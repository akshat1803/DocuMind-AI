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
      messages: { orderBy: { createdAt: 'asc' }, include: { citations: { orderBy: { citationNumber: 'asc' } } } },
    },
  });
  if (!conversation) return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' } });
  return res.json({ conversation });
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
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Question must be between 1 and 4000 characters.' } });

  const conversation = await prisma.conversation.findFirst({
    where: { id: req.params.conversationId, userId: req.userId },
    include: { documents: { select: { documentId: true } } },
  });
  if (!conversation) return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' } });

  const [, assistantMessage] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conversation.id, role: 'USER', content: parsed.data.question, status: 'COMPLETED' } }),
    prisma.message.create({ data: { conversationId: conversation.id, role: 'ASSISTANT', content: '', status: 'STREAMING' } }),
    prisma.conversation.update({ where: { id: conversation.id }, data: conversation.title === 'New conversation' ? { title: parsed.data.question.slice(0, 80) } : {} }),
  ]);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const abortController = new AbortController();
  res.on('close', () => { if (!res.writableEnded) abortController.abort(); });
  const startedAt = Date.now();

  try {
    const chunks = await retrievalService.retrieve(req.userId!, conversation.documents.map((item) => item.documentId), parsed.data.question);
    let answer = '';
    if (chunks.length === 0 || chunks[0].similarityScore < 0.25) {
      answer = 'The selected documents do not contain enough information to answer that question.';
      send('chunk', { text: answer });
    } else {
      const prompt = buildGroundedPrompt(parsed.data.question, chunks);
      for await (const text of aiService.streamGroundedAnswer(prompt, abortController.signal)) {
        answer += text;
        send('chunk', { text });
      }
    }

    const citationNumbers = parseCitationNumbers(answer, chunks.length);
    await prisma.$transaction(async (tx) => {
      await tx.message.update({
        where: { id: assistantMessage.id },
        data: { content: answer, status: 'COMPLETED', latencyMs: Date.now() - startedAt },
      });
      if (citationNumbers.valid.length > 0) {
        await tx.messageCitation.createMany({
          data: citationNumbers.valid.map((citationNumber) => {
            const chunk = chunks[citationNumber - 1];
            return {
              messageId: assistantMessage.id,
              chunkId: chunk.id,
              citationNumber,
              excerpt: chunk.content.slice(0, 600),
              similarityScore: chunk.similarityScore,
            };
          }),
        });
      }
    });
    send('done', { messageId: assistantMessage.id, citations: citationNumbers.valid, invalidCitations: citationNumbers.invalid });
    res.end();
  } catch (error) {
    await prisma.message.updateMany({ where: { id: assistantMessage.id }, data: { status: 'FAILED', latencyMs: Date.now() - startedAt } });
    send('error', { code: 'CHAT_GENERATION_FAILED', message: 'The answer could not be generated.' });
    res.end();
    console.error('Chat generation failed:', error);
  }
}));

export const chatRouter = router;
