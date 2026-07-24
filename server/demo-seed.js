import { generateSchedule, formatScheduleLabel } from '../js/scheduler.js';
import { loadAppState, saveAppState, STATE_ID } from './state-api.js';
import { getPool } from './db.js';
import { hashPassword } from './auth/crypto.js';
import { upsertAuthUser } from './auth/users.js';
import { DEMO_IDS, DEMO_PASSWORD, DEMO_EMAILS } from './demo-accounts.js';

function buildDemoAppState() {
  const centerId = DEMO_IDS.center;
  const teacher1 = {
    id: DEMO_IDS.teacherAnita,
    centerId,
    name: 'Dr. Anita Desai',
    email: 'anita@tutorhub.com',
    phone: '9876001001',
    subjects: ['Physics', 'Chemistry'],
    bio: '10+ years teaching board exam science',
  };
  const teacher2 = {
    id: DEMO_IDS.teacherVikram,
    centerId,
    name: 'Mr. Vikram Singh',
    email: 'vikram@tutorhub.com',
    phone: '9876001002',
    subjects: ['Mathematics'],
    bio: 'Specialist in algebra and geometry',
  };

  const scienceTopics = [
    'Introduction & Measurement',
    'Motion and Force',
    'Laws of Motion',
    'Gravitation',
    'Work, Energy & Power',
  ];
  const mathTopics = [
    'Number Systems Review',
    'Linear Equations',
    'Quadratic Equations',
    'Polynomials',
  ];

  const batch1Base = {
    id: DEMO_IDS.batchScience,
    centerId,
    name: 'Grade 10 — Science',
    subjects: ['Physics', 'Chemistry', 'Biology'],
    capacity: 20,
    teacherId: teacher1.id,
    monthlyFee: 4500,
    feeDueDay: 5,
    scheduleDays: ['mon', 'wed', 'fri'],
    startTime: '16:00',
    endTime: '18:00',
    startDate: '2025-06-02',
    topics: scienceTopics,
    meetingPlatform: 'google-meet',
  };
  const batch2Base = {
    id: DEMO_IDS.batchMath,
    centerId,
    name: 'Grade 8 — Mathematics',
    subjects: ['Algebra', 'Geometry'],
    capacity: 15,
    teacherId: teacher2.id,
    monthlyFee: 3500,
    feeDueDay: 5,
    scheduleDays: ['tue', 'thu'],
    startTime: '17:00',
    endTime: '19:00',
    startDate: '2025-06-03',
    topics: mathTopics,
    meetingPlatform: 'zoom',
  };

  const batch1 = {
    ...batch1Base,
    schedule: formatScheduleLabel(batch1Base.scheduleDays, batch1Base.startTime, batch1Base.endTime),
    sessions: generateSchedule({ ...batch1Base, batchName: batch1Base.name }),
  };
  const batch2 = {
    ...batch2Base,
    schedule: formatScheduleLabel(batch2Base.scheduleDays, batch2Base.startTime, batch2Base.endTime),
    sessions: generateSchedule({ ...batch2Base, batchName: batch2Base.name }),
  };

  const students = [
    {
      id: DEMO_IDS.studentAarav,
      centerId,
      name: 'Aarav Sharma',
      batchId: batch1.id,
      grade: '10',
      email: 'aarav@email.com',
      phone: '9876543210',
      parentName: 'Rajesh Sharma',
      parentPhone: '9876500011',
      parentEmail: 'sharma@family.demo',
      joinDate: '2025-06-01',
      feeStatus: 'active',
    },
    {
      id: DEMO_IDS.studentPriya,
      centerId,
      name: 'Priya Patel',
      batchId: batch1.id,
      grade: '10',
      email: 'priya@email.com',
      phone: '9876543211',
      parentName: 'Meena Patel',
      parentPhone: '9876500022',
      parentEmail: 'meena@email.com',
      joinDate: '2025-06-15',
      feeStatus: 'active',
    },
    {
      id: DEMO_IDS.studentRohan,
      centerId,
      name: 'Rohan Mehta',
      batchId: batch2.id,
      grade: '8',
      email: 'rohan@email.com',
      phone: '9876543212',
      parentName: 'Suresh Mehta',
      parentPhone: '9876500033',
      parentEmail: 'suresh@email.com',
      joinDate: '2025-07-01',
      feeStatus: 'active',
    },
  ];

  const settings = {
    tutorName: 'Bright Minds Academy',
    whatsappApiKey: '',
    whatsappPhoneId: '',
    openaiApiKey: '',
    defaultCountryCode: '+91',
    defaultMeetingPlatform: 'google-meet',
    billing: { invoicePrefix: 'INV', upiId: '', bankDetails: '', defaultDueDay: 5 },
  };

  const users = [
    { id: DEMO_IDS.userOwner, email: 'owner@eduos.app', role: 'platform_owner', name: 'Platform Owner' },
    { id: DEMO_IDS.userAdmin, email: 'admin@brightminds.demo', role: 'center_admin', name: 'Center Admin', centerId },
    { id: DEMO_IDS.userAnita, email: 'anita@tutorhub.com', role: 'teacher', name: teacher1.name, centerId, linkedTeacherId: teacher1.id },
    { id: DEMO_IDS.userVikram, email: 'vikram@tutorhub.com', role: 'teacher', name: teacher2.name, centerId, linkedTeacherId: teacher2.id },
    {
      id: DEMO_IDS.userSharma,
      email: 'sharma@family.demo',
      role: 'family',
      name: 'Sharma Family',
      centerId,
      parentName: 'Rajesh Sharma',
      linkedStudentIds: [students[0].id],
    },
  ];

  return {
    batches: [batch1, batch2],
    students,
    teachers: [teacher1, teacher2],
    leads: [],
    attendance: [],
    tests: [],
    messages: [],
    invoices: [],
    passwordResetTokens: [],
    centers: [{
      id: centerId,
      name: 'Bright Minds Academy',
      slug: 'bright-minds',
      city: 'Mumbai',
      phone: '9876000000',
      ownerEmail: 'admin@brightminds.demo',
      ownerUserId: DEMO_IDS.userAdmin,
      status: 'active',
      plan: 'trial',
      createdAt: '2025-06-01',
      listingEnabled: true,
      publicTagline: 'Grades 6–12 · small batches · personalized attention',
      publicSubjects: ['Mathematics', 'Science', 'English'],
      rating: 4.8,
      reviewCount: 124,
    }],
    branches: [{
      id: DEMO_IDS.branch,
      centerId,
      name: 'Bright Minds Academy — Main',
      city: 'Mumbai',
      status: 'active',
      isDefault: true,
      createdAt: '2025-06-01',
    }],
    users,
    centerSettings: { [centerId]: settings },
    organization: { name: 'Bright Minds Academy', branches: [{ id: 'main', name: 'Main Branch' }] },
    settings,
    _migratedV5: true,
    _migratedV7: true,
  };
}

async function loadAppStateData() {
  const result = await loadAppState();
  if (result.error) return null;
  return result.body.data;
}

async function saveAppStateData(data) {
  return saveAppState(data);
}

function demoAppStateMissing(data) {
  if (!data) return true;
  if (!data.users?.some((u) => u.email === 'admin@brightminds.demo')) return true;
  if (!data.users?.some((u) => u.email === 'owner@eduos.app')) return true;
  return false;
}

async function upsertDemoAuthUsersFromState(data) {
  const passwordHash = hashPassword(DEMO_PASSWORD);
  let upserted = 0;

  for (const u of data.users || []) {
    if (!u.email) continue;
    await upsertAuthUser({
      id: u.id,
      email: u.email,
      passwordHash,
      role: u.role,
      name: u.name || u.email,
      centerId: u.centerId || null,
      linkedTeacherId: u.linkedTeacherId || null,
      linkedStudentId: u.linkedStudentId || null,
      linkedStudentIds: u.linkedStudentIds || [],
      parentName: u.parentName || null,
    });
    upserted += 1;
  }

  return upserted;
}

/** Idempotent: seed Bright Minds demo app_state + all demo auth_users (password demo123). */
export async function ensureNeonDemoSeeded({ forceAppState = false } = {}) {
  if (!process.env.DATABASE_URL) {
    return { ok: false, skipped: true, reason: 'no_database' };
  }

  let data = await loadAppStateData();
  let appStateSeeded = false;

  if (forceAppState || demoAppStateMissing(data)) {
    data = buildDemoAppState();
    await saveAppStateData(data);
    appStateSeeded = true;
  }

  const authUsers = await upsertDemoAuthUsersFromState(data);

  return {
    ok: true,
    appStateSeeded,
    authUsers,
    demoEmails: DEMO_EMAILS,
    password: DEMO_PASSWORD,
  };
}

export async function runDemoSeedCli() {
  const result = await ensureNeonDemoSeeded({ forceAppState: true });
  console.log('Neon demo seed complete:', result);
  await getPool().end();
}
