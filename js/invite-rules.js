// @ts-check
// Plain helpers for "Send login" (no browser or store access, so they can be unit-tested).

/** How long an invite link works. Must match INVITE_TTL_DAYS on the server. */
export const INVITE_DAYS = 7;

const FAMILY_ROLES = ['family', 'parent'];
const norm = (v) => String(v || '').trim().toLowerCase();

/** The login that belongs to a teacher record: linked to it, or a teacher login with the same email. */
export function findTeacherLogin(users, teacher) {
  if (!teacher) return null;
  return (
    users.find((u) => u.linkedTeacherId && u.linkedTeacherId === teacher.id) ||
    (teacher.email ? users.find((u) => u.role === 'teacher' && norm(u.email) === norm(teacher.email)) : null) ||
    null
  );
}

/** The family login for a student: linked to the student, or a family login with the parent's email. */
export function findFamilyLogin(users, student) {
  if (!student) return null;
  const linked = users.find(
    (u) =>
      FAMILY_ROLES.includes(u.role) &&
      ((u.linkedStudentIds || []).includes(student.id) || u.linkedStudentId === student.id),
  );
  if (linked) return linked;
  const email = norm(student.parentEmail || student.email);
  if (!email) return null;
  return users.find((u) => FAMILY_ROLES.includes(u.role) && norm(u.email) === email) || null;
}

/** "Has signed in · last seen 3 Nov 2026", or that they haven't yet. */
export function loginStatusText(user) {
  if (!user) return 'No login yet';
  if (!user.lastSeenAt) return "Hasn't signed in yet";
  const d = new Date(user.lastSeenAt);
  if (Number.isNaN(d.getTime())) return 'Has signed in';
  return `Has signed in · last seen ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** The WhatsApp message that carries an invite link. */
export function buildInviteMessage({ name, centerName, email, link, days = INVITE_DAYS }) {
  const center = centerName || 'Our tuition center';
  return `Hello${name ? ` ${name}` : ''},

${center} has set up your Tutorsala login.

Sign-in email: ${email}
Choose your password here: ${link}

The link works once and expires in ${days} days.`;
}
