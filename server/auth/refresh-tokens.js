import { getPool } from '../db.js';
import { getRefreshTtlSec } from './config.js';
import { hashToken, randomToken, uid } from './crypto.js';

export async function createRefreshToken(userId) {
  const token = randomToken('rft');
  const tokenHash = hashToken(token);
  const id = uid('refresh');
  const expiresAt = new Date(Date.now() + getRefreshTtlSec() * 1000);
  await getPool().query(
    `INSERT INTO auth_refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [id, userId, tokenHash, expiresAt.toISOString()],
  );
  return token;
}

export async function findValidRefreshToken(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const result = await getPool().query(
    `SELECT * FROM auth_refresh_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );
  return result.rows[0] || null;
}

export async function revokeRefreshToken(token) {
  if (!token) return;
  const tokenHash = hashToken(token);
  await getPool().query(
    'UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
    [tokenHash],
  );
}

export async function revokeAllUserRefreshTokens(userId) {
  await getPool().query(
    'UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  );
}

export async function rotateRefreshToken(oldToken, userId) {
  await revokeRefreshToken(oldToken);
  return createRefreshToken(userId);
}
