// @ts-check
// Every /api route, used by both the Express server and the single Vercel function.
import {
  handleLogin,
  handleLogout,
  handleRefresh,
  handleMe,
  handleRegisterCenter,
  handleForgotPassword,
  handleResetPasswordInfo,
  handleResetPassword,
} from './auth/handlers.js';
import { handleCreateInboundLead, handleListInboundLeads, handleUpdateInboundLead } from './leads-handler.js';
import { authenticateRequest } from './auth/middleware.js';
import { buildBootstrap } from './services/bootstrap.js';
import { applySync } from './services/sync.js';
import { createUser, updateUser } from './services/users.js';
import { listPublicCenters, getHealthPayload } from './services/public.js';
import { saveSecrets, aiChat, sendWhatsApp } from './services/integrations.js';
import { createApiKey, revokeApiKey } from './services/api-keys.js';
import { createInquiry } from './services/inquiries.js';

/** Signed-in routes: fn(user, req, ...params) returns { status, body }. */
function signedIn(fn) {
  return async (req, res, ...params) => {
    const auth = await authenticateRequest(req, res);
    if (!auth.ok) return;
    // Without JWT secrets (local only) there is no user to scope data to.
    if (!auth.auth) return res.status(503).json({ error: 'auth_not_configured' });
    const result = await fn(auth.user, req, ...params);
    res.status(result.status).json(result.body);
  };
}

// [method, path, handler]. ":name" segments are passed to the handler as extra arguments.
export const ROUTES = [
  ['GET', '/api/health', async (_req, res) => res.status(200).json(await getHealthPayload())],

  ['POST', '/api/auth/login', handleLogin],
  ['POST', '/api/auth/logout', handleLogout],
  ['POST', '/api/auth/refresh', handleRefresh],
  ['GET', '/api/auth/me', handleMe],
  ['POST', '/api/auth/register-center', handleRegisterCenter],
  ['POST', '/api/auth/forgot-password', handleForgotPassword],
  ['GET', '/api/auth/reset-password-info', handleResetPasswordInfo],
  ['POST', '/api/auth/reset-password', handleResetPassword],

  ['GET', '/api/bootstrap', signedIn(buildBootstrap)],
  ['POST', '/api/sync', signedIn((user, req) => applySync(user, req, req.body))],
  ['POST', '/api/users', signedIn(createUser)],
  ['PATCH', '/api/users/:id', signedIn(updateUser)],
  ['PUT', '/api/settings/secrets', signedIn(saveSecrets)],
  ['POST', '/api/ai/chat', signedIn(aiChat)],
  ['POST', '/api/whatsapp/send', signedIn(sendWhatsApp)],
  ['POST', '/api/api-keys', signedIn(createApiKey)],
  ['DELETE', '/api/api-keys/:id', signedIn(revokeApiKey)],

  ['GET', '/api/public/centers', async (req, res) => {
    const result = await listPublicCenters({ includeDemo: req.query?.demo === '1' });
    res.status(result.status).json(result.body);
  }],
  ['POST', '/api/public/centers/:id/inquiries', createInquiry],

  ['POST', '/api/leads', handleCreateInboundLead],
  ['GET', '/api/leads', handleListInboundLeads],
  ['PATCH', '/api/leads', handleUpdateInboundLead],
];

function match(pattern, pathname) {
  const a = pattern.split('/');
  const b = pathname.replace(/\/+$/, '').split('/');
  if (a.length !== b.length) return null;
  const params = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params.push(decodeURIComponent(b[i]));
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

/**
 * Handles one API request. `req.body` and `req.query` must already be parsed.
 * @param {any} req
 * @param {any} res
 * @param {string} pathname e.g. /api/auth/login
 */
export async function handleApi(req, res, pathname) {
  const allowed = [];
  for (const [method, pattern, handler] of ROUTES) {
    const params = match(pattern, pathname);
    if (!params) continue;
    if (method !== req.method) {
      allowed.push(method);
      continue;
    }
    try {
      await handler(req, res, ...params);
    } catch (err) {
      console.error(`${req.method} ${pathname} failed:`, err);
      if (!res.headersSent) res.status(500).json({ error: 'server_error' });
    }
    return;
  }
  if (allowed.length) {
    res.setHeader('Allow', allowed.join(', '));
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  return res.status(404).json({ error: 'not_found' });
}
