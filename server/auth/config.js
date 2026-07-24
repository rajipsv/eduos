const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC) || 15 * 60;
const REFRESH_TTL_SEC = Number(process.env.JWT_REFRESH_TTL_SEC) || 30 * 24 * 60 * 60;
const REFRESH_COOKIE = 'eduos_refresh';

export function isAuthConfigured() {
  return Boolean(process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET);
}

export function getAccessTtlSec() {
  return ACCESS_TTL_SEC;
}

export function getRefreshTtlSec() {
  return REFRESH_TTL_SEC;
}

export function getRefreshCookieName() {
  return REFRESH_COOKIE;
}

export function cookieOptions(maxAgeSec) {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  return {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: maxAgeSec,
  };
}

export const PORTAL_ROLE_MAP = {
  platform: 'platform_owner',
  center: 'center_admin',
  teacher: 'teacher',
  student: 'student',
  parent: 'parent',
  family: 'family',
};

export const DEMO_PASSWORD = 'demo123';
