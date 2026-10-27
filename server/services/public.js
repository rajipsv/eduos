// @ts-check
// Data anyone may see without signing in.
import { getPool, testConnection } from '../db.js';
import { isAuthConfigured } from '../auth/config.js';

const LISTING_FIELDS = [
  'city',
  'categories',
  'publicSubjects',
  'publicTagline',
  'rating',
  'reviewCount',
  'listingEnabled',
  'phone',
  'createdAt',
];

/** GET /api/public/centers: listed, active centers with their public fields only. */
export async function listPublicCenters() {
  const db = getPool();
  const r = await db.query(
    `SELECT c.id, c.name, c.slug, c.status, c.data,
       (SELECT count(*)::int FROM records t WHERE t.center_id = c.id AND t.collection = 'teachers' AND t.deleted_at IS NULL) AS teachers,
       (SELECT count(*)::int FROM records s WHERE s.center_id = c.id AND s.collection = 'students' AND s.deleted_at IS NULL) AS students,
       (SELECT count(*)::int FROM records b WHERE b.center_id = c.id AND b.collection = 'batches' AND b.deleted_at IS NULL) AS batches
     FROM centers c
     WHERE c.status <> 'suspended' AND coalesce(c.data->>'listingEnabled', 'true') <> 'false'
     ORDER BY c.created_at`,
  );
  const branchRows = await db.query(
    `SELECT center_id, data FROM records WHERE collection = 'branches' AND deleted_at IS NULL
       AND coalesce(data->>'status', 'active') <> 'closed'`,
  );
  const branchesOf = (id) =>
    branchRows.rows
      .filter((b) => b.center_id === id)
      .map((b) => ({
        id: b.data.id,
        name: b.data.name,
        city: b.data.city || '',
        isDefault: Boolean(b.data.isDefault),
      }));
  const centers = r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    ...Object.fromEntries(LISTING_FIELDS.filter((f) => row.data?.[f] !== undefined).map((f) => [f, row.data[f]])),
    _stats: { teachers: row.teachers, students: row.students, batches: row.batches },
    _branches: branchesOf(row.id),
  }));
  return { status: 200, body: { centers } };
}

export async function getHealthPayload() {
  if (!process.env.DATABASE_URL) {
    return { ok: true, db: false, auth: false, reason: 'DATABASE_URL not configured' };
  }
  const db = await testConnection();
  return { ok: true, db, auth: db && isAuthConfigured() };
}
