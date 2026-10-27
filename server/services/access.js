// @ts-check
// Works out what a user is linked to, and reduces records to what their role may see.
import { ADMIN_ROLES, FAMILY_ROLES, SECRET_SETTINGS_FIELDS, isOwnRecord, readMode } from '../../js/sync-rules.js';

/**
 * @param {{ id: string, role: string, linkedTeacherId?: string|null, linkedStudentId?: string|null, linkedStudentIds?: string[] }} user
 * @param {Array<{ collection: string, data: any }>} rows the center's batches and students
 */
export function buildContext(user, rows) {
  const ctx = {
    role: user.role,
    userId: user.id,
    teacherIds: new Set(),
    batchIds: new Set(),
    studentIds: new Set(),
  };
  const batches = rows.filter((r) => r.collection === 'batches').map((r) => r.data);
  const students = rows.filter((r) => r.collection === 'students').map((r) => r.data);

  if (user.role === 'teacher') {
    if (user.linkedTeacherId) ctx.teacherIds.add(user.linkedTeacherId);
    for (const b of batches) if (ctx.teacherIds.has(b.teacherId)) ctx.batchIds.add(b.id);
    for (const s of students) if (ctx.batchIds.has(s.batchId)) ctx.studentIds.add(s.id);
  } else if (FAMILY_ROLES.includes(user.role)) {
    const linked = new Set([...(user.linkedStudentIds || []), user.linkedStudentId].filter(Boolean));
    for (const s of students) {
      if (!linked.has(s.id)) continue;
      ctx.studentIds.add(s.id);
      if (s.batchId) ctx.batchIds.add(s.batchId);
    }
    for (const b of batches) if (ctx.batchIds.has(b.id) && b.teacherId) ctx.teacherIds.add(b.teacherId);
  }
  return ctx;
}

export function isAdmin(ctx) {
  return ADMIN_ROLES.includes(ctx.role);
}

export function canRead(collection, record, key, ctx) {
  const mode = readMode(ctx.role, collection);
  if (mode === 'all') return true;
  if (mode === 'own') return isOwnRecord(collection, record, key, ctx);
  return false;
}

const pickKeys = (obj, keys) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => keys.has(k)));

const TEACHER_FIELDS_FOR_FAMILY = ['id', 'centerId', 'branchId', 'name', 'subjects', 'bio', 'phone', 'email'];

/**
 * The record as this user may see it, or null if they may not see it at all.
 * Reduced copies are flagged _projected so they can't be saved back as a whole.
 */
export function project(collection, record, key, ctx) {
  if (!canRead(collection, record, key, ctx)) return null;
  if (isAdmin(ctx)) return record;

  if (collection === 'centerSettings') {
    const copy = { ...record, _projected: true };
    for (const f of SECRET_SETTINGS_FIELDS) delete copy[f];
    return copy;
  }

  if (!FAMILY_ROLES.includes(ctx.role)) return record;

  const mine = ctx.studentIds;
  switch (collection) {
    case 'teachers':
      return { ...Object.fromEntries(TEACHER_FIELDS_FOR_FAMILY.map((f) => [f, record[f]])), _projected: true };
    case 'batches': {
      const { notes: _notes, ...rest } = record;
      return { ...rest, _projected: true };
    }
    case 'attendance':
      return { ...record, records: pickKeys(record.records, mine), _projected: true };
    case 'tests':
      return { ...record, marks: pickKeys(record.marks, mine), _projected: true };
    case 'assignments':
      return { ...record, submissions: pickKeys(record.submissions, mine), _projected: true };
    default:
      return record;
  }
}
