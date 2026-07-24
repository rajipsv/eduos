import {
  getCenters, getCenter, saveCenter, getUsers, findUserByEmail, createUser, updateUser,
  linkCenterAdminTeacherProfile, persistRaw,
  getState, seedDemoUsers, migrateMultiTenant, migrateCenterListings, initCenterSettings,
  getDefaultBranch, getBranch, getStudent, getTeacher,
  createPasswordResetToken, findValidPasswordResetToken, markPasswordResetTokenUsed, updateUserPassword,
  reloadStoreFromServer,
} from './store.js';
import { sendViaChannel } from './communication.js';
import {
  authPost,
  authGet,
  setAccessToken,
  getAccessToken,
  refreshAccessToken,
  isServerAuthEnabled,
} from './api-client.js';
export const DEMO_PASSWORD = 'demo123';

export const ROLES = {
  platform_owner: 'Platform owner',
  center_admin: 'Center admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  family: 'Family',
};

export const FAMILY_VIEWS = {
  parent: 'Parent view',
  student: 'Student view',
};

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser() {
  const session = getSession();
  if (!session?.userId) return null;
  return getUsers().find((u) => u.id === session.userId) || null;
}

export function getCurrentRole() {
  return getSession()?.role || null;
}

/** Portal role for family accounts — parent or student view. */
export function getEffectiveRole() {
  const session = getSession();
  if (!session) return null;
  if (session.role === 'family') {
    return session.familyView === 'student' ? 'student' : 'parent';
  }
  return session.role;
}

export function isFamilyAccount() {
  return getCurrentRole() === 'family';
}

export function getFamilyView() {
  const session = getSession();
  if (session?.role !== 'family') return null;
  return session.familyView === 'student' ? 'student' : 'parent';
}

export function setFamilyView(view) {
  const session = getSession();
  if (!session || session.role !== 'family') return;
  session.familyView = view === 'student' ? 'student' : 'parent';
  const user = getCurrentUser();
  if (session.familyView === 'student') {
    const ids = user?.linkedStudentIds || session.linkedStudentIds || [];
    session.activeStudentId = ids[0] || null;
  } else {
    session.activeStudentId = null;
  }
  setSession(resolveSessionBranch(session, user || {}));
}

export function getActiveBranchId() {
  return getSession()?.branchId || null;
}

export function canSwitchBranch() {
  const role = getCurrentRole();
  if (role === 'center_admin') return true;
  if (role === 'platform_owner' && getSession()?.viewCenterId) return true;
  return false;
}

export function setActiveBranch(branchId) {
  const session = getSession();
  if (!session || !canSwitchBranch()) return;
  if (!branchId) {
    session.branchId = null;
    session.branchName = null;
  } else {
    const branch = getBranch(branchId);
    if (!branch) return;
    const centerId = getActiveCenterId();
    if (branch.centerId !== centerId) return;
    session.branchId = branch.id;
    session.branchName = branch.name;
  }
  setSession(session);
}

function resolveSessionBranch(session, user) {
  const centerId = session.centerId || session.viewCenterId;
  if (!centerId) return session;

  if (user.role === 'family') {
    const ids = user.linkedStudentIds || session.linkedStudentIds || [];
    const studentId = session.familyView === 'student'
      ? (session.activeStudentId || ids[0])
      : ids[0];
    if (studentId) {
      const student = getStudent(studentId);
      if (student?.branchId) {
        const branch = getBranch(student.branchId);
        session.branchId = student.branchId;
        session.branchName = branch?.name || null;
        return session;
      }
    }
  }

  if (user.role === 'student' && user.linkedStudentId) {
    const student = getStudent(user.linkedStudentId);
    if (student?.branchId) {
      const branch = getBranch(student.branchId);
      session.branchId = student.branchId;
      session.branchName = branch?.name || null;
      return session;
    }
  }

  if (user.role === 'teacher' && user.linkedTeacherId) {
    const teacher = getTeacher(user.linkedTeacherId);
    if (teacher?.branchId) {
      const branch = getBranch(teacher.branchId);
      session.branchId = teacher.branchId;
      session.branchName = branch?.name || null;
      return session;
    }
  }

  const defaultBranch = getDefaultBranch(centerId);
  if (defaultBranch) {
    session.branchId = session.branchId || null;
    session.branchName = session.branchId ? getBranch(session.branchId)?.name : null;
  }
  return session;
}

export function getActiveCenterId() {
  const session = getSession();
  if (!session) return null;
  if (session.role === 'platform_owner') return session.viewCenterId || null;
  return session.centerId || null;
}

export function isPlatformOwner() {
  return getCurrentRole() === 'platform_owner';
}

export function getLinkedTeacherId() {
  return getSession()?.linkedTeacherId || getCurrentUser()?.linkedTeacherId || null;
}

export function syncSessionFromUser(user) {
  const session = getSession();
  if (!session || !user || session.userId !== user.id) return;
  session.linkedTeacherId = user.linkedTeacherId || null;
  setSession(resolveSessionBranch(session, user));
}

export function saveCenterAdminTeacherLink({ enabled, teacherId, subjects = [] } = {}) {
  const user = getCurrentUser();
  if (!user || user.role !== 'center_admin') {
    return { ok: false, error: 'Only center admins can link a teaching profile' };
  }
  const result = linkCenterAdminTeacherProfile(user.id, { enabled, teacherId, subjects });
  if (result.ok) {
    const updated = getUsers().find((u) => u.id === user.id);
    if (updated) syncSessionFromUser(updated);
  }
  return result;
}

export function getLinkedStudentId() {
  const session = getSession();
  const user = getCurrentUser();
  if (session?.role === 'family' || user?.role === 'family') {
    const ids = user?.linkedStudentIds || session?.linkedStudentIds || [];
    if (getFamilyView() === 'student') {
      return session?.activeStudentId || ids[0] || null;
    }
    return null;
  }
  return session?.linkedStudentId || user?.linkedStudentId || null;
}

export function getLinkedStudentIds() {
  const session = getSession();
  const user = getCurrentUser();
  if (session?.role === 'family' || user?.role === 'family') {
    return user?.linkedStudentIds || session?.linkedStudentIds || [];
  }
  return user?.linkedStudentIds || (user?.linkedStudentId ? [user.linkedStudentId] : []);
}

export { isServerAuthEnabled };

function applyServerSession(session, accessToken) {
  setAccessToken(accessToken);
  const user = getUsers().find((u) => u.id === session.userId) || session;
  setSession(resolveSessionBranch(session, user));
}

export async function initAuthSession() {
  if (!isServerAuthEnabled()) return { ok: false };
  const data = await refreshAccessToken();
  if (!data?.ok || !data.accessToken || !data.session) {
    clearSession();
    setAccessToken(null);
    return { ok: false };
  }
  applyServerSession(data.session, data.accessToken);
  await reloadStoreFromServer();
  return { ok: true };
}

export function validatePassword(password) {
  if (!password || String(password).length < 8) {
    return 'Password must be at least 8 characters';
  }
  return null;
}
export function buildPasswordResetUrl(token) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#reset-password/${encodeURIComponent(token)}`;
}

export function parsePasswordResetTokenFromLocation() {
  const hash = (location.hash || '').replace(/^#/, '');
  if (hash.startsWith('reset-password/')) {
    return decodeURIComponent(hash.slice('reset-password/'.length));
  }
  try {
    return new URLSearchParams(location.search).get('reset') || null;
  } catch {
    return null;
  }
}

export async function requestPasswordReset(email) {
  const normEmail = email.trim().toLowerCase();
  if (!normEmail) return { ok: false, error: 'Email is required' };

  if (isServerAuthEnabled()) {
    const result = await authPost('/api/auth/forgot-password', { email: normEmail });
    return {
      ok: true,
      message: result.message || 'If an account exists for that email, password reset instructions have been sent.',
      demoResetUrl: result.demoResetUrl || null,
    };
  }

  migrateMultiTenant();
  const user = findUserByEmail(normEmail);
  let demoResetUrl = null;

  if (user) {
    const { token } = createPasswordResetToken(user.id, normEmail);
    demoResetUrl = buildPasswordResetUrl(token);
    const academy = getState().settings?.tutorName || 'EduOS';
    await sendViaChannel('email', {
      to: normEmail,
      message: `Hello ${user.name},

We received a request to reset your EduOS password.

Open this link to choose a new password (valid for 1 hour):
${demoResetUrl}

If you did not request this, you can ignore this email.

— ${academy}`,
      type: 'password_reset',
      meta: { subject: 'Reset your EduOS password', email: normEmail, resetUrl: demoResetUrl },
    });
  }

  return {
    ok: true,
    message: 'If an account exists for that email, password reset instructions have been sent.',
    demoResetUrl,
  };
}

export async function getPasswordResetTokenInfo(token) {
  if (isServerAuthEnabled()) {
    const result = await authGet(`/api/auth/reset-password-info?token=${encodeURIComponent(token)}`);
    if (!result.ok) return { ok: false, error: result.error || 'This reset link is invalid or has expired.' };
    return { ok: true, email: result.email, name: result.name };
  }

  const entry = findValidPasswordResetToken(token);
  if (!entry) return { ok: false, error: 'This reset link is invalid or has expired.' };
  const user = getUsers().find((u) => u.id === entry.userId);
  return { ok: true, email: entry.email, name: user?.name || entry.email };
}

export async function resetPasswordWithToken(token, newPassword) {
  const passwordError = validatePassword(newPassword);
  if (passwordError) return { ok: false, error: passwordError };

  if (isServerAuthEnabled()) {
    const result = await authPost('/api/auth/reset-password', { token, password: newPassword });
    if (!result.ok) return { ok: false, error: result.error || 'Reset failed' };
    return { ok: true, message: result.message || 'Password updated. You can sign in now.' };
  }

  const entry = findValidPasswordResetToken(token);
  if (!entry) return { ok: false, error: 'This reset link is invalid or has expired.' };

  updateUserPassword(entry.userId, newPassword);
  markPasswordResetTokenUsed(token);
  return { ok: true, message: 'Password updated. You can sign in now.' };
}

export async function login(email, password, expectedPortal) {
  if (isServerAuthEnabled()) {
    const result = await authPost('/api/auth/login', {
      email: email.trim().toLowerCase(),
      password,
      portal: expectedPortal,
    });
    if (!result.ok) {
      return { ok: false, error: result.error || 'Invalid email or password' };
    }
    applyServerSession(result.session, result.accessToken);
    await reloadStoreFromServer();
    return { ok: true, session: getSession() };
  }

  migrateMultiTenant();
  migrateCenterListings();
  const user = findUserByEmail(email.trim().toLowerCase());
  if (!user || user.password !== password) {
    return { ok: false, error: 'Invalid email or password' };
  }

  const portalRoleMap = {
    platform: 'platform_owner',
    center: 'center_admin',
    teacher: 'teacher',
    student: 'student',
    parent: 'parent',
    family: 'family',
  };
  const expectedRole = portalRoleMap[expectedPortal];
  if (expectedRole && user.role !== expectedRole) {
    return { ok: false, error: `This account is not a ${ROLES[user.role] || user.role} login` };
  }

  const center = user.centerId ? getCenter(user.centerId) : null;
  if (user.centerId && center?.status === 'suspended') {
    return { ok: false, error: 'This center has been suspended. Contact EduOS support.' };
  }

  const session = {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    centerId: user.centerId || null,
    centerName: center?.name || null,
    branchId: null,
    branchName: null,
    linkedTeacherId: user.linkedTeacherId || null,
    linkedStudentId: user.linkedStudentId || null,
    linkedStudentIds: user.linkedStudentIds || null,
    familyView: user.role === 'family' ? 'parent' : null,
    activeStudentId: null,
    viewCenterId: null,
  };
  setSession(resolveSessionBranch(session, user));
  return { ok: true, session: getSession() };
}

export async function logout() {
  if (isServerAuthEnabled()) {
    try {
      await authPost('/api/auth/logout', {});
    } catch {
      /* ignore */
    }
    setAccessToken(null);
  }
  clearSession();
}

export async function registerCenter({ centerName, ownerName, email, phone, city, password }) {
  const normEmail = email.trim().toLowerCase();
  if (!centerName?.trim() || !ownerName?.trim() || !normEmail || !password) {
    return { ok: false, error: 'Please fill all required fields' };
  }
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };

  if (isServerAuthEnabled()) {
    const result = await authPost('/api/auth/register-center', {
      centerName,
      ownerName,
      email: normEmail,
      phone,
      city,
      password,
    });
    if (!result.ok) return { ok: false, error: result.error || 'Registration failed' };
    applyServerSession(result.session, result.accessToken);
    await reloadStoreFromServer();
    const center = getCenter(result.session.centerId);
    const user = getCurrentUser();
    return { ok: true, center, user };
  }

  migrateMultiTenant();
  migrateCenterListings();
  if (findUserByEmail(normEmail)) {
    return { ok: false, error: 'An account with this email already exists' };
  }

  const slug = centerName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const center = saveCenter({
    name: centerName.trim(),
    slug: slug || `center-${Date.now()}`,
    city: city?.trim() || '',
    phone: phone?.trim() || '',
    ownerEmail: normEmail,
    status: 'active',
    plan: 'trial',
    createdAt: new Date().toISOString().slice(0, 10),
  });

  const user = createUser({
    centerId: center.id,
    name: ownerName.trim(),
    email: normEmail,
    password,
    role: 'center_admin',
  });

  center.ownerUserId = user.id;
  saveCenter(center);
  initCenterSettings(center.id, center.name);

  setSession(resolveSessionBranch({
    userId: user.id,
    role: 'center_admin',
    name: user.name,
    email: user.email,
    centerId: center.id,
    centerName: center.name,
    branchId: null,
    branchName: null,
    linkedTeacherId: null,
    linkedStudentId: null,
    linkedStudentIds: null,
    viewCenterId: null,
  }, user));

  persistRaw();
  return { ok: true, center, user };
}

export function platformViewCenter(centerId) {
  const session = getSession();
  if (!session || session.role !== 'platform_owner') return;
  session.viewCenterId = centerId;
  session.branchId = null;
  session.branchName = null;
  setSession(session);
}

export function platformExitCenterView() {
  const session = getSession();
  if (!session || session.role !== 'platform_owner') return;
  session.viewCenterId = null;
  setSession(session);
}

export function setCenterStatus(centerId, status) {
  const center = getCenter(centerId);
  if (!center) return null;
  center.status = status;
  saveCenter(center);
  persistRaw();
  return center;
}

export function initAuth() {
  migrateMultiTenant();
  migrateCenterListings();
  const state = getState();
  if (!state.users?.length) seedDemoUsers();
}

export function getSessionLabel() {
  const session = getSession();
  if (!session) return '';

  if (session.role === 'platform_owner') {
    const branchPart = session.branchName ? ` · ${session.branchName}` : '';
    return session.viewCenterId
      ? `Platform · viewing ${getCenter(session.viewCenterId)?.name || 'center'}${branchPart}`
      : 'Platform owner';
  }

  if (session.role === 'family' || session.role === 'parent' || session.role === 'student') {
    return session.name || session.centerName || 'EduOS';
  }

  const branchPart = session.branchName ? ` · ${session.branchName}` : '';
  return `${session.centerName || 'Center'}${branchPart} · ${ROLES[session.role] || session.role}`;
}
