import { isAuthConfigured } from './auth/config.js';
import { authenticateRequest } from './auth/middleware.js';
import { getPool, testConnection } from './db.js';

export const STATE_ID = 'global';

export async function getHealthPayload() {
  if (!process.env.DATABASE_URL) {
    return {
      ok: true,
      db: false,
      auth: false,
      reason: 'DATABASE_URL not configured',
    };
  }
  const db = await testConnection();
  return {
    ok: true,
    db,
    auth: db && isAuthConfigured(),
  };
}

export async function loadAppState() {
  if (!process.env.DATABASE_URL) {
    return { error: 'database_not_configured', status: 503 };
  }
  const result = await getPool().query(
    'SELECT data, updated_at FROM app_state WHERE id = $1',
    [STATE_ID],
  );
  if (!result.rows.length) {
    return { error: 'not_found', status: 404 };
  }
  return {
    status: 200,
    body: { data: result.rows[0].data, updatedAt: result.rows[0].updated_at },
  };
}

export async function saveAppState(data) {
  if (!process.env.DATABASE_URL) {
    return { error: 'database_not_configured', status: 503 };
  }
  if (!data || typeof data !== 'object') {
    return { error: 'invalid_body', status: 400 };
  }

  const cleaned = { ...data };
  if (cleaned.users?.length && isAuthConfigured()) {
    cleaned.users = cleaned.users.map(({ password, ...rest }) => rest);
  }
  cleaned.passwordResetTokens = [];

  await getPool().query(
    `INSERT INTO app_state (id, data, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [STATE_ID, cleaned],
  );
  return { status: 200, body: { ok: true } };
}

export async function removeAppState() {
  if (!process.env.DATABASE_URL) {
    return { error: 'database_not_configured', status: 503 };
  }
  await getPool().query('DELETE FROM app_state WHERE id = $1', [STATE_ID]);
  return { status: 200, body: { ok: true } };
}

export async function loadAppStateForRequest(req, res) {
  if (isAuthConfigured()) {
    const auth = await authenticateRequest(req, res);
    if (!auth.ok) return { error: 'unauthorized', status: 401 };
  }
  return loadAppState();
}

export async function saveAppStateForRequest(req, res, data) {
  if (isAuthConfigured()) {
    const auth = await authenticateRequest(req, res);
    if (!auth.ok) return { error: 'unauthorized', status: 401 };
  }
  return saveAppState(data);
}

export async function removeAppStateForRequest(req, res) {
  if (isAuthConfigured()) {
    const auth = await authenticateRequest(req, res);
    if (!auth.ok) return { error: 'unauthorized', status: 401 };
    if (auth.user.role !== 'platform_owner' && auth.user.role !== 'center_admin') {
      return { error: 'forbidden', status: 403 };
    }
  }
  return removeAppState();
}
