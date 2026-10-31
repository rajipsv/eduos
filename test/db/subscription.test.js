// Tutorsala subscriptions: the platform-owner endpoint, defaults for older centers, what each
// role sees, and the active-student limit enforced in /api/sync.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { skip, useScratchSchema, createSchema, dropSchema } from './helpers.js';

const schema = useScratchSchema();

let pool;
let handleApi;
let signAccessToken;
let DEMO;
let sub;

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
  sub = await import('../../js/subscription.js');
});

after(async () => {
  if (pool) await dropSchema(pool, schema);
});

const USERS = {
  owner: 'user_platform_owner_demo',
  admin: 'user_center_admin_demo',
  anita: 'user_teacher_anita_demo',
  family: 'user_family_sharma_demo',
};

async function call(method, path, { as, body, headers = {}, ip = '10.0.0.9' } = {}) {
  let token = null;
  if (as) {
    const r = await pool.query('SELECT id, role, email, center_id FROM auth_users WHERE id = $1', [USERS[as]]);
    token = signAccessToken(r.rows[0], process.env.JWT_SECRET);
  }
  const req = {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'x-forwarded-for': ip, ...headers },
    body: body || {},
    query: {},
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
    getHeader(k) {
      return this.headers[k];
    },
  };
  await handleApi(req, res, path);
  return res;
}

const subPath = (id) => `/api/platform/centers/${id}/subscription`;
const studentChange = (id, extra = {}) => ({
  collection: 'students',
  id,
  op: 'upsert',
  data: { id, name: `Student ${id}`, batchId: DEMO.batchScience, ...extra },
  baseVersion: null,
});

test('only the platform owner can change a subscription', { skip }, async () => {
  for (const who of ['admin', 'anita', 'family']) {
    const r = await call('PATCH', subPath(DEMO.center), { as: who, body: { plan: 'starter' } });
    assert.equal(r.statusCode, 403, who);
  }
  assert.equal((await call('PATCH', subPath(DEMO.center), { body: { plan: 'starter' } })).statusCode, 401);
  assert.equal((await call('PATCH', subPath('center_missing'), { as: 'owner', body: { plan: 'starter' } })).statusCode, 404);
  const row = (await pool.query('SELECT plan, data FROM centers WHERE id = $1', [DEMO.center])).rows[0];
  assert.equal(row.plan, 'trial');
  assert.equal(row.data.subscription, undefined);
});

test('the endpoint validates what it is sent', { skip }, async () => {
  const bad = [
    {},
    { plan: 'gold' },
    { pilotEndsAt: '2026-02-30' },
    { pilotEndsAt: '31/03/2027' },
    { extraBranches: -1 },
    { extraBranches: 1.5 },
    { studentLimit: 0 },
    { payment: { date: '2026-11-01', amount: -5, method: 'UPI' } },
    { payment: { date: '2026-11-01', amount: 18000, method: 'cheque' } },
    { payment: { date: '2026-11-01', amount: 18000, method: 'UPI', reference: 'x'.repeat(121) } },
    { payment: { date: '2026-11-01', amount: 18000, method: 'UPI', recordedBy: 'someone' } },
    { status: 'suspended' },
  ];
  for (const body of bad) {
    const r = await call('PATCH', subPath(DEMO.center), { as: 'owner', body });
    assert.equal(r.statusCode, 400, JSON.stringify(body));
    assert.equal(r.body.error, 'invalid_body');
  }
});

test('platform owner records a payment and edits limits; it is audited', { skip }, async () => {
  const paid = await call('PATCH', subPath(DEMO.center), {
    as: 'owner',
    body: { payment: { date: '2026-11-01', amount: 18000, method: 'UPI', reference: 'UTR123', note: 'first year' } },
  });
  assert.equal(paid.statusCode, 200, JSON.stringify(paid.body));
  const s = paid.body.center.subscription;
  assert.equal(s.plan, 'starter');
  assert.equal(s.paidUntil, '2027-11-01');
  assert.equal(s.payments.length, 1);
  assert.equal(s.payments[0].recordedBy, USERS.owner);
  assert.ok(s.payments[0].id);

  const limits = await call('PATCH', subPath(DEMO.center), {
    as: 'owner',
    body: { plan: 'custom', extraBranches: 1, studentLimit: 150, paidUntil: '2027-12-31' },
  });
  assert.equal(limits.statusCode, 200);
  const row = (await pool.query('SELECT plan, version, data FROM centers WHERE id = $1', [DEMO.center])).rows[0];
  assert.equal(row.plan, 'custom');
  assert.equal(row.version, limits.body.version);
  assert.deepEqual(
    { ...row.data.subscription, payments: row.data.subscription.payments.length },
    { plan: 'custom', pilotEndsAt: row.data.subscription.pilotEndsAt, paidUntil: '2027-12-31', extraBranches: 1, studentLimit: 150, payments: 1 },
  );
  const audit = await pool.query(`SELECT * FROM audit_log WHERE action = 'center_subscription' ORDER BY id`);
  assert.equal(audit.rows.length, 2);
  assert.equal(audit.rows[0].detail.payment.amount, 18000);
});

test('center admins see their plan without internal notes; teachers and families see none; sync cannot change it', { skip }, async () => {
  const admin = await call('GET', '/api/bootstrap', { as: 'admin' });
  const mine = admin.body.data.centers[0];
  assert.equal(mine.subscription.plan, 'custom');
  assert.equal(mine.subscription.payments[0].note, undefined);
  assert.equal(mine.subscription.payments[0].reference, 'UTR123');
  for (const who of ['anita', 'family']) {
    const r = await call('GET', '/api/bootstrap', { as: who });
    assert.equal(r.body.data.centers[0].subscription, undefined, who);
  }

  // An admin trying to give themselves more students through sync gets nowhere.
  const version = admin.body.versions.centers[DEMO.center];
  const tamper = await call('POST', '/api/sync', {
    as: 'admin',
    body: {
      changes: [
        {
          collection: 'centers',
          id: DEMO.center,
          op: 'upsert',
          data: { ...mine, tagline: 'Edited', plan: 'starter', subscription: { plan: 'custom', studentLimit: 99999, paidUntil: '2099-01-01' } },
          baseVersion: version,
        },
      ],
    },
  });
  assert.equal(tamper.body.results[0].status, 'ok');
  assert.equal(tamper.body.results[0].record.subscription.payments[0].note, undefined);
  const row = (await pool.query('SELECT plan, data FROM centers WHERE id = $1', [DEMO.center])).rows[0];
  assert.equal(row.data.tagline, 'Edited');
  assert.equal(row.plan, 'custom');
  assert.equal(row.data.subscription.studentLimit, 150);
  assert.equal(row.data.subscription.payments[0].note, 'first year');
});

test('older centers without dates count as a 30-day pilot from created_at', { skip }, async () => {
  await pool.query(
    `INSERT INTO centers (id, name, plan, data, created_at) VALUES ('center_old', 'Old Center', 'trial', '{}', '2026-09-01T10:00:00Z')`,
  );
  const r = await call('GET', '/api/bootstrap', { as: 'owner' });
  assert.equal(r.statusCode, 200);
  const old = r.body.data.centers.find((c) => c.id === 'center_old');
  assert.equal(old.createdAt, '2026-09-01');
  const s = sub.getSubscription(old);
  assert.equal(s.plan, 'pilot');
  assert.equal(s.pilotEndsAt, '2026-10-01');
  assert.equal(sub.subscriptionStatus(old, '2026-10-31').kind, 'pilot_ended');
  // The demo center can still be opened.
  const demo = await call('GET', '/api/bootstrap', { as: 'owner', headers: { 'x-center-id': DEMO.center } });
  assert.equal(demo.statusCode, 200);
});

test('new registrations get a 30-day pilot', { skip }, async () => {
  const r = await call('POST', '/api/auth/register-center', {
    body: { centerName: 'Fresh Tuitions', ownerName: 'Lata', email: 'lata@fresh.example', phone: '', city: 'Pune', password: 'Monsoon-Rain7' },
    ip: '10.0.0.77',
  });
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  const row = (await pool.query(`SELECT plan, data FROM centers WHERE name = 'Fresh Tuitions'`)).rows[0];
  assert.equal(row.plan, 'pilot');
  assert.equal(row.data.subscription.plan, 'pilot');
  assert.equal(row.data.subscription.pilotEndsAt, sub.addDays(row.data.createdAt, 30));
});

test('sync refuses new students past the plan limit, with a reason', { skip }, async () => {
  const count = async () =>
    (
      await pool.query(`SELECT count(*)::int AS n FROM records WHERE center_id = $1 AND collection = 'students' AND deleted_at IS NULL`, [
        DEMO.center,
      ])
    ).rows[0].n;
  const existing = await count();
  // Leave room for exactly one more student.
  const set = await call('PATCH', subPath(DEMO.center), { as: 'owner', body: { studentLimit: existing + 1 } });
  assert.equal(set.statusCode, 200);

  const first = await call('POST', '/api/sync', { as: 'admin', body: { changes: [studentChange('student_new1'), studentChange('student_new2')] } });
  assert.deepEqual(
    first.body.results.map((x) => x.status),
    ['ok', 'invalid'],
  );
  assert.equal(first.body.results[1].error, 'student_limit_reached');
  assert.equal(first.body.results[1].message, `Your plan includes ${existing + 1} students. Contact us to add more.`);
  assert.equal(await count(), existing + 1);

  // Editing an existing student still works at the limit.
  const edit = await call('POST', '/api/sync', {
    as: 'admin',
    body: { changes: [{ ...studentChange('student_new1', { grade: '10' }), baseVersion: first.body.results[0].version }] },
  });
  assert.equal(edit.body.results[0].status, 'ok');

  // Removing one frees a seat for another in the same save.
  const swap = await call('POST', '/api/sync', {
    as: 'admin',
    body: {
      changes: [
        { collection: 'students', id: 'student_new1', op: 'delete', baseVersion: edit.body.results[0].version },
        studentChange('student_new3'),
      ],
    },
  });
  assert.deepEqual(
    swap.body.results.map((x) => x.status),
    ['ok', 'ok'],
  );

  // The platform owner raising the limit lets the admin add again.
  await call('PATCH', subPath(DEMO.center), { as: 'owner', body: { studentLimit: null } });
  const again = await call('POST', '/api/sync', { as: 'admin', body: { changes: [studentChange('student_new4')] } });
  assert.equal(again.body.results[0].status, 'ok');
});
