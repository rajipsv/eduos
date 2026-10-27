// @ts-check
// Shape checks for data coming from browsers. Records keep fields we don't list
// (the app adds fields over time), but the fields we rely on must have the right type,
// and every record has a size limit.
import { z } from 'zod';
import { COLLECTION_NAMES } from '../js/sync-rules.js';

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

// Fields the app depends on, per collection. Other fields pass through unchanged.
const RECORD_SCHEMAS = {
  centers: z.object({ id, name: text(200).optional(), slug: optText(80) }).passthrough(),
  branches: z.object({ id, name: text(200) }).passthrough(),
  teachers: z.object({ id, name: text(200), email: optText(320), phone: optText(40) }).passthrough(),
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
