import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.');
  }
  // DATABASE_SCHEMA is for tests: it points every query at a scratch schema.
  const schema = process.env.DATABASE_SCHEMA;
  if (schema && !/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('Invalid DATABASE_SCHEMA');
  pool = new Pool({
    // Neon's pooler rejects the search_path start-up option, so tests use the direct host.
    connectionString: schema ? connectionString.replace('-pooler.', '.') : connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  });
  // Neon closes idle connections. Without a handler, that error crashes the whole process;
  // the pool drops the broken connection and opens a new one on the next query.
  pool.on('error', (err) => {
    console.warn('Database connection dropped (will reconnect):', err.message);
  });
  return pool;
}

export async function testConnection() {
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    return false;
  }
}
