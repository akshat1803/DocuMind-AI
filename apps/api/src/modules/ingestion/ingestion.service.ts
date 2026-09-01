import { createHash, randomUUID } from 'crypto';
import { aiService, EmbeddingProvider } from '../ai/ai.service.js';
import { prisma } from '../../shared/db.js';
import { chunkPages } from './chunking.js';
import { extractPdfPages } from './pdf.service.js';

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;

function safeFailureCode(error: unknown): string {
  if (error instanceof Error && error.message === 'PDF_HAS_NO_EXTRACTABLE_TEXT') return 'NO_EXTRACTABLE_TEXT';
  if (error instanceof Error && error.message.includes('EMBEDDING')) return 'EMBEDDING_FAILED';
  return 'PROCESSING_FAILED';
}

export class IngestionService {
  constructor(
    private readonly embeddings: EmbeddingProvider = aiService,
    private readonly database = prisma,
  ) {}

  async ingestDocument(documentId: string, pdfBuffer: Buffer): Promise<void> {
    const claimed = await this.database.document.updateMany({
      where: { id: documentId, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PROCESSING', errorCode: null },
    });
    if (claimed.count !== 1) return;

    try {
      const pages = await extractPdfPages(pdfBuffer);
      const chunks = chunkPages(pages, CHUNK_SIZE, CHUNK_OVERLAP);
      if (chunks.length === 0) throw new Error('PDF_HAS_NO_EXTRACTABLE_TEXT');
      const vectors = await this.embeddings.embedDocuments(chunks.map((chunk) => chunk.content));

      await this.database.$transaction(async (tx) => {
        await tx.documentChunk.deleteMany({ where: { documentId } });
        for (let index = 0; index < chunks.length; index += 1) {
          const chunk = chunks[index];
          const vector = vectors[index];
          const id = randomUUID();
          const contentHash = createHash('sha256').update(chunk.content).digest('hex');
          await tx.$executeRaw`
            INSERT INTO "document_chunks"
              ("id", "document_id", "chunk_index", "content", "page_start", "page_end", "token_count", "embedding", "content_hash")
            VALUES
              (${id}::uuid, ${documentId}::uuid, ${index}, ${chunk.content}, ${chunk.pageStart}, ${chunk.pageEnd}, ${chunk.tokenCount}, ${JSON.stringify(vector)}::vector, ${contentHash})
          `;
        }
        await tx.document.update({
          where: { id: documentId },
          data: { status: 'READY', pageCount: pages.length, processedAt: new Date(), errorCode: null },
        });
      });
    } catch (error) {
      await this.database.document.updateMany({
        where: { id: documentId },
        data: { status: 'FAILED', errorCode: safeFailureCode(error) },
      });
      throw error;
    }
  }
}

export const ingestionService = new IngestionService();
