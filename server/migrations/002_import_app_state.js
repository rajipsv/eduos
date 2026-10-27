// Copies the old shared app_state document into centers + records.
// app_state itself is left in place; it is dropped in a later migration.
import { blobToCenterRows } from '../db/blob.js';
import { upsertCenter, createCenterWithDefaults, DEFAULT_CENTER_SETTINGS } from '../db/centers.js';
import { insertRecords } from '../db/records.js';
import { uid } from '../auth/crypto.js';

export default async function importAppState(db) {
  const exists = await db.query(`SELECT to_regclass('app_state') AS t`);
  let blob = null;
  if (exists.rows[0].t) {
    const r = await db.query(`SELECT data FROM app_state WHERE id = 'global'`);
    blob = r.rows[0]?.data || null;
  }

  const { centers, rows } = blobToCenterRows(blob || {});
  for (const center of centers) await upsertCenter(db, center, { onConflict: 'nothing' });
  const imported = await insertRecords(db, rows);

  // Logins that point at a center the old document never saved get a placeholder center.
  const orphans = await db.query(
    `SELECT u.center_id, min(u.id) AS user_id, min(u.name) AS name, min(u.email) AS email
     FROM auth_users u
     WHERE u.center_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM centers c WHERE c.id = u.center_id)
     GROUP BY u.center_id`,
  );
  for (const o of orphans.rows) {
    await createCenterWithDefaults(db, {
      id: o.center_id,
      name: `${o.name}'s center`,
      status: 'active',
      plan: 'trial',
      ownerUserId: o.user_id,
      ownerEmail: o.email,
      createdAt: new Date().toISOString().slice(0, 10),
    });
  }

  // Every center needs settings and at least one branch.
  const all = await db.query(`SELECT id, name, data FROM centers`);
  const branchless = await db.query(
    `SELECT c.id FROM centers c WHERE NOT EXISTS
       (SELECT 1 FROM records r WHERE r.center_id = c.id AND r.collection = 'branches')`,
  );
  const needsBranch = new Set(branchless.rows.map((r) => r.id));
  const defaults = [];
  for (const c of all.rows) {
    defaults.push({
      centerId: c.id,
      collection: 'centerSettings',
      id: c.id,
      data: { ...DEFAULT_CENTER_SETTINGS, tutorName: c.name },
    });
    if (needsBranch.has(c.id)) {
      const id = uid('branch');
      defaults.push({
        centerId: c.id,
        collection: 'branches',
        id,
        data: {
          id,
          centerId: c.id,
          name: `${c.name} — Main`,
          city: c.data?.city || '',
          status: 'active',
          isDefault: true,
        },
      });
    }
  }
  await insertRecords(db, defaults);

  await db.query('ALTER TABLE auth_users VALIDATE CONSTRAINT auth_users_center_fk');
  return `imported ${centers.length} centers, ${imported} records; ${orphans.rows.length} placeholder centers`;
}
