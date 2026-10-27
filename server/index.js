import express from 'express';
import cors from 'cors';
import path from 'path';
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
} from './auth/handlers.js';
import { runMigrations } from './migrate.js';
import { seedDemoIfMissing } from './demo-seed.js';
import { isAuthConfigured } from './auth/config.js';
import {
  handleCreateInboundLead,
  handleListInboundLeads,
  handleUpdateInboundLead,
} from './leads-handler.js';
import { allowedOrigins, missingRequiredEnv } from './env.js';
import { securityHeaders } from './security-headers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const missing = missingRequiredEnv();
if (missing.length) {
  console.error(`Refusing to start in production: missing ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT) || 8888;

let dbReady = false;

app.use((_req, res, next) => {
  for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value);
  next();
});

// Same-origin requests need no CORS. Other origins must be listed in ALLOWED_ORIGINS.
const corsOrigins = allowedOrigins();
app.use(cors({ origin: (origin, cb) => cb(null, !origin || corsOrigins.includes(origin)), credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Express 4 doesn't catch rejected promises from async handlers; send them to the error handler.
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

const sendResult = (res, result) => {
  if (res.headersSent) return;
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.status(result.status).json(result.body);
};

app.get(
  '/api/health',
  route(async (_req, res) => res.json(await getHealthPayload())),
);

app.post('/api/auth/login', route(handleLogin));
app.post('/api/auth/logout', route(handleLogout));
app.post('/api/auth/refresh', route(handleRefresh));
app.get('/api/auth/me', route(handleMe));
app.post('/api/auth/register-center', route(handleRegisterCenter));
app.post('/api/auth/forgot-password', route(handleForgotPassword));
app.get('/api/auth/reset-password-info', route(handleResetPasswordInfo));
app.post('/api/auth/reset-password', route(handleResetPassword));

app.get('/api/state', route(async (req, res) => sendResult(res, await loadAppStateForRequest(req, res))));
app.put('/api/state', route(async (req, res) => sendResult(res, await saveAppStateForRequest(req, res, req.body))));
app.delete('/api/state', route(async (req, res) => sendResult(res, await removeAppStateForRequest(req, res))));

app.post('/api/leads', route(handleCreateInboundLead));
app.get('/api/leads', route(handleListInboundLeads));
app.patch('/api/leads', route(handleUpdateInboundLead));

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// Only public files are served. Server code, scripts, docs and config stay private.
const PUBLIC_PAGES = { '/': 'index.html', '/index.html': 'index.html', '/start-page.html': 'start-page.html' };
app.get(Object.keys(PUBLIC_PAGES), (req, res, next) => {
  res.sendFile(path.join(root, PUBLIC_PAGES[req.path]), (err) => err && next(err));
});
for (const dir of ['css', 'js', 'img']) {
  app.use(`/${dir}`, express.static(path.join(root, dir), { dotfiles: 'deny', index: false }));
}

app.use((_req, res) => res.status(404).type('text/plain').send('Not found'));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
  console.error('Request failed:', err);
  if (!res.headersSent) res.status(500).json({ error: 'server_error' });
});

app.listen(port, host, async () => {
  if (process.env.DATABASE_URL) {
    dbReady = await testConnection();
    if (dbReady) {
      try {
        await runMigrations();
        // Creates the demo center and logins on first start, only when demo mode is on.
        const seed = await seedDemoIfMissing();
        if (seed.ok && !seed.skipped) console.log('Demo center seeded:', seed.demoEmails.join(', '));
      } catch (err) {
        console.warn('Database setup warning:', err.message);
      }
    }
  }
  const url = `http://${host}:${port}/`;
  console.log(`Tutorsala running at ${url}`);
  console.log(dbReady ? 'Database: Neon PostgreSQL connected' : 'Database: localStorage fallback (no DATABASE_URL or connection failed)');
  if (isAuthConfigured()) console.log('Auth: JWT enabled (access + refresh cookies)');
  else console.log('Auth: local-only (set JWT_SECRET and JWT_REFRESH_SECRET for server auth)');
  console.log('Press Ctrl+C to stop.');
});
