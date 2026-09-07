import { defineConfig } from 'vitest/config';

const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
if (!databaseUrl || !['postgres:', 'postgresql:'].includes(databaseUrl.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)
    || databaseUrl.search || databaseUrl.hash
    || !/^documind_test_[a-f0-9]{32}$/.test(databaseUrl.pathname.slice(1))) {
  throw new Error('Run integration tests through npm run test:integration with TEST_DATABASE_URL.');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
