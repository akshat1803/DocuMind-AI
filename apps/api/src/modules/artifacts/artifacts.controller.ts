import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { ArtifactRequestSchema, BookmarkInputSchema, NoteInputSchema, QuizAttemptInputSchema } from '@documind/shared';
import { env } from '../../config/env.js';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../shared/db.js';
import { aiService } from '../ai/ai.service.js';
import { queueArtifactGeneration } from '../ingestion/processing-queue.js';

const router = Router();
const asyncRoute = (handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>): RequestHandler => (req: Request, res: Response, next: NextFunction) => { void handler(req as AuthenticatedRequest, res).catch(next); };
router.use(authMiddleware);

router.get('/', asyncRoute(async (req, res) => {
  const artifacts = await prisma.analysisArtifact.findMany({ where: { userId: req.userId }, orderBy: { updatedAt: 'desc' }, include: { sources: { include: { document: { select: { id: true, originalName: true } } } } } });
  return res.json({ artifacts });
}));

async function processArtifactInProcess(artifactId: string) {
  try {
    await prisma.analysisArtifact.update({ where: { id: artifactId }, data: { status: 'GENERATING' } });
    const artifact = await prisma.analysisArtifact.findUnique({
      where: { id: artifactId },
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
    });
    if (!artifact) return;
    const evidence = artifact.sources.flatMap(({ document }) => document.chunks.map((chunk) => ({ documentName: document.originalName, ...chunk }))).slice(0, 20);
    if (!evidence.length) {
      await prisma.analysisArtifact.update({ where: { id: artifactId }, data: { status: 'FAILED', errorCode: 'NO_EVIDENCE' } });
      return;
    }
    const evidenceText = evidence.map((item) => `[${item.documentName} p.${item.pageStart ?? 1}]: ${item.content}`).join('\n\n');
    const keyPoints = evidence.slice(0, 8).map((chunk) => ({ text: chunk.content.slice(0, 360), documentName: chunk.documentName, pageStart: chunk.pageStart, pageEnd: chunk.pageEnd }));
    const aiOutput = await aiService.generateStructuredArtifact(artifact.kind, evidenceText);
    const fallback = artifact.kind === 'OVERVIEW' ? { overview: keyPoints.map((point) => point.text).join('\n\n'), keyPoints, suggestedQuestions: ['What is the central argument of this document?', 'What are the main key points?', 'What methodology or evidence is presented?'] }
      : artifact.kind === 'FLASHCARDS' ? { cards: keyPoints.slice(0, 10).map((point, index) => ({ id: index + 1, front: `What does this document detail regarding item ${index + 1}?`, back: point.text })) }
        : artifact.kind === 'QUIZ' ? { questions: keyPoints.slice(0, 5).map((point, index) => ({ id: index + 1, question: `Which claim is supported by section ${index + 1}?`, options: [point.text, 'This information is not stated.', 'An alternative claim.', 'An unverified hypothesis.'], correctIndex: 0, explanation: point.text })) }
          : { items: keyPoints };
    const result = Object.keys(aiOutput).length > 0 ? { ...fallback, ...aiOutput } : fallback;
    await prisma.analysisArtifact.update({ where: { id: artifactId }, data: { status: 'READY', result } });
  } catch (_error) {
    await prisma.analysisArtifact.update({ where: { id: artifactId }, data: { status: 'FAILED', errorCode: 'GENERATION_FAILED' } }).catch(() => undefined);
  }
}

router.post('/', asyncRoute(async (req, res) => {
  const parsed = ArtifactRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Choose ready documents and a supported study action.' } });
  const documentIds = [...new Set(parsed.data.documentIds)];
  const owned = await prisma.document.count({ where: { id: { in: documentIds }, userId: req.userId, status: 'READY' } });
  if (owned !== documentIds.length) return res.status(403).json({ error: { code: 'DOCUMENT_ACCESS_DENIED', message: 'One or more selected documents are unavailable.' } });
  const artifact = await prisma.analysisArtifact.create({ data: { userId: req.userId!, kind: parsed.data.kind, configuration: JSON.parse(JSON.stringify(parsed.data.configuration)), sources: { create: documentIds.map((documentId) => ({ documentId })) } }, include: { sources: true } });
  const processingJobId = await queueArtifactGeneration(req.userId!, artifact.id);
  if (!env.REDIS_URL) {
    void processArtifactInProcess(artifact.id)
      .then(() => prisma.processingJob.update({ where: { id: processingJobId }, data: { status: 'COMPLETED' } }))
      .catch(() => prisma.processingJob.update({ where: { id: processingJobId }, data: { status: 'FAILED' } }));
  }
  return res.status(202).json({ artifact });
}));

router.get('/notes', asyncRoute(async (req, res) => res.json({ notes: await prisma.note.findMany({ where: { userId: req.userId }, orderBy: { updatedAt: 'desc' } }) })));
router.post('/notes', asyncRoute(async (req, res) => { const parsed = NoteInputSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A note needs content.' } }); const note = await prisma.note.create({ data: { userId: req.userId!, ...parsed.data } }); return res.status(201).json({ note }); }));
router.get('/bookmarks', asyncRoute(async (req, res) => res.json({ bookmarks: await prisma.bookmark.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } }) })));
router.post('/bookmarks', asyncRoute(async (req, res) => { const parsed = BookmarkInputSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Bookmark details are invalid.' } }); const bookmark = await prisma.bookmark.create({ data: { userId: req.userId!, ...parsed.data } }); return res.status(201).json({ bookmark }); }));
router.post('/:artifactId/attempts', asyncRoute(async (req, res) => { const parsed = QuizAttemptInputSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Quiz answers are invalid.' } }); const artifact = await prisma.analysisArtifact.findFirst({ where: { id: req.params.artifactId, userId: req.userId, kind: 'QUIZ', status: 'READY' } }); if (!artifact) return res.status(404).json({ error: { code: 'QUIZ_NOT_FOUND', message: 'Quiz not found.' } }); const attempt = await prisma.quizAttempt.create({ data: { artifactId: artifact.id, userId: req.userId!, score: parsed.data.score, answers: parsed.data.answers } }); return res.status(201).json({ attempt }); }));

export const artifactsRouter = router;
