// Tutor public profiles and parent reviews: who may change what, and what the public sees.
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
});

after(async () => {
  if (pool) await dropSchema(pool, schema);
});

const USERS = {
  admin: 'user_center_admin_demo',
  anita: 'user_teacher_anita_demo',
  vikram: 'user_teacher_vikram_demo',
  family: 'user_family_sharma_demo',
};

async function call(method, path, { as, body } = {}) {
  let token = null;
  if (as) {
    const r = await pool.query('SELECT id, role, email, center_id FROM auth_users WHERE id = $1', [USERS[as]]);
    token = signAccessToken(r.rows[0], process.env.JWT_SECRET);
  }
  const req = {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body || {},
    query: {},
    socket: { remoteAddress: '10.9.9.9' },
  };
  const res = {
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
  await handleApi(req, res, path);
  return res;
}

const stored = async (collection, id) =>
  (
    await pool.query(`SELECT data, version FROM records WHERE collection = $1 AND id = $2 AND deleted_at IS NULL`, [
      collection,
      id,
    ])
  ).rows[0];
const sync = (as, changes) => call('POST', '/api/sync', { as, body: { changes } });
const one = (res) => res.body.results[0];

const profile = (title) => ({
  intro: 'Hello',
  sections: [{ id: 's1', title, items: [{ id: 'i1', text: 'Item', link: 'https://example.org' }] }],
});

test('a tutor edits only their own draft; publishing stays with the admin', { skip }, async () => {
  const row = await stored('teachers', DEMO.teacherVikram);
  const res = await sync('vikram', [
    {
      collection: 'teachers',
      id: DEMO.teacherVikram,
      op: 'upsert',
      baseVersion: row.version,
      data: {
        ...row.data,
        name: 'Renamed',
        phone: '0000000000',
        profileDraft: profile('Olympiad results'),
        profileStatus: 'published',
        publicProfile: profile('Self-published'),
      },
    },
  ]);
  assert.equal(one(res).status, 'ok');
  let after = (await stored('teachers', DEMO.teacherVikram)).data;
  assert.equal(after.profileDraft.sections[0].title, 'Olympiad results');
  assert.equal(after.name, row.data.name, 'name changed');
  assert.equal(after.phone, row.data.phone, 'phone changed');
  assert.equal(after.publicProfile, undefined, 'tutor published their own profile');
  assert.notEqual(after.profileStatus, 'published');

  // Submitting for review is allowed.
  const v = (await stored('teachers', DEMO.teacherVikram)).version;
  await sync('vikram', [
    {
      collection: 'teachers',
      id: DEMO.teacherVikram,
      op: 'upsert',
      baseVersion: v,
      data: { ...after, profileStatus: 'pending' },
    },
  ]);
  after = (await stored('teachers', DEMO.teacherVikram)).data;
  assert.equal(after.profileStatus, 'pending');

  // Not another tutor's profile.
  const anita = await stored('teachers', DEMO.teacherAnita);
  const other = await sync('vikram', [
    {
      collection: 'teachers',
      id: DEMO.teacherAnita,
      op: 'upsert',
      baseVersion: anita.version,
      data: { ...anita.data, profileDraft: profile('Hacked') },
    },
  ]);
  assert.equal(one(other).status, 'forbidden');
});

test('bad links are refused', { skip }, async () => {
  const row = await stored('teachers', DEMO.teacherVikram);
  const bad = profile('Links');
  bad.sections[0].items[0].link = 'javascript:alert(1)';
  const res = await sync('admin', [
    {
      collection: 'teachers',
      id: DEMO.teacherVikram,
      op: 'upsert',
      baseVersion: row.version,
      data: { ...row.data, profileDraft: bad },
    },
  ]);
  assert.equal(one(res).status, 'invalid');
});

test('the public sees only published profiles, never drafts, phone or email', { skip }, async () => {
  let list = (await call('GET', '/api/public/centers')).body.centers.find((c) => c.id === DEMO.center);
  const ids = list._tutors.map((t) => t.id);
  assert.deepEqual(ids, [DEMO.teacherAnita], 'Vikram (draft only) is public');
  const json = JSON.stringify(list._tutors);
  assert.ok(!json.includes('anita@tutorhub.com') && !json.includes('9876001001'), 'contact details leaked');
  assert.ok(!json.includes('profileDraft'));

  // Admin publishes Vikram's draft.
  const row = await stored('teachers', DEMO.teacherVikram);
  await sync('admin', [
    {
      collection: 'teachers',
      id: DEMO.teacherVikram,
      op: 'upsert',
      baseVersion: row.version,
      data: { ...row.data, publicProfile: row.data.profileDraft, profileStatus: 'published' },
    },
  ]);
  list = (await call('GET', '/api/public/centers')).body.centers.find((c) => c.id === DEMO.center);
  assert.equal(
    list._tutors.find((t) => t.id === DEMO.teacherVikram)?.publicProfile.sections[0].title,
    'Olympiad results',
  );
});

test("parents review only their child's tutor; reviews go live, the admin can hide them", { skip }, async () => {
  const id = `rev_${DEMO.teacherVikram}_${DEMO.studentAarav}`;
  const notMine = await sync('family', [
    {
      collection: 'tutorReviews',
      id,
      op: 'upsert',
      data: { id, teacherId: DEMO.teacherVikram, studentId: DEMO.studentAarav, rating: 1, status: 'visible' },
    },
  ]);
  assert.equal(one(notMine).status, 'forbidden', "reviewed a tutor who doesn't teach their child");

  const rid = `rev_${DEMO.teacherAnita}_${DEMO.studentAarav}`;
  const existing = await stored('tutorReviews', rid);
  const res = await sync('family', [
    {
      collection: 'tutorReviews',
      id: rid,
      op: 'upsert',
      baseVersion: existing.version,
      data: { ...existing.data, rating: 4, comment: 'Updated by parent', status: 'visible' },
    },
  ]);
  assert.equal(one(res).status, 'ok');
  let list = (await call('GET', '/api/public/centers')).body.centers.find((c) => c.id === DEMO.center);
  const anita = list._tutors.find((t) => t.id === DEMO.teacherAnita);
  assert.equal(anita.reviews[0].comment, 'Updated by parent');
  assert.equal(anita.reviews[0].name, 'Rajesh', 'only the first name is public');
  assert.equal(anita.rating, 4);

  // Admin hides it; the parent editing again can't bring it back.
  let row = await stored('tutorReviews', rid);
  await sync('admin', [
    {
      collection: 'tutorReviews',
      id: rid,
      op: 'upsert',
      baseVersion: row.version,
      data: { ...row.data, status: 'hidden' },
    },
  ]);
  row = await stored('tutorReviews', rid);
  await sync('family', [
    {
      collection: 'tutorReviews',
      id: rid,
      op: 'upsert',
      baseVersion: row.version,
      data: { ...row.data, comment: 'again', status: 'visible' },
    },
  ]);
  assert.equal((await stored('tutorReviews', rid)).data.status, 'hidden');
  list = (await call('GET', '/api/public/centers')).body.centers.find((c) => c.id === DEMO.center);
  assert.equal(list._tutors.find((t) => t.id === DEMO.teacherAnita).reviews.length, 0);

  // Teachers see reviews about themselves only.
  const boot = await call('GET', '/api/bootstrap', { as: 'vikram' });
  assert.equal(boot.body.data.tutorReviews.filter((r) => r.teacherId !== DEMO.teacherVikram).length, 0);
});
