import { loadAppState, saveAppState, STATE_ID } from '../state-api.js';
import { getPool } from '../db.js';
import { DEMO_PASSWORD } from './config.js';
import { hashPassword, uid } from './crypto.js';
import { findUserByEmail, insertUser } from './users.js';

export async function loadAppStateData() {
  const result = await loadAppState();
  if (result.error) return null;
  return result.body.data;
}

export async function saveAppStateData(data) {
  return saveAppState(data);
}

function stripPasswordsFromUsers(data) {
  if (!data?.users?.length) return data;
  data.users = data.users.map(({ password, ...rest }) => rest);
  return data;
}

export async function syncAuthUsersFromAppState() {
  const data = await loadAppStateData();
  if (!data?.users?.length) return { synced: 0 };

  let synced = 0;
  for (const u of data.users) {
    if (!u.email || !u.password) continue;
    const existing = await findUserByEmail(u.email);
    if (existing) continue;

    await insertUser({
      id: u.id || uid('user'),
      email: u.email,
      passwordHash: hashPassword(u.password),
      role: u.role,
      name: u.name || u.email,
      centerId: u.centerId || null,
      linkedTeacherId: u.linkedTeacherId || null,
      linkedStudentId: u.linkedStudentId || null,
      linkedStudentIds: u.linkedStudentIds || [],
      parentName: u.parentName || null,
    });
    synced += 1;
  }

  const cleaned = stripPasswordsFromUsers({ ...data });
  const hasPlaintext = data.users.some((u) => u.password);
  if (hasPlaintext) {
    await saveAppStateData(cleaned);
  }

  return { synced, strippedPasswords: hasPlaintext };
}

export async function registerCenterInAppState({ centerName, ownerName, email, phone, city }) {
  let data = await loadAppStateData();
  if (!data) {
    data = {
      batches: [],
      students: [],
      teachers: [],
      leads: [],
      attendance: [],
      tests: [],
      messages: [],
      centers: [],
      branches: [],
      users: [],
      centerSettings: {},
      organization: { name: centerName, branches: [{ id: 'main', name: 'Main Branch' }] },
      settings: {
        tutorName: centerName,
        whatsappApiKey: '',
        whatsappPhoneId: '',
        openaiApiKey: '',
        defaultCountryCode: '+91',
        defaultMeetingPlatform: 'google-meet',
        billing: { invoicePrefix: 'INV', upiId: '', bankDetails: '', defaultDueDay: 5 },
      },
      invoices: [],
      passwordResetTokens: [],
    };
  }

  const normEmail = email.trim().toLowerCase();
  if (data.users.some((u) => u.email === normEmail)) {
    return { ok: false, error: 'An account with this email already exists' };
  }

  const slug = centerName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const centerId = uid('center');
  const userId = uid('user');

  const center = {
    id: centerId,
    name: centerName.trim(),
    slug: slug || `center-${Date.now()}`,
    city: city?.trim() || '',
    phone: phone?.trim() || '',
    ownerEmail: normEmail,
    ownerUserId: userId,
    status: 'active',
    plan: 'trial',
    createdAt: new Date().toISOString().slice(0, 10),
  };

  const userProfile = {
    id: userId,
    centerId,
    name: ownerName.trim(),
    email: normEmail,
    role: 'center_admin',
  };

  data.centers = data.centers || [];
  data.centers.push(center);
  data.users = data.users || [];
  data.users.push(userProfile);
  data.centerSettings = data.centerSettings || {};
  data.centerSettings[centerId] = {
    ...data.settings,
    tutorName: centerName.trim(),
  };

  await saveAppStateData(data);
  return { ok: true, center, user: userProfile };
}

export async function ensureDemoAuthUsers() {
  const data = await loadAppStateData();
  if (!data) return;
  const hasDemo = await findUserByEmail('admin@brightminds.demo');
  if (hasDemo) return;
  await syncAuthUsersFromAppState();
}

export { DEMO_PASSWORD };
