import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';

const SALT_ROUNDS = 10;
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(userId: string): string {
  return jwt.sign(
    { userId },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] }
  );
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiresAt(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);
  return expiresAt;
}

export function verifyAccessToken(token: string): { userId: string } {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string };
  } catch (error) {
    throw new Error('INVALID_ACCESS_TOKEN');
  }
}
