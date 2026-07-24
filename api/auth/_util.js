import {
  handleLogin,
  handleLogout,
  handleRefresh,
  handleMe,
  handleRegisterCenter,
  handleForgotPassword,
  handleResetPasswordInfo,
  handleResetPassword,
} from '../../server/auth/handlers.js';

export function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

export function createAuthHandler(handler) {
  return async function authRoute(req, res) {
    try {
      req.body = readJsonBody(req);
      if (req.method === 'GET' && req.query == null) {
        const url = new URL(req.url || '', 'http://localhost');
        req.query = Object.fromEntries(url.searchParams);
      }
      await handler(req, res);
    } catch (err) {
      console.error('Auth route error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'server_error' });
    }
  };
}

export const loginHandler = createAuthHandler(handleLogin);
export const logoutHandler = createAuthHandler(handleLogout);
export const refreshHandler = createAuthHandler(handleRefresh);
export const meHandler = createAuthHandler(handleMe);
export const registerCenterHandler = createAuthHandler(handleRegisterCenter);
export const forgotPasswordHandler = createAuthHandler(handleForgotPassword);
export const resetPasswordInfoHandler = createAuthHandler(handleResetPasswordInfo);
export const resetPasswordHandler = createAuthHandler(handleResetPassword);
