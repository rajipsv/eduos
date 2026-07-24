export function buildClientSession(user, centerOverride = null) {
  const center = centerOverride || (user.centerId ? { id: user.centerId, name: null } : null);
  const centerName = centerOverride?.name || center?.name || null;

  return {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    centerId: user.centerId || null,
    centerName,
    branchId: null,
    branchName: null,
    linkedTeacherId: user.linkedTeacherId || null,
    linkedStudentId: user.linkedStudentId || null,
    linkedStudentIds: user.linkedStudentIds || null,
    familyView: user.role === 'family' ? 'parent' : null,
    activeStudentId: null,
    viewCenterId: null,
  };
}

export async function buildClientSessionFromDbUser(user, appState) {
  let centerName = null;
  if (user.centerId && appState?.centers) {
    const c = appState.centers.find((x) => x.id === user.centerId);
    centerName = c?.name || null;
  }
  return buildClientSession(user, user.centerId ? { id: user.centerId, name: centerName } : null);
}

export function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  return null;
}
