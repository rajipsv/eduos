import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, testConnection } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const ok = await testConnection();
  if (!ok) {
    process.exit(1);
  }

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await getPool().query(sql);
  console.log('Database schema applied.');
  await getPool().end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
