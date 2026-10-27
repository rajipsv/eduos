// @ts-check
// POST /api/sync: the browser sends the records it changed since it last synced.
// Each change is checked on its own and gets its own result:
//   ok        saved; `record` is the stored copy (as this user may see it)
//   conflict  someone else changed it first; `record` is the current copy (null if deleted)
//   forbidden this user may not make that change
//   invalid   the data failed validation
import { COLLECTIONS, recordKey, writeMode, isOwnRecord } from '../../js/sync-rules.js';
import { getPool } from '../db.js';
import { rowToCenter, upsertCenter } from '../db/centers.js';
import { loadRecords, getRecordsForUpdate, upsertRecord, deleteRecord } from '../db/records.js';
import { parseSyncRequest, checkRecord } from '../validation.js';
import { buildContext, project } from './access.js';
import { resolveCenter } from './bootstrap.js';

// Fields a center admin may not change on their own center (platform owner only).
const PROTECTED_CENTER_FIELDS = ['status', 'plan', 'ownerUserId', 'ownerEmail', 'createdAt'];

const without = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

// 'merge' writes: which parts of an existing record a role may change.
const MERGERS = {
  // Teachers update their batch's sessions (status, notes, timing). No new or removed
  // sessions, and nothing else on the batch.
  batches(stored, incoming) {
    const changed = new Map((incoming.sessions || []).map((s) => [s?.id, s]));
    const sessions = (stored.sessions || []).map((s) =>
      changed.has(s.id) && changed.get(s.id) && typeof changed.get(s.id) === 'object'
        ? { ...changed.get(s.id), id: s.id }
        : s,
    );
    return { ...stored, sessions };
  },
  // Families submit homework for their own children. Grades stay with the teacher.
  assignments(stored, incoming, ctx) {
    const submissions = { ...(stored.submissions || {}) };
    for (const sid of ctx.studentIds) {
      const sub = incoming.submissions?.[sid];
      if (!sub || typeof sub !== 'object') continue;
      const before = stored.submissions?.[sid] || {};
      const next = without(sub, ['grade', 'feedback']);
      if (before.grade !== undefined) next.grade = before.grade;
      if (before.feedback !== undefined) next.feedback = before.feedback;
      submissions[sid] = next;
    }
    return { ...stored, submissions };
  },
};

function applyRecordChange(change, { prev, ctx, centerId, user }) {
  const { collection, id, op } = change;
  const live = prev && !prev.deleted ? prev : null;
  const mode = writeMode(ctx.role, collection);
  const shape = COLLECTIONS[collection].shape;
  const base = change.baseVersion ?? null;

  if (mode === 'none') return { status: 'forbidden' };

  const conflict = live ? base !== live.version : base !== null;
  if (op === 'delete') {
    if (!live) return { status: 'ok', deleted: true, version: prev?.version ?? null };
    if (conflict) return { status: 'conflict' };
    const allowed = mode === 'all' || (mode === 'own' && isOwnRecord(collection, live.data, id, ctx));
    return allowed ? { status: 'ok', write: 'delete' } : { status: 'forbidden' };
  }

  const incoming = change.data;
  if (!incoming) return { status: 'invalid', error: 'data is required' };
  if (conflict) return { status: 'conflict' };
  if (incoming._projected && mode !== 'merge') return { status: 'invalid', error: 'cannot save a reduced copy' };

  let next;
  if (mode === 'all') next = incoming;
  else if (mode === 'own') {
    if (live && !isOwnRecord(collection, live.data, id, ctx)) return { status: 'forbidden' };
    next = incoming;
  } else if (mode === 'create') {
    if (live) return { status: 'forbidden' };
    next = incoming;
  } else if (mode === 'merge') {
    if (!live || !isOwnRecord(collection, live.data, id, ctx) || !MERGERS[collection]) return { status: 'forbidden' };
    next = MERGERS[collection](live.data, incoming, ctx);
  } else {
    return { status: 'forbidden' };
  }

  next = without(next, ['_projected']);
  if (shape === 'list') {
    // The server decides which center a record is in and who created it.
    next.centerId = centerId;
    const createdBy = live ? live.data.createdBy : user.id;
    if (createdBy !== undefined) next.createdBy = createdBy;
    if (String(recordKey(collection, next)) !== id) return { status: 'invalid', error: 'id does not match' };
  }
  if ((mode === 'own' || mode === 'create') && !isOwnRecord(collection, next, id, ctx)) {
    return { status: 'forbidden' };
  }
  const error = checkRecord(collection, next);
  if (error) return { status: 'invalid', error };
  return { status: 'ok', write: 'upsert', data: next };
}

async function applyCenterChange(db, change, user) {
  const isOwner = user.role === 'platform_owner';
  if (change.op !== 'upsert' || !change.data) return { status: 'forbidden' };
  if (!isOwner && !(user.role === 'center_admin' && user.centerId === change.id)) return { status: 'forbidden' };

  const r = await db.query('SELECT * FROM centers WHERE id = $1 FOR UPDATE', [change.id]);
  const row = r.rows[0];
  if (!row) return { status: 'forbidden' };
  const live = rowToCenter(row);
  if ((change.baseVersion ?? null) !== row.version) return { status: 'conflict', record: live, version: row.version };

  let next = { ...change.data, id: change.id };
  if (!isOwner) for (const f of PROTECTED_CENTER_FIELDS) next[f] = live[f];
  next = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined));
  const error = checkRecord('centers', next);
  if (error) return { status: 'invalid', error };
  const version = await upsertCenter(db, next);
  return {
    status: 'ok',
    record: next,
    version,
    audit: live.status !== next.status ? { from: live.status, to: next.status } : null,
  };
}

export async function applySync(user, req, body) {
  const parsed = parseSyncRequest(body);
  if (!parsed.ok) return { status: 400, body: { error: 'invalid_body', message: parsed.error } };
  const { changes } = parsed.value;

  const pool = getPool();
  const scope = await resolveCenter(pool, user, req);
  if (scope.error) return { status: scope.status, body: { error: scope.error } };
  const centerId = scope.centerId;
  const recordChanges = changes.filter((c) => c.collection !== 'centers');
  if (!centerId && recordChanges.length) return { status: 400, body: { error: 'no_center_selected' } };

  const actingUser = user.role === 'platform_owner' ? { ...user, role: 'center_admin' } : user;
  const db = await pool.connect();
  const results = [];
  const audit = [];
  try {
    await db.query('BEGIN');
    const ctxRows = centerId ? await loadRecords(db, centerId, ['batches', 'students']) : [];
    const ctx = buildContext(actingUser, ctxRows);
    const stored = centerId
      ? await getRecordsForUpdate(
          db,
          centerId,
          recordChanges.map(({ collection, id }) => ({ collection, id })),
        )
      : new Map();

    for (const change of recordChanges) {
      const key = `${change.collection}/${change.id}`;
      const prev = stored.get(key);
      const outcome = applyRecordChange(change, { prev, ctx, centerId, user });
      const base = { collection: change.collection, id: change.id, status: outcome.status };

      if (outcome.status === 'ok' && outcome.write === 'upsert') {
        const version = await upsertRecord(db, {
          centerId,
          collection: change.collection,
          id: change.id,
          data: outcome.data,
          userId: user.id,
        });
        stored.set(key, { collection: change.collection, id: change.id, data: outcome.data, version, deleted: false });
        results.push({ ...base, version, record: project(change.collection, outcome.data, change.id, ctx) });
        audit.push({ action: 'upsert', collection: change.collection, id: change.id });
      } else if (outcome.status === 'ok' && outcome.write === 'delete') {
        const version = await deleteRecord(db, {
          centerId,
          collection: change.collection,
          id: change.id,
          userId: user.id,
        });
        stored.set(key, { ...prev, version, deleted: true });
        results.push({ ...base, version, deleted: true });
        audit.push({ action: 'delete', collection: change.collection, id: change.id });
      } else if (outcome.status === 'conflict') {
        const live = prev && !prev.deleted ? prev : null;
        results.push({
          ...base,
          version: prev?.version ?? null,
          record: live ? project(change.collection, live.data, change.id, ctx) : null,
          deleted: !live,
        });
      } else {
        results.push({
          ...base,
          ...(outcome.error ? { error: outcome.error } : {}),
          ...(outcome.deleted ? { deleted: true, version: outcome.version } : {}),
        });
      }
    }

    for (const change of changes.filter((c) => c.collection === 'centers')) {
      const outcome = await applyCenterChange(db, change, user);
      const { audit: statusChange, ...rest } = outcome;
      results.push({ collection: 'centers', id: change.id, ...rest });
      if (outcome.status === 'ok') {
        audit.push({
          action: statusChange ? 'center_status' : 'upsert',
          collection: 'centers',
          id: change.id,
          detail: statusChange,
        });
      }
    }

    // Platform-owner changes and center status changes are always recorded.
    const toLog = audit.filter((a) => user.role === 'platform_owner' || a.action === 'center_status');
    if (toLog.length) {
      await db.query(
        `INSERT INTO audit_log (user_id, role, center_id, action, collection, record_id, detail)
         SELECT $1, $2, x.center_id, x.action, x.collection, x.record_id, x.detail
         FROM jsonb_to_recordset($3::jsonb) AS x(center_id text, action text, collection text, record_id text, detail jsonb)`,
        [
          user.id,
          user.role,
          JSON.stringify(
            toLog.map((a) => ({
              center_id: a.collection === 'centers' ? a.id : centerId,
              action: a.action,
              collection: a.collection,
              record_id: a.id,
              detail: a.detail || null,
            })),
          ),
        ],
      );
    }
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }

  return { status: 200, body: { results } };
}
