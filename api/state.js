import { loadAppStateForRequest, saveAppStateForRequest, removeAppStateForRequest } from '../server/state-api.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await loadAppStateForRequest(req, res);
      if (result.error) {
        if (res.headersSent) return;
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(result.status).json(result.body);
    }

    if (req.method === 'PUT') {
      const result = await saveAppStateForRequest(req, res, req.body);
      if (result.error) {
        if (res.headersSent) return;
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(result.status).json(result.body);
    }

    if (req.method === 'DELETE') {
      const result = await removeAppStateForRequest(req, res);
      if (result.error) {
        if (res.headersSent) return;
        return res.status(result.status).json({ error: result.error });
      }
      return res.status(result.status).json(result.body);
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error(`${req.method} /api/state failed:`, err);
    if (!res.headersSent) return res.status(500).json({ error: 'server_error' });
  }
}
