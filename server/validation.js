// @ts-check
// Shape checks for data coming from browsers. Records keep fields we don't list
// (the app adds fields over time), but the fields we rely on must have the right type,
// and every record has a size limit.
import { z } from 'zod';
import { COLLECTION_NAMES } from '../js/sync-rules.js';
import { PLANS, PAYMENT_METHODS, isoDate } from '../js/subscription.js';

export const MAX_RECORD_BYTES = 200 * 1024;
export const MAX_CHANGES = 500;

const id = z.string().min(1).max(200);
const optId = id.nullable().optional();
const text = (max = 2000) => z.string().max(max);
const optText = (max = 2000) => text(max).nullable().optional();

const syncEnvelope = z.object({
  changes: z
    .array(
      z.object({
        collection: z.enum([...COLLECTION_NAMES, 'centers']),
        id,
        op: z.enum(['upsert', 'delete']),
        data: z.record(z.any()).optional(),
        baseVersion: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .max(MAX_CHANGES),
});

// A tutor's public profile: sections they name themselves, each with items.
const httpLink = z
  .string()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'link must start with http:// or https://');
const tutorProfile = z
  .object({
    intro: text(1000).optional(),
    sections: z
      .array(
        z.object({
          id,
          title: text(80),
          items: z
            .array(z.object({ id, text: text(200), detail: optText(500), link: httpLink.nullable().optional() }))
            .max(20),
        }),
      )
      .max(10),
  })
  .nullable()
  .optional();

// Fields the app depends on, per collection. Other fields pass through unchanged.
const RECORD_SCHEMAS = {
  centers: z.object({ id, name: text(200).optional(), slug: optText(80) }).passthrough(),
  branches: z.object({ id, name: text(200) }).passthrough(),
  teachers: z
    .object({
      id,
      name: text(200),
      email: optText(320),
      phone: optText(40),
      profileDraft: tutorProfile,
      publicProfile: tutorProfile,
      profileStatus: z.enum(['draft', 'pending', 'published']).optional(),
    })
    .passthrough(),
  tutorReviews: z
    .object({
      id,
      teacherId: id,
      studentId: id,
      rating: z.number().int().min(1).max(5),
      comment: optText(1000),
      parentName: optText(120),
      status: z.enum(['visible', 'hidden']),
    })
    .passthrough(),
  students: z
    .object({
      id,
      name: text(200),
      batchId: optId,
      email: optText(320),
      phone: optText(40),
      parentEmail: optText(320),
      parentPhone: optText(40),
    })
    .passthrough(),
  batches: z
    .object({
      id,
      name: text(200),
      teacherId: optId,
      sessions: z.array(z.object({ id }).passthrough()).max(1000).optional(),
    })
    .passthrough(),
  attendance: z.object({ id, batchId: id, date: text(40), records: z.record(text(20)) }).passthrough(),
  tests: z
    .object({ id, batchId: id, name: text(200), marks: z.record(z.number().nullable().or(text(20))) })
    .passthrough(),
  assignments: z
    .object({ id, batchId: id, submissions: z.record(z.object({}).passthrough()).optional() })
    .passthrough(),
  invoices: z.object({ id, studentId: optId }).passthrough(),
  leads: z.object({ id, name: text(200) }).passthrough(),
  messages: z.object({ id, message: optText(10000) }).passthrough(),
  aiHistory: z.object({ id, userMessage: optText(10000), assistantReply: optText(20000) }).passthrough(),
};

/** @returns {{ ok: true, value: any } | { ok: false, error: string }} */
export function parseSyncRequest(body) {
  const r = syncEnvelope.safeParse(body);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message || 'invalid_body' };
  return { ok: true, value: r.data };
}

// PATCH /api/platform/centers/:id/subscription (platform owner only).
const day = z
  .string()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && isoDate(v) === v, 'dates must be real days written as YYYY-MM-DD');
const subscriptionUpdate = z
  .object({
    plan: z.enum(/** @type {[string, ...string[]]} */ (PLANS)).optional(),
    pilotEndsAt: day.optional(),
    paidUntil: day.nullable().optional(),
    extraBranches: z.number().int().min(0).max(500).optional(),
    studentLimit: z.number().int().min(1).max(100000).nullable().optional(),
    payment: z
      .object({
        date: day,
        amount: z.number().positive().max(10000000),
        method: z.enum(/** @type {[string, ...string[]]} */ (PAYMENT_METHODS)),
        reference: z.string().trim().max(120).optional().default(''),
        note: z.string().trim().max(500).optional().default(''),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'nothing to change');

export function parseSubscriptionUpdate(body) {
  const r = subscriptionUpdate.safeParse(body);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    return { ok: false, error: `${where}${issue?.message || 'invalid'}` };
  }
  return { ok: true, value: r.data };
}

/** @returns {string|null} an error message, or null when the record is acceptable */
export function checkRecord(collection, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'record must be an object';
  if (JSON.stringify(data).length > MAX_RECORD_BYTES) return 'record too large';
  const schema = RECORD_SCHEMAS[collection];
  if (!schema) return null;
  const r = schema.safeParse(data);
  if (r.success) return null;
  const issue = r.error.issues[0];
  return `${issue.path.join('.') || 'record'}: ${issue.message}`;
}
