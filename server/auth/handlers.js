import { isAuthConfigured, PORTAL_ROLE_MAP } from './config.js';
import { verifyPassword, hashPassword } from './crypto.js';
import { signAccessToken } from './jwt.js';
import { setRefreshCookie, clearRefreshCookie, getRefreshTokenFromRequest } from './cookies.js';
import {
  findUserWithPasswordByEmail,
  findUserById,
  findUserByEmail,
  insertUser,
  updateUserPassword,
} from './users.js';
import {
  createRefreshToken,
  findValidRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from './refresh-tokens.js';
import {
  createPasswordResetToken,
  findValidPasswordResetToken,
  markPasswordResetTokenUsed,
} from './password-reset.js';
import {
  buildClientSessionFromDbUser,
  validatePassword,
} from './session.js';
import {
  loadAppStateData,
  registerCenterInAppState,
  syncAuthUsersFromAppState,
} from './state-sync.js';
import { getPool } from '../db.js';
import { authenticateRequest } from './middleware.js';

function json(res, status, body) {
  res.status(status).json(body);
}

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

function buildResetUrl(req, token) {
  return `${getOrigin(req)}/#reset-password/${encodeURIComponent(token)}`;
}

async function issueAuthResponse(req, res, user) {
  const appState = await loadAppStateData();
  const session = await buildClientSessionFromDbUser(user, appState);
  const accessToken = signAccessToken(user, process.env.JWT_SECRET);
  const refreshToken = await createRefreshToken(user.id);
  setRefreshCookie(res, refreshToken);
  return json(res, 200, { ok: true, accessToken, session, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
}

export async function handleLogin(req, res) {
  if (!isAuthConfigured()) return authUnavailable(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  const { email, password, portal } = req.body || {};
  if (!email || !password) return json(res, 400, { ok: false, error: 'Email and password required' });

  await syncAuthUsersFromAppState().catch(() => {});

  const row = await findUserWithPasswordByEmail(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return json(res, 401, { ok: false, error: 'Invalid email or password' });
  }

  const user = await findUserById(row.id);
  const expectedRole = portal ? PORTAL_ROLE_MAP[portal] : null;
  if (expectedRole && user.role !== expectedRole) {
    return json(res, 401, { ok: false, error: `This account is not a ${expectedRole} login` });
  }

  if (user.centerId && appStateCenterSuspended(user.centerId, await loadAppStateData())) {
    return json(res, 403, { ok: false, error: 'This center has been suspended. Contact EduOS support.' });
  }

  return issueAuthResponse(req, res, user);
}

function appStateCenterSuspended(centerId, data) {
  const center = data?.centers?.find((c) => c.id === centerId);
  return center?.status === 'suspended';
}

export async function handleLogout(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  const token = getRefreshTokenFromRequest(req);
  if (token) await revokeRefreshToken(token);
  clearRefreshCookie(res);
  return json(res, 200, { ok: true });
}

export async function handleRefresh(req, res) {
  if (!isAuthConfigured()) return authUnavailable(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  const token = getRefreshTokenFromRequest(req);
  if (!token) return json(res, 401, { ok: false, error: 'No refresh token' });

  const row = await findValidRefreshToken(token);
  if (!row) {
    clearRefreshCookie(res);
    return json(res, 401, { ok: false, error: 'Refresh token invalid or expired' });
  }

  const user = await findUserById(row.user_id);
  if (!user) {
    clearRefreshCookie(res);
    return json(res, 401, { ok: false, error: 'User not found' });
  }

  const newRefresh = await rotateRefreshToken(token, user.id);
  setRefreshCookie(res, newRefresh);
  const accessToken = signAccessToken(user, process.env.JWT_SECRET);
  const appState = await loadAppStateData();
  const session = await buildClientSessionFromDbUser(user, appState);
  return json(res, 200, { ok: true, accessToken, session });
}

export async function handleMe(req, res) {
  if (!isAuthConfigured()) return authUnavailable(res);
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  const auth = await authenticateRequest(req, res);
  if (!auth.ok) return;

  const appState = await loadAppStateData();
  const session = await buildClientSessionFromDbUser(auth.user, appState);
  return json(res, 200, { ok: true, session, user: auth.user });
}

export async function handleRegisterCenter(req, res) {
  if (!isAuthConfigured()) return authUnavailable(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  const { centerName, ownerName, email, phone, city, password } = req.body || {};
  const normEmail = email?.trim().toLowerCase();

  if (!centerName?.trim() || !ownerName?.trim() || !normEmail || !password) {
    return json(res, 400, { ok: false, error: 'Please fill all required fields' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) return json(res, 400, { ok: false, error: passwordError });

  const existing = await findUserByEmail(normEmail);
  if (existing) return json(res, 409, { ok: false, error: 'An account with this email already exists' });

  const reg = await registerCenterInAppState({ centerName, ownerName, email: normEmail, phone, city });
  if (!reg.ok) return json(res, 409, { ok: false, error: reg.error });

  await insertUser({
    id: reg.user.id,
    email: normEmail,
    passwordHash: hashPassword(password),
    role: 'center_admin',
    name: ownerName.trim(),
    centerId: reg.center.id,
  });

  const user = await findUserById(reg.user.id);
  return issueAuthResponse(req, res, user);
}

export async function handleForgotPassword(req, res) {
  if (!isAuthConfigured()) return authUnavailable(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  const email = req.body?.email?.trim().toLowerCase();
  if (!email) return json(res, 400, { ok: false, error: 'Email is required' });

  let demoResetUrl = null;
  const user = await findUserByEmail(email);
  if (user) {
    const { token } = await createPasswordResetToken(user.id, email);
    demoResetUrl = buildResetUrl(req, token);
  }

  return json(res, 200, {
    ok: true,
    message: 'If an account exists for that email, password reset instructions have been sent.',
    demoResetUrl,
  });
}

export async function handleResetPasswordInfo(req, res) {
  if (!isAuthConfigured()) return authUnavailable(res);
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  const token = req.query?.token;
  const entry = await findValidPasswordResetToken(token);
  if (!entry) return json(res, 400, { ok: false, error: 'This reset link is invalid or has expired.' });
  return json(res, 200, { ok: true, email: entry.email, name: entry.user_name || entry.email });
}

export async function handleResetPassword(req, res) {
  if (!isAuthConfigured()) return authUnavailable(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  const { token, password } = req.body || {};
  const passwordError = validatePassword(password);
  if (passwordError) return json(res, 400, { ok: false, error: passwordError });

  const entry = await findValidPasswordResetToken(token);
  if (!entry) return json(res, 400, { ok: false, error: 'This reset link is invalid or has expired.' });

  await updateUserPassword(entry.user_id, hashPassword(password));
  await markPasswordResetTokenUsed(token);
  return json(res, 200, { ok: true, message: 'Password updated. You can sign in now.' });
}

export async function handleSyncAuthUsers(req, res) {
  if (!isAuthConfigured()) return authUnavailable(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  const auth = await authenticateRequest(req, res);
  if (!auth.ok) return;
  if (auth.user.role !== 'platform_owner') {
    return json(res, 403, { ok: false, error: 'Platform owner only' });
  }

  const result = await syncAuthUsersFromAppState();
  return json(res, 200, { ok: true, ...result });
}

function authUnavailable(res) {
  return json(res, 503, { ok: false, error: 'auth_not_configured' });
}

function methodNotAllowed(res, method) {
  res.setHeader('Allow', method);
  return json(res, 405, { error: 'method_not_allowed' });
}

export async function runAuthMigrations() {
  if (!process.env.DATABASE_URL) return;
  const sql = await import('fs').then((fs) => fs.promises.readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  await getPool().query(sql);
  await syncAuthUsersFromAppState().catch((err) => {
    console.warn('Auth user sync skipped:', err.message);
  });
}
