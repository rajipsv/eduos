// Database tests run in a throwaway schema: every table is created fresh there and the
// schema is dropped afterwards, so real tables are never read or written.
// Run with: npm run test:db   (needs TEST_DATABASE_URL or DATABASE_URL in .env)
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });

export const DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
export const skip = DB_URL ? false : 'no TEST_DATABASE_URL or DATABASE_URL';

/** Points the server code at a new empty schema. Call before importing server modules. */
export function useScratchSchema() {
  const schema = `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  process.env.DATABASE_URL = DB_URL;
  process.env.DATABASE_SCHEMA = schema;
  process.env.ENABLE_DEMO_SEED = 'true';
  process.env.JWT_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  return schema;
}

export async function createSchema(pool, schema) {
  await pool.query(`CREATE SCHEMA ${schema}`);
}

export async function dropSchema(pool, schema) {
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
}
