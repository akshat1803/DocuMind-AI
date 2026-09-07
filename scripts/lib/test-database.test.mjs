import assert from 'node:assert/strict';
import { test } from 'node:test';
import { quoteTemporaryDatabase, testDatabaseTarget } from './test-database.mjs';

test('test runs receive distinct databases while preserving the dedicated server', () => {
  const input = 'postgresql://tester:example@127.0.0.1:5433/documind_test';
  const first = testDatabaseTarget(input);
  const second = testDatabaseTarget(input);
  assert.notEqual(first.name, second.name);
  assert.equal(new URL(first.databaseUrl).port, '5433');
  assert.equal(first.adminUrl, input);
  assert.match(quoteTemporaryDatabase(first.name), /^"documind_test_[a-f0-9]{32}"$/);
});

test('refuses missing, remote, development, and connection-option URLs', () => {
  for (const value of [undefined, 'invalid', 'https://localhost/documind_test',
    'postgresql://localhost/documind_dev', 'postgresql://database.example/documind_test',
    'postgresql://localhost/documind_test?host=production.example',
    'postgresql://localhost/documind_test#unsafe']) {
    assert.throws(() => testDatabaseTarget(value));
  }
});

test('cleanup identifiers cannot target the base database or inject SQL', () => {
  for (const name of ['documind_test', 'documind_dev', 'postgres', 'documind_test_123; DROP DATABASE postgres']) {
    assert.throws(() => quoteTemporaryDatabase(name));
  }
});
