// @ts-check
// PATCH /api/platform/centers/:id/subscription: the platform owner changes a center's plan,
// pilot end, paid-until date and limits, or records a payment. See js/subscription.js.
import { getPool } from '../db.js';
import { rowToCenter, upsertCenter } from '../db/centers.js';
import { uid } from '../auth/crypto.js';
import { parseSubscriptionUpdate } from '../validation.js';
import { applySubscriptionUpdate } from '../../js/subscription.js';

export async function updateCenterSubscription(user, req, centerId) {
  if (user.role !== 'platform_owner') return { status: 403, body: { error: 'forbidden' } };
  const parsed = parseSubscriptionUpdate(req.body);
  if (!parsed.ok) return { status: 400, body: { error: 'invalid_body', message: parsed.error } };
  const update = { ...parsed.value };
  if (update.payment) {
    update.payment = { id: uid('payment'), ...update.payment, recordedAt: new Date().toISOString(), recordedBy: user.id };
  }

  const db = await getPool().connect();
  try {
    await db.query('BEGIN');
    const r = await db.query('SELECT * FROM centers WHERE id = $1 FOR UPDATE', [centerId]);
    if (!r.rows[0]) {
      await db.query('ROLLBACK');
      return { status: 404, body: { error: 'center_not_found' } };
    }
    const live = rowToCenter(r.rows[0]);
    const subscription = applySubscriptionUpdate(live, update);
    const center = { ...live, plan: subscription.plan, subscription };
    const version = await upsertCenter(db, center);
    await db.query(
      `INSERT INTO audit_log (user_id, role, center_id, action, collection, record_id, detail)
       VALUES ($1, $2, $3, 'center_subscription', 'centers', $3, $4)`,
      [
        user.id,
        user.role,
        centerId,
        JSON.stringify({
          changed: Object.keys(parsed.value),
          plan: subscription.plan,
          paidUntil: subscription.paidUntil,
          payment: update.payment ? { amount: update.payment.amount, method: update.payment.method } : undefined,
        }),
      ],
    );
    await db.query('COMMIT');
    return { status: 200, body: { center, version } };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally {
    db.release();
  }
}
