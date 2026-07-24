import { cookieOptions, getRefreshCookieName, getRefreshTtlSec } from './config.js';

export function parseCookies(req) {
  const raw = req.headers?.cookie || req.headers?.Cookie || '';
  const out = {};
  raw.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

export function serializeCookie(name, value, opts) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  return parts.join('; ');
}

export function setRefreshCookie(res, token) {
  const opts = cookieOptions(getRefreshTtlSec());
  res.setHeader('Set-Cookie', serializeCookie(getRefreshCookieName(), token, opts));
}

export function clearRefreshCookie(res) {
  const opts = { ...cookieOptions(0), maxAge: 0 };
  res.setHeader('Set-Cookie', serializeCookie(getRefreshCookieName(), '', opts));
}

export function getRefreshTokenFromRequest(req) {
  return parseCookies(req)[getRefreshCookieName()] || null;
}
