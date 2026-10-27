// Stage 1 security checks. No database: DATABASE_URL and JWT secrets are blanked so the
// real .env (loaded by dotenv, which never overrides existing vars) is not used.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLANK = { DATABASE_URL: '', JWT_SECRET: '', JWT_REFRESH_SECRET: '', VERCEL: '', NODE_ENV: '', ENABLE_DEMO_SEED: '' };
Object.assign(process.env, BLANK);

const env = await import('../server/env.js');
const { authenticateRequest } = await import('../server/auth/middleware.js');
const { ensureNeonDemoSeeded } = await import('../server/demo-seed.js');

function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    Object.assign(process.env, saved);
  }
}

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

test('demo mode: on locally, off in production unless explicitly enabled', () => {
  assert.equal(withEnv({ VERCEL: '' }, env.isDemoModeEnabled), true);
  assert.equal(withEnv({ VERCEL: '1' }, env.isDemoModeEnabled), false);
  assert.equal(withEnv({ VERCEL: '1', ENABLE_DEMO_SEED: 'true' }, env.isDemoModeEnabled), true);
  assert.equal(withEnv({ VERCEL: '', ENABLE_DEMO_SEED: 'false' }, env.isDemoModeEnabled), false);
});

test('production requires database and JWT secrets', () => {
  assert.deepEqual(withEnv({ VERCEL: '' }, env.missingRequiredEnv), []);
  assert.deepEqual(withEnv({ VERCEL: '1' }, env.missingRequiredEnv), ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET']);
});

test('API refuses requests in production when JWT secrets are missing', async () => {
  const res = fakeRes();
  process.env.VERCEL = '1';
  try {
    const result = await authenticateRequest({ headers: {} }, res);
    assert.equal(result.ok, false);
    assert.equal(res.statusCode, 503);
  } finally {
    process.env.VERCEL = '';
  }
});

test('demo seeding is skipped when demo mode is off', async () => {
  process.env.DATABASE_URL = 'postgres://unused';
  process.env.ENABLE_DEMO_SEED = 'false';
  try {
    const result = await ensureNeonDemoSeeded();
    assert.equal(result.reason, 'demo_mode_disabled');
  } finally {
    process.env.DATABASE_URL = '';
    process.env.ENABLE_DEMO_SEED = '';
  }
});

// --- Local server: only public files are served -------------------------------------------
const PORT = 18000 + Math.floor(Math.random() * 1000);
let server;

before(async () => {
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: { ...process.env, ...BLANK, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 10000);
    server.stdout.on('data', (d) => {
      if (String(d).includes('running at')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
});

after(() => server?.kill());

const get = (p) => fetch(`http://127.0.0.1:${PORT}${p}`);

test('public pages and assets are served with security headers', async () => {
  const home = await get('/');
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-frame-options'), 'DENY');
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(home.headers.get('content-security-policy-report-only'));
  assert.equal(home.headers.get('x-powered-by'), null);
  assert.equal((await get('/start-page.html')).status, 200);
  assert.equal((await get('/js/store.js')).status, 200);
  assert.equal((await get('/css/app.css')).status, 200);
});

test('server code, docs and config are not served', async () => {
  for (const p of ['/server/schema.sql', '/server/db.js', '/docs/qa/accounts.csv', '/package.json', '/.env', '/.env.example', '/js/../server/db.js']) {
    assert.equal((await get(p)).status, 404, p);
  }
});

test('unknown API routes return JSON 404', async () => {
  const res = await get('/api/nope');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'not_found' });
});
