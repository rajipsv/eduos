import { isAuthConfigured } from './config.js';
import { verifyAccessToken, getBearerToken } from './jwt.js';
import { findUserById } from './users.js';
import { isProduction } from '../env.js';

export function authUnavailable(res) {
  return res.status(503).json({ error: 'auth_not_configured' });
}

export async function authenticateRequest(req, res) {
  if (!isAuthConfigured()) {
    // Local demo without JWT secrets runs open; production never does.
    if (isProduction()) {
      res.status(503).json({ error: 'auth_not_configured' });
      return { ok: false };
    }
    return { ok: true, auth: false, user: null, claims: null };
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return { ok: false };
  }

  const claims = verifyAccessToken(token, process.env.JWT_SECRET);
  if (!claims?.sub) {
    res.status(401).json({ error: 'invalid_token' });
    return { ok: false };
  }

  const user = await findUserById(claims.sub);
  if (!user) {
    res.status(401).json({ error: 'user_not_found' });
    return { ok: false };
  }

  return { ok: true, auth: true, user, claims };
}

export async function requireAuth(req, res) {
  const result = await authenticateRequest(req, res);
  if (!result.ok) return null;
  if (!isAuthConfigured()) return { auth: false, user: null };
  return result;
}
