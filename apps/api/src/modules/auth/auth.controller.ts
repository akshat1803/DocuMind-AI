import { Router, Request, Response } from 'express';
import { RegisterInputSchema, LoginInputSchema } from '@documind/shared';
import { prisma } from '../../shared/db.js';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from './auth.utils.js';
import { env } from '../../config/env.js';

const router = Router();

const REFRESH_COOKIE = 'documind_refresh';

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
  path: '/api/v1/auth',
};

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions,
    maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
}

function readRefreshToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[REFRESH_COOKIE];
  const bodyToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
  return typeof cookieToken === 'string' ? cookieToken : bodyToken;
}

// REGISTER
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parseResult = RegisterInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: parseResult.error.flatten(),
        }
      });
    }

    const { email, password, name } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'A user with this email address already exists',
        }
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashedPassword,
        name,
      }
    });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    // Save refresh token to db
    const expiresAt = refreshTokenExpiresAt();

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
      }
    });

    setRefreshCookie(res, refreshToken);
    return res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to register user',
      }
    });
  }
});

// LOGIN
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parseResult = LoginInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: parseResult.error.flatten(),
        }
      });
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        }
      });
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    const expiresAt = refreshTokenExpiresAt();

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
      }
    });

    setRefreshCookie(res, refreshToken);
    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to authenticate user',
      }
    });
  }
});

// REFRESH TOKEN
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = readRefreshToken(req);
    if (!refreshToken) {
      return res.status(401).json({
        error: {
          code: 'REFRESH_TOKEN_REQUIRED',
          message: 'No active refresh session was found',
        }
      });
    }

    const tokenHash = hashRefreshToken(refreshToken);

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
      }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      clearRefreshCookie(res);
      return res.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid, expired, or has been revoked',
        }
      });
    }

    const newAccessToken = generateAccessToken(storedToken.userId);
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    await prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: storedToken.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) {
        throw new Error('REFRESH_TOKEN_REUSED');
      }
      await tx.refreshToken.create({
        data: {
          userId: storedToken.userId,
          tokenHash: newRefreshTokenHash,
          expiresAt: refreshTokenExpiresAt(),
        },
      });
    });

    setRefreshCookie(res, newRefreshToken);
    return res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    clearRefreshCookie(res);
    return res.status(401).json({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token verification failed',
      }
    });
  }
});

// LOGOUT
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const refreshToken = readRefreshToken(req);
    if (refreshToken) {
      const tokenHash = hashRefreshToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }
    clearRefreshCookie(res);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to process logout',
      }
    });
  }
});

// GET ME
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Authenticated user profile not found',
        }
      });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve profile info',
      }
    });
  }
});

export const authRouter = router;
