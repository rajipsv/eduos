// @ts-check
// Logins are created and changed here, never through /api/sync.
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getPool } from '../db.js';
import { hashPassword, uid } from '../auth/crypto.js';
import { findUserById, findUserByEmail, insertUser } from '../auth/users.js';
import { validatePassword } from '../auth/session.js';
import { createPasswordResetToken, INVITE_TTL_DAYS } from '../auth/password-reset.js';
import { buildResetUrl } from '../auth/handlers.js';
import { getCenter } from '../db/centers.js';
import { sendInviteEmail } from '../email.js';
import { hitRateLimit } from '../rate-limit.js';
import { resolveCenter, publicUser } from './bootstrap.js';

const MANAGED_ROLES = ['center_admin', 'teacher', 'family', 'parent', 'student'];
const optId = z.string().min(1).max(200).nullable().optional();

const createSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1).max(200),
  role: z.enum(MANAGED_ROLES),
  password: z.string().max(200).optional(),
  // Create the login without a password and return a "choose your password" link right away.
  sendInvite: z.boolean().optional(),
  linkedTeacherId: optId,
  linkedStudentId: optId,
  linkedStudentIds: z.array(z.string().max(200)).max(50).optional(),
  parentName: z.string().max(200).nullable().optional(),
});

const updateSchema = createSchema
  .pick({ name: true, linkedTeacherId: true, linkedStudentId: true, linkedStudentIds: true, parentName: true })
  .partial();

const inviteParams = z.object({ userId: z.string().min(1).max(200) });

/** At most this many invite links per person per hour. */
const INVITES_PER_HOUR = 5;

/** The center an admin manages in this request, or an error response. */
async function adminCenter(user, req) {
  if (!['center_admin', 'platform_owner'].includes(user.role))
    return { error: { status: 403, body: { error: 'forbidden' } } };
  const scope = await resolveCenter(getPool(), user, req);
  if (scope.error) return { error: { status: scope.status, body: { error: scope.error } } };
  if (!scope.centerId) return { error: { status: 400, body: { error: 'no_center_selected' } } };
  return { centerId: scope.centerId };
}

/** When the person last used Tutorsala (each sign-in and session refresh), or null if never. */
async function lastSeenAt(userId) {
  const r = await getPool().query(
    'SELECT max(created_at) AS at FROM auth_refresh_tokens WHERE user_id = $1',
    [userId],
  );
  return r.rows[0]?.at ? new Date(r.rows[0].at).toISOString() : null;
}

/**
 * Makes a one-time "choose your password" link for `target`, emails it when email is set up,
 * and returns what the admin's screen shows. Older unused links for the person stop working.
 */
async function issueInvite(req, target) {
  const { token, expiresAt } = await createPasswordResetToken(target.id, target.email, { invite: true });
  const link = buildResetUrl(req, token);
  const center = target.centerId ? await getCenter(getPool(), target.centerId) : null;
  let emailed = false;
  try {
    emailed = await sendInviteEmail({
      to: target.email,
      name: target.name,
      centerName: center?.name,
      inviteUrl: link,
      days: INVITE_TTL_DAYS,
    });
  } catch (err) {
    console.error('Invite email failed:', err instanceof Error ? err.message : err);
  }
  return {
    link,
    emailed,
    email: target.email,
    expiresAt: expiresAt.toISOString(),
    lastSeenAt: await lastSeenAt(target.id),
  };
}

export async function createUser(user, req) {
  const scope = await adminCenter(user, req);
  if (scope.error) return scope.error;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return { status: 400, body: { error: 'invalid_body', message: parsed.error.issues[0]?.message } };
  const input = parsed.data;

  const email = input.email.trim().toLowerCase();
  if (await findUserByEmail(email)) return { status: 409, body: { error: 'email_exists' } };

  // Without a password the account can't sign in until its owner opens an invite or reset link.
  let passwordHash;
  if (input.password && !input.sendInvite) {
    const err = validatePassword(input.password, { email, name: input.name });
    if (err) return { status: 400, body: { error: 'invalid_password', message: err } };
    passwordHash = hashPassword(input.password);
  } else {
    passwordHash = hashPassword(randomBytes(32).toString('base64url'));
  }

  const id = uid('user');
  await insertUser({
    id,
    email,
    passwordHash,
    role: input.role,
    name: input.name.trim(),
    centerId: scope.centerId,
    linkedTeacherId: input.linkedTeacherId || null,
    linkedStudentId: input.linkedStudentId || null,
    linkedStudentIds: input.linkedStudentIds || [],
    parentName: input.parentName || null,
  });
  const created = await findUserById(id);
  const body = { user: publicUser(created) };
  if (input.sendInvite) {
    await hitRateLimit('invite:user', id, { limit: INVITES_PER_HOUR, windowSec: 60 * 60 });
    body.invite = await issueInvite(req, created);
  }
  return { status: 201, body };
}

/** POST /api/users/:id/invite — a new "choose your password" link for someone in the admin's center. */
export async function inviteUser(user, req, userId) {
  if (!['center_admin', 'platform_owner'].includes(user.role)) return { status: 403, body: { error: 'forbidden' } };
  const parsed = inviteParams.safeParse({ userId });
  if (!parsed.success) return { status: 400, body: { error: 'invalid_body' } };

  const target = await findUserById(parsed.data.userId);
  // Platform owners can't be invited through a center.
  if (!target || target.role === 'platform_owner') return { status: 404, body: { error: 'not_found' } };
  if (user.role === 'center_admin' && (!user.centerId || target.centerId !== user.centerId)) {
    return { status: 403, body: { error: 'forbidden' } };
  }

  const limit = await hitRateLimit('invite:user', target.id, { limit: INVITES_PER_HOUR, windowSec: 60 * 60 });
  if (!limit.ok) {
    return {
      status: 429,
      body: { error: 'too_many_invites', message: 'Too many links for this person. Please try again in an hour.' },
    };
  }
  return { status: 200, body: await issueInvite(req, target) };
}

export async function updateUser(user, req, userId) {
  const scope = await adminCenter(user, req);
  if (scope.error) return scope.error;
  const target = await findUserById(userId);
  // Admins manage logins in their own center only, and never platform owners.
  if (!target || target.centerId !== scope.centerId || target.role === 'platform_owner') {
    return { status: 404, body: { error: 'not_found' } };
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success)
    return { status: 400, body: { error: 'invalid_body', message: parsed.error.issues[0]?.message } };
  const f = parsed.data;

  const cols = {
    name: f.name?.trim(),
    linked_teacher_id: f.linkedTeacherId,
    linked_student_id: f.linkedStudentId,
    linked_student_ids: f.linkedStudentIds === undefined ? undefined : JSON.stringify(f.linkedStudentIds),
    parent_name: f.parentName,
  };
  const entries = Object.entries(cols).filter(([, v]) => v !== undefined);
  if (entries.length) {
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    await getPool().query(`UPDATE auth_users SET ${sets}, updated_at = NOW() WHERE id = $1`, [
      userId,
      ...entries.map(([, v]) => v),
    ]);
  }
  return { status: 200, body: { user: publicUser(await findUserById(userId)) } };
}
