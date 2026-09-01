import { NextFunction, Request, RequestHandler, Router, Response } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../shared/db.js';
import { ingestionService } from '../ingestion/ingestion.service.js';
import { getDocumentStorage } from './storage.service.js';

const router = Router();
const asyncRoute = (
  handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>,
): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  void handler(req as AuthenticatedRequest, res).catch(next);
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const isPdf = file.mimetype === 'application/pdf' && file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      callback(new Error('INVALID_PDF_TYPE'));
      return;
    }
    callback(null, true);
  },
});

router.use(authMiddleware);

router.post('/', upload.single('file'), asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file || !req.userId) {
    return res.status(400).json({ error: { code: 'PDF_REQUIRED', message: 'A PDF file is required.' } });
  }
  if (req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return res.status(400).json({ error: { code: 'INVALID_PDF_CONTENT', message: 'The uploaded file is not a valid PDF.' } });
  }

  const documentCount = await prisma.document.count({ where: { userId: req.userId } });
  if (documentCount >= env.MAX_DOCUMENTS_PER_USER) {
    return res.status(429).json({ error: { code: 'DOCUMENT_LIMIT_REACHED', message: 'Document limit reached.' } });
  }

  const storage = getDocumentStorage();
  const stored = await storage.uploadPdf(req.file.buffer, req.userId);
  try {
    const document = await prisma.document.create({
      data: {
        userId: req.userId,
        originalName: req.file.originalname,
        storageKey: stored.publicId,
        storageProvider: 'cloudinary',
        storageAssetId: stored.assetId,
        storageResourceType: stored.resourceType,
        storageDeliveryType: stored.deliveryType,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(stored.bytes),
        status: 'PENDING',
      },
      select: { id: true, originalName: true, status: true, sizeBytes: true, createdAt: true },
    });
    void ingestionService.ingestDocument(document.id, req.file.buffer).catch((error) => {
      console.error(`Document ingestion failed for ${document.id}:`, error);
    });
    return res.status(201).json({ document: { ...document, sizeBytes: document.sizeBytes.toString() } });
  } catch (error) {
    await storage.deletePdf(stored.publicId).catch(() => undefined);
    throw error;
  }
}));

router.post('/:documentId/retry', asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.documentId, userId: req.userId, status: 'FAILED' },
    select: { id: true, storageKey: true },
  });
  if (!document) {
    return res.status(404).json({ error: { code: 'FAILED_DOCUMENT_NOT_FOUND', message: 'Failed document not found.' } });
  }
  const buffer = await getDocumentStorage().downloadPdf(document.storageKey);
  void ingestionService.ingestDocument(document.id, buffer).catch((error) => {
    console.error(`Document retry failed for ${document.id}:`, error);
  });
  return res.status(202).json({ status: 'PROCESSING' });
}));

router.get('/', asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  const documents = await prisma.document.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, pageCount: true, status: true, errorCode: true, createdAt: true, processedAt: true },
  });
  return res.json({ documents: documents.map((document) => ({ ...document, sizeBytes: document.sizeBytes.toString() })) });
}));

router.get('/:documentId', asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.documentId, userId: req.userId },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, pageCount: true, status: true, errorCode: true, createdAt: true, processedAt: true },
  });
  if (!document) {
    return res.status(404).json({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
  }
  return res.json({ document: { ...document, sizeBytes: document.sizeBytes.toString() } });
}));

router.get('/:documentId/source', asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.documentId, userId: req.userId },
    select: { storageKey: true },
  });
  if (!document) {
    return res.status(404).json({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
  }
  return res.json({ url: getDocumentStorage().createDownloadUrl(document.storageKey), expiresInSeconds: 300 });
}));

router.delete('/:documentId', asyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.documentId, userId: req.userId },
    select: { id: true, storageKey: true },
  });
  if (!document) {
    return res.status(404).json({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' } });
  }
  await getDocumentStorage().deletePdf(document.storageKey);
  await prisma.document.delete({ where: { id: document.id } });
  return res.status(204).send();
}));

export const documentsRouter = router;
