import { loadAppState, saveAppState, removeAppState } from '../server/state-api.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await loadAppState();
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.status(result.status).json(result.body);
    }

    if (req.method === 'PUT') {
      const result = await saveAppState(req.body);
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.status(result.status).json(result.body);
    }

    if (req.method === 'DELETE') {
      const result = await removeAppState();
      if (result.error) return res.status(result.status).json({ error: result.error });
      return res.status(result.status).json(result.body);
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error(`${req.method} /api/state failed:`, err);
    return res.status(500).json({ error: 'server_error' });
  }
}
