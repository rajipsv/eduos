// Shared by the browser and the server: which collections are stored per center,
// how each is shaped in the app state, and how a record is identified.
//
// Shapes:
//   list   - array of records, each with an id (state.students = [{ id, ... }])
//   map    - object keyed by id (state.tutorAvailability = { [teacherId]: {...} })
//   single - one object per center (state.publicSite = {...}), stored with id 'default'

export const SINGLE_ID = 'default';

export const COLLECTIONS = {
  branches: { shape: 'list' },
  teachers: { shape: 'list' },
  students: { shape: 'list', ref: (r) => r.batchId },
  batches: { shape: 'list', ref: (r) => r.teacherId },
  attendance: { shape: 'list', ref: (r) => r.batchId },
  tests: { shape: 'list', ref: (r) => r.batchId },
  assignments: { shape: 'list', ref: (r) => r.batchId },
  lessonPlans: { shape: 'list', ref: (r) => r.teacherId },
  tutorPd: { shape: 'list', ref: (r) => r.teacherId },
  certificates: { shape: 'list', ref: (r) => r.studentId },
  feedback: { shape: 'list', ref: (r) => r.studentId },
  // Skills have no id of their own: one per student and subject.
  skills: { shape: 'list', ref: (r) => r.studentId, key: (r) => r.id || `${r.studentId}|${r.subject}` },
  projects: { shape: 'list', ref: (r) => r.studentId },
  interventions: { shape: 'list', ref: (r) => r.studentId },
  messages: { shape: 'list', ref: (r) => r.meta?.studentId },
  invoices: { shape: 'list', ref: (r) => r.studentId },
  leads: { shape: 'list' },
  parentInquiries: { shape: 'list', ref: (r) => r.studentId },
  aiHistory: { shape: 'list', ref: (r) => r.createdBy },
  marketplace: { shape: 'list' },
  commTemplates: { shape: 'list' },
  commAutomations: { shape: 'list' },
  webhooks: { shape: 'list' },
  apiEventLog: { shape: 'list' },
  sdkIntegrations: { shape: 'list' },
  tutorAvailability: { shape: 'map' },
  parentPreferences: { shape: 'map' },
  centerSettings: { shape: 'map' },
  commSettings: { shape: 'single' },
  publicSite: { shape: 'single' },
};

export const COLLECTION_NAMES = Object.keys(COLLECTIONS);

/** The id a record is stored under. */
export function recordKey(collection, record) {
  const def = COLLECTIONS[collection];
  if (def?.key) return def.key(record);
  return record?.id;
}

/** The field used to find a record's owner (batch, teacher or student), for indexing. */
export function ownerRef(collection, record) {
  const ref = COLLECTIONS[collection]?.ref?.(record);
  return ref == null ? null : String(ref);
}

/** App-state value for a collection -> Map of id -> record. */
export function toRecordMap(collection, value) {
  const def = COLLECTIONS[collection];
  const out = new Map();
  if (!def || value == null) return out;
  if (def.shape === 'list') {
    for (const item of Array.isArray(value) ? value : []) {
      const key = recordKey(collection, item);
      if (key != null && key !== '') out.set(String(key), item);
    }
  } else if (def.shape === 'map') {
    for (const [key, item] of Object.entries(value)) {
      if (item && typeof item === 'object') out.set(key, item);
    }
  } else if (value && typeof value === 'object') {
    out.set(SINGLE_ID, value);
  }
  return out;
}

/** Stored records [{ id, data }] -> app-state value for a collection. */
export function fromRecords(collection, records) {
  const def = COLLECTIONS[collection];
  if (def.shape === 'list') return records.map((r) => r.data);
  if (def.shape === 'map') return Object.fromEntries(records.map((r) => [r.id, r.data]));
  return records.find((r) => r.id === SINGLE_ID)?.data ?? null;
}

// --- Who may read and write what --------------------------------------------------------
//
// read:  'all' | 'own' | 'none'
// write: 'all'    any record
//        'own'    records that are theirs before and after the change
//        'create' add new records only (theirs); no edits or deletes
//        'merge'  edit only some fields of their existing records (see server/services/sync.js)
//        'none'
// "Theirs" is decided by isOwnRecord() below. Admin roles can do everything in their center.

export const ADMIN_ROLES = ['platform_owner', 'center_admin'];
export const FAMILY_ROLES = ['family', 'parent', 'student'];

const TEACHER_ACCESS = {
  branches: ['all', 'none'],
  teachers: ['all', 'own'],
  students: ['own', 'none'],
  batches: ['own', 'merge'], // session status, notes and timing only
  attendance: ['own', 'own'],
  tests: ['own', 'own'],
  assignments: ['own', 'own'],
  lessonPlans: ['own', 'own'],
  tutorPd: ['own', 'own'],
  tutorAvailability: ['own', 'own'],
  certificates: ['own', 'own'],
  feedback: ['own', 'own'],
  skills: ['own', 'own'],
  projects: ['own', 'none'],
  interventions: ['own', 'none'],
  messages: ['own', 'create'],
  parentInquiries: ['own', 'none'],
  aiHistory: ['own', 'own'],
  commTemplates: ['all', 'none'],
  commAutomations: ['all', 'none'],
  commSettings: ['all', 'none'],
  centerSettings: ['all', 'none'],
};

const FAMILY_ACCESS = {
  branches: ['all', 'none'],
  teachers: ['own', 'none'], // their children's teachers, a few fields only
  students: ['own', 'none'],
  batches: ['own', 'none'],
  attendance: ['own', 'none'], // reduced to their children
  tests: ['own', 'none'], // reduced to their children
  assignments: ['own', 'merge'], // their children's submissions only
  certificates: ['own', 'none'],
  feedback: ['own', 'none'],
  skills: ['own', 'none'],
  projects: ['own', 'none'],
  invoices: ['own', 'none'],
  messages: ['own', 'create'],
  parentPreferences: ['own', 'own'],
  parentInquiries: ['own', 'create'],
  aiHistory: ['own', 'own'],
  centerSettings: ['all', 'none'],
};

function accessFor(role, collection) {
  if (ADMIN_ROLES.includes(role)) return ['all', 'all'];
  const table = role === 'teacher' ? TEACHER_ACCESS : FAMILY_ROLES.includes(role) ? FAMILY_ACCESS : {};
  return table[collection] || ['none', 'none'];
}

export function readMode(role, collection) {
  return accessFor(role, collection)[0];
}

export function writeMode(role, collection) {
  return accessFor(role, collection)[1];
}

/** Collections the browser should send changes for. */
export function writableCollections(role) {
  return COLLECTION_NAMES.filter((c) => writeMode(role, c) !== 'none');
}

/**
 * ctx: { role, userId, teacherIds:Set, batchIds:Set, studentIds:Set }
 *   teacher: their own teacher id, their batches, the students in those batches
 *   family:  their children, the children's batches and those batches' teachers
 */
export function isOwnRecord(collection, record, key, ctx) {
  if (!record) return false;
  const { teacherIds, batchIds, studentIds } = ctx;
  switch (collection) {
    case 'teachers':
      return teacherIds.has(record.id);
    case 'students':
      return studentIds.has(record.id);
    case 'batches':
      return batchIds.has(record.id);
    case 'attendance':
    case 'tests':
    case 'assignments':
      return batchIds.has(record.batchId);
    case 'lessonPlans':
    case 'tutorPd':
      return teacherIds.has(record.teacherId);
    case 'tutorAvailability':
      return teacherIds.has(key);
    case 'parentPreferences':
      return studentIds.has(key);
    case 'certificates':
    case 'feedback':
    case 'skills':
    case 'projects':
    case 'interventions':
    case 'invoices':
    case 'parentInquiries':
      return studentIds.has(record.studentId);
    case 'messages':
      return (
        record.createdBy === ctx.userId ||
        studentIds.has(record.meta?.studentId) ||
        (ctx.role === 'teacher' && teacherIds.has(record.meta?.teacherId))
      );
    case 'aiHistory':
      return record.createdBy === ctx.userId;
    default:
      return false;
  }
}

/** Settings fields that only admins may see (API keys). */
export const SECRET_SETTINGS_FIELDS = ['openaiApiKey', 'whatsappApiKey', 'whatsappPhoneId'];
