import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_PATH = path.join(__dirname, 'data', 'platform-inbound-leads.json');

export const INBOUND_STAGES = [
  { id: 'inquiry', label: 'Inquiry' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'demo', label: 'Demo scheduled' },
  { id: 'pilot', label: 'Pilot' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

const RATE_LIMIT_MS = 45_000;
const recentPosts = new Map();

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
    activities: [{
      id: uid('act'),
      type: 'inquiry',
      note: 'Submitted start-page demo form',
      at: now,
    }],
  };

  return { lead };
}

export function checkRateLimit(ip) {
  const key = ip || 'unknown';
  const last = recentPosts.get(key);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) {
    return { error: 'rate_limited', status: 429, retryAfterSec: Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000) };
  }
  recentPosts.set(key, now);
  if (recentPosts.size > 5000) {
    const cutoff = now - RATE_LIMIT_MS * 2;
    for (const [k, v] of recentPosts) {
      if (v < cutoff) recentPosts.delete(k);
    }
  }
  return { ok: true };
}

async function readFileLeads() {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFileLeads(leads) {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(leads, null, 2), 'utf8');
}

async function readDbLeads() {
  const result = await getPool().query(
    'SELECT data FROM platform_inbound_leads ORDER BY created_at DESC',
  );
  return result.rows.map((row) => row.data);
}

async function insertDbLead(lead) {
  await getPool().query(
    `INSERT INTO platform_inbound_leads (id, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4)`,
    [lead.id, lead, lead.createdAt, lead.updatedAt],
  );
}

async function updateDbLead(lead) {
  await getPool().query(
    `UPDATE platform_inbound_leads SET data = $2, updated_at = NOW() WHERE id = $1`,
    [lead.id, lead],
  );
}

function useDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function listInboundLeads() {
  if (useDatabase()) {
    try {
      return await readDbLeads();
    } catch (err) {
      console.warn('DB inbound leads read failed, falling back to file:', err.message);
    }
  }
  return readFileLeads();
}

export async function appendInboundLead(lead) {
  if (useDatabase()) {
    try {
      await insertDbLead(lead);
      return lead;
    } catch (err) {
      console.warn('DB inbound lead insert failed, falling back to file:', err.message);
    }
  }
  const leads = await readFileLeads();
  leads.unshift(lead);
  await writeFileLeads(leads);
  return lead;
}

export async function updateInboundLead(id, patch) {
  const leads = await listInboundLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx < 0) return { error: 'not_found', status: 404 };

  const prev = leads[idx];
  const now = new Date().toISOString();
  const next = { ...prev, ...patch, updatedAt: now };

  if (patch.stage && patch.stage !== prev.stage) {
    next.activities = [
      {
        id: uid('act'),
        type: 'stage',
        note: `Stage → ${patch.stage}`,
        at: now,
      },
      ...(prev.activities || []),
    ];
  }

  if (useDatabase()) {
    try {
      await updateDbLead(next);
      return { lead: next };
    } catch (err) {
      console.warn('DB inbound lead update failed, falling back to file:', err.message);
    }
  }

  leads[idx] = next;
  await writeFileLeads(leads);
  return { lead: next };
}
