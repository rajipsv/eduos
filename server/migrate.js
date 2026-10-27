// Applies server/migrations/*.sql and *.js in name order, once each.
// Usage: npm run migrate
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { getPool, testConnection } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const LOCK_ID = 727001; // any constant; keeps two servers from migrating at once

export function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.(sql|js)$/.test(f))
    .sort();
}

/** @returns {Promise<string[]>} names of the migrations applied by this run */
export async function runMigrations({ log = console.log } = {}) {
  const client = await getPool().connect();
  const applied = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));

    for (const name of listMigrations()) {
      if (done.has(name)) continue;
      const file = path.join(MIGRATIONS_DIR, name);
      await client.query('BEGIN');
      try {
        let note = '';
        if (name.endsWith('.sql')) {
          await client.query(fs.readFileSync(file, 'utf8'));
        } else {
          const mod = await import(pathToFileURL(file).href);
          note = (await mod.default(client)) || '';
        }
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        applied.push(name);
        log(`Applied ${name}${note ? ` (${note})` : ''}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${name} failed: ${err.message}`, { cause: err });
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
  return applied;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  (async () => {
    if (!(await testConnection())) process.exit(1);
    const applied = await runMigrations();
    console.log(applied.length ? `Done: ${applied.length} migration(s) applied.` : 'Database is up to date.');
    await getPool().end();
  })().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
