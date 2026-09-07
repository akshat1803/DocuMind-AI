import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { quoteTemporaryDatabase, testDatabaseTarget } from './lib/test-database.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

function run(script, args, env, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env, stdio: 'inherit' });
    child.on('error', () => reject(new Error('Unable to start the integration check process.')));
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Integration check process failed.')));
  });
}

async function main() {
  // Never read .env or fall back to DATABASE_URL/DIRECT_URL here.
  const target = testDatabaseTarget(process.env.TEST_DATABASE_URL);
  const identifier = quoteTemporaryDatabase(target.name);
  const admin = new pg.Client({ connectionString: target.adminUrl, connectionTimeoutMillis: 5000 });
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: target.databaseUrl,
    DIRECT_URL: target.databaseUrl,
    GEMINI_API_KEY: 'integration-test-key',
    JWT_ACCESS_SECRET: 'integration-test-access-secret-long-enough',
    JWT_REFRESH_SECRET: 'integration-test-refresh-secret-long-enough',
    CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '',
  };
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${identifier}`);
    created = true;
    await run(fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)), ['migrate', 'deploy'], env);
    await run(fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
      ['run', '--config', 'vitest.integration.config.ts'], env, fileURLToPath(new URL('../apps/api/', import.meta.url)));
  } finally {
    try {
      if (created) await admin.query(`DROP DATABASE ${identifier} WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  }
}

main().catch((error) => {
  // Avoid printing connection strings or credentials from driver error objects.
  console.error(error instanceof Error && !('code' in error) ? error.message : 'Test database operation failed; check the dedicated local PostgreSQL service and permissions.');
  process.exitCode = 1;
});
