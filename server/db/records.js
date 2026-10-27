// @ts-check
import { ownerRef } from '../../js/sync-rules.js';

/** Live records of a center, optionally only some collections. */
export async function loadRecords(db, centerId, collections = null) {
  const r = collections
    ? await db.query(
        `SELECT collection, id, data, version FROM records
         WHERE center_id = $1 AND collection = ANY($2) AND deleted_at IS NULL`,
        [centerId, collections],
      )
    : await db.query(
        `SELECT collection, id, data, version FROM records
         WHERE center_id = $1 AND deleted_at IS NULL`,
        [centerId],
      );
  return r.rows;
}

/**
 * Stored rows for the given keys, including deleted ones (so a delete can be told
 * apart from "never existed"). Locks the rows for the rest of the transaction.
 * @returns {Promise<Map<string, {collection:string,id:string,data:any,version:number,deleted:boolean}>>}
 */
export async function getRecordsForUpdate(db, centerId, keys) {
  const out = new Map();
  if (!keys.length) return out;
  const r = await db.query(
    `SELECT r.collection, r.id, r.data, r.version, r.deleted_at IS NOT NULL AS deleted
     FROM records r
     JOIN jsonb_to_recordset($2::jsonb) AS k(collection text, id text)
       ON r.collection = k.collection AND r.id = k.id
     WHERE r.center_id = $1
     FOR UPDATE OF r`,
    [centerId, JSON.stringify(keys)],
  );
  for (const row of r.rows) out.set(`${row.collection}/${row.id}`, row);
  return out;
}

/** Inserts or replaces one record (undeleting it if needed). Returns the new version. */
export async function upsertRecord(db, { centerId, collection, id, data, userId = null }) {
  const r = await db.query(
    `INSERT INTO records (center_id, collection, id, owner_ref, data, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (center_id, collection, id) DO UPDATE SET
       data = EXCLUDED.data, owner_ref = EXCLUDED.owner_ref, updated_by = EXCLUDED.updated_by,
       version = records.version + 1, updated_at = NOW(), deleted_at = NULL
     RETURNING version`,
    [centerId, collection, id, ownerRef(collection, data), data, userId],
  );
  return r.rows[0].version;
}

/** Soft-deletes a record. Returns the new version, or null if it wasn't there. */
export async function deleteRecord(db, { centerId, collection, id, userId = null }) {
  const r = await db.query(
    `UPDATE records SET deleted_at = NOW(), version = version + 1, updated_at = NOW(), updated_by = $4
     WHERE center_id = $1 AND collection = $2 AND id = $3 AND deleted_at IS NULL
     RETURNING version`,
    [centerId, collection, id, userId],
  );
  return r.rows[0]?.version ?? null;
}

/**
 * Bulk insert of new records. Existing ones are left alone.
 * @param {Array<{centerId:string, collection:string, id:string, data:any}>} rows
 */
export async function insertRecords(db, rows) {
  if (!rows.length) return 0;
  const payload = rows.map((r) => ({
    center_id: r.centerId,
    collection: r.collection,
    id: String(r.id),
    owner_ref: ownerRef(r.collection, r.data),
    data: r.data,
  }));
  const r = await db.query(
    `INSERT INTO records (center_id, collection, id, owner_ref, data)
     SELECT center_id, collection, id, owner_ref, data
     FROM jsonb_to_recordset($1::jsonb)
       AS x(center_id text, collection text, id text, owner_ref text, data jsonb)
     ON CONFLICT (center_id, collection, id) DO NOTHING`,
    [JSON.stringify(payload)],
  );
  return r.rowCount;
}

/** Permanently removes every record of a center (demo re-seed only). */
export async function purgeCenterRecords(db, centerId) {
  await db.query('DELETE FROM records WHERE center_id = $1', [centerId]);
}

/** Record counts per center, for the platform owner's overview. */
export async function countRecordsByCenter(db, collections) {
  const r = await db.query(
    `SELECT center_id, collection, count(*)::int AS n FROM records
     WHERE deleted_at IS NULL AND collection = ANY($1)
     GROUP BY center_id, collection`,
    [collections],
  );
  return r.rows;
}
