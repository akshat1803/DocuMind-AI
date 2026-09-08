import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { prisma } from '../../shared/db.js';

export const PROCESSING_QUEUE = 'documind-processing';
export interface ProcessingPayload { processingJobId: string }

let queue: Queue<ProcessingPayload> | undefined;

function getQueue(): Queue<ProcessingPayload> | undefined {
  if (!env.REDIS_URL) return undefined;
  queue ??= new Queue<ProcessingPayload>(PROCESSING_QUEUE, { connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) });
  return queue;
}

export async function queueDocumentIngestion(userId: string, documentId: string): Promise<string> {
  const job = await prisma.processingJob.create({ data: { userId, documentId, kind: 'INGEST_DOCUMENT' } });
  const workQueue = getQueue();
  if (workQueue) await workQueue.add('process', { processingJobId: job.id }, { jobId: job.id, attempts: 3, backoff: { type: 'exponential', delay: 2_000 }, removeOnComplete: 1000, removeOnFail: 1000 });
  return job.id;
}

export async function queueArtifactGeneration(userId: string, artifactId: string): Promise<string> {
  const job = await prisma.processingJob.create({ data: { userId, artifactId, kind: 'GENERATE_STUDY' } });
  const workQueue = getQueue();
  if (workQueue) await workQueue.add('process', { processingJobId: job.id }, { jobId: job.id, attempts: 3, backoff: { type: 'exponential', delay: 2_000 }, removeOnComplete: 1000, removeOnFail: 1000 });
  return job.id;
}

export async function recoverQueuedProcessing(): Promise<void> {
  const workQueue = getQueue();
  if (!workQueue) return;
  const jobs = await prisma.processingJob.findMany({ where: { status: 'QUEUED' }, select: { id: true } });
  await Promise.all(jobs.map((job) => workQueue.add('process', { processingJobId: job.id }, { jobId: job.id, attempts: 3, backoff: { type: 'exponential', delay: 2_000 }, removeOnComplete: 1000, removeOnFail: 1000 }).catch(() => undefined)));
}
