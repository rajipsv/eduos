import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { testConnection } from './db.js';
import { getHealthPayload, loadAppState, saveAppState, removeAppState } from './state-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const app = express();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT) || 8888;

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
  try {
    res.json(await getHealthPayload());
  } catch (err) {
    console.error('GET /api/health failed:', err);
    res.status(500).json({ ok: false, db: false, error: 'health_check_failed' });
  }
});

app.get('/api/state', async (_req, res) => {
  try {
    const result = await loadAppState();
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('GET /api/state failed:', err);
    res.status(500).json({ error: 'load_failed' });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    const result = await saveAppState(req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('PUT /api/state failed:', err);
    res.status(500).json({ error: 'save_failed' });
  }
});

app.delete('/api/state', async (_req, res) => {
  try {
    const result = await removeAppState();
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.body);
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
