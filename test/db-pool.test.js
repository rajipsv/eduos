// A dropped database connection (Neon closes idle ones) must not crash the server.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgres://user:pass@127.0.0.1:1/none';
delete process.env.DATABASE_SCHEMA;
const { getPool } = await import('../server/db.js');

test('pool errors are handled instead of crashing the process', () => {
  const pool = getPool();
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.doesNotThrow(() => pool.emit('error', new Error('Connection terminated unexpectedly')));
  } finally {
    console.warn = warn;
  }
});
