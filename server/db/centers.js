// @ts-check
import { insertRecords } from './records.js';
import { uid } from '../auth/crypto.js';
import { subscriptionForViewer } from '../../js/subscription.js';

// Center fields kept in their own columns. Everything else lives in `data`.
const COLUMN_FIELDS = ['id', 'name', 'slug', 'status', 'plan', 'ownerUserId'];

export const DEFAULT_CENTER_SETTINGS = {
  tutorName: 'Your Tutoring Center',
  defaultCountryCode: '+91',
  defaultMeetingPlatform: 'google-meet',
  billing: { invoicePrefix: 'INV', upiId: '', bankDetails: '', defaultDueDay: 5 },
};

export function rowToCenter(row) {
  if (!row) return null;
  return {
    ...row.data,
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    plan: row.plan,
    ownerUserId: row.owner_user_id,
    // Older centers kept no createdAt of their own; the pilot end date is worked out from it.
    createdAt: row.data?.createdAt || (row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : undefined),
  };
}

/** A center as the given role may see it: the subscription is trimmed or removed. */
export function centerForViewer(center, role) {
  if (!center) return center;
  const { subscription, ...rest } = center;
  const shown = subscriptionForViewer(subscription, role);
  return shown ? { ...rest, subscription: shown } : rest;
}

function splitCenter(center) {
  const data = { ...center };
  for (const f of COLUMN_FIELDS) delete data[f];
  return {
    id: String(center.id),
    name: String(center.name || 'Unnamed center'),
    slug: center.slug ? String(center.slug) : null,
    status: center.status ? String(center.status) : 'active',
    plan: center.plan ? String(center.plan) : 'trial',
    ownerUserId: center.ownerUserId ? String(center.ownerUserId) : null,
    data,
  };
}

export async function getCenter(db, id) {
  const r = await db.query('SELECT * FROM centers WHERE id = $1', [id]);
  return rowToCenter(r.rows[0]);
}

export async function listCenters(db) {
  const r = await db.query('SELECT * FROM centers ORDER BY created_at');
  return r.rows.map(rowToCenter);
}

/** Inserts or replaces a center. Returns the new version. */
export async function upsertCenter(db, center, { onConflict = 'update' } = {}) {
  const c = splitCenter(center);
  const conflict =
    onConflict === 'nothing'
      ? 'DO NOTHING'
      : `DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, status = EXCLUDED.status,
           plan = EXCLUDED.plan, owner_user_id = EXCLUDED.owner_user_id, data = EXCLUDED.data,
           version = centers.version + 1, updated_at = NOW()`;
  const r = await db.query(
    `INSERT INTO centers (id, name, slug, status, plan, owner_user_id, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) ${conflict}
     RETURNING version`,
    [c.id, c.name, c.slug, c.status, c.plan, c.ownerUserId, c.data],
  );
  return r.rows[0]?.version ?? null;
}

/** A new center with its default branch and settings, as sign-up creates it. */
export async function createCenterWithDefaults(db, center) {
  await upsertCenter(db, center);
  const branch = {
    id: uid('branch'),
    centerId: center.id,
    name: `${center.name} — Main`,
    city: center.city || '',
    status: 'active',
    isDefault: true,
    createdAt: center.createdAt || new Date().toISOString().slice(0, 10),
  };
  await insertRecords(db, [
    { centerId: center.id, collection: 'branches', id: branch.id, data: branch },
    {
      centerId: center.id,
      collection: 'centerSettings',
      id: center.id,
      data: { ...DEFAULT_CENTER_SETTINGS, tutorName: center.name },
    },
  ]);
}
