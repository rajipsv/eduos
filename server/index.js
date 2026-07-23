import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getPool, testConnection } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const app = express();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT) || 8888;
const STATE_ID = 'global';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

let dbReady = false;

app.use(cors());
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.json({ ok: true, db: false, reason: 'DATABASE_URL not configured' });
  }
  dbReady = await testConnection();
  res.json({ ok: true, db: dbReady });
});

app.get('/api/state', async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'database_not_configured' });
  }
  try {
    const result = await getPool().query(
      'SELECT data, updated_at FROM app_state WHERE id = $1',
      [STATE_ID],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ data: result.rows[0].data, updatedAt: result.rows[0].updated_at });
  } catch (err) {
    console.error('GET /api/state failed:', err);
    res.status(500).json({ error: 'load_failed' });
  }
});

app.put('/api/state', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'database_not_configured' });
  }
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'invalid_body' });
  }
  try {
    await getPool().query(
      `INSERT INTO app_state (id, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [STATE_ID, req.body],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/state failed:', err);
    res.status(500).json({ error: 'save_failed' });
  }
});

app.delete('/api/state', async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'database_not_configured' });
  }
  try {
    await getPool().query('DELETE FROM app_state WHERE id = $1', [STATE_ID]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/state failed:', err);
    res.status(500).json({ error: 'reset_failed' });
  }
});

app.use(express.static(root));

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  const urlPath = decodeURIComponent(req.path.split('?')[0]);
  const rel = urlPath.replace(/^\//, '') || 'index.html';
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return next();
  }
  res.type(types[path.extname(file)] || 'application/octet-stream');
  res.sendFile(file);
});

app.listen(port, host, async () => {
  if (process.env.DATABASE_URL) {
    dbReady = await testConnection();
  }
  const url = `http://${host}:${port}/`;
  console.log(`EduOS running at ${url}`);
  console.log(dbReady ? 'Database: Neon PostgreSQL connected' : 'Database: localStorage fallback (no DATABASE_URL or connection failed)');
  console.log('Press Ctrl+C to stop.');
});
