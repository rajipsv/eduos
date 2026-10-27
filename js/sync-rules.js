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
  apiKeys: { shape: 'list' },
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
