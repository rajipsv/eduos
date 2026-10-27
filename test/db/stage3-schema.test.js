// Stage 3: migrations, the app_state import and the demo seed, against a scratch schema.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { skip, useScratchSchema, createSchema, dropSchema } from './helpers.js';

const schema = useScratchSchema();
let pool;
let mods;

before(async () => {
  if (skip) return;
  const { getPool } = await import('../../server/db.js');
  pool = getPool();
  await createSchema(pool, schema);
  mods = {
    migrate: await import('../../server/migrate.js'),
    seed: await import('../../server/demo-seed.js'),
    users: await import('../../server/auth/users.js'),
    crypto: await import('../../server/auth/crypto.js'),
  };
});

after(async () => {
  if (pool) await dropSchema(pool, schema);
});

test('migrations import the old app_state and are applied only once', { skip }, async () => {
  // Lay down the pre-migration schema with an old-style document and an orphaned login.
  const fs = await import('node:fs');
  const baseline = new URL('../../server/migrations/000_baseline.sql', import.meta.url);
  await pool.query(fs.readFileSync(baseline, 'utf8'));
  const blob = mods.seed.buildFullDemoState();
  await pool.query(`INSERT INTO app_state (id, data) VALUES ('global', $1)`, [blob]);
  await pool.query(
    `INSERT INTO auth_users (id, email, password_hash, role, name, center_id)
     VALUES ('user_orphan', 'orphan@example.com', 'x', 'center_admin', 'Orphan', 'center_missing')`,
  );

  const first = await mods.migrate.runMigrations({ log: () => {} });
  assert.deepEqual(first, mods.migrate.listMigrations());
  assert.deepEqual(await mods.migrate.runMigrations({ log: () => {} }), []);

  // Row counts per collection match the document.
  const counts = await pool.query(
    `SELECT collection, count(*)::int AS n FROM records WHERE center_id = 'center_brightminds_demo' GROUP BY 1`,
  );
  const got = Object.fromEntries(counts.rows.map((r) => [r.collection, r.n]));
  for (const key of ['students', 'teachers', 'batches', 'leads', 'attendance', 'tests', 'assignments', 'skills']) {
    assert.equal(got[key], blob[key].length, `${key} count`);
  }
  assert.equal(got.tutorAvailability, Object.keys(blob.tutorAvailability).length);
  assert.equal(got.publicSite, 1);

  // The orphaned login got a placeholder center with settings and a branch.
  const orphan = await pool.query(`SELECT name FROM centers WHERE id = 'center_missing'`);
  assert.equal(orphan.rows[0].name, "Orphan's center");
  const extras = await pool.query(
    `SELECT collection FROM records WHERE center_id = 'center_missing' ORDER BY collection`,
  );
  assert.deepEqual(
    extras.rows.map((r) => r.collection),
    ['branches', 'centerSettings'],
  );
});

test('a login must belong to an existing center', { skip }, async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO auth_users (id, email, password_hash, role, name, center_id)
       VALUES ('u_bad', 'bad@example.com', 'x', 'teacher', 'Bad', 'no_such_center')`,
    ),
    /auth_users_center_fk/,
  );
});

test('demo seed is repeatable and never touches real users', { skip }, async () => {
  const realHash = mods.crypto.hashPassword('real-user-password');
  await mods.users.upsertAuthUser({
    id: 'user_real',
    email: 'real@example.com',
    passwordHash: realHash,
    role: 'center_admin',
    name: 'Real',
    centerId: 'center_missing',
  });
  await pool.query(
    `INSERT INTO records (center_id, collection, id, data) VALUES ('center_missing', 'students', 's_real', '{"id":"s_real"}')`,
  );

  const a = await mods.seed.seedDemo();
  const b = await mods.seed.seedDemo();
  assert.equal(a.records, b.records);

  const real = await pool.query(`SELECT password_hash FROM auth_users WHERE id = 'user_real'`);
  assert.equal(real.rows[0].password_hash, realHash);
  const kept = await pool.query(`SELECT 1 FROM records WHERE center_id = 'center_missing' AND id = 's_real'`);
  assert.equal(kept.rowCount, 1);

  const demo = await pool.query(
    `SELECT count(*)::int AS n FROM auth_users WHERE email LIKE '%.demo' OR email LIKE '%tutorhub.com' OR email = 'owner@tutorsala.app'`,
  );
  assert.equal(demo.rows[0].n, 5);
});
