// @ts-check
// Security headers for the local Express server. Keep in sync with "headers" in vercel.json.

// Report-only for now: the browser logs violations without blocking, so nothing breaks while we
// confirm the list. 'unsafe-inline' is needed until the inline <script> blocks in index.html move to files.
// api.openai.com and graph.facebook.com go away once AI and WhatsApp calls move to the server.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.openai.com https://graph.facebook.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const securityHeaders = {
  'Content-Security-Policy-Report-Only': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
