// @ts-check
// Developer API keys. The full key is shown once when created; only a hash and a short
// prefix are stored.
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { getPool } from '../db.js';
import { uid } from '../auth/crypto.js';
import { resolveCenter } from './bootstrap.js';

export const hashApiKey = (key) => createHash('sha256').update(key).digest('hex');

async function adminCenter(user, req) {
  if (!['center_admin', 'platform_owner'].includes(user.role))
    return { error: { status: 403, body: { error: 'forbidden' } } };
  const scope = await resolveCenter(getPool(), user, req);
  if (scope.error) return { error: { status: scope.status, body: { error: scope.error } } };
  if (!scope.centerId) return { error: { status: 400, body: { error: 'no_center_selected' } } };
  return { centerId: scope.centerId };
}

const toPublic = (row) => ({
  id: row.id,
  name: row.name,
  prefix: row.key_prefix,
  scopes: row.scopes || [],
  createdAt: new Date(row.created_at).toISOString().slice(0, 10),
});

export async function listApiKeys(db, centerId) {
  const r = await db.query(
    'SELECT * FROM center_api_keys WHERE center_id = $1 AND revoked_at IS NULL ORDER BY created_at',
    [centerId],
  );
  return r.rows.map(toPublic);
}

const createSchema = z.object({
  name: z.string().trim().max(100).optional(),
  scopes: z
    .array(z.enum(['read', 'write']))
    .max(2)
    .optional(),
});

/** POST /api/api-keys */
export async function createApiKey(user, req) {
  const scope = await adminCenter(user, req);
  if (scope.error) return scope.error;
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) return { status: 400, body: { error: 'invalid_body' } };

  const key = `tsk_${randomBytes(24).toString('base64url')}`;
  const id = uid('key');
  const r = await getPool().query(
    `INSERT INTO center_api_keys (id, center_id, name, key_prefix, key_hash, scopes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      id,
      scope.centerId,
      parsed.data.name || 'API Key',
      key.slice(0, 10),
      hashApiKey(key),
      JSON.stringify(parsed.data.scopes || ['read']),
    ],
  );
  return { status: 201, body: { apiKey: toPublic(r.rows[0]), key } };
}

/** DELETE /api/api-keys/:id */
export async function revokeApiKey(user, req, id) {
  const scope = await adminCenter(user, req);
  if (scope.error) return scope.error;
  const r = await getPool().query(
    'UPDATE center_api_keys SET revoked_at = NOW() WHERE id = $1 AND center_id = $2 AND revoked_at IS NULL',
    [id, scope.centerId],
  );
  return r.rowCount ? { status: 200, body: { ok: true } } : { status: 404, body: { error: 'not_found' } };
}
