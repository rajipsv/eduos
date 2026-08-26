import {
  handleCreateInboundLead,
  handleListInboundLeads,
  handleUpdateInboundLead,
} from '../server/leads-handler.js';

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

export default async function handler(req, res) {
  req.body = readJsonBody(req);
  if (req.method === 'GET' && req.query == null) {
    const url = new URL(req.url || '', 'http://localhost');
    req.query = Object.fromEntries(url.searchParams);
  }

  try {
    if (req.method === 'POST') return handleCreateInboundLead(req, res);
    if (req.method === 'GET') return handleListInboundLeads(req, res);
    if (req.method === 'PATCH') return handleUpdateInboundLead(req, res);

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error(`${req.method} /api/leads failed:`, err);
    if (!res.headersSent) return res.status(500).json({ error: 'server_error' });
  }
}
