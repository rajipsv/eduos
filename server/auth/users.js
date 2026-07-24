import { getPool } from '../db.js';

export function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    centerId: row.center_id,
    center_id: row.center_id,
    linkedTeacherId: row.linked_teacher_id,
    linked_teacher_id: row.linked_teacher_id,
    linkedStudentId: row.linked_student_id,
    linked_student_id: row.linked_student_id,
    linkedStudentIds: row.linked_student_ids || [],
    linked_student_ids: row.linked_student_ids || [],
    parentName: row.parent_name,
    parent_name: row.parent_name,
  };
}

export async function findUserByEmail(email) {
  const norm = email.trim().toLowerCase();
  const result = await getPool().query(
    'SELECT * FROM auth_users WHERE lower(email) = $1 LIMIT 1',
    [norm],
  );
  return rowToUser(result.rows[0]);
}

export async function findUserById(id) {
  const result = await getPool().query('SELECT * FROM auth_users WHERE id = $1 LIMIT 1', [id]);
  return rowToUser(result.rows[0]);
}

export async function findUserWithPasswordByEmail(email) {
  const norm = email.trim().toLowerCase();
  const result = await getPool().query(
    'SELECT * FROM auth_users WHERE lower(email) = $1 LIMIT 1',
    [norm],
  );
  return result.rows[0] || null;
}

export async function insertUser(user) {
  await getPool().query(
    `INSERT INTO auth_users (
      id, email, password_hash, role, name, center_id,
      linked_teacher_id, linked_student_id, linked_student_ids, parent_name
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      user.id,
      user.email.trim().toLowerCase(),
      user.passwordHash,
      user.role,
      user.name,
      user.centerId || null,
      user.linkedTeacherId || null,
      user.linkedStudentId || null,
      JSON.stringify(user.linkedStudentIds || []),
      user.parentName || null,
    ],
  );
  return findUserById(user.id);
}

export async function updateUserPassword(userId, passwordHash) {
  await getPool().query(
    'UPDATE auth_users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
    [userId, passwordHash],
  );
}
