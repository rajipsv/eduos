// Stages 5 and 6: encrypted center secrets, server-side AI and WhatsApp, developer API keys,
// public marketplace inquiries. OpenAI and WhatsApp calls are stubbed; nothing leaves the machine.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { skip, useScratchSchema, createSchema, dropSchema } from './helpers.js';

const schema = useScratchSchema();
process.env.SECRETS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
delete process.env.OPENAI_API_KEY;

let pool;
let handleApi;
let signAccessToken;
let DEMO;
const outbound = [];
const realFetch = globalThis.fetch;

before(async () => {
  if (skip) return;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.openai.com/') || u.startsWith('https://graph.facebook.com/')) {
      outbound.push({ url: u, auth: init.headers?.Authorization, body: JSON.parse(init.body) });
      const body = u.includes('openai')
        ? { choices: [{ message: { content: 'stub reply' } }] }
        : { messages: [{ id: 'wamid.1' }] };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(url, init);
  };
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
};

async function call(method, path, { as, body, ip = '10.0.0.1' } = {}) {
  let token = null;
  if (as) {
    const r = await pool.query('SELECT id, role, email, center_id FROM auth_users WHERE id = $1', [USERS[as]]);
    token = signAccessToken(r.rows[0], process.env.JWT_SECRET);
  }
  const req = {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'x-forwarded-for': ip },
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
  };
  await handleApi(req, res, path);
  return res;
}

test('the migration took API keys out of synced settings', { skip }, async () => {
  const r = await pool.query(`SELECT data FROM records WHERE collection = 'centerSettings' AND center_id = $1`, [
    DEMO.center,
  ]);
  for (const f of ['openaiApiKey', 'whatsappApiKey', 'whatsappPhoneId']) assert.ok(!(f in r.rows[0].data), f);
  const keys = await pool.query(`SELECT count(*)::int AS n FROM records WHERE collection = 'apiKeys'`);
  assert.equal(keys.rows[0].n, 0);
  assert.equal((await pool.query(`SELECT to_regclass('app_state') AS t`)).rows[0].t, null);
});

test('only admins save secrets; they are stored encrypted and never sent back', { skip }, async () => {
  const body = { openaiApiKey: 'sk-test-123', whatsappApiKey: 'EAAG-test-token', whatsappPhoneId: '1234567890' };
  assert.equal((await call('PUT', '/api/settings/secrets', { as: 'anita', body })).statusCode, 403);

  const saved = await call('PUT', '/api/settings/secrets', { as: 'admin', body });
  assert.equal(saved.statusCode, 200);
  assert.deepEqual({ ai: saved.body.status.ai, whatsapp: saved.body.status.whatsapp }, { ai: true, whatsapp: true });

  const row = (await pool.query('SELECT * FROM center_secrets WHERE center_id = $1', [DEMO.center])).rows[0];
  assert.ok(row.openai_api_key_enc.startsWith('v1:'));
  assert.ok(!row.openai_api_key_enc.includes('sk-test-123'));

  for (const who of ['admin', 'anita', 'family']) {
    const boot = await call('GET', '/api/bootstrap', { as: who });
    const json = JSON.stringify(boot.body);
    assert.ok(!json.includes('sk-test-123') && !json.includes('EAAG-test-token'), `${who} saw a secret`);
    assert.equal(boot.body.data.integrationStatus.ai, true);
  }

  // Saving settings through sync can't sneak a key back into the shared record.
  const boot = await call('GET', '/api/bootstrap', { as: 'admin' });
  const settings = boot.body.data.centerSettings[DEMO.center];
  const v = boot.body.versions.centerSettings[DEMO.center];
  await call('POST', '/api/sync', {
    as: 'admin',
    body: {
      changes: [
        {
          collection: 'centerSettings',
          id: DEMO.center,
          op: 'upsert',
          baseVersion: v,
          data: { ...settings, openaiApiKey: 'sk-leak' },
        },
      ],
    },
  });
  const after = (
    await pool.query(`SELECT data FROM records WHERE collection = 'centerSettings' AND id = $1`, [DEMO.center])
  ).rows[0].data;
  assert.equal(after.openaiApiKey, undefined);
});

test('AI chat runs on the server with the center key and only what the user may see', { skip }, async () => {
  outbound.length = 0;
  const res = await call('POST', '/api/ai/chat', {
    as: 'family',
    body: { message: 'How is my child doing?', role: 'owner' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.reply, 'stub reply');
  const sent = outbound[0];
  assert.equal(sent.auth, 'Bearer sk-test-123');
  const system = sent.body.messages[0].content;
  assert.match(system, /AI Parent Assistant/, 'a parent cannot pick the owner persona');
  assert.match(system, /Aarav/);
  assert.ok(!/Priya|Rohan/.test(system), 'context leaked another child');
});

test('families can only WhatsApp their teacher or themselves', { skip }, async () => {
  outbound.length = 0;
  const toStranger = await call('POST', '/api/whatsapp/send', {
    as: 'family',
    body: { to: '9999999999', message: 'hi' },
  });
  assert.equal(toStranger.statusCode, 403);
  const toTeacher = await call('POST', '/api/whatsapp/send', {
    as: 'family',
    body: { to: '+91 98760 01001', message: 'hi' },
  });
  assert.equal(toTeacher.body.status, 'sent');
  assert.equal(outbound.length, 1);
  assert.equal(outbound[0].auth, 'Bearer EAAG-test-token');
  const byAdmin = await call('POST', '/api/whatsapp/send', { as: 'admin', body: { to: '9999999999', message: 'hi' } });
  assert.equal(byAdmin.body.status, 'sent');
});

test('removing a key turns the feature off', { skip }, async () => {
  const res = await call('PUT', '/api/settings/secrets', { as: 'admin', body: { openaiApiKey: '' } });
  assert.equal(res.body.status.ai, false);
  assert.equal(res.body.status.whatsapp, true, 'other secrets kept');
  const chat = await call('POST', '/api/ai/chat', { as: 'admin', body: { message: 'hello' } });
  assert.equal(chat.statusCode, 503);
});

test('developer API keys: shown once, stored as a hash, revocable', { skip }, async () => {
  assert.equal((await call('POST', '/api/api-keys', { as: 'anita', body: { name: 'x' } })).statusCode, 403);
  const created = await call('POST', '/api/api-keys', { as: 'admin', body: { name: 'Zapier' } });
  assert.equal(created.statusCode, 201);
  const { key, apiKey } = created.body;
  assert.match(key, /^tsk_/);
  const row = (await pool.query('SELECT key_hash, key_prefix FROM center_api_keys WHERE id = $1', [apiKey.id])).rows[0];
  assert.notEqual(row.key_hash, key);
  assert.equal(row.key_prefix, key.slice(0, 10));
  const boot = await call('GET', '/api/bootstrap', { as: 'admin' });
  assert.ok(!JSON.stringify(boot.body).includes(key));
  assert.deepEqual(
    boot.body.data.apiKeys.map((k) => k.name),
    ['Zapier'],
  );
  assert.equal((await call('DELETE', `/api/api-keys/${apiKey.id}`, { as: 'admin' })).statusCode, 200);
  assert.equal((await call('GET', '/api/bootstrap', { as: 'admin' })).body.data.apiKeys.length, 0);
});

test('a marketplace inquiry becomes a lead in that center', { skip }, async () => {
  const res = await call('POST', `/api/public/centers/${DEMO.center}/inquiries`, {
    body: { name: 'Guest Parent', phone: '9811111111', childName: 'Kid', grade: '7', message: 'Weekend batch?' },
    ip: '10.1.1.1',
  });
  assert.equal(res.statusCode, 201);
  const boot = await call('GET', '/api/bootstrap', { as: 'admin' });
  const lead = boot.body.data.leads.find((l) => l.parentName === 'Guest Parent');
  assert.ok(lead, 'lead not created');
  assert.equal(lead.name, 'Kid');
  assert.equal(lead.stage, 'inquiry');
  assert.equal(lead.source, 'Guest Marketplace');
  assert.ok(lead.branchId);
  const stored = await pool.query('SELECT count(*)::int AS n FROM public_inquiries WHERE center_id = $1', [
    DEMO.center,
  ]);
  assert.equal(stored.rows[0].n, 1);
});

test('inquiries: validation, honeypot, unknown center, and the 6th in a minute is refused', { skip }, async () => {
  const ip = '10.2.2.2';
  const post = (body, center = DEMO.center) => call('POST', `/api/public/centers/${center}/inquiries`, { body, ip });
  assert.equal((await post({ name: 'No contact' })).statusCode, 400);
  assert.equal((await post({ name: 'Bot', phone: '1', website: 'spam.example' })).statusCode, 201);
  assert.equal((await post({ name: 'x', phone: '9800000000' }, 'center_nope')).statusCode, 404);
  assert.equal((await post({ name: 'ok', phone: '9800000001' })).statusCode, 201);
  assert.equal((await post({ name: 'ok', phone: '9800000002' })).statusCode, 201);
  const sixth = await post({ name: 'too many', phone: '9800000003' });
  assert.equal(sixth.statusCode, 429);
  const bots = await pool.query(`SELECT count(*)::int AS n FROM public_inquiries WHERE data->>'name' = 'Bot'`);
  assert.equal(bots.rows[0].n, 0);
});

test('demo requests from the start page are stored in the database', { skip }, async () => {
  const res = await call('POST', '/api/leads', {
    body: {
      first_name: 'Start',
      last_name: 'Page',
      center_name: 'SP Academy',
      city: 'Pune',
      phone: '9822222222',
      email: 'sp@example.com',
      students: '40-100',
      center_type: 'Academic',
      pain: 'Lost leads',
    },
    ip: '10.3.3.3',
  });
  assert.ok([200, 201].includes(res.statusCode), JSON.stringify(res.body));
  const stored = await pool.query(`SELECT data FROM platform_inbound_leads WHERE data->>'centerName' = 'SP Academy'`);
  assert.equal(stored.rowCount, 1);
  const again = await call('POST', '/api/leads', { body: { first_name: 'Again' }, ip: '10.3.3.3' });
  assert.equal(again.statusCode, 429);
});
