// Every API route needs sign-in except the ones listed here. A new route that forgets its
// auth check fails this test.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Real-looking secrets so auth is "configured"; no database, so nothing gets past the auth check.
Object.assign(process.env, {
  DATABASE_URL: '',
  JWT_SECRET: 'route-auth-test-secret',
  JWT_REFRESH_SECRET: 'route-auth-test-refresh',
  VERCEL: '',
  NODE_ENV: '',
});
const { ROUTES, handleApi } = await import('../server/router.js');

// Reachable without signing in, on purpose.
const PUBLIC = new Set([
  'GET /api/health',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/auth/refresh', // uses the refresh cookie instead
  'POST /api/auth/register-center',
  'POST /api/auth/forgot-password',
  'GET /api/auth/reset-password-info',
  'POST /api/auth/reset-password',
  'GET /api/public/centers',
  'POST /api/public/centers/:id/inquiries',
  'POST /api/leads', // demo requests from start-page.html
]);

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
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
    setHeader() {},
  };
}

test('the public list only names real routes', () => {
  const all = new Set(ROUTES.map(([m, p]) => `${m} ${p}`));
  for (const r of PUBLIC) assert.ok(all.has(r), `${r} is not a route`);
});

for (const [method, pattern] of ROUTES) {
  const name = `${method} ${pattern}`;
  if (PUBLIC.has(name)) continue;
  test(`${name} refuses requests without sign-in`, async () => {
    const res = fakeRes();
    const req = { method, headers: {}, body: {}, query: {}, socket: { remoteAddress: '127.0.0.1' } };
    await handleApi(req, res, pattern.replace(/:\w+/g, 'x'));
    assert.equal(res.statusCode, 401, `${name} answered ${res.statusCode}`);
  });
}
