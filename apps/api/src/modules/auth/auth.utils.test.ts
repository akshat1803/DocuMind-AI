import { describe, expect, it } from 'vitest';
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  refreshTokenExpiresAt,
  verifyAccessToken,
} from './auth.utils.js';

describe('authentication utilities', () => {
  it('hashes and verifies passwords without retaining plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct horse battery staple');
    await expect(comparePassword('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(comparePassword('wrong password', hash)).resolves.toBe(false);
  });

  it('creates verifiable access tokens', () => {
    const token = generateAccessToken('user-123');
    expect(verifyAccessToken(token)).toMatchObject({ userId: 'user-123' });
  });

  it('creates unique opaque refresh credentials and stable hashes', () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();
    expect(first).not.toBe(second);
    expect(hashRefreshToken(first)).toBe(hashRefreshToken(first));
    expect(hashRefreshToken(first)).not.toBe(hashRefreshToken(second));
  });

  it('uses the configured refresh lifetime', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(refreshTokenExpiresAt(now).getTime()).toBeGreaterThan(now.getTime());
  });
});
