import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { testConnection } from './db.js';
import {
  getHealthPayload,
  loadAppStateForRequest,
  saveAppStateForRequest,
  removeAppStateForRequest,
} from './state-api.js';
import {
  handleLogin,
  handleLogout,
  handleRefresh,
  handleMe,
  handleRegisterCenter,
  handleForgotPassword,
  handleResetPasswordInfo,
  handleResetPassword,
  runAuthMigrations,
} from './auth/handlers.js';
import { isAuthConfigured } from './auth/config.js';

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

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    res.json(await getHealthPayload());
  } catch (err) {
    console.error('GET /api/health failed:', err);
    res.status(500).json({ ok: false, db: false, error: 'health_check_failed' });
  }
});

app.post('/api/auth/login', (req, res) => handleLogin(req, res));
app.post('/api/auth/logout', (req, res) => handleLogout(req, res));
app.post('/api/auth/refresh', (req, res) => handleRefresh(req, res));
app.get('/api/auth/me', (req, res) => handleMe(req, res));
app.post('/api/auth/register-center', (req, res) => handleRegisterCenter(req, res));
app.post('/api/auth/forgot-password', (req, res) => handleForgotPassword(req, res));
app.get('/api/auth/reset-password-info', (req, res) => handleResetPasswordInfo(req, res));
app.post('/api/auth/reset-password', (req, res) => handleResetPassword(req, res));

app.get('/api/state', (req, res) => loadAppStateForRequest(req, res).then((result) => {
  if (result.error) {
    if (!res.headersSent) res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(result.status).json(result.body);
}));

app.put('/api/state', (req, res) => saveAppStateForRequest(req, res, req.body).then((result) => {
  if (result.error) {
    if (!res.headersSent) res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(result.status).json(result.body);
}));

app.delete('/api/state', (req, res) => removeAppStateForRequest(req, res).then((result) => {
  if (result.error) {
    if (!res.headersSent) res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(result.status).json(result.body);
}));

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
    if (dbReady) {
      try {
        await runAuthMigrations();
      } catch (err) {
        console.warn('Auth migration warning:', err.message);
      }
    }
  }
  const url = `http://${host}:${port}/`;
  console.log(`EduOS running at ${url}`);
  console.log(dbReady ? 'Database: Neon PostgreSQL connected' : 'Database: localStorage fallback (no DATABASE_URL or connection failed)');
  if (isAuthConfigured()) console.log('Auth: JWT enabled (access + refresh cookies)');
  else console.log('Auth: local-only (set JWT_SECRET and JWT_REFRESH_SECRET for server auth)');
  console.log('Press Ctrl+C to stop.');
});
