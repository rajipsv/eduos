// @ts-check
// GET /api/bootstrap: everything the signed-in user may see in their center.
import { COLLECTION_NAMES, fromRecords } from '../../js/sync-rules.js';
import { getPool } from '../db.js';
import { getCenter, listCenters, centerForViewer } from '../db/centers.js';
import { loadRecords, countRecordsByCenter } from '../db/records.js';
import { buildContext, isAdmin, project } from './access.js';
import { integrationStatus } from './integrations.js';
import { listApiKeys } from './api-keys.js';

const PUBLIC_USER_FIELDS = [
  'id',
  'email',
  'role',
  'name',
  'centerId',
  'linkedTeacherId',
  'linkedStudentId',
  'linkedStudentIds',
  'parentName',
];

export function publicUser(u) {
  return Object.fromEntries(PUBLIC_USER_FIELDS.map((f) => [f, u[f] ?? null]));
}

/**
 * The center a request acts on. Platform owners choose one with the X-Center-Id
 * header; everyone else always gets their own.
 * @returns {Promise<{ centerId: string|null, error?: string, status?: number }>}
 */
export async function resolveCenter(db, user, req) {
  if (user.role === 'platform_owner') {
    const header = req.headers['x-center-id'];
    const wanted = typeof header === 'string' && header ? header : null;
    if (!wanted) return { centerId: null };
    if (!(await getCenter(db, wanted))) return { centerId: null, error: 'center_not_found', status: 404 };
    return { centerId: wanted };
  }
  if (!user.centerId) return { centerId: null, error: 'no_center', status: 403 };
  return { centerId: user.centerId };
}

async function centerStats(db) {
  const rows = await countRecordsByCenter(db, ['teachers', 'students', 'batches']);
  const leads = await db.query(
    `SELECT center_id, count(*)::int AS n FROM records
     WHERE collection = 'leads' AND deleted_at IS NULL AND coalesce(data->>'stage', '') <> 'converted'
     GROUP BY center_id`,
  );
  const stats = {};
  for (const r of rows) (stats[r.center_id] ||= {})[r.collection] = r.n;
  for (const r of leads.rows) (stats[r.center_id] ||= {}).leads = r.n;
  return stats;
}

async function centerUsers(db, centerId) {
  const r = await db.query('SELECT * FROM auth_users WHERE center_id = $1 ORDER BY created_at', [centerId]);
  return r.rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    centerId: row.center_id,
    linkedTeacherId: row.linked_teacher_id,
    linkedStudentId: row.linked_student_id,
    linkedStudentIds: row.linked_student_ids || [],
    parentName: row.parent_name,
  }));
}

export async function buildBootstrap(user, req) {
  const db = getPool();
  const scope = await resolveCenter(db, user, req);
  if (scope.error) return { status: scope.status, body: { error: scope.error } };

  const versions = {};
  const data = {};

  // Platform owner without a chosen center: the list of centers and counts only.
  if (!scope.centerId) {
    const centers = await listCenters(db);
    const v = await db.query('SELECT id, version FROM centers');
    versions.centers = Object.fromEntries(v.rows.map((r) => [r.id, r.version]));
    return {
      status: 200,
      body: {
        centerId: null,
        data: { centers, users: [publicUser(user)] },
        versions,
        centerStats: await centerStats(db),
      },
    };
  }

  const centerId = scope.centerId;
  const rows = await loadRecords(db, centerId);
  const ctx = buildContext({ ...user, role: user.role === 'platform_owner' ? 'center_admin' : user.role }, rows);

  for (const collection of COLLECTION_NAMES) {
    const visible = [];
    for (const row of rows) {
      if (row.collection !== collection) continue;
      const shown = project(collection, row.data, row.id, ctx);
      if (!shown) continue;
      visible.push({ id: row.id, data: shown });
      (versions[collection] ||= {})[row.id] = row.version;
    }
    const value = fromRecords(collection, visible);
    if (value != null) data[collection] = value;
  }

  const center = await getCenter(db, centerId);
  const centers = user.role === 'platform_owner' ? await listCenters(db) : [centerForViewer(center, user.role)];
  const cv = await db.query('SELECT id, version FROM centers WHERE id = ANY($1)', [centers.map((c) => c.id)]);
  versions.centers = Object.fromEntries(cv.rows.map((r) => [r.id, r.version]));
  data.centers = centers;
  data.users = isAdmin(ctx) ? await centerUsers(db, centerId) : [publicUser(user)];
  if (user.role === 'platform_owner' && !data.users.some((u) => u.id === user.id)) data.users.push(publicUser(user));

  const status = await integrationStatus(db, centerId);
  if (isAdmin(ctx)) {
    data.integrationStatus = status;
    data.apiKeys = await listApiKeys(db, centerId);
  } else {
    data.integrationStatus = { ai: status.ai, whatsapp: status.whatsapp };
  }

  return { status: 200, body: { centerId, data, versions } };
}
