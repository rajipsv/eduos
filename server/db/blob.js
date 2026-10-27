// @ts-check
// Converts the old single-document app state (app_state.data, or the demo data)
// into centers and per-center record rows.
import { COLLECTIONS, COLLECTION_NAMES, SECRET_SETTINGS_FIELDS, toRecordMap } from '../../js/sync-rules.js';

// In the old document these were shared by every center. Each center now gets its own copy.
const SHARED_COLLECTIONS = new Set([
  'marketplace',
  'commTemplates',
  'commAutomations',
  'webhooks',
  'sdkIntegrations',
  'commSettings',
  'publicSite',
]);

/**
 * @param {any} blob old app state
 * @returns {{ centers: any[], rows: Array<{centerId:string, collection:string, id:string, data:any}> }}
 */
export function blobToCenterRows(blob) {
  const centers = (blob?.centers || []).filter((c) => c?.id);
  const centerIds = new Set(centers.map((c) => c.id));
  const fallbackCenter = centers[0]?.id || null;

  const centerOf = (collection) => {
    const m = new Map();
    for (const item of blob?.[collection] || []) if (item?.id && item.centerId) m.set(item.id, item.centerId);
    return m;
  };
  const batchCenter = centerOf('batches');
  const studentCenter = centerOf('students');
  const teacherCenter = centerOf('teachers');

  // Which center a record belongs to: its own centerId, else the batch, student or teacher it refers to.
  const resolveCenter = (record, key) =>
    (record?.centerId && centerIds.has(record.centerId) && record.centerId) ||
    batchCenter.get(record?.batchId) ||
    studentCenter.get(record?.studentId) ||
    studentCenter.get(record?.meta?.studentId) ||
    teacherCenter.get(record?.teacherId) ||
    teacherCenter.get(key) ||
    studentCenter.get(key) ||
    fallbackCenter;

  const rows = [];
  for (const collection of COLLECTION_NAMES) {
    const value = blob?.[collection];
    if (value == null) continue;

    // centerSettings is keyed by center id already.
    if (collection === 'centerSettings') {
      for (const [cid, settings] of toRecordMap(collection, value)) {
        // API keys are not copied: they live encrypted in center_secrets.
        const clean = Object.fromEntries(Object.entries(settings).filter(([k]) => !SECRET_SETTINGS_FIELDS.includes(k)));
        if (centerIds.has(cid)) rows.push({ centerId: cid, collection, id: cid, data: clean });
      }
      continue;
    }

    for (const [id, record] of toRecordMap(collection, value)) {
      if (SHARED_COLLECTIONS.has(collection)) {
        for (const cid of centerIds) rows.push({ centerId: cid, collection, id, data: record });
        continue;
      }
      const cid = resolveCenter(record, COLLECTIONS[collection].shape === 'map' ? id : null);
      if (!cid) continue;
      const data = COLLECTIONS[collection].shape === 'list' ? { ...record, centerId: cid } : record;
      rows.push({ centerId: cid, collection, id, data });
    }
  }

  return { centers, rows };
}
