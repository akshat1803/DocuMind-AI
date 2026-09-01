import { aiService, EmbeddingProvider } from '../ai/ai.service.js';
import { prisma } from '../../shared/db.js';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  similarityScore: number;
}

interface RetrievalDatabase {
  document: {
    count(args: unknown): Promise<number>;
  };
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
}

export class RetrievalService {
  constructor(
    private readonly embeddings: EmbeddingProvider = aiService,
    private readonly database: RetrievalDatabase = prisma,
  ) {}

  async retrieve(userId: string, documentIds: string[], question: string, limit = 8): Promise<RetrievedChunk[]> {
    const uniqueDocumentIds = [...new Set(documentIds)];
    if (uniqueDocumentIds.length === 0) throw new Error('DOCUMENTS_REQUIRED');
    if (!question.trim()) throw new Error('QUESTION_REQUIRED');
    const boundedLimit = Math.min(Math.max(limit, 1), 20);

    const ownedReadyCount = await this.database.document.count({
      where: { id: { in: uniqueDocumentIds }, userId, status: 'READY' },
    });
    if (ownedReadyCount !== uniqueDocumentIds.length) throw new Error('DOCUMENT_ACCESS_DENIED');

    const queryVector = await this.embeddings.embedQuery(question.trim());
    const rows = await this.database.$queryRawUnsafe<Array<{
      id: string;
      document_id: string;
      document_name: string;
      content: string;
      page_start: number | null;
      page_end: number | null;
      similarity_score: number;
    }>>(
      `SELECT dc.id,
              dc.document_id,
              d.original_name AS document_name,
              dc.content,
              dc.page_start,
              dc.page_end,
              (1 - (dc.embedding <=> $1::vector))::double precision AS similarity_score
         FROM document_chunks dc
         JOIN documents d ON d.id = dc.document_id
        WHERE d.user_id = $2::uuid
          AND dc.document_id = ANY($3::uuid[])
          AND dc.embedding IS NOT NULL
        ORDER BY similarity_score DESC
        LIMIT $4`,
      JSON.stringify(queryVector),
      userId,
      uniqueDocumentIds,
      boundedLimit,
    );

    return rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      documentName: row.document_name,
      content: row.content,
      pageStart: row.page_start,
      pageEnd: row.page_end,
      similarityScore: row.similarity_score,
    }));
  }
}

export const retrievalService = new RetrievalService();
