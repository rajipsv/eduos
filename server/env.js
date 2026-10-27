// @ts-check

/** True on Vercel or when NODE_ENV=production. */
export function isProduction() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

/**
 * Demo mode seeds the demo accounts (password demo123) and allows demo-only shortcuts
 * such as returning the password-reset link in the response.
 * Off in production unless ENABLE_DEMO_SEED=true; on locally unless ENABLE_DEMO_SEED=false.
 */
export function isDemoModeEnabled() {
  const flag = process.env.ENABLE_DEMO_SEED;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return !isProduction();
}

const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

/** Names of required env vars that are missing (only enforced in production). */
export function missingRequiredEnv() {
  if (!isProduction()) return [];
  return REQUIRED_IN_PRODUCTION.filter((name) => !process.env[name]);
}

/** Origins allowed to call the API cross-origin (comma-separated ALLOWED_ORIGINS). */
export function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Public base URL used in emails (APP_URL), so links never come from request headers. */
export function appUrl() {
  return (process.env.APP_URL || '').replace(/\/$/, '');
}
