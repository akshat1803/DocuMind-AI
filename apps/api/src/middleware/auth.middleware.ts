import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../modules/auth/auth.utils.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header is missing or malformed',
        }
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is empty',
        }
      });
    }

    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch (error: any) {
    if (error.message === 'INVALID_ACCESS_TOKEN') {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token is invalid or expired',
        }
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during authentication',
      }
    });
  }
}
