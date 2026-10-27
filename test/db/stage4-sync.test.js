// Stage 4: bootstrap, sync and the per-role rules, through the real router and a
// seeded scratch schema.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { skip, useScratchSchema, createSchema, dropSchema } from './helpers.js';

const schema = useScratchSchema();
let pool;
let handleApi;
let signAccessToken;
let DEMO;

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

  // A second center with its own admin.
  const { createCenterWithDefaults } = await import('../../server/db/centers.js');
  const { insertUser } = await import('../../server/auth/users.js');
  await createCenterWithDefaults(pool, { id: 'center_other', name: 'Other Academy', status: 'active', plan: 'trial' });
  await insertUser({
    id: 'user_other_admin',
    email: 'admin@other.test',
    passwordHash: 'x',
    role: 'center_admin',
    name: 'Other',
    centerId: 'center_other',
  });
  await pool.query(
    `INSERT INTO records (center_id, collection, id, data) VALUES ('center_other', 'students', 'student_other', '{"id":"student_other","name":"Other Kid","centerId":"center_other"}')`,
  );
});

after(async () => {
  if (pool) await dropSchema(pool, schema);
});

const USERS = {
  owner: 'user_platform_owner_demo',
  admin: 'user_center_admin_demo',
  anita: 'user_teacher_anita_demo', // teaches Grade 10 Science (Aarav, Priya)
  vikram: 'user_teacher_vikram_demo', // teaches Grade 8 Math (Rohan)
  family: 'user_family_sharma_demo', // parent of Aarav
  other: 'user_other_admin',
};

async function call(method, path, { as, body, headers = {}, query = {} } = {}) {
  const r = await pool.query('SELECT id, role, email, center_id FROM auth_users WHERE id = $1', [USERS[as] || as]);
  const token = as ? signAccessToken(r.rows[0], process.env.JWT_SECRET) : null;
  const req = {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body || {},
    query,
    socket: { remoteAddress: '127.0.0.1' },
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

const bootstrap = (as, headers) => call('GET', '/api/bootstrap', { as, headers });
const sync = (as, changes, headers) => call('POST', '/api/sync', { as, body: { changes }, headers });
const one = (res) => res.body.results[0];

async function stored(collection, id, centerId = DEMO.center) {
  const r = await pool.query(
    'SELECT data, version FROM records WHERE center_id = $1 AND collection = $2 AND id = $3 AND deleted_at IS NULL',
    [centerId, collection, id],
  );
  return r.rows[0] || null;
}

test('signed-out requests are refused; unknown routes 404; wrong method 405', { skip }, async () => {
  assert.equal((await call('GET', '/api/bootstrap')).statusCode, 401);
  assert.equal((await call('POST', '/api/sync', { body: { changes: [] } })).statusCode, 401);
  assert.equal((await call('GET', '/api/state')).statusCode, 404);
  assert.equal((await call('GET', '/api/sync')).statusCode, 405);
});

test('admin sees the whole center; other centers stay invisible', { skip }, async () => {
  const res = await bootstrap('admin');
  assert.equal(res.statusCode, 200);
  const { data } = res.body;
  assert.equal(data.students.length, 3);
  assert.equal(data.leads.length, 5);
  assert.deepEqual(
    data.centers.map((c) => c.id),
    [DEMO.center],
  );
  assert.equal(data.users.length, 4); // the center's logins, not the platform owner
  assert.ok(!JSON.stringify(res.body).includes('student_other'));

  // X-Center-Id is ignored for everyone but the platform owner.
  const other = await bootstrap('admin', { 'x-center-id': 'center_other' });
  assert.equal(other.body.centerId, DEMO.center);
});

test("a parent sees only their own child, with other children's data removed", { skip }, async () => {
  const res = await bootstrap('family');
  const json = JSON.stringify(res.body);
  assert.deepEqual(
    res.body.data.students.map((s) => s.id),
    [DEMO.studentAarav],
  );
  assert.ok(!json.includes(DEMO.studentPriya), 'classmate id leaked');
  assert.ok(!json.includes(DEMO.studentRohan), 'other batch leaked');
  assert.equal(res.body.data.leads?.length || 0, 0);
  assert.equal(res.body.data.invoices?.length || 0, 0);
  assert.equal(res.body.data.teachers.length, 1);
  assert.equal(res.body.data.teachers[0].email, 'anita@tutorhub.com');
  assert.equal(res.body.data.users.length, 1);
  const settings = res.body.data.centerSettings[DEMO.center];
  assert.equal(settings.openaiApiKey, undefined);
  assert.equal(settings.whatsappApiKey, undefined);
});

test('a teacher sees their own batches and students only', { skip }, async () => {
  const res = await bootstrap('vikram');
  assert.deepEqual(
    res.body.data.batches.map((b) => b.id),
    [DEMO.batchMath],
  );
  assert.deepEqual(
    res.body.data.students.map((s) => s.id),
    [DEMO.studentRohan],
  );
  assert.equal(res.body.data.leads?.length || 0, 0);
  assert.equal(res.body.data.invoices?.length || 0, 0);
});

test('admin can add, edit and delete records; versions go up', { skip }, async () => {
  const created = await sync('admin', [
    { collection: 'leads', id: 'lead_new', op: 'upsert', data: { id: 'lead_new', name: 'New Lead', stage: 'lead' } },
  ]);
  assert.equal(one(created).status, 'ok');
  assert.equal(one(created).record.centerId, DEMO.center, 'server sets the center');
  const v1 = one(created).version;

  const edited = await sync('admin', [
    {
      collection: 'leads',
      id: 'lead_new',
      op: 'upsert',
      baseVersion: v1,
      data: { id: 'lead_new', name: 'Renamed', stage: 'demo' },
    },
  ]);
  assert.equal(one(edited).status, 'ok');
  assert.equal(one(edited).version, v1 + 1);

  const deleted = await sync('admin', [{ collection: 'leads', id: 'lead_new', op: 'delete', baseVersion: v1 + 1 }]);
  assert.equal(one(deleted).status, 'ok');
  assert.equal(await stored('leads', 'lead_new'), null);
});

test('an out-of-date edit is a conflict and returns the current copy', { skip }, async () => {
  const before = await stored('leads', 'lead_demo_1');
  const first = await sync('admin', [
    {
      collection: 'leads',
      id: 'lead_demo_1',
      op: 'upsert',
      baseVersion: before.version,
      data: { ...before.data, notes: 'first' },
    },
  ]);
  assert.equal(one(first).status, 'ok');
  const second = await sync('admin', [
    {
      collection: 'leads',
      id: 'lead_demo_1',
      op: 'upsert',
      baseVersion: before.version,
      data: { ...before.data, notes: 'second' },
    },
  ]);
  assert.equal(one(second).status, 'conflict');
  assert.equal(one(second).record.notes, 'first');
  assert.equal((await stored('leads', 'lead_demo_1')).data.notes, 'first');
});

test("a teacher can't write to another teacher's batch", { skip }, async () => {
  const att = {
    id: 'att_x',
    batchId: DEMO.batchScience,
    date: '2025-08-01',
    records: { [DEMO.studentAarav]: 'present' },
  };
  assert.equal(
    one(await sync('vikram', [{ collection: 'attendance', id: 'att_x', op: 'upsert', data: att }])).status,
    'forbidden',
  );
  // Anita teaches that batch.
  assert.equal(
    one(await sync('anita', [{ collection: 'attendance', id: 'att_x', op: 'upsert', data: att }])).status,
    'ok',
  );
  // Vikram can't move it into his batch either.
  const row = await stored('attendance', 'att_x');
  const moved = await sync('vikram', [
    {
      collection: 'attendance',
      id: 'att_x',
      op: 'upsert',
      baseVersion: row.version,
      data: { ...att, batchId: DEMO.batchMath },
    },
  ]);
  assert.equal(one(moved).status, 'forbidden');
  assert.equal(
    one(await sync('vikram', [{ collection: 'leads', id: 'l', op: 'upsert', data: { id: 'l', name: 'x' } }])).status,
    'forbidden',
  );
});

test('a teacher may update session status but nothing else on the batch', { skip }, async () => {
  const row = await stored('batches', DEMO.batchMath);
  const batch = structuredClone(row.data);
  batch.name = 'Hijacked';
  batch.monthlyFee = 1;
  batch.sessions[0].status = 'completed';
  batch.sessions.push({ id: 'extra', topic: 'x' });
  const res = await sync('vikram', [
    { collection: 'batches', id: DEMO.batchMath, op: 'upsert', baseVersion: row.version, data: batch },
  ]);
  assert.equal(one(res).status, 'ok');
  const after = (await stored('batches', DEMO.batchMath)).data;
  assert.equal(after.name, row.data.name);
  assert.equal(after.monthlyFee, row.data.monthlyFee);
  assert.equal(after.sessions[0].status, 'completed');
  assert.equal(after.sessions.length, row.data.sessions.length);
});

test("a parent can't write attendance, but can submit their own child's homework", { skip }, async () => {
  const att = {
    id: 'att_p',
    batchId: DEMO.batchScience,
    date: '2025-08-02',
    records: { [DEMO.studentAarav]: 'present' },
  };
  assert.equal(
    one(await sync('family', [{ collection: 'attendance', id: 'att_p', op: 'upsert', data: att }])).status,
    'forbidden',
  );

  const { body } = await bootstrap('family');
  const hw = body.data.assignments.find((a) => a.batchId === DEMO.batchScience && a.submissions[DEMO.studentAarav]);
  const version = body.versions.assignments[hw.id];
  const edited = structuredClone(hw);
  edited.title = 'Changed title';
  edited.submissions[DEMO.studentAarav] = { status: 'submitted', submittedAt: '2025-08-02', grade: 'A+' };
  edited.submissions[DEMO.studentPriya] = { status: 'submitted', grade: 'A+' };
  const res = await sync('family', [
    { collection: 'assignments', id: hw.id, op: 'upsert', baseVersion: version, data: edited },
  ]);
  assert.equal(one(res).status, 'ok');

  const saved = (await stored('assignments', hw.id)).data;
  assert.notEqual(saved.title, 'Changed title');
  assert.equal(saved.submissions[DEMO.studentAarav].status, 'submitted');
  assert.notEqual(saved.submissions[DEMO.studentAarav].grade, 'A+', 'parents cannot grade');
  assert.notEqual(saved.submissions[DEMO.studentPriya]?.grade, 'A+', "another child's submission changed");
  assert.ok(!JSON.stringify(one(res).record).includes(DEMO.studentPriya), 'reply leaked a classmate');
});

test('reduced copies and bad data are rejected', { skip }, async () => {
  const { body } = await bootstrap('anita');
  const settings = body.data.centerSettings[DEMO.center];
  assert.equal(settings._projected, true);
  assert.equal(
    one(
      await sync('admin', [
        {
          collection: 'centerSettings',
          id: DEMO.center,
          op: 'upsert',
          baseVersion: body.versions.centerSettings[DEMO.center],
          data: settings,
        },
      ]),
    ).status,
    'invalid',
  );
  const bad = await sync('admin', [
    { collection: 'students', id: 's_bad', op: 'upsert', data: { id: 's_bad', name: 42 } },
  ]);
  assert.equal(one(bad).status, 'invalid');
  const big = await sync('admin', [
    { collection: 'leads', id: 'l_big', op: 'upsert', data: { id: 'l_big', name: 'x', notes: 'x'.repeat(250000) } },
  ]);
  assert.equal(one(big).status, 'invalid');
  const mismatch = await sync('admin', [
    { collection: 'leads', id: 'l_a', op: 'upsert', data: { id: 'l_b', name: 'x' } },
  ]);
  assert.equal(one(mismatch).status, 'invalid');
  assert.equal((await sync('admin', [{ collection: 'nope', id: 'x', op: 'upsert', data: {} }])).statusCode, 400);
});

test('a center admin can edit their center listing but not its status or other centers', { skip }, async () => {
  const { body } = await bootstrap('admin');
  const center = body.data.centers[0];
  const v = body.versions.centers[center.id];
  const res = await sync('admin', [
    {
      collection: 'centers',
      id: center.id,
      op: 'upsert',
      baseVersion: v,
      data: { ...center, publicTagline: 'New tagline', status: 'suspended', plan: 'enterprise' },
    },
  ]);
  assert.equal(one(res).status, 'ok');
  const row = (await pool.query('SELECT status, plan, data FROM centers WHERE id = $1', [center.id])).rows[0];
  assert.equal(row.data.publicTagline, 'New tagline');
  assert.equal(row.status, 'active');
  assert.equal(row.plan, 'trial');
  const other = await sync('admin', [
    {
      collection: 'centers',
      id: 'center_other',
      op: 'upsert',
      baseVersion: 1,
      data: { id: 'center_other', name: 'Mine now' },
    },
  ]);
  assert.equal(one(other).status, 'forbidden');
});

test('platform owner: centers overview, then a chosen center; changes are audited', { skip }, async () => {
  const overview = await bootstrap('owner');
  assert.equal(overview.body.centerId, null);
  assert.equal(overview.body.data.students, undefined);
  assert.ok(overview.body.data.centers.length >= 2);
  assert.equal(overview.body.centerStats[DEMO.center].students, 3);

  const viewing = await bootstrap('owner', { 'x-center-id': 'center_other' });
  assert.deepEqual(
    viewing.body.data.students.map((s) => s.id),
    ['student_other'],
  );

  const res = await sync(
    'owner',
    [{ collection: 'leads', id: 'lead_owner', op: 'upsert', data: { id: 'lead_owner', name: 'Owner lead' } }],
    { 'x-center-id': 'center_other' },
  );
  assert.equal(one(res).status, 'ok');
  assert.ok(await stored('leads', 'lead_owner', 'center_other'));

  const ov = overview.body.versions.centers.center_other;
  const suspend = await sync('owner', [
    {
      collection: 'centers',
      id: 'center_other',
      op: 'upsert',
      baseVersion: ov,
      data: { ...overview.body.data.centers.find((c) => c.id === 'center_other'), status: 'suspended' },
    },
  ]);
  assert.equal(one(suspend).status, 'ok');

  const log = await pool.query(`SELECT action, collection, record_id FROM audit_log WHERE user_id = $1 ORDER BY id`, [
    USERS.owner,
  ]);
  assert.deepEqual(
    log.rows.map((r) => `${r.action}:${r.record_id}`),
    ['upsert:lead_owner', 'center_status:center_other'],
  );
  assert.equal(
    (await sync('owner', [{ collection: 'leads', id: 'x', op: 'upsert', data: { id: 'x', name: 'x' } }])).statusCode,
    400,
  );
});

test('logins: admins manage their own center only; others cannot', { skip }, async () => {
  const created = await call('POST', '/api/users', {
    as: 'admin',
    body: { email: 'new.teacher@test.dev', name: 'New Teacher', role: 'teacher', linkedTeacherId: DEMO.teacherAnita },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.user.centerId, DEMO.center);

  const dup = await call('POST', '/api/users', {
    as: 'admin',
    body: { email: 'new.teacher@test.dev', name: 'x', role: 'teacher' },
  });
  assert.equal(dup.statusCode, 409);
  const owner = await call('POST', '/api/users', {
    as: 'admin',
    body: { email: 'o@test.dev', name: 'x', role: 'platform_owner' },
  });
  assert.equal(owner.statusCode, 400);
  const byTeacher = await call('POST', '/api/users', {
    as: 'anita',
    body: { email: 't@test.dev', name: 'x', role: 'teacher' },
  });
  assert.equal(byTeacher.statusCode, 403);

  const patched = await call('PATCH', `/api/users/${USERS.family}`, {
    as: 'admin',
    body: { linkedStudentIds: [DEMO.studentAarav, DEMO.studentRohan] },
  });
  assert.equal(patched.statusCode, 200);
  assert.deepEqual(patched.body.user.linkedStudentIds, [DEMO.studentAarav, DEMO.studentRohan]);
  const cross = await call('PATCH', `/api/users/${USERS.family}`, { as: 'other', body: { name: 'Mine' } });
  assert.equal(cross.statusCode, 404);
});

test('public center listing shows listed centers with public fields only', { skip }, async () => {
  const res = await call('GET', '/api/public/centers');
  const demo = res.body.centers.find((c) => c.id === DEMO.center);
  assert.ok(demo);
  assert.equal(demo.ownerEmail, undefined);
  assert.equal(demo._stats.students, 3);
  assert.ok(!res.body.centers.some((c) => c.id === 'center_other'), 'suspended center listed');
});
