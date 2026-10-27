// @ts-check
// POST /api/public/centers/:id/inquiries: an inquiry from the public marketplace.
// No sign-in. It is stored and becomes a lead in that center's CRM.
import { z } from 'zod';
import { getPool } from '../db.js';
import { getCenter } from '../db/centers.js';
import { loadRecords, upsertRecord } from '../db/records.js';
import { uid } from '../auth/crypto.js';
import { hitRateLimit, clientIp } from '../rate-limit.js';

const SOURCES = ['Guest Marketplace', 'Parent Marketplace', 'Student Marketplace'];
const optText = (max) => z.string().trim().max(max).optional().default('');

const inquirySchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: optText(20),
  email: z
    .union([z.literal(''), z.string().trim().email().max(200)])
    .optional()
    .default(''),
  childName: optText(120),
  grade: optText(20),
  message: optText(2000),
  branchId: optText(100),
  source: z.enum(SOURCES).optional().default('Guest Marketplace'),
  // Hidden field. People leave it empty; bots fill it in.
  website: z.string().max(200).optional().default(''),
});

export async function createInquiry(req, res, centerId) {
  const limit = await hitRateLimit('inquiry:ip', clientIp(req), { limit: 5, windowSec: 60 });
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    return res.status(429).json({ error: 'rate_limited', retryAfterSec: limit.retryAfterSec });
  }

  const parsed = inquirySchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', message: parsed.error.issues[0]?.message });
  }
  const input = parsed.data;
  if (input.website) return res.status(201).json({ ok: true }); // quietly drop bot submissions
  if (!input.phone && !input.email) return res.status(400).json({ error: 'phone_or_email_required' });

  const db = getPool();
  const center = await getCenter(db, centerId);
  if (!center || center.status === 'suspended' || center.listingEnabled === false) {
    return res.status(404).json({ error: 'center_not_found' });
  }

  const branches = (await loadRecords(db, centerId, ['branches'])).map((r) => r.data);
  const branch =
    branches.find((b) => b.id === input.branchId) || branches.find((b) => b.isDefault) || branches[0] || null;

  const now = new Date().toISOString();
  const inquiryId = uid('inq');
  const notes = [
    input.childName ? `Parent: ${input.name}` : '',
    input.childName ? `Child: ${input.childName}` : '',
    input.message,
  ]
    .filter(Boolean)
    .join('. ');
  const lead = {
    id: uid('lead'),
    centerId,
    branchId: branch?.id || null,
    name: input.childName || input.name,
    parentName: input.name,
    phone: input.phone,
    email: input.email,
    grade: input.grade,
    course: (center.publicSubjects || []).slice(0, 3).join(', '),
    source: input.source,
    stage: 'inquiry',
    notes,
    inquiryId,
    createdAt: now.slice(0, 10),
    activities: [
      { id: uid('act'), type: 'inquiry', note: `Submitted via Tuition Marketplace (${input.source})`, at: now },
    ],
  };

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO public_inquiries (id, center_id, data) VALUES ($1, $2, $3)', [
      inquiryId,
      centerId,
      { ...input, website: undefined, leadId: lead.id, ip: clientIp(req) },
    ]);
    await upsertRecord(client, { centerId, collection: 'leads', id: lead.id, data: lead, userId: null });
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return res.status(201).json({ ok: true });
}
