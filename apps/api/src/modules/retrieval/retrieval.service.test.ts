import { describe, expect, it, vi } from 'vitest';
import { RetrievalService } from './retrieval.service.js';

const embeddings = {
  embedDocuments: vi.fn(),
  embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
};

describe('owner-filtered retrieval', () => {
  it('rejects selected documents that are not ready and owned', async () => {
    const database = {
      document: { count: vi.fn().mockResolvedValue(1) },
      $queryRawUnsafe: vi.fn(),
    };
    const service = new RetrievalService(embeddings, database);
    await expect(service.retrieve('user-1', ['doc-1', 'doc-2'], 'question')).rejects.toThrow('DOCUMENT_ACCESS_DENIED');
    expect(embeddings.embedQuery).not.toHaveBeenCalled();
  });

  it('maps ranked database results after embedding the query', async () => {
    const database = {
      document: { count: vi.fn().mockResolvedValue(1) },
      $queryRawUnsafe: vi.fn().mockResolvedValue([{
        id: 'chunk-1', document_id: 'doc-1', document_name: 'guide.pdf', content: 'Grounded passage',
        page_start: 2, page_end: 3, similarity_score: 0.91,
      }]),
    };
    const service = new RetrievalService(embeddings, database);
    const result = await service.retrieve('user-1', ['doc-1'], 'What is covered?');
    expect(result[0]).toMatchObject({ documentId: 'doc-1', documentName: 'guide.pdf', pageStart: 2, similarityScore: 0.91 });
    expect(database.$queryRawUnsafe).toHaveBeenCalledOnce();
  });
});
