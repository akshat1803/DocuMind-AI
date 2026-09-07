import { randomUUID } from 'node:crypto';

export function testDatabaseTarget(value) {
  if (!value) throw new Error('Set TEST_DATABASE_URL to the dedicated local documind_test database. See DEVELOPMENT.md.');
  let url;
  try { url = new URL(value); } catch { throw new Error('TEST_DATABASE_URL must be a PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || url.pathname !== '/documind_test'
      || url.search || url.hash) {
    throw new Error('Integration tests require a loopback PostgreSQL URL for documind_test with no query or fragment.');
  }
  const name = `documind_test_${randomUUID().replaceAll('-', '')}`;
  const database = new URL(url);
  database.pathname = `/${name}`;
  return { adminUrl: url.href, databaseUrl: database.href, name };
}

export function quoteTemporaryDatabase(name) {
  if (!/^documind_test_[a-f0-9]{32}$/.test(name)) throw new Error('Refusing to modify a non-temporary database.');
  return `"${name}"`;
}
