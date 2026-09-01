import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './shared/db.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('API foundation', () => {
  it('serves liveness without contacting dependencies', async () => {
    const response = await request(app).get('/api/v1/health/live');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns the standard not-found envelope', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('protects the current-user endpoint', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('validates registration before accessing the database', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({ email: 'invalid' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('keeps refresh public and reports a missing session clearly', async () => {
    const response = await request(app).post('/api/v1/auth/refresh').send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('REFRESH_TOKEN_REQUIRED');
  });
});
