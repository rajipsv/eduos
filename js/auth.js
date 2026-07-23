import {
  getCenters, getCenter, saveCenter, getUsers, findUserByEmail, createUser, persistRaw,
  getState, seedDemoUsers, migrateMultiTenant, migrateCenterListings, initCenterSettings,
  getDefaultBranch, getBranch, getStudent, getTeacher,
} from './store.js';

export const SESSION_KEY = 'tutorhub_session';
export const DEMO_PASSWORD = 'demo123';

export const ROLES = {
  platform_owner: 'Platform owner',
  center_admin: 'Center admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
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

export function getLinkedStudentId() {
  return getSession()?.linkedStudentId || getCurrentUser()?.linkedStudentId || null;
}

export function getLinkedStudentIds() {
  const user = getCurrentUser();
  return user?.linkedStudentIds || (user?.linkedStudentId ? [user.linkedStudentId] : []);
}

export function login(email, password, expectedPortal) {
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
    viewCenterId: null,
  };
  setSession(resolveSessionBranch(session, user));
  return { ok: true, session: getSession() };
}

export function logout() {
  clearSession();
}

export function registerCenter({ centerName, ownerName, email, phone, city, password }) {
  migrateMultiTenant();
  migrateCenterListings();
  const normEmail = email.trim().toLowerCase();
  if (findUserByEmail(normEmail)) {
    return { ok: false, error: 'An account with this email already exists' };
  }
  if (!centerName?.trim() || !ownerName?.trim() || !normEmail || !password) {
    return { ok: false, error: 'Please fill all required fields' };
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
  const branchPart = session.branchName ? ` · ${session.branchName}` : '';
  if (session.role === 'platform_owner') {
    return session.viewCenterId
      ? `Platform · viewing ${getCenter(session.viewCenterId)?.name || 'center'}${branchPart}`
      : 'Platform owner';
  }
  return `${session.centerName || 'Center'}${branchPart} · ${ROLES[session.role] || session.role}`;
}
