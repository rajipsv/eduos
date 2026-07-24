import { createHmac, timingSafeEqual } from 'crypto';
import { getAccessTtlSec } from './config.js';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function parseB64urlJson(str) {
  return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
}

function signSegment(header, payload, secret) {
  const data = `${header}.${payload}`;
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function signAccessToken(user, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = b64urlJson({
    sub: user.id,
    role: user.role,
    email: user.email,
    centerId: user.center_id || user.centerId || null,
    iat: now,
    exp: now + getAccessTtlSec(),
  });
  const sig = signSegment(header, payload, secret);
  return `${header}.${payload}.${sig}`;
}

export function verifyAccessToken(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = signSegment(header, payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims;
  try {
    claims = parseB64urlJson(payload);
  } catch {
    return null;
  }
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
}

export function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
