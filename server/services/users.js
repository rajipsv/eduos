// @ts-check
// Logins are created and changed here, never through /api/sync.
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getPool } from '../db.js';
import { hashPassword, uid } from '../auth/crypto.js';
import { findUserById, findUserByEmail, insertUser } from '../auth/users.js';
import { validatePassword } from '../auth/session.js';
import { resolveCenter, publicUser } from './bootstrap.js';

const MANAGED_ROLES = ['center_admin', 'teacher', 'family', 'parent', 'student'];
const optId = z.string().min(1).max(200).nullable().optional();

const createSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1).max(200),
  role: z.enum(MANAGED_ROLES),
  password: z.string().max(200).optional(),
  linkedTeacherId: optId,
  linkedStudentId: optId,
  linkedStudentIds: z.array(z.string().max(200)).max(50).optional(),
  parentName: z.string().max(200).nullable().optional(),
});

const updateSchema = createSchema
  .pick({ name: true, linkedTeacherId: true, linkedStudentId: true, linkedStudentIds: true, parentName: true })
  .partial();

/** The center an admin manages in this request, or an error response. */
async function adminCenter(user, req) {
  if (!['center_admin', 'platform_owner'].includes(user.role))
    return { error: { status: 403, body: { error: 'forbidden' } } };
  const scope = await resolveCenter(getPool(), user, req);
  if (scope.error) return { error: { status: scope.status, body: { error: scope.error } } };
  if (!scope.centerId) return { error: { status: 400, body: { error: 'no_center_selected' } } };
  return { centerId: scope.centerId };
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

  // Without a password the account can't sign in until its owner uses "Forgot password".
  let passwordHash;
  if (input.password) {
    const err = validatePassword(input.password);
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
  return { status: 201, body: { user: publicUser(await findUserById(id)) } };
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
