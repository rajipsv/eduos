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
  revokeAllUserRefreshTokens,
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
import { loadAppStateData, registerCenterInAppState } from './state-sync.js';
import { ensureNeonDemoSeeded } from '../demo-seed.js';
import { getPool } from '../db.js';
import { authenticateRequest } from './middleware.js';
import { appUrl, isDemoModeEnabled } from '../env.js';
import { hitRateLimit, clientIp } from '../rate-limit.js';
import { sendPasswordResetEmail } from '../email.js';

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_PASSWORD_HASH = hashPassword('dummy-password-for-timing');

async function tooManyAttempts(res, checks) {
  for (const [bucket, key, opts] of checks) {
    const r = await hitRateLimit(bucket, key, opts);
    if (!r.ok) {
      res.setHeader('Retry-After', String(r.retryAfterSec));
      json(res, 429, { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' });
      return true;
    }
  }
  return false;
}

function json(res, status, body) {
  res.status(status).json(body);
}

function getOrigin(req) {
  const configured = appUrl();
  if (configured) return configured;
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

  if (typeof email !== 'string' || typeof password !== 'string') {
    return json(res, 400, { ok: false, error: 'Email and password required' });
  }

  const normEmail = email.trim().toLowerCase();
  if (await tooManyAttempts(res, [
    ['login:email', normEmail, { limit: 10, windowSec: 15 * 60 }],
    ['login:ip', clientIp(req), { limit: 50, windowSec: 15 * 60 }],
  ])) return;

  const row = await findUserWithPasswordByEmail(normEmail);
  const passwordOk = verifyPassword(password, row?.password_hash || DUMMY_PASSWORD_HASH);
  if (!row || !passwordOk) {
    return json(res, 401, { ok: false, error: 'Invalid email or password' });
  }

  const user = await findUserById(row.id);
  const expectedRole = portal ? PORTAL_ROLE_MAP[portal] : null;
  if (expectedRole && user.role !== expectedRole) {
    return json(res, 401, { ok: false, error: `This account is not a ${expectedRole} login` });
  }

  if (user.centerId && appStateCenterSuspended(user.centerId, await loadAppStateData())) {
    return json(res, 403, { ok: false, error: 'This center has been suspended. Contact Tutorsala support.' });
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
  if ([centerName, ownerName, email, phone, city, password].some((v) => v != null && typeof v !== 'string')) {
    return json(res, 400, { ok: false, error: 'Please fill all required fields' });
  }
  const normEmail = email?.trim().toLowerCase();

  if (await tooManyAttempts(res, [['register:ip', clientIp(req), { limit: 5, windowSec: 60 * 60 }]])) return;

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

  const rawEmail = req.body?.email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email) return json(res, 400, { ok: false, error: 'Email is required' });

  if (await tooManyAttempts(res, [
    ['forgot:email', email, { limit: 3, windowSec: 60 * 60 }],
    ['forgot:ip', clientIp(req), { limit: 20, windowSec: 60 * 60 }],
  ])) return;

  // The reset link is returned in the response only in demo mode. Otherwise it is emailed.
  let demoResetUrl = null;
  const user = await findUserByEmail(email);
  if (user) {
    const { token } = await createPasswordResetToken(user.id, email);
    const resetUrl = buildResetUrl(req, token);
    if (isDemoModeEnabled()) {
      demoResetUrl = resetUrl;
    } else {
      await sendPasswordResetEmail(email, resetUrl).catch((err) => {
        console.error('Password reset email failed:', err.message);
      });
    }
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
  // Sign out every existing session for this account.
  await revokeAllUserRefreshTokens(entry.user_id);
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

  const result = await ensureNeonDemoSeeded();
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
  const fs = await import('fs');
  const sql = await fs.promises.readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  await getPool().query(sql);
  const seed = await ensureNeonDemoSeeded().catch((err) => {
    console.warn('Demo seed after migrate skipped:', err.message);
    return null;
  });
  if (seed?.ok) console.log('Demo accounts ready:', seed.demoEmails?.join(', '));
}
