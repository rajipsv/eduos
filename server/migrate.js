import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, testConnection } from './db.js';
import { runAuthMigrations } from './auth/handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const ok = await testConnection();
  if (!ok) {
    process.exit(1);
  }

  await runAuthMigrations();
  console.log('Database schema applied (app_state + auth tables).');
  await getPool().end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
