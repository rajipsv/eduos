import { getPool } from '../db.js';
import { hashToken, randomToken, uid } from './crypto.js';

const RESET_TTL_MS = 60 * 60 * 1000;

export async function createPasswordResetToken(userId, email) {
  const token = randomToken('rst');
  const tokenHash = hashToken(token);
  const id = uid('pwreset');
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await getPool().query(
    `UPDATE auth_password_reset_tokens SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );

  await getPool().query(
    `INSERT INTO auth_password_reset_tokens (id, user_id, token_hash, email, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, tokenHash, email.trim().toLowerCase(), expiresAt.toISOString()],
  );

  return { token, expiresAt };
}

export async function findValidPasswordResetToken(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const result = await getPool().query(
    `SELECT t.*, u.email AS user_email, u.name AS user_name
     FROM auth_password_reset_tokens t
     JOIN auth_users u ON u.id = t.user_id
     WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );
  return result.rows[0] || null;
}

export async function markPasswordResetTokenUsed(token) {
  const tokenHash = hashToken(token);
  await getPool().query(
    'UPDATE auth_password_reset_tokens SET used_at = NOW() WHERE token_hash = $1',
    [tokenHash],
  );
}
