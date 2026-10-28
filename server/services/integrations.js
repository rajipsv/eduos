// @ts-check
// Center API secrets (OpenAI, WhatsApp), the AI chat and WhatsApp sending.
// Secrets are only ever used here, on the server; browsers see "configured" or not.
import { z } from 'zod';
import { getPool } from '../db.js';
import { loadRecords } from '../db/records.js';
import { canEncrypt, encryptSecret, decryptSecret } from '../secrets.js';
import { hitRateLimit } from '../rate-limit.js';
import { FAMILY_ROLES } from '../../js/sync-rules.js';
import { buildContext, project } from './access.js';
import { resolveCenter } from './bootstrap.js';

const OPENAI_MODEL = () => process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function centerScope(user, req) {
  const scope = await resolveCenter(getPool(), user, req);
  if (scope.error) return { error: { status: scope.status, body: { error: scope.error } } };
  if (!scope.centerId) return { error: { status: 400, body: { error: 'no_center_selected' } } };
  return { centerId: scope.centerId };
}

async function loadSecrets(db, centerId) {
  const r = await db.query('SELECT * FROM center_secrets WHERE center_id = $1', [centerId]);
  return r.rows[0] || null;
}

/** What is set up for a center, safe to show anyone in it. */
export async function integrationStatus(db, centerId) {
  const row = await loadSecrets(db, centerId);
  return {
    ai: Boolean(row?.openai_api_key_enc || process.env.OPENAI_API_KEY),
    whatsapp: Boolean(row?.whatsapp_token_enc && row?.whatsapp_phone_id),
    // Which of them the center set itself (the AI may also come from the platform's key).
    centerOpenAi: Boolean(row?.openai_api_key_enc),
    centerWhatsapp: Boolean(row?.whatsapp_token_enc),
    whatsappPhoneId: row?.whatsapp_phone_id || '',
  };
}

// Each field: a string sets it, '' or null removes it, missing leaves it as is.
const secretsSchema = z.object({
  openaiApiKey: z.string().max(500).nullable().optional(),
  whatsappApiKey: z.string().max(1000).nullable().optional(),
  whatsappPhoneId: z.string().max(50).nullable().optional(),
});

/** PUT /api/settings/secrets (center admin) */
export async function saveSecrets(user, req) {
  if (!['center_admin', 'platform_owner'].includes(user.role)) return { status: 403, body: { error: 'forbidden' } };
  const scope = await centerScope(user, req);
  if (scope.error) return scope.error;
  const parsed = secretsSchema.safeParse(req.body);
  if (!parsed.success) return { status: 400, body: { error: 'invalid_body' } };
  const input = parsed.data;

  const setsSecret = [input.openaiApiKey, input.whatsappApiKey].some((v) => typeof v === 'string' && v.trim());
  if (setsSecret && !canEncrypt()) return { status: 503, body: { error: 'encryption_key_missing' } };

  const db = getPool();
  const row = (await loadSecrets(db, scope.centerId)) || {};
  const next = {
    openai: row.openai_api_key_enc || null,
    whatsapp: row.whatsapp_token_enc || null,
    phoneId: row.whatsapp_phone_id || null,
  };
  const apply = (value, current, encrypt) => {
    if (value === undefined) return current;
    const v = (value || '').trim();
    if (!v) return null;
    return encrypt ? encryptSecret(v) : v;
  };
  next.openai = apply(input.openaiApiKey, next.openai, true);
  next.whatsapp = apply(input.whatsappApiKey, next.whatsapp, true);
  next.phoneId = apply(input.whatsappPhoneId, next.phoneId, false);

  await db.query(
    `INSERT INTO center_secrets (center_id, openai_api_key_enc, whatsapp_token_enc, whatsapp_phone_id, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (center_id) DO UPDATE SET openai_api_key_enc = $2, whatsapp_token_enc = $3,
       whatsapp_phone_id = $4, updated_at = NOW()`,
    [scope.centerId, next.openai, next.whatsapp, next.phoneId],
  );
  await db.query(
    `INSERT INTO audit_log (user_id, role, center_id, action, detail) VALUES ($1, $2, $3, 'secrets_updated', $4)`,
    [user.id, user.role, scope.centerId, { fields: Object.keys(input) }],
  );
  return { status: 200, body: { status: await integrationStatus(db, scope.centerId) } };
}

// --- AI chat ------------------------------------------------------------------------------

const SYSTEM_PROMPTS = {
  owner:
    'You are an AI Academy Manager for Tutorsala. Help owners with operations, decisions, capacity, leads, and business health. Be concise and actionable.',
  tutor:
    'You are an AI Lesson Assistant for Tutorsala tutors. Help generate lesson plans, quizzes, homework, and teaching strategies.',
  parent:
    "You are an AI Parent Assistant for Tutorsala. Help parents understand their child's progress and how to support learning at home.",
  student:
    'You are an AI Tutor for students on Tutorsala. Explain concepts clearly with examples. Be encouraging and age-appropriate.',
};

// The assistant persona each role may use.
const ALLOWED_PERSONAS = {
  center_admin: ['owner', 'tutor'],
  platform_owner: ['owner', 'tutor'],
  teacher: ['tutor'],
  family: ['parent', 'student'], // parent view or student view of the same family login
  parent: ['parent'],
  student: ['student'],
};

const chatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  role: z.enum(['owner', 'tutor', 'parent', 'student']).optional(),
});

/** A short summary of what this user may see, built on the server so it can't be forged. */
async function contextSummary(db, centerId, user) {
  const rows = await loadRecords(db, centerId, ['batches', 'students', 'tests', 'attendance', 'centerSettings']);
  const actingUser = user.role === 'platform_owner' ? { ...user, role: 'center_admin' } : user;
  const ctx = buildContext(actingUser, rows);
  const visible = (collection) =>
    rows
      .filter((r) => r.collection === collection)
      .map((r) => project(collection, r.data, r.id, ctx))
      .filter(Boolean);

  const batches = visible('batches');
  const students = visible('students');
  const tests = visible('tests');
  const settings = visible('centerSettings')[0] || {};
  const lines = [
    `Center: ${settings.tutorName || 'Tuition center'}`,
    `Batches: ${batches.length} (${batches
      .map((b) => b.name)
      .slice(0, 10)
      .join(', ')})`,
    `Students: ${students.length}`,
    `Tests recorded: ${tests.length}`,
  ];
  if (FAMILY_ROLES.includes(user.role)) {
    for (const s of students.slice(0, 5)) {
      const scores = tests
        .filter((t) => t.marks?.[s.id] != null && t.maxMarks)
        .map((t) => `${t.name}: ${t.marks[s.id]}/${t.maxMarks}`);
      lines.push(`Child ${s.name} (grade ${s.grade || '?'}): ${scores.join('; ') || 'no test scores yet'}`);
    }
  }
  return lines.join('\n');
}

/** POST /api/ai/chat */
export async function aiChat(user, req) {
  const scope = await centerScope(user, req);
  if (scope.error) return scope.error;
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return { status: 400, body: { error: 'invalid_body' } };

  const allowed = ALLOWED_PERSONAS[user.role] || ['student'];
  const persona = allowed.includes(parsed.data.role) ? parsed.data.role : allowed[0];

  const limit = await hitRateLimit('ai:user', user.id, { limit: 30, windowSec: 60 * 60 });
  if (!limit.ok) return { status: 429, body: { error: 'rate_limited', retryAfterSec: limit.retryAfterSec } };

  const db = getPool();
  const row = await loadSecrets(db, scope.centerId);
  const apiKey = decryptSecret(row?.openai_api_key_enc) || process.env.OPENAI_API_KEY;
  if (!apiKey) return { status: 503, body: { error: 'ai_not_configured' } };

  const context = await contextSummary(db, scope.centerId, user);
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL(),
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPTS[persona]}\n\nCurrent data summary:\n${context}` },
        { role: 'user', content: parsed.data.message },
      ],
      max_tokens: 600,
    }),
  }).catch(() => null);
  if (!res?.ok) {
    console.warn('OpenAI request failed:', res?.status);
    return { status: 502, body: { error: 'ai_failed' } };
  }
  const data = await res.json();
  return { status: 200, body: { reply: data.choices?.[0]?.message?.content || 'No response generated.' } };
}

// --- WhatsApp -----------------------------------------------------------------------------

const sendSchema = z.object({
  to: z.string().max(30),
  message: z.string().min(1).max(4096),
});

const digits = (v) => String(v || '').replace(/\D/g, '');
const last10 = (v) => digits(v).slice(-10);

/** POST /api/whatsapp/send. Families may only message their children's teachers and themselves. */
export async function sendWhatsApp(user, req) {
  const scope = await centerScope(user, req);
  if (scope.error) return scope.error;
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return { status: 400, body: { error: 'invalid_body' } };
  const to = digits(parsed.data.to);
  if (to.length < 8 || to.length > 15) return { status: 400, body: { error: 'invalid_phone' } };

  const db = getPool();
  if (FAMILY_ROLES.includes(user.role)) {
    const rows = await loadRecords(db, scope.centerId, ['batches', 'students', 'teachers']);
    const ctx = buildContext(user, rows);
    const allowed = new Set();
    for (const r of rows) {
      if (r.collection === 'teachers' && ctx.teacherIds.has(r.data.id)) allowed.add(last10(r.data.phone));
      if (r.collection === 'students' && ctx.studentIds.has(r.data.id)) allowed.add(last10(r.data.parentPhone));
    }
    allowed.delete('');
    if (!allowed.has(last10(to))) return { status: 403, body: { error: 'forbidden_recipient' } };
  }

  const limit = await hitRateLimit('wa:user', user.id, { limit: 300, windowSec: 60 * 60 });
  if (!limit.ok) return { status: 429, body: { error: 'rate_limited', retryAfterSec: limit.retryAfterSec } };

  const row = await loadSecrets(db, scope.centerId);
  const token = decryptSecret(row?.whatsapp_token_enc);
  if (!token || !row?.whatsapp_phone_id) return { status: 200, body: { status: 'sent', simulated: true } };

  const res = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(row.whatsapp_phone_id)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: parsed.data.message } }),
  }).catch((err) => ({ ok: false, status: 0, text: async () => err.message }));
  if (!res.ok) {
    return { status: 200, body: { status: 'failed', error: `WhatsApp API error ${res.status}` } };
  }
  const data = await res.json();
  return { status: 200, body: { status: 'sent', providerId: data.messages?.[0]?.id || null } };
}
