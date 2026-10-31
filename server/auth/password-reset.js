import { getPool } from '../db.js';
import { hashToken, randomToken, uid } from './crypto.js';

const RESET_TTL_MS = 60 * 60 * 1000;
/** Invite links ("set your password") stay valid longer than reset links. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_TTL_DAYS = 7;

/** Invites share the reset-token table; the token's prefix says which kind it is. */
export function isInviteToken(token) {
  return typeof token === 'string' && token.startsWith('inv_');
}

/**
 * Creates a one-time link token. Any older unused reset or invite link for the user stops working.
 * @param {string} userId
 * @param {string} email
 * @param {{ invite?: boolean }} [opts]
 */
export async function createPasswordResetToken(userId, email, { invite = false } = {}) {
  const token = randomToken(invite ? 'inv' : 'rst');
  const tokenHash = hashToken(token);
  const id = uid(invite ? 'invite' : 'pwreset');
  const expiresAt = new Date(Date.now() + (invite ? INVITE_TTL_MS : RESET_TTL_MS));

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
  if (!token || typeof token !== 'string') return null;
  const tokenHash = hashToken(token);
  const result = await getPool().query(
    `SELECT t.*, u.email AS user_email, u.name AS user_name, u.center_id AS user_center_id
     FROM auth_password_reset_tokens t
     JOIN auth_users u ON u.id = t.user_id
     WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );
  return result.rows[0] || null;
}

/** Marks the token used. Returns false if it was already used (so a link works only once). */
export async function markPasswordResetTokenUsed(token) {
  const tokenHash = hashToken(token);
  const r = await getPool().query(
    'UPDATE auth_password_reset_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL',
    [tokenHash],
  );
  return r.rowCount > 0;
}
