// Demo requests from start-page.html. Stored in the database only.
import { getPool } from './db.js';
import { hitRateLimit } from './rate-limit.js';

export const INBOUND_STAGES = [
  { id: 'inquiry', label: 'Inquiry' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'demo', label: 'Demo scheduled' },
  { id: 'pilot', label: 'Pilot' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

function uid(prefix = 'inbound') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function cleanText(value, maxLen = 500) {
  if (value == null) return '';
  return String(value).trim().slice(0, maxLen);
}

function deriveSource(body) {
  const utmSource = cleanText(body.utm_source, 120);
  if (utmSource) return utmSource.replace(/\+/g, ' ');
  const medium = cleanText(body.utm_medium, 80);
  if (medium) return medium.replace(/\+/g, ' ');
  return 'Start Page';
}

function buildUtm(body) {
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid'];
  const utm = {};
  keys.forEach((key) => {
    const value = cleanText(body[key], 200);
    if (value) utm[key] = value;
  });
  return utm;
}

export function validateInboundLeadBody(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'invalid_body', status: 400 };
  }
  if (cleanText(body.website)) {
    return { honeypot: true };
  }

  const firstName = cleanText(body.first_name, 80);
  const lastName = cleanText(body.last_name, 80);
  const centerName = cleanText(body.center_name, 160);
  const city = cleanText(body.city, 80);
  const phone = cleanText(body.phone, 24);
  const email = cleanText(body.email, 160);
  const students = cleanText(body.students, 40);
  const centerType = cleanText(body.center_type, 80);
  const pain = cleanText(body.pain, 120);

  const missing = [];
  if (!firstName) missing.push('first_name');
  if (!lastName) missing.push('last_name');
  if (!centerName) missing.push('center_name');
  if (!city) missing.push('city');
  if (!phone) missing.push('phone');
  if (!email) missing.push('email');
  if (!students) missing.push('students');
  if (!centerType) missing.push('center_type');
  if (!pain) missing.push('pain');
  if (missing.length) {
    return { error: 'missing_fields', fields: missing, status: 400 };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'invalid_email', status: 400 };
  }

  const now = new Date().toISOString();
  const utm = buildUtm(body);
  const lead = {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    stage: 'inquiry',
    source: deriveSource(body),
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    centerName,
    city,
    phone,
    email,
    students,
    centerType,
    pain,
    planInterest: cleanText(body.plan, 80) || null,
    notes: cleanText(body.notes, 2000) || null,
    utm,
    activities: [
      {
        id: uid('act'),
        type: 'inquiry',
        note: 'Submitted start-page demo form',
        at: now,
      },
    ],
  };

  return { lead };
}

/** One demo request per IP every 45 seconds (shared across server instances). */
export async function checkRateLimit(ip) {
  const r = await hitRateLimit('inbound:ip', ip || 'unknown', { limit: 1, windowSec: 45 });
  return r.ok ? { ok: true } : { error: 'rate_limited', status: 429, retryAfterSec: r.retryAfterSec };
}

export async function listInboundLeads() {
  const result = await getPool().query('SELECT data FROM platform_inbound_leads ORDER BY created_at DESC');
  return result.rows.map((row) => row.data);
}

export async function appendInboundLead(lead) {
  await getPool().query(
    `INSERT INTO platform_inbound_leads (id, data, created_at, updated_at) VALUES ($1, $2, $3, $4)`,
    [lead.id, lead, lead.createdAt, lead.updatedAt],
  );
  return lead;
}

export async function updateInboundLead(id, patch) {
  if (patch.stage && !INBOUND_STAGES.some((s) => s.id === patch.stage)) {
    return { error: 'invalid_stage', status: 400 };
  }
  const r = await getPool().query('SELECT data FROM platform_inbound_leads WHERE id = $1', [id]);
  const prev = r.rows[0]?.data;
  if (!prev) return { error: 'not_found', status: 404 };

  const now = new Date().toISOString();
  const next = { ...prev, ...patch, updatedAt: now };
  if (patch.stage && patch.stage !== prev.stage) {
    next.activities = [
      { id: uid('act'), type: 'stage', note: `Stage → ${patch.stage}`, at: now },
      ...(prev.activities || []),
    ];
  }
  await getPool().query('UPDATE platform_inbound_leads SET data = $2, updated_at = NOW() WHERE id = $1', [id, next]);
  return { lead: next };
}
