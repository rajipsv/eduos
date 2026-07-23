import { getHealthPayload } from '../server/state-api.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  try {
    const body = await getHealthPayload();
    return res.status(200).json(body);
  } catch (err) {
    console.error('GET /api/health failed:', err);
    return res.status(500).json({ ok: false, db: false, error: 'health_check_failed' });
  }
}
