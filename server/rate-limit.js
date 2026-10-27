// @ts-check
import { getPool } from './db.js';

/**
 * Database-backed rate limit, so it holds across serverless instances.
 * Records one attempt and reports whether the caller is over `limit` in the last `windowSec`.
 * Fails open (allows the request) if the database or table is unavailable, and logs a warning.
 *
 * @param {string} bucket e.g. 'login:email'
 * @param {string} key e.g. the email or IP
 * @param {{ limit: number, windowSec: number }} opts
 * @returns {Promise<{ ok: boolean, retryAfterSec?: number }>}
 */
export async function hitRateLimit(bucket, key, { limit, windowSec }) {
  if (!process.env.DATABASE_URL || !key) return { ok: true };
  const k = `${bucket}:${String(key).toLowerCase().slice(0, 200)}`;
  try {
    const pool = getPool();
    await pool.query('INSERT INTO auth_attempts (key) VALUES ($1)', [k]);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n, min(created_at) AS first
         FROM auth_attempts
        WHERE key = $1 AND created_at > NOW() - make_interval(secs => $2)`,
      [k, windowSec],
    );
    // Occasionally prune old rows.
    if (Math.random() < 0.02) {
      await pool.query("DELETE FROM auth_attempts WHERE created_at < NOW() - INTERVAL '1 day'");
    }
    const { n, first } = rows[0];
    if (n <= limit) return { ok: true };
    const elapsed = (Date.now() - new Date(first).getTime()) / 1000;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(windowSec - elapsed)) };
  } catch (err) {
    console.warn('Rate limit check skipped:', err instanceof Error ? err.message : err);
    return { ok: true };
  }
}

/** Client IP as reported by the platform proxy (Vercel / local). */
export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
