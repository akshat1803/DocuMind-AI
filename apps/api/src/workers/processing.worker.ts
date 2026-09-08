import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { ingestionService } from '../modules/ingestion/ingestion.service.js';
import { PROCESSING_QUEUE, recoverQueuedProcessing, type ProcessingPayload } from '../modules/ingestion/processing-queue.js';
import { getDocumentStorage } from '../modules/documents/storage.service.js';
import { prisma } from '../shared/db.js';

import { aiService } from '../modules/ai/ai.service.js';

if (!env.REDIS_URL) throw new Error('REDIS_URL is required to start the processing worker.');

const worker = new Worker<ProcessingPayload>(PROCESSING_QUEUE, async (queueJob) => {
  const claimed = await prisma.processingJob.updateMany({ where: { id: queueJob.data.processingJobId, OR: [{ status: 'QUEUED' }, { status: 'RUNNING', leaseUntil: { lt: new Date() } }] }, data: { status: 'RUNNING', attempts: { increment: 1 }, leaseUntil: new Date(Date.now() + 5 * 60_000), errorCode: null } });
  if (claimed.count !== 1) return;
  const processingJob = await prisma.processingJob.findUnique({
    where: { id: queueJob.data.processingJobId },
    include: {
      document: true,
      artifact: {
        include: {
          sources: {
            include: {
              document: {
                select: {
                  originalName: true,
                  chunks: { select: { content: true, pageStart: true, pageEnd: true }, take: 12, orderBy: { chunkIndex: 'asc' } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!processingJob) return;
  try {
    if (processingJob.kind === 'INGEST_DOCUMENT' && processingJob.document) {
      const buffer = await getDocumentStorage().downloadPdf(processingJob.document.storageKey);
      await ingestionService.ingestDocument(processingJob.document.id, buffer);
    } else if (processingJob.kind === 'GENERATE_STUDY' && processingJob.artifact) {
      await prisma.analysisArtifact.update({ where: { id: processingJob.artifact.id }, data: { status: 'GENERATING', errorCode: null } });
      const evidence = processingJob.artifact.sources.flatMap(({ document }) => document.chunks.map((chunk) => ({ documentName: document.originalName, ...chunk }))).slice(0, 20);
      if (!evidence.length) throw new Error('ARTIFACT_SOURCE_UNAVAILABLE');
      const evidenceText = evidence.map((item) => `[${item.documentName} p.${item.pageStart ?? 1}]: ${item.content}`).join('\n\n');
      const keyPoints = evidence.slice(0, 8).map((chunk) => ({ text: chunk.content.slice(0, 360), documentName: chunk.documentName, pageStart: chunk.pageStart, pageEnd: chunk.pageEnd }));
      const aiOutput = await aiService.generateStructuredArtifact(processingJob.artifact.kind, evidenceText);
      const fallback = processingJob.artifact.kind === 'OVERVIEW' ? { overview: keyPoints.map((point) => point.text).join('\n\n'), keyPoints, suggestedQuestions: ['What is the central argument?', 'Which evidence is most important?', 'What should I review next?'] }
        : processingJob.artifact.kind === 'FLASHCARDS' ? { cards: keyPoints.slice(0, 10).map((point, index) => ({ id: index + 1, front: `What does this source explain about point ${index + 1}?`, back: point.text, source: { documentName: point.documentName, pageStart: point.pageStart, pageEnd: point.pageEnd } })) }
          : processingJob.artifact.kind === 'QUIZ' ? { questions: keyPoints.slice(0, 5).map((point, index) => ({ id: index + 1, question: `Which statement is supported by source ${index + 1}?`, options: [point.text, 'The source does not provide this information.', 'A claim from a different document.', 'An unsupported conclusion.'], correctIndex: 0, explanation: point.text, source: { documentName: point.documentName, pageStart: point.pageStart, pageEnd: point.pageEnd } })) }
            : { items: keyPoints, note: 'Generated from the document’s extracted sections.' };
      const result = Object.keys(aiOutput).length > 0 ? { ...fallback, ...aiOutput } : fallback;
      await prisma.analysisArtifact.update({ where: { id: processingJob.artifact.id }, data: { status: 'READY', result } });
    } else return;
    await prisma.processingJob.updateMany({ where: { id: processingJob.id, status: 'RUNNING' }, data: { status: 'COMPLETED', leaseUntil: null } });
  } catch (error) {
    const retryable = processingJob.attempts + 1 < processingJob.maxAttempts;
    await prisma.processingJob.updateMany({ where: { id: processingJob.id, status: 'RUNNING' }, data: { status: retryable ? 'QUEUED' : 'FAILED', leaseUntil: null, errorCode: 'PROCESSING_FAILED' } });
    if (processingJob.artifactId && !retryable) await prisma.analysisArtifact.updateMany({ where: { id: processingJob.artifactId, status: { in: ['QUEUED', 'GENERATING'] } }, data: { status: 'FAILED', errorCode: 'GENERATION_FAILED' } });
    throw error;
  }
}, { connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }), concurrency: env.WORKER_CONCURRENCY });

void recoverQueuedProcessing();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void worker.close().finally(() => prisma.$disconnect()));
