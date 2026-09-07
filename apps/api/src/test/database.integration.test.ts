import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../shared/db.js';
import { RetrievalService } from '../modules/retrieval/retrieval.service.js';
import { generateAccessToken } from '../modules/auth/auth.utils.js';
import { app } from '../app.js';

// These tests exercise real SQL and HTTP handlers, never paid providers.
vi.mock('../modules/ai/ai.service.js', () => ({
  aiService: { embedDocuments: vi.fn(), embedQuery: vi.fn(), streamGroundedAnswer: vi.fn() },
}));
vi.mock('../modules/documents/storage.service.js', () => ({ getDocumentStorage: vi.fn() }));

const ownerId = randomUUID();
const otherId = randomUUID();
const selectedId = randomUUID();
const unselectedId = randomUUID();
const foreignId = randomUUID();
const pendingId = randomUUID();
const firstChunkId = randomUUID();
const secondChunkId = randomUUID();
const vector = (first: number, second = 0) => [first, second, ...Array<number>(766).fill(0)];
const embeddings = { embedDocuments: vi.fn(), embedQuery: vi.fn().mockResolvedValue(vector(1)) };
const retrieval = new RetrievalService(embeddings, prisma);

async function insertChunk(id: string, documentId: string, index: number, values: number[]) {
  await prisma.$executeRaw`
    INSERT INTO document_chunks
      (id, document_id, chunk_index, content, page_start, page_end, token_count, embedding, content_hash)
    VALUES (${id}::uuid, ${documentId}::uuid, ${index}, ${'Synthetic passage'}, 2, 3, 2, ${JSON.stringify(values)}::vector, ${id})
  `;
}

beforeAll(async () => {
  await prisma.user.createMany({ data: [ownerId, otherId].map((id) => ({
    id, name: 'Integration fixture', email: `${id}@example.test`, passwordHash: 'unused-test-hash',
  })) });
  await prisma.document.createMany({ data: [selectedId, unselectedId, foreignId, pendingId].map((id) => ({
    id, userId: id === foreignId ? otherId : ownerId, originalName: `${id}.pdf`,
    storageKey: `test/${id}`, mimeType: 'application/pdf', sizeBytes: 100n,
    status: id === pendingId ? 'PENDING' as const : 'READY' as const,
  })) });
  await insertChunk(firstChunkId, selectedId, 0, vector(1));
  await insertChunk(secondChunkId, selectedId, 1, vector(0, 1));
  await insertChunk(randomUUID(), unselectedId, 0, vector(1));
  await insertChunk(randomUUID(), foreignId, 0, vector(1));
});

afterAll(async () => {
  try { await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } }); }
  finally { await prisma.$disconnect(); }
});

describe('migrated PostgreSQL and pgvector', () => {
  it('installs vector and the cosine HNSW index from committed migrations', async () => {
    const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    expect(extensions).toHaveLength(1);
    const indexes = await prisma.$queryRaw<Array<{ indexdef: string }>>`SELECT indexdef FROM pg_indexes WHERE tablename = 'document_chunks'`;
    expect(indexes.some(({ indexdef }) => indexdef.includes('USING hnsw') && indexdef.includes('vector_cosine_ops'))).toBe(true);
  });

  it('ranks vectors and returns page metadata only from the selected owned document', async () => {
    const results = await retrieval.retrieve(ownerId, [selectedId], 'Synthetic query');
    expect(results.map(({ id }) => id)).toEqual([firstChunkId, secondChunkId]);
    expect(results[0]).toMatchObject({ documentId: selectedId, documentName: `${selectedId}.pdf`, pageStart: 2, pageEnd: 3 });
    expect(results[0].similarityScore).toBeCloseTo(1);
    expect(results[1].similarityScore).toBeCloseTo(0);
  });

  it('rejects foreign or pending document selections before embedding', async () => {
    embeddings.embedQuery.mockClear();
    await expect(retrieval.retrieve(ownerId, [selectedId, foreignId], 'query')).rejects.toThrow('DOCUMENT_ACCESS_DENIED');
    await expect(retrieval.retrieve(ownerId, [pendingId], 'query')).rejects.toThrow('DOCUMENT_ACCESS_DENIED');
    expect(embeddings.embedQuery).not.toHaveBeenCalled();
  });

  it('enforces unique chunk ordering in the database', async () => {
    await expect(prisma.documentChunk.create({ data: {
      documentId: selectedId, chunkIndex: 0, content: 'Duplicate', tokenCount: 1, contentHash: 'duplicate',
    } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('serves readiness and enforces document ownership through the API', async () => {
    expect((await request(app).get('/api/v1/health/ready')).status).toBe(200);
    const token = generateAccessToken(ownerId);
    const documents = await request(app).get('/api/v1/documents').auth(token, { type: 'bearer' });
    expect(documents.status).toBe(200);
    expect(documents.body.documents).toHaveLength(3);
    expect(documents.body.documents.some((item: { id: string }) => item.id === foreignId)).toBe(false);
    const source = await request(app).get(`/api/v1/documents/${foreignId}/source`).auth(token, { type: 'bearer' });
    expect(source.status).toBe(404);
  });

  it('cascades deleted document evidence while retaining saved messages', async () => {
    const document = await prisma.document.create({ data: {
      userId: ownerId, originalName: 'deleted.pdf', storageKey: `test/${randomUUID()}`,
      mimeType: 'application/pdf', sizeBytes: 100n, status: 'READY',
    } });
    const chunk = await prisma.documentChunk.create({ data: {
      documentId: document.id, chunkIndex: 0, content: 'Evidence', tokenCount: 1, contentHash: 'fixture',
    } });
    const conversation = await prisma.conversation.create({ data: {
      userId: ownerId, title: 'Cascade fixture', documents: { create: { documentId: document.id } },
      messages: { create: { role: 'ASSISTANT', content: 'Saved answer [1]', citations: {
        create: { chunkId: chunk.id, citationNumber: 1, excerpt: 'Evidence' },
      } } },
    } });
    await prisma.document.delete({ where: { id: document.id } });
    expect(await prisma.documentChunk.count({ where: { documentId: document.id } })).toBe(0);
    expect(await prisma.messageCitation.count({ where: { chunkId: chunk.id } })).toBe(0);
    expect(await prisma.conversationDocument.count({ where: { documentId: document.id } })).toBe(0);
    expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(1);
  });
});
