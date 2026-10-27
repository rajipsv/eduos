// The only Vercel function. vercel.json rewrites /api/<path> here as ?__path=<path>.
import { handleApi } from '../server/router.js';

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const query = req.query && typeof req.query === 'object' ? { ...req.query } : Object.fromEntries(url.searchParams);
  const rewritten = query.__path;
  delete query.__path;
  req.query = query;
  if (!req.body || typeof req.body !== 'object') req.body = {};

  const pathname = rewritten != null ? `/api/${[].concat(rewritten).join('/')}` : url.pathname;
  return handleApi(req, res, pathname);
}
