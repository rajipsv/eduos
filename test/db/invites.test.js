// "Send login": invite links that let a teacher or family choose their own password.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { skip, useScratchSchema, createSchema, dropSchema } from './helpers.js';

const schema = useScratchSchema();
delete process.env.RESEND_API_KEY;
process.env.APP_URL = 'https://app.test';

let pool;
let handleApi;
let signAccessToken;
let DEMO;
const realFetch = globalThis.fetch;

before(async () => {
  if (skip) return;
  const { getPool } = await import('../../server/db.js');
  pool = getPool();
  await createSchema(pool, schema);
  await (await import('../../server/migrate.js')).runMigrations({ log: () => {} });
  await (await import('../../server/demo-seed.js')).seedDemo();
  ({ handleApi } = await import('../../server/router.js'));
  ({ signAccessToken } = await import('../../server/auth/jwt.js'));
  ({ DEMO_IDS: DEMO } = await import('../../server/demo-accounts.js'));
});

after(async () => {
  globalThis.fetch = realFetch;
  if (pool) await dropSchema(pool, schema);
});

const USERS = {
  admin: 'user_center_admin_demo',
  anita: 'user_teacher_anita_demo',
  family: 'user_family_sharma_demo',
  owner: 'user_platform_owner_demo',
};

async function call(method, path, { as, asId, body, query = {}, ip = '10.0.0.9' } = {}) {
  let token = null;
  const id = asId || USERS[as];
  if (id) {
    const r = await pool.query('SELECT id, role, email, center_id FROM auth_users WHERE id = $1', [id]);
    token = signAccessToken(r.rows[0], process.env.JWT_SECRET);
  }
  const req = {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'x-forwarded-for': ip },
    body: body || {},
    query,
    socket: { remoteAddress: ip },
  };
  const res = {
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
  await handleApi(req, res, path);
  return res;
}

const tokenOf = (link) => decodeURIComponent(link.split('#reset-password/')[1]);
const info = (token) => call('GET', '/api/auth/reset-password-info', { query: { token } });
const invite = (id, as = 'admin') => call('POST', `/api/users/${id}/invite`, { as });

let teacherId;
let firstLink;

test('admin creates a teacher login with an invite link and no usable password', { skip }, async () => {
  const res = await call('POST', '/api/users', {
    as: 'admin',
    body: { email: 'NewTeacher@Example.com', name: 'New Teacher', role: 'teacher', linkedTeacherId: 'teacher_x', sendInvite: true },
  });
  assert.equal(res.statusCode, 201);
  teacherId = res.body.user.id;
  const { invite: inv } = res.body;
  assert.match(inv.link, /^https:\/\/app\.test\/#reset-password\/inv_/);
  assert.equal(inv.emailed, false, 'no Resend key, so not emailed');
  assert.equal(inv.email, 'newteacher@example.com');
  assert.equal(inv.lastSeenAt, null);
  const days = (new Date(inv.expiresAt).getTime() - Date.now()) / 86400000;
  assert.ok(days > 6.9 && days <= 7, `expires in 7 days, got ${days}`);
  assert.ok(!/password_?hash/i.test(JSON.stringify(res.body)));
  firstLink = inv.link;

  // Only the hash of the token is stored.
  const rows = await pool.query('SELECT token_hash FROM auth_password_reset_tokens WHERE user_id = $1', [teacherId]);
  assert.equal(rows.rowCount, 1);
  assert.ok(!firstLink.includes(rows.rows[0].token_hash));

  // Nobody can sign in with a guessed password.
  const login = await call('POST', '/api/auth/login', { body: { email: 'newteacher@example.com', password: 'demo123' } });
  assert.equal(login.statusCode, 401);
});

test('the invite page knows it is an invite and names the center', { skip }, async () => {
  const r = await info(tokenOf(firstLink));
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.invite, true);
  assert.equal(r.body.email, 'newteacher@example.com');
  const center = await pool.query('SELECT name FROM centers WHERE id = $1', [DEMO.center]);
  assert.equal(r.body.centerName, center.rows[0].name);
});

test('only admins of the same center (or the platform owner) can send a login', { skip }, async () => {
  assert.equal((await invite(teacherId, 'anita')).statusCode, 403, 'teacher');
  assert.equal((await invite(teacherId, 'family')).statusCode, 403, 'family');
  assert.equal((await call('POST', `/api/users/${teacherId}/invite`)).statusCode, 401, 'signed out');

  const other = await call('POST', '/api/auth/register-center', {
    ip: '10.9.9.9',
    body: { centerName: 'Other Classes', ownerName: 'Other Owner', email: 'other@owner.test', city: 'Pune', password: 'Zebra-Lantern-42' },
  });
  assert.equal(other.statusCode, 200);
  const otherAdmin = other.body.user.id;
  const cross = await call('POST', `/api/users/${teacherId}/invite`, { asId: otherAdmin });
  assert.equal(cross.statusCode, 403, 'admin of another center');
  assert.equal(cross.body.link, undefined);

  assert.equal((await invite('user_does_not_exist')).statusCode, 404);
  assert.equal((await invite(USERS.owner)).statusCode, 404, "platform owners can't be invited");

  // A teacher can't create logins either.
  const created = await call('POST', '/api/users', {
    as: 'anita',
    body: { email: 'x@y.test', name: 'X', role: 'teacher', sendInvite: true },
  });
  assert.equal(created.statusCode, 403);
});

test('a new link turns off the older one', { skip }, async () => {
  const second = await invite(teacherId);
  assert.equal(second.statusCode, 200);
  assert.notEqual(second.body.link, firstLink);
  const old = await info(tokenOf(firstLink));
  assert.equal(old.statusCode, 400);
  assert.equal(old.body.invite, true);
  assert.match(old.body.error, /invite link has expired or was already used/);
  assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: tokenOf(firstLink), password: 'Mango-River-77' } })).statusCode, 400);
  firstLink = second.body.link;
});

test('accepting the invite sets the password, signs in, and works only once', { skip }, async () => {
  const token = tokenOf(firstLink);
  const res = await call('POST', '/api/auth/reset-password', { body: { token, password: 'Mango-River-77' } });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.accessToken, 'signed straight in');
  assert.equal(res.body.session.role, 'teacher');
  assert.equal(res.body.user.id, teacherId);
  assert.match(String(res.headers['Set-Cookie']), /HttpOnly/);

  const again = await call('POST', '/api/auth/reset-password', { body: { token, password: 'Other-Pass-88' } });
  assert.equal(again.statusCode, 400);
  assert.equal((await info(token)).statusCode, 400);

  const login = await call('POST', '/api/auth/login', {
    ip: '10.1.1.1',
    body: { email: 'newteacher@example.com', password: 'Mango-River-77', portal: 'teacher' },
  });
  assert.equal(login.statusCode, 200);

  // The admin now sees that this person has signed in.
  const boot = await call('GET', '/api/bootstrap', { as: 'admin' });
  const u = boot.body.data.users.find((x) => x.id === teacherId);
  assert.ok(u.lastSeenAt, 'lastSeenAt is set');
  assert.ok(!/password/i.test(JSON.stringify(boot.body.data.users)));
  assert.ok((await invite(teacherId)).body.lastSeenAt);
});

test('invite links expire', { skip }, async () => {
  const res = await invite(teacherId);
  const token = tokenOf(res.body.link);
  await pool.query(
    `UPDATE auth_password_reset_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1 AND used_at IS NULL`,
    [teacherId],
  );
  assert.equal((await info(token)).statusCode, 400);
  assert.equal((await call('POST', '/api/auth/reset-password', { body: { token, password: 'Late-Pass-99x' } })).statusCode, 400);
});

test('reset links (forgot password) are still reset links, not invites', { skip }, async () => {
  const r = await call('POST', '/api/auth/forgot-password', { ip: '10.2.2.2', body: { email: 'newteacher@example.com' } });
  assert.equal(r.statusCode, 200);
  const token = tokenOf(r.body.demoResetUrl);
  assert.match(token, /^rst_/);
  const i = await info(token);
  assert.equal(i.body.invite, false);
  assert.equal(i.body.centerName, null);
});

test('"set a password myself" still works, with the strong-password rules', { skip }, async () => {
  const weak = await call('POST', '/api/users', {
    as: 'admin',
    body: { email: 'fam1@example.com', name: 'Fam One', role: 'family', password: 'abc' },
  });
  assert.equal(weak.statusCode, 400);
  const ok = await call('POST', '/api/users', {
    as: 'admin',
    body: { email: 'fam1@example.com', name: 'Fam One', role: 'family', password: 'Purple-Kite-31', linkedStudentIds: ['s1'] },
  });
  assert.equal(ok.statusCode, 201);
  assert.equal(ok.body.invite, undefined);
  const login = await call('POST', '/api/auth/login', { ip: '10.3.3.3', body: { email: 'fam1@example.com', password: 'Purple-Kite-31' } });
  assert.equal(login.statusCode, 200);
});

test('the platform owner can send a login; email goes out when Resend is set up', { skip }, async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.resend.com/')) {
      sent.push(JSON.parse(init.body));
      return new Response('{}', { status: 200 });
    }
    return realFetch(url, init);
  };
  process.env.RESEND_API_KEY = 're_test_key';
  try {
    const res = await invite(USERS.family, 'owner');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.emailed, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, res.body.email);
    assert.ok(sent[0].text.includes(res.body.link));
    assert.match(sent[0].subject, /choose your password/);
  } finally {
    delete process.env.RESEND_API_KEY;
    globalThis.fetch = realFetch;
  }
});

test('at most 5 links per person per hour', { skip }, async () => {
  const created = await call('POST', '/api/users', {
    as: 'admin',
    body: { email: 'ratelimit@example.com', name: 'Rate Limit', role: 'family', sendInvite: true },
  });
  assert.equal(created.statusCode, 201);
  const id = created.body.user.id;
  for (let i = 0; i < 4; i++) assert.equal((await invite(id)).statusCode, 200, `invite ${i + 2}`);
  const blocked = await invite(id);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.link, undefined);
});
