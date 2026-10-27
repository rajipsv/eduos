import { generateSchedule, formatScheduleLabel } from '../js/scheduler.js';
import { ensurePlatformData, seedPlatformDemo } from '../js/platform.js';
import { getPool } from './db.js';
import { hashPassword } from './auth/crypto.js';
import { upsertAuthUser } from './auth/users.js';
import { DEMO_IDS, DEMO_PASSWORD, DEMO_EMAILS, isDemoEmail } from './demo-accounts.js';
import { isDemoModeEnabled } from './env.js';
import { blobToCenterRows } from './db/blob.js';
import { upsertCenter, getCenter } from './db/centers.js';
import { insertRecords, purgeCenterRecords } from './db/records.js';

export function buildDemoAppState() {
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
    // Charged per class attended, billed every 8 classes (2 classes a week).
    feeType: 'per_class',
    perClassFee: 300,
    classesPerBill: 8,
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

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const users = [
    { id: DEMO_IDS.userOwner, email: 'owner@tutorsala.app', role: 'platform_owner', name: 'Platform Owner' },
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
    leads: demoLeads(centerId),
    attendance: [
      { id: 'att_demo_1', centerId, batchId: batch1.id, date: yesterday, records: { [students[0].id]: 'present', [students[1].id]: 'absent' } },
      { id: 'att_demo_2', centerId, batchId: batch2.id, date: yesterday, records: { [students[2].id]: 'present' } },
    ],
    tests: [
      { id: 'test_demo_physics', centerId, name: 'Unit Test 1 — Physics', batchId: batch1.id, subject: 'Physics', date: '2025-07-10', maxMarks: 50, marks: { [students[0].id]: 42, [students[1].id]: 35 } },
      { id: 'test_demo_algebra', centerId, name: 'Algebra Quiz', batchId: batch2.id, subject: 'Algebra', date: '2025-07-12', maxMarks: 30, marks: { [students[2].id]: 24 } },
    ],
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

function demoLeads(centerId) {
  const lead = (n, fields) => ({ id: `lead_demo_${n}`, centerId, activities: [], ...fields });
  return [
    lead(1, { name: 'Kavya Reddy', phone: '9876510001', email: 'kavya@email.com', source: 'Website', stage: 'lead', grade: '9', course: 'Science', notes: 'Interested in weekend batch', followUpDate: '2025-07-23', createdAt: '2025-07-18' }),
    lead(2, { name: 'Arjun Nair', phone: '9876510002', email: 'arjun@email.com', source: 'WhatsApp', stage: 'inquiry', grade: '10', course: 'Science', notes: 'Asked about fees', followUpDate: '2025-07-22', createdAt: '2025-07-17' }),
    lead(3, { name: 'Sneha Iyer', phone: '9876510003', email: 'sneha@email.com', source: 'Facebook Ads', stage: 'demo', grade: '8', course: 'Mathematics', notes: 'Demo scheduled Fri 5 PM', demoDate: '2025-07-25', demoTime: '17:00', createdAt: '2025-07-16' }),
    lead(4, { name: 'Dev Kapoor', phone: '9876510004', email: 'dev@email.com', source: 'Referral', stage: 'counseling', grade: '10', course: 'Science', notes: 'Parent wants career guidance', createdAt: '2025-07-14' }),
    lead(5, { name: 'Isha Gupta', phone: '9876510005', email: 'isha@email.com', source: 'Walk-in', stage: 'batch_allocation', grade: '8', course: 'Mathematics', notes: 'Ready to enroll — pick batch', createdAt: '2025-07-12' }),
  ];
}

/** Demo data in the old single-document shape, including the platform demo content. */
export function buildFullDemoState() {
  const data = buildDemoAppState();
  ensurePlatformData(data);
  seedPlatformDemo(data, data.students, data.batches, data.teachers);
  return data;
}

/**
 * Replaces the demo center's data and resets the demo logins (password demo123).
 * Other centers and real users are never touched.
 */
export async function seedDemo(pool = getPool()) {
  if (!isDemoModeEnabled()) {
    return { ok: false, skipped: true, reason: 'demo_mode_disabled' };
  }
  const data = buildFullDemoState();
  const { centers, rows } = blobToCenterRows(data);
  const passwordHash = hashPassword(DEMO_PASSWORD);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const center of centers) {
      await upsertCenter(client, center);
      await purgeCenterRecords(client, center.id);
    }
    const records = await insertRecords(client, rows);
    for (const u of data.users) {
      if (!isDemoEmail(u.email)) continue;
      await upsertAuthUser(
        {
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
        },
        client,
      );
    }
    await client.query('COMMIT');
    return { ok: true, records, demoEmails: DEMO_EMAILS };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Seeds the demo center only if it doesn't exist yet (local server start-up). */
export async function seedDemoIfMissing(pool = getPool()) {
  if (!isDemoModeEnabled()) return { ok: false, skipped: true, reason: 'demo_mode_disabled' };
  if (await getCenter(pool, DEMO_IDS.center)) return { ok: true, skipped: true, reason: 'exists' };
  return seedDemo(pool);
}

export async function runDemoSeedCli() {
  if (!isDemoModeEnabled()) {
    console.error('Demo seed refused: demo mode is off (production). Set ENABLE_DEMO_SEED=true to allow it.');
    process.exitCode = 1;
    return;
  }
  const result = await seedDemo();
  console.log(`Demo seed complete: ${result.records} records; logins ${DEMO_EMAILS.join(', ')}`);
  await getPool().end();
}
