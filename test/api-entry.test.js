// The single Vercel function: vercel.json rewrites /api/<path> to /api/index?__path=<path>.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

Object.assign(process.env, { DATABASE_URL: '', JWT_SECRET: '', JWT_REFRESH_SECRET: '', VERCEL: '', NODE_ENV: '' });
const { default: handler } = await import('../api/index.js');

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    headersSent: false,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      this.headersSent = true;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
}

test('rewritten paths reach the right route, and __path is not passed on', async () => {
  const res = fakeRes();
  const req = { method: 'GET', url: '/api/index?__path=health&x=1', query: { __path: 'health', x: '1' }, headers: {} };
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.db, false);
  assert.deepEqual(req.query, { x: '1' });
});

test('nested paths and unknown routes', async () => {
  const res = fakeRes();
  await handler({ method: 'GET', url: '/api/index', query: { __path: 'auth/me' }, headers: {} }, res);
  assert.equal(res.statusCode, 503); // JWT secrets blank in this test: auth unavailable
  const missing = fakeRes();
  await handler({ method: 'GET', url: '/api/index', query: { __path: 'state' }, headers: {} }, missing);
  assert.equal(missing.statusCode, 404);
});

test('vercel.json sends every /api path to the one function', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const apiRewrites = config.rewrites.filter((r) => r.source.startsWith('/api'));
  assert.deepEqual(apiRewrites, [{ source: '/api/:path*', destination: '/api/index?__path=:path*' }]);
  // The other rewrites only map clean page URLs to their .html files.
  for (const r of config.rewrites.filter((x) => !x.source.startsWith('/api'))) {
    assert.equal(r.destination, `${r.source}.html`);
  }
  assert.deepEqual(Object.keys(config.functions), ['api/index.js']);
  const apiFiles = fs.readdirSync(new URL('../api/', import.meta.url), { recursive: true });
  assert.deepEqual(apiFiles, ['index.js']);
});
