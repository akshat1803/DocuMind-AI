import { prisma } from '../../shared/db.js';

export class GenerationConflict extends Error {
  constructor(public readonly code: string, public readonly statusCode = 409) { super(code); }
}

export async function claimGeneration(userId: string, conversationId: string, question: string, requestId: string, retryMessageId?: string) {
  return prisma.$transaction(async (tx) => {
    // Serialize submissions for this conversation across API processes.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${conversationId}))::text`;
    const conversation = await tx.conversation.findFirst({ where: { id: conversationId, userId }, include: { documents: true } });
    if (!conversation) throw new GenerationConflict('CONVERSATION_NOT_FOUND', 404);
    const duplicate = await tx.message.findUnique({ where: { requestId } });
    if (duplicate) {
      if (duplicate.conversationId !== conversationId) throw new GenerationConflict('REQUEST_ID_CONFLICT');
      const original = duplicate.replyToId ? await tx.message.findUnique({ where: { id: duplicate.replyToId } }) : null;
      if (original?.content !== question) throw new GenerationConflict('REQUEST_ID_CONFLICT');
      if (duplicate.status === 'STREAMING') throw new GenerationConflict('GENERATION_IN_PROGRESS');
      return { message: duplicate, documentIds: [], replay: true };
    }
    await tx.message.updateMany({ where: { conversationId, status: 'STREAMING', createdAt: { lt: new Date(Date.now() - 180_000) } }, data: { status: 'FAILED', errorCode: 'GENERATION_INTERRUPTED' } });
    if (await tx.message.count({ where: { conversationId, status: 'STREAMING' } })) throw new GenerationConflict('GENERATION_IN_PROGRESS');
    const documentIds = conversation.documents.map((item) => item.documentId);
    if (!documentIds.length || await tx.document.count({ where: { id: { in: documentIds }, userId, status: 'READY' } }) !== documentIds.length) {
      throw new GenerationConflict('DOCUMENT_ACCESS_DENIED', 403);
    }
    let replyToId: string;
    if (retryMessageId) {
      const previous = await tx.message.findFirst({ where: { id: retryMessageId, conversationId, role: 'ASSISTANT', status: { in: ['FAILED', 'CANCELLED'] } }, include: { replyTo: true } });
      if (!previous?.replyTo || previous.replyTo.content !== question) throw new GenerationConflict('INVALID_RETRY', 400);
      replyToId = previous.replyTo.id;
    } else {
      const userMessage = await tx.message.create({ data: { conversationId, role: 'USER', content: question, status: 'COMPLETED' } });
      replyToId = userMessage.id;
    }
    const message = await tx.message.create({ data: { conversationId, role: 'ASSISTANT', content: '', status: 'STREAMING', replyToId, requestId } });
    await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date(), ...(conversation.title === 'New conversation' ? { title: question.slice(0, 80) } : {}) } });
    return { message, documentIds, replay: false };
  });
}
