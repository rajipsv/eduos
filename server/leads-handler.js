import { isAuthConfigured } from './auth/config.js';
import { authenticateRequest } from './auth/middleware.js';
import {
  appendInboundLead,
  checkRateLimit,
  listInboundLeads,
  updateInboundLead,
  validateInboundLeadBody,
} from './inbound-leads.js';

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

async function requirePlatformOwner(req, res) {
  if (!isAuthConfigured()) return { ok: true, user: null };
  const auth = await authenticateRequest(req, res);
  if (!auth.ok) return { ok: false };
  if (auth.user.role !== 'platform_owner') {
    if (!res.headersSent) res.status(403).json({ error: 'forbidden' });
    return { ok: false };
  }
  return { ok: true, user: auth.user };
}

export async function handleCreateInboundLead(req, res) {
  try {
    const rate = checkRateLimit(clientIp(req));
    if (rate.error) {
      return res.status(rate.status).json({
        error: rate.error,
        retryAfterSec: rate.retryAfterSec,
      });
    }

    const validated = validateInboundLeadBody(req.body);
    if (validated.honeypot) {
      return res.status(200).json({ ok: true, id: 'ignored' });
    }
    if (validated.error) {
      return res.status(validated.status).json({
        error: validated.error,
        fields: validated.fields,
      });
    }

    const lead = await appendInboundLead(validated.lead);
    return res.status(201).json({ ok: true, id: lead.id, lead });
  } catch (err) {
    console.error('POST /api/leads failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

export async function handleListInboundLeads(req, res) {
  try {
    const auth = await requirePlatformOwner(req, res);
    if (!auth.ok) return;

    const leads = await listInboundLeads();
    return res.status(200).json({ ok: true, leads });
  } catch (err) {
    console.error('GET /api/leads failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

export async function handleUpdateInboundLead(req, res) {
  try {
    const auth = await requirePlatformOwner(req, res);
    if (!auth.ok) return;

    const id = req.body?.id || req.query?.id;
    if (!id) return res.status(400).json({ error: 'missing_id' });

    const patch = {};
    if (req.body.stage) patch.stage = String(req.body.stage).trim();
    if (req.body.notes != null) patch.notes = String(req.body.notes).trim();

    if (!patch.stage && patch.notes === undefined) {
      return res.status(400).json({ error: 'nothing_to_update' });
    }

    const result = await updateInboundLead(id, patch);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ ok: true, lead: result.lead });
  } catch (err) {
    console.error('PATCH /api/leads failed:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
