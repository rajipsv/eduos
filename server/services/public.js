// @ts-check
// Data anyone may see without signing in.
import { getPool, testConnection } from '../db.js';
import { isAuthConfigured } from '../auth/config.js';
import { DEMO_IDS } from '../demo-accounts.js';
import { isEmailConfigured } from '../email.js';
import { isProduction } from '../env.js';

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

/**
 * A center is shown to parents only once it has something to show: a city plus subjects,
 * categories or a tagline. Brand-new or test centers with an empty profile stay hidden.
 * @param {any} data centers.data
 */
export function isListingReady(data) {
  const d = data || {};
  if (d.listingEnabled === false || d.listingEnabled === 'false') return false;
  const has = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(String(v ?? '').trim()));
  return has(d.city) && (has(d.publicSubjects) || has(d.categories) || has(d.publicTagline));
}

/**
 * GET /api/public/centers: listed, active centers with their public fields only.
 * The demo center is left out on the live site unless the page asks for it (?demo=1, used in sales demos).
 * @param {{ includeDemo?: boolean }} [options]
 */
export async function listPublicCenters({ includeDemo = false } = {}) {
  const showDemo = includeDemo || !isProduction();
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
  // Published tutor profiles and visible parent reviews. Never phone, email or drafts.
  const tutorRows = await db.query(
    `SELECT center_id, data FROM records WHERE collection = 'teachers' AND deleted_at IS NULL
       AND data ? 'publicProfile' AND data->'publicProfile' <> 'null'::jsonb`,
  );
  const reviewRows = await db.query(
    `SELECT center_id, data FROM records WHERE collection = 'tutorReviews' AND deleted_at IS NULL
       AND data->>'status' = 'visible'`,
  );
  const firstName = (name) =>
    String(name || 'Parent')
      .trim()
      .split(/\s+/)[0];
  const tutorsOf = (centerId) =>
    tutorRows.rows
      .filter((t) => t.center_id === centerId)
      .map(({ data: t }) => {
        const reviews = reviewRows.rows
          .filter((rv) => rv.center_id === centerId && rv.data.teacherId === t.id)
          .map((rv) => rv.data)
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        const rating = reviews.length
          ? Math.round((reviews.reduce((n, rv) => n + rv.rating, 0) / reviews.length) * 10) / 10
          : null;
        return {
          id: t.id,
          name: t.name,
          subjects: t.subjects || [],
          publicProfile: t.publicProfile,
          rating,
          reviewCount: reviews.length,
          reviews: reviews.slice(0, 10).map((rv) => ({
            name: firstName(rv.parentName),
            rating: rv.rating,
            comment: rv.comment || '',
            date: String(rv.createdAt || '').slice(0, 10),
          })),
        };
      });
  const centers = r.rows
    .filter((row) => (row.id === DEMO_IDS.center ? showDemo : isListingReady(row.data)))
    .map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    ...Object.fromEntries(LISTING_FIELDS.filter((f) => row.data?.[f] !== undefined).map((f) => [f, row.data[f]])),
    _stats: { teachers: row.teachers, students: row.students, batches: row.batches },
    _branches: branchesOf(row.id),
    _tutors: tutorsOf(row.id),
  }));
  return { status: 200, body: { centers } };
}

export async function getHealthPayload() {
  if (!process.env.DATABASE_URL) {
    return { ok: true, db: false, auth: false, email: isEmailConfigured(), reason: 'DATABASE_URL not configured' };
  }
  const db = await testConnection();
  // email: whether password-reset and invite emails can be sent (SMTP or Resend is set up).
  return { ok: true, db, auth: db && isAuthConfigured(), email: isEmailConfigured() };
}
