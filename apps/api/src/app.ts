import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.controller.js';
import { chatRouter } from './modules/chat/chat.controller.js';
import { documentsRouter } from './modules/documents/documents.controller.js';
import { prisma } from './shared/db.js';

export const app = express();

if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.get('/api/v1/health/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/health/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ready',
      services: { database: 'ready', geminiApi: 'configured' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'unready',
      services: { database: 'error', geminiApi: 'configured' },
      timestamp: new Date().toISOString(),
    });
  }
});

app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }), authRouter);
app.use('/api/v1/documents', rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: 'draft-8', legacyHeaders: false }), documentsRouter);
app.use('/api/v1/conversations', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }), chatRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const error = err as { code?: string; message?: string };
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: `PDFs must be at most ${env.MAX_FILE_SIZE_MB} MB.` } });
  }
  if (error.message === 'INVALID_PDF_TYPE') {
    return res.status(400).json({ error: { code: 'INVALID_PDF_TYPE', message: 'Only PDF files are accepted.' } });
  }
  if (error.message === 'CLOUDINARY_NOT_CONFIGURED') {
    return res.status(503).json({ error: { code: 'STORAGE_UNAVAILABLE', message: 'Document storage is not configured.' } });
  }
  console.error('Unhandled server error:', err);
  return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred.' } });
});
