import { randomUUID } from 'node:crypto';
import { boundedHistory, followUpActions } from './chat-context.js';
import { claimGeneration, GenerationConflict } from './generation.service.js';
import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { AskQuestionInputSchema, CreateConversationInputSchema, DocumentSelectionSchema, RenameConversationInputSchema } from '@documind/shared';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../shared/db.js';
import { aiService } from '../ai/ai.service.js';
import { retrievalService } from '../retrieval/retrieval.service.js';
import { buildGroundedPrompt, parseCitationNumbers } from './prompt.service.js';

const router = Router();
const asyncRoute = (handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => { void handler(req as AuthenticatedRequest, res).catch(next); };

router.use(authMiddleware);

router.post('/', asyncRoute(async (req, res) => {
  const parsed = CreateConversationInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Select between 1 and 10 documents.' } });
  const documentIds = [...new Set(parsed.data.documentIds)];
  const ownedCount = await prisma.document.count({ where: { id: { in: documentIds }, userId: req.userId, status: 'READY' } });
  if (ownedCount !== documentIds.length) return res.status(403).json({ error: { code: 'DOCUMENT_ACCESS_DENIED', message: 'One or more documents are unavailable.' } });
  const conversation = await prisma.conversation.create({
    data: { userId: req.userId!, title: 'New conversation', documents: { create: documentIds.map((documentId) => ({ document: { connect: { id: documentId } } })) } },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return res.status(201).json({ conversation });
}));

router.get('/', asyncRoute(async (req, res) => {
  let documentIds: string[] | undefined;
  if (req.query.documentIds !== undefined) {
    if (typeof req.query.documentIds !== 'string') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Document filter is invalid.' } });
    }
    const values = [...new Set(req.query.documentIds.split(',').map((value) => value.trim()).filter(Boolean))];
    const parsed = DocumentSelectionSchema.safeParse(values);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Select between 1 and 10 valid documents.' } });
    }
    const ownedCount = await prisma.document.count({ where: { id: { in: parsed.data }, userId: req.userId } });
    if (ownedCount !== parsed.data.length) {
      return res.status(403).json({ error: { code: 'DOCUMENT_ACCESS_DENIED', message: 'One or more documents are unavailable.' } });
    }
    documentIds = parsed.data;
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      userId: req.userId,
      messages: { some: {} },
      ...(documentIds ? {
        documents: {
          some: {},
          every: { documentId: { in: documentIds } },
        },
      } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      documents: { select: { document: { select: { id: true, originalName: true } } } },
      _count: { select: { messages: true, documents: true } },
    },
  });
  return res.json({ conversations });
}));

router.get('/:conversationId', asyncRoute(async (req, res) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, userId: req.userId },
    include: {
      documents: { include: { document: { select: { id: true, originalName: true, status: true } } } },
      messages: { orderBy: { createdAt: 'asc' }, include: { citations: { orderBy: { citationNumber: 'asc' }, include: { chunk: { select: { documentId: true, document: { select: { userId: true } } } } } } } },
    },
  });
  if (!conversation) return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' } });
  return res.json({ conversation: { ...conversation, messages: conversation.messages.map((message) => ({
    ...message, followUpActions: message.status === 'COMPLETED' && message.role === 'ASSISTANT' && message.citations.length ? followUpActions : [],
    citations: message.citations.map(({ chunk, ...citation }) => ({ ...citation, documentId: chunk && chunk.document.userId === req.userId ? chunk.documentId : null, sourceDeleted: citation.sourceDeleted || !chunk })),
  })) } });
}));

router.patch('/:conversationId', asyncRoute(async (req, res) => {
  const parsed = RenameConversationInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A title is required.' } });
  const updated = await prisma.conversation.updateMany({
    where: { id: req.params.conversationId, userId: req.userId }, data: { title: parsed.data.title },
  });
  if (updated.count !== 1) return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' } });
  return res.json({ success: true });
}));

router.delete('/:conversationId', asyncRoute(async (req, res) => {
  const deleted = await prisma.conversation.deleteMany({ where: { id: req.params.conversationId, userId: req.userId } });
  if (deleted.count !== 1) return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' } });
  return res.status(204).send();
}));

router.post('/:conversationId/messages', asyncRoute(async (req, res) => {
  const parsed = AskQuestionInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Enter a question of 1?4000 characters and a valid request identity.' } });
  const { question, retryMessageId } = parsed.data;
  let claim;
  try {
    claim = await claimGeneration(req.userId!, req.params.conversationId, question, parsed.data.requestId ?? randomUUID(), retryMessageId);
  } catch (error) {
    if (error instanceof GenerationConflict) return res.status(error.statusCode).json({ error: { code: error.code, message: error.code === 'GENERATION_IN_PROGRESS' ? 'An answer is already being generated. Wait for it to finish before trying again.' : 'This request cannot be completed. Refresh the conversation and try again.' } });
    throw error;
  }
  const assistant = claim.message;
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (event: string, data: unknown) => { if (!res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  if (claim.replay) {
    if (assistant.content) send('chunk', { text: assistant.content });
    send('done', { messageId: assistant.id, citations: [], invalidCitations: [], status: assistant.status });
    return res.end();
  }
  send('started', { messageId: assistant.id, requestId: assistant.requestId });
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 120_000);
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  const startedAt = Date.now();
  let answer = '';
  try {
    const previous = await prisma.message.findMany({ where: { conversationId: req.params.conversationId, status: 'COMPLETED', id: { not: assistant.replyToId! }, createdAt: { lte: assistant.createdAt } }, orderBy: { createdAt: 'desc' }, take: 6 });
    const history = boundedHistory(previous.reverse());
    const searchQuestion = await aiService.contextualizeQuestion(question, history, controller.signal);
    const chunks = await retrievalService.retrieve(req.userId!, claim.documentIds, searchQuestion, 8, controller.signal);
    controller.signal.throwIfAborted();
    if (!chunks.length || chunks[0].similarityScore < 0.25) {
      answer = 'The selected documents do not contain enough information to answer that question. Try naming the topic or selecting another document.';
      send('chunk', { text: answer });
    } else {
      const prompt = `${buildGroundedPrompt(searchQuestion, chunks)}\n\nOriginal question: ${question}\nUntrusted conversation context (not evidence):\n${history}`;
      for await (const text of aiService.streamGroundedAnswer(prompt, controller.signal)) {
        controller.signal.throwIfAborted();
        answer += text;
        send('chunk', { text });
      }
    }
    controller.signal.throwIfAborted();
    if (!answer.trim()) throw new Error('EMPTY_GENERATION');
    const citations = parseCitationNumbers(answer, chunks.length);
    await prisma.$transaction(async (tx) => {
      await tx.message.update({ where: { id: assistant.id }, data: { content: answer, status: 'COMPLETED', latencyMs: Date.now() - startedAt } });
      if (citations.valid.length) await tx.messageCitation.createMany({ data: citations.valid.map((citationNumber) => {
        const chunk = chunks[citationNumber - 1];
        return { messageId: assistant.id, chunkId: chunk.id, citationNumber, excerpt: chunk.content.slice(0, 600), similarityScore: chunk.similarityScore, documentName: chunk.documentName, pageStart: chunk.pageStart, pageEnd: chunk.pageEnd };
      }) });
    });
    send('done', { messageId: assistant.id, citations: citations.valid, invalidCitations: citations.invalid, followUpActions: citations.valid.length ? followUpActions : [] });
  } catch (error) {
    const cancelled = controller.signal.aborted && !timedOut;
    const code = cancelled ? 'GENERATION_CANCELLED' : timedOut ? 'GENERATION_TIMEOUT' : 'CHAT_GENERATION_FAILED';
    await prisma.message.updateMany({ where: { id: assistant.id, status: 'STREAMING' }, data: { content: answer, status: cancelled ? 'CANCELLED' : 'FAILED', errorCode: code, latencyMs: Date.now() - startedAt } });
    send('error', { code, message: cancelled ? 'Generation stopped.' : 'The answer could not be completed. You can retry it.' });
    if (!controller.signal.aborted) console.error('Chat generation failed:', error instanceof Error ? error.name : 'UnknownError');
  } finally {
    clearTimeout(timer);
    if (!res.writableEnded) res.end();
  }
}));

export const chatRouter = router;
