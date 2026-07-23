import {
  generateSchedule,
  formatScheduleLabel,
  getSessionProgress,
  getUpcomingSessions,
} from './scheduler.js';
import { ensurePlatformData, seedPlatformDemo } from './platform.js';

const STORAGE_KEY = 'tutorhub_data_v5';
const SESSION_KEY = 'tutorhub_session';

function getActiveCenterIdFromSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!s) return null;
    if (s.role === 'platform_owner') return s.viewCenterId || null;
    return s.centerId || null;
  } catch {
    return null;
  }
}

function scopeCenter(items = []) {
  const cid = getActiveCenterIdFromSession();
  if (!cid) return [...items];
  return items.filter((i) => i.centerId === cid);
}

function withCenter(entity) {
  const cid = getActiveCenterIdFromSession();
  if (!cid || entity.centerId) return entity;
  return { ...entity, centerId: cid };
}

const defaultData = () => ({
  batches: [],
  students: [],
  teachers: [],
  leads: [],
  attendance: [],
  tests: [],
  messages: [],
  centers: [],
  users: [],
  centerSettings: {},
  _migratedV5: false,
  organization: {
    name: 'Your Academy',
    branches: [{ id: 'main', name: 'Main Branch' }],
  },
  settings: {
    tutorName: 'Your Tutoring Center',
    whatsappApiKey: '',
    whatsappPhoneId: '',
    openaiApiKey: '',
    defaultCountryCode: '+91',
    defaultMeetingPlatform: 'google-meet',
  },
});

function migrateBatch(batch) {
  return {
    scheduleDays: ['mon', 'wed', 'fri'],
    startTime: '16:00',
    endTime: '18:00',
    startDate: new Date().toISOString().slice(0, 10),
    topics: [],
    sessions: [],
    teacherId: null,
    meetingPlatform: 'google-meet',
    ...batch,
    subjects: batch.subjects || [],
    topics: batch.topics?.length ? batch.topics : batch.subjects || [],
  };
}

function hydrateState(raw) {
  const data = { ...defaultData(), ...raw };
  data.batches = (data.batches || []).map((batch) => {
    const migrated = migrateBatch(batch);
    if (migrated.topics?.length && !migrated.sessions?.length) {
      migrated.sessions = generateSchedule({
        topics: migrated.topics,
        scheduleDays: migrated.scheduleDays,
        startTime: migrated.startTime,
        endTime: migrated.endTime,
        startDate: migrated.startDate,
        meetingPlatform: migrated.meetingPlatform,
        batchName: migrated.name,
      });
      migrated.schedule = formatScheduleLabel(migrated.scheduleDays, migrated.startTime, migrated.endTime);
    }
    return migrated;
  });
  data.teachers = data.teachers || [];
  data.leads = data.leads || [];
  data.centers = data.centers || [];
  data.users = data.users || [];
  data.organization = data.organization || defaultData().organization;
  data.students = data.students || [];
  ensurePlatformData(data);
  migrateMultiTenant(data);
  migrateCenterListings(data);
  seedPlatformDemo(data, data.students, data.batches, data.teachers);
  if (!data.users.length) seedDemoUsers(data);
  return data;
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of ['tutorhub_data_v3', 'tutorhub_data_v2', 'tutorhub_data_v1']) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          parsed.batches = (parsed.batches || []).map(migrateBatch);
          const merged = hydrateState({ ...defaultData(), ...parsed });
          saveDataLocal(merged);
          return merged;
        }
      }
      return seedDemoData();
    }
    return hydrateState(JSON.parse(raw));
  } catch (err) {
    console.error('EduOS loadData failed, resetting demo:', err);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return seedDemoData();
  }
}

async function loadFromDatabase() {
  const res = await fetch('/api/state');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Database load failed (${res.status})`);
  const payload = await res.json();
  return hydrateState(payload.data);
}

async function persistToDatabase(data) {
  const res = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Database save failed (${res.status})`);
}

let state = null;
let dbMode = false;
let persistTimer = null;
let initPromise = null;

function saveDataLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function saveData(data) {
  saveDataLocal(data);
  if (dbMode) scheduleDbPersist();
}

function scheduleDbPersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistToDatabase(state).catch((err) => {
      console.warn('EduOS database save failed:', err.message);
    });
  }, 400);
}

export async function initStore() {
  if (state) return state;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const health = await fetch('/api/health');
      if (health.ok) {
        const info = await health.json();
        if (info.db) {
          dbMode = true;
          const remote = await loadFromDatabase();
          if (remote) {
            state = remote;
            saveDataLocal(state);
            return state;
          }
          state = loadFromLocalStorage();
          await persistToDatabase(state);
          return state;
        }
      }
    } catch (err) {
      console.warn('EduOS using localStorage (API unavailable):', err.message);
      dbMode = false;
    }

    state = loadFromLocalStorage();
    return state;
  })();

  return initPromise;
}

export function isDatabaseMode() {
  return dbMode;
}

export function getStorageLabel() {
  return dbMode ? 'Neon PostgreSQL' : 'Browser localStorage';
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function seedDemoData() {
  const teacher1 = {
    id: uid('teacher'),
    name: 'Dr. Anita Desai',
    email: 'anita@tutorhub.com',
    phone: '9876001001',
    subjects: ['Physics', 'Chemistry'],
    bio: '10+ years teaching board exam science',
  };

  const teacher2 = {
    id: uid('teacher'),
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
    'Atomic Structure',
    'Chemical Bonding',
    'Acids, Bases & Salts',
    'Cell Structure',
    'Human Physiology',
    'Revision & Mock Test',
  ];

  const mathTopics = [
    'Number Systems Review',
    'Linear Equations',
    'Quadratic Equations',
    'Polynomials',
    'Triangles & Congruence',
    'Coordinate Geometry',
    'Statistics Introduction',
    'Probability Basics',
  ];

  const batch1Base = {
    id: uid('batch'),
    name: 'Grade 10 — Science',
    subjects: ['Physics', 'Chemistry', 'Biology'],
    capacity: 20,
    notes: 'Board exam preparation batch',
    teacherId: teacher1.id,
    scheduleDays: ['mon', 'wed', 'fri'],
    startTime: '16:00',
    endTime: '18:00',
    startDate: '2025-06-02',
    topics: scienceTopics,
    meetingPlatform: 'google-meet',
    createdAt: new Date().toISOString(),
  };

  const batch2Base = {
    id: uid('batch'),
    name: 'Grade 8 — Mathematics',
    subjects: ['Algebra', 'Geometry'],
    capacity: 15,
    notes: 'Foundation strengthening',
    teacherId: teacher2.id,
    scheduleDays: ['tue', 'thu'],
    startTime: '17:00',
    endTime: '19:00',
    startDate: '2025-06-03',
    topics: mathTopics,
    meetingPlatform: 'zoom',
    createdAt: new Date().toISOString(),
  };

  const batch1 = {
    ...batch1Base,
    schedule: formatScheduleLabel(batch1Base.scheduleDays, batch1Base.startTime, batch1Base.endTime),
    sessions: generateSchedule({ ...batch1Base, batchName: batch1Base.name }).map((s, i) =>
      i < 4 ? { ...s, completed: true } : s
    ),
  };

  const batch2 = {
    ...batch2Base,
    schedule: formatScheduleLabel(batch2Base.scheduleDays, batch2Base.startTime, batch2Base.endTime),
    sessions: generateSchedule({ ...batch2Base, batchName: batch2Base.name }).map((s, i) =>
      i < 3 ? { ...s, completed: true } : s
    ),
  };

  const students = [
    {
      id: uid('student'),
      name: 'Aarav Sharma',
      batchId: batch1.id,
      grade: '10',
      email: 'aarav@email.com',
      phone: '9876543210',
      parentName: 'Rajesh Sharma',
      parentPhone: '9876500011',
      parentEmail: 'rajesh@email.com',
      address: '12 Park Street, Mumbai',
      joinDate: '2025-06-01',
      notes: 'Strong in Physics',
    },
    {
      id: uid('student'),
      name: 'Priya Patel',
      batchId: batch1.id,
      grade: '10',
      email: 'priya@email.com',
      phone: '9876543211',
      parentName: 'Meena Patel',
      parentPhone: '9876500022',
      parentEmail: 'meena@email.com',
      address: '45 Lake View, Ahmedabad',
      joinDate: '2025-06-15',
      notes: 'Needs help in Chemistry',
    },
    {
      id: uid('student'),
      name: 'Rohan Mehta',
      batchId: batch2.id,
      grade: '8',
      email: 'rohan@email.com',
      phone: '9876543212',
      parentName: 'Suresh Mehta',
      parentPhone: '9876500033',
      parentEmail: 'suresh@email.com',
      address: '78 Green Avenue, Pune',
      joinDate: '2025-07-01',
      notes: '',
    },
  ];

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const leads = [
    { id: uid('lead'), name: 'Kavya Reddy', phone: '9876510001', email: 'kavya@email.com', source: 'Website', stage: 'lead', grade: '9', course: 'Science', notes: 'Interested in weekend batch', followUpDate: '2025-07-23', createdAt: '2025-07-18', activities: [{ id: uid('act'), type: 'note', note: 'Captured from website form', at: '2025-07-18T10:00:00.000Z' }] },
    { id: uid('lead'), name: 'Arjun Nair', phone: '9876510002', email: 'arjun@email.com', source: 'WhatsApp', stage: 'inquiry', grade: '10', course: 'Science', notes: 'Asked about fees', followUpDate: '2025-07-22', createdAt: '2025-07-17', activities: [{ id: uid('act'), type: 'note', note: 'WhatsApp inquiry about fee structure', at: '2025-07-17T14:30:00.000Z' }] },
    { id: uid('lead'), name: 'Sneha Iyer', phone: '9876510003', email: 'sneha@email.com', source: 'Facebook Ads', stage: 'demo', grade: '8', course: 'Mathematics', notes: 'Demo scheduled Fri 5 PM', demoDate: '2025-07-25', demoTime: '17:00', createdAt: '2025-07-16', activities: [{ id: uid('act'), type: 'demo', note: 'Demo class scheduled for Fri 5 PM', at: '2025-07-16T11:00:00.000Z' }] },
    { id: uid('lead'), name: 'Dev Kapoor', phone: '9876510004', email: 'dev@email.com', source: 'Referral', stage: 'counseling', grade: '10', course: 'Science', notes: 'Parent wants career guidance', createdAt: '2025-07-14', activities: [] },
    { id: uid('lead'), name: 'Isha Gupta', phone: '9876510005', email: 'isha@email.com', source: 'Walk-in', stage: 'batch_allocation', grade: '8', course: 'Mathematics', notes: 'Ready to enroll — pick batch', createdAt: '2025-07-12', activities: [{ id: uid('act'), type: 'payment', note: 'Fee received — pending batch assignment', at: '2025-07-19T09:00:00.000Z' }] },
  ];

  const data = {
    batches: [batch1, batch2],
    students,
    teachers: [teacher1, teacher2],
    leads,
    organization: defaultData().organization,
    attendance: [
      { id: uid('att'), batchId: batch1.id, date: yesterday, records: { [students[0].id]: 'present', [students[1].id]: 'absent' } },
      { id: uid('att'), batchId: batch2.id, date: yesterday, records: { [students[2].id]: 'present' } },
    ],
    tests: [
      {
        id: uid('test'),
        name: 'Unit Test 1 — Physics',
        batchId: batch1.id,
        subject: 'Physics',
        date: '2025-07-10',
        maxMarks: 50,
        marks: { [students[0].id]: 42, [students[1].id]: 35 },
      },
      {
        id: uid('test'),
        name: 'Algebra Quiz',
        batchId: batch2.id,
        subject: 'Algebra',
        date: '2025-07-12',
        maxMarks: 30,
        marks: { [students[2].id]: 24 },
      },
    ],
    messages: [],
    settings: defaultData().settings,
  };

  saveDataLocal(data);
  ensurePlatformData(data);
  migrateMultiTenant(data);
  seedPlatformDemo(data, students, [batch1, batch2], [teacher1, teacher2]);
  seedDemoUsers(data);
  return data;
}

function ensureState() {
  if (!state) throw new Error('Store not initialized — call initStore() first');
}

export function getSettings() {
  ensureState();
  const cid = getActiveCenterIdFromSession();
  if (!cid) return state.settings || defaultData().settings;
  state.centerSettings = state.centerSettings || {};
  if (!state.centerSettings[cid]) {
    state.centerSettings[cid] = { ...(state.settings || defaultData().settings) };
  }
  return state.centerSettings[cid];
}

function applyCenterListingMigration(data) {
  if (data._migratedV6) return data;

  const listingDefaults = {
    'bright-minds': {
      publicTagline: 'Board exam prep with expert tutors — flexible batches and proven results',
      categories: ['academics'],
      publicSubjects: ['Physics', 'Chemistry', 'Mathematics'],
      rating: 4.8,
      reviewCount: 124,
    },
    'excel-tutors-pune': {
      publicTagline: 'Grades 6–12 · small batches · personalized attention',
      categories: ['academics'],
      publicSubjects: ['Mathematics', 'Science', 'English'],
      rating: 4.6,
      reviewCount: 89,
    },
  };

  for (const center of data.centers || []) {
    if (center.listingEnabled === undefined) center.listingEnabled = true;
    const defaults = listingDefaults[center.slug] || {};
    if (!center.publicTagline && defaults.publicTagline) center.publicTagline = defaults.publicTagline;
    if (!center.publicSubjects?.length && defaults.publicSubjects) center.publicSubjects = defaults.publicSubjects;
    if (!center.categories?.length && defaults.categories) center.categories = defaults.categories;
    if (center.rating == null && defaults.rating != null) center.rating = defaults.rating;
    if (center.reviewCount == null && defaults.reviewCount != null) center.reviewCount = defaults.reviewCount;
  }

  data._migratedV6 = true;
  return data;
}

export function migrateCenterListings(data) {
  const run = (d) => applyTuitionCategoriesMigration(applyCenterListingMigration(d));
  if (arguments.length > 0) return run(data);
  state = run(state);
  saveData(state);
  return state;
}

function applyTuitionCategoriesMigration(data) {
  if (data._migratedV7) return data;

  const slugDefaults = {
    'bright-minds': {
      categories: ['academics'],
      publicSubjects: ['Physics', 'Chemistry', 'Mathematics'],
    },
    'excel-tutors-pune': {
      categories: ['academics'],
      publicSubjects: ['Mathematics', 'Science', 'English'],
    },
    'rhythm-steps-mumbai': {
      categories: ['dance'],
      publicSubjects: ['Classical', 'Bollywood', 'Contemporary'],
      publicTagline: 'From classical to contemporary — all ages welcome',
      rating: 4.9,
      reviewCount: 156,
    },
    'palette-art-studio': {
      categories: ['art', 'drawing'],
      publicSubjects: ['Painting', 'Sketching', 'Watercolor'],
      publicTagline: 'Fine art, sketching, and creative expression for kids & adults',
      rating: 4.7,
      reviewCount: 98,
    },
    'melody-music-hub': {
      categories: ['music'],
      publicSubjects: ['Vocal', 'Guitar', 'Piano'],
      publicTagline: 'Trinity-grade music lessons — vocal and instruments',
      rating: 4.8,
      reviewCount: 112,
    },
    'kickstart-sports-academy': {
      categories: ['sports'],
      publicSubjects: ['Cricket', 'Football', 'Fitness'],
      publicTagline: 'Coaching, fitness, and competitive sports training',
      rating: 4.5,
      reviewCount: 74,
    },
    'code-young-labs': {
      categories: ['coding'],
      publicSubjects: ['Python', 'Scratch', 'Robotics'],
      publicTagline: 'Coding and robotics for school students — build real projects',
      rating: 4.9,
      reviewCount: 203,
    },
    'express-languages': {
      categories: ['languages'],
      publicSubjects: ['English', 'French', 'IELTS Prep'],
      publicTagline: 'Spoken English, foreign languages, and exam prep',
      rating: 4.6,
      reviewCount: 67,
    },
    'craft-corner': {
      categories: ['craft', 'art'],
      publicSubjects: ['Pottery', 'DIY Crafts', 'Sculpture'],
      publicTagline: 'Hands-on craft workshops — pottery, DIY, and sculpture',
      rating: 4.7,
      reviewCount: 45,
    },
    'stagecraft-theatre': {
      categories: ['theatre'],
      publicSubjects: ['Acting', 'Stage Performance', 'Drama'],
      publicTagline: 'Acting, drama, and stage confidence for young performers',
      rating: 4.8,
      reviewCount: 52,
    },
  };

  for (const center of data.centers || []) {
    const defaults = slugDefaults[center.slug] || {};
    if (!center.categories?.length && defaults.categories) center.categories = defaults.categories;
    if (!center.publicSubjects?.length && defaults.publicSubjects) center.publicSubjects = defaults.publicSubjects;
    if (!center.publicTagline && defaults.publicTagline) center.publicTagline = defaults.publicTagline;
    if (center.rating == null && defaults.rating != null) center.rating = defaults.rating;
    if (center.reviewCount == null && defaults.reviewCount != null) center.reviewCount = defaults.reviewCount;
    if (center.listingEnabled === undefined) center.listingEnabled = true;
  }

  const slugs = new Set((data.centers || []).map((c) => c.slug));
  const extra = [
    { name: 'Rhythm Steps Dance Academy', slug: 'rhythm-steps-mumbai', city: 'Mumbai', phone: '9876100001' },
    { name: 'Palette Art Studio', slug: 'palette-art-studio', city: 'Mumbai', phone: '9876100002' },
    { name: 'Melody Music Hub', slug: 'melody-music-hub', city: 'Delhi', phone: '9876100003' },
    { name: 'Kickstart Sports Academy', slug: 'kickstart-sports-academy', city: 'Pune', phone: '9876100004' },
    { name: 'CodeYoung Labs', slug: 'code-young-labs', city: 'Bangalore', phone: '9876100005' },
    { name: 'Express Languages', slug: 'express-languages', city: 'Hyderabad', phone: '9876100006' },
    { name: 'Craft Corner Studio', slug: 'craft-corner', city: 'Chennai', phone: '9876100007' },
    { name: 'StageCraft Theatre School', slug: 'stagecraft-theatre', city: 'Mumbai', phone: '9876100008' },
  ];

  for (const item of extra) {
    if (slugs.has(item.slug)) continue;
    const defaults = slugDefaults[item.slug] || {};
    data.centers.push({
      id: uid('center'),
      status: 'active',
      plan: 'trial',
      createdAt: '2025-06-15',
      listingEnabled: true,
      ...item,
      categories: defaults.categories || ['academics'],
      publicSubjects: defaults.publicSubjects || [],
      publicTagline: defaults.publicTagline || `Quality programs in ${item.city}`,
      rating: defaults.rating ?? 4.5,
      reviewCount: defaults.reviewCount ?? 40,
    });
  }

  data._migratedV7 = true;
  return data;
}

function applyMultiTenantMigration(data) {
  if (data._migratedV5) return data;
  const centerId = data.centers?.[0]?.id || uid('center');
  if (!data.centers?.length) {
    data.centers = [{
      id: centerId,
      name: data.settings?.tutorName || 'Bright Minds Academy',
      slug: 'bright-minds',
      city: 'Mumbai',
      phone: '',
      status: 'active',
      plan: 'trial',
      createdAt: new Date().toISOString().slice(0, 10),
    }];
  }
  const cid = data.centers[0].id;
  const tag = (arr) => (arr || []).map((x) => ({ ...x, centerId: x.centerId || cid }));
  data.batches = tag(data.batches);
  data.students = tag(data.students);
  data.teachers = tag(data.teachers);
  data.leads = tag(data.leads);
  data.attendance = tag(data.attendance);
  data.tests = tag(data.tests);
  data.messages = tag(data.messages);
  if (data.centers.length === 1) {
    data.centers.push({
      id: uid('center'),
      name: 'Excel Tutors Pune',
      slug: 'excel-tutors-pune',
      city: 'Pune',
      phone: '9876000000',
      status: 'active',
      plan: 'trial',
      createdAt: '2025-07-01',
      listingEnabled: true,
      publicTagline: 'Grades 6–12 · small batches · personalized attention',
      publicSubjects: ['Mathematics', 'Science', 'English'],
      rating: 4.6,
      reviewCount: 89,
    });
  }
  data.centerSettings = data.centerSettings || {};
  if (!data.centerSettings[cid]) {
    data.centerSettings[cid] = { ...defaultData().settings, ...(data.settings || {}) };
  }
  data._migratedV5 = true;
  return data;
}

export function migrateMultiTenant(data) {
  if (arguments.length > 0) return applyMultiTenantMigration(data);
  state = applyMultiTenantMigration(state);
  saveData(state);
  return state;
}

function applySeedDemoUsers(data) {
  if (data.users?.length) return data;
  applyMultiTenantMigration(data);
  const centerId = data.centers[0].id;
  const t1 = data.teachers[0];
  const t2 = data.teachers[1];
  const s1 = data.students[0];
  data.users = [
    { id: uid('user'), email: 'owner@eduos.app', password: 'demo123', role: 'platform_owner', name: 'Platform Owner' },
    { id: uid('user'), centerId, email: 'admin@brightminds.demo', password: 'demo123', role: 'center_admin', name: 'Center Admin' },
    { id: uid('user'), centerId, email: 'anita@tutorhub.com', password: 'demo123', role: 'teacher', name: t1?.name || 'Teacher 1', linkedTeacherId: t1?.id },
    { id: uid('user'), centerId, email: 'vikram@tutorhub.com', password: 'demo123', role: 'teacher', name: t2?.name || 'Teacher 2', linkedTeacherId: t2?.id },
    { id: uid('user'), centerId, email: 'aarav@email.com', password: 'demo123', role: 'student', name: s1?.name || 'Student', linkedStudentId: s1?.id },
    { id: uid('user'), centerId, email: 'rajesh@email.com', password: 'demo123', role: 'parent', name: 'Rajesh Sharma', linkedStudentIds: s1 ? [s1.id] : [] },
  ];
  return data;
}

export function seedDemoUsers(data) {
  if (arguments.length > 0) return applySeedDemoUsers(data);
  if (state.users?.length) return;
  applySeedDemoUsers(state);
  saveData(state);
}

export function getCenters() {
  return state.centers || [];
}

export function getCenter(id) {
  return (state.centers || []).find((c) => c.id === id);
}

export function saveCenter(center) {
  const idx = (state.centers || []).findIndex((c) => c.id === center.id);
  if (idx >= 0) state.centers[idx] = center;
  else state.centers.push({ ...center, id: center.id || uid('center') });
  if (!state.centers) state.centers = [];
  return state.centers.find((c) => c.id === (center.id || state.centers.at(-1).id));
}

export function getUsers() {
  return state.users || [];
}

export function findUserByEmail(email) {
  return getUsers().find((u) => u.email === email.trim().toLowerCase());
}

export function createUser(user) {
  const entry = {
    ...user,
    id: uid('user'),
    email: user.email.trim().toLowerCase(),
  };
  state.users = state.users || [];
  state.users.push(entry);
  return entry;
}

export function persistRaw() {
  persist();
}

export function initCenterSettings(centerId, name) {
  state.centerSettings = state.centerSettings || {};
  state.centerSettings[centerId] = { ...defaultData().settings, tutorName: name || 'Your Tutoring Center' };
  persist();
}

export function getState() {
  ensureState();
  return { ...state, settings: getSettings() };
}

export function persist() {
  ensureState();
  saveData(state);
}

export async function resetDemo() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  if (dbMode) {
    try {
      await fetch('/api/state', { method: 'DELETE' });
    } catch (err) {
      console.warn('Could not reset database state:', err.message);
    }
  }
  state = seedDemoData();
  if (dbMode) {
    try {
      await persistToDatabase(state);
    } catch (err) {
      console.warn('Could not seed database:', err.message);
    }
  }
  return state;
}

export function updateSettings(partial) {
  const cid = getActiveCenterIdFromSession();
  if (!cid) {
    state.settings = { ...(state.settings || defaultData().settings), ...partial };
  } else {
    state.centerSettings = state.centerSettings || {};
    state.centerSettings[cid] = { ...getSettings(), ...partial };
  }
  persist();
}

// Teachers
export function getTeachers() {
  return scopeCenter(state.teachers);
}

export function getTeacher(id) {
  return scopeCenter(state.teachers).find((t) => t.id === id);
}

export function saveTeacher(teacher) {
  const idx = state.teachers.findIndex((t) => t.id === teacher.id);
  if (idx >= 0) state.teachers[idx] = withCenter(teacher);
  else state.teachers.push(withCenter({ ...teacher, id: uid('teacher') }));
  persist();
}

export function deleteTeacher(id) {
  state.teachers = state.teachers.filter((t) => t.id !== id);
  state.batches.forEach((b) => {
    if (b.teacherId === id) b.teacherId = null;
  });
  persist();
}

// CRM Leads
export function getLeads(stage) {
  let leads = scopeCenter(state.leads);
  if (stage) leads = leads.filter((l) => l.stage === stage);
  return leads;
}

export function getLead(id) {
  return scopeCenter(state.leads).find((l) => l.id === id);
}

export function saveLead(lead) {
  const idx = state.leads.findIndex((l) => l.id === lead.id);
  if (idx >= 0) {
    state.leads[idx] = lead;
    persist();
    return state.leads[idx];
  }
  const entry = withCenter({ ...lead, id: uid('lead'), createdAt: lead.createdAt || new Date().toISOString().slice(0, 10), activities: lead.activities || [] });
  state.leads.push(entry);
  persist();
  return entry;
}

const LEAD_STAGE_LABELS = {
  lead: 'Lead',
  inquiry: 'Inquiry',
  demo: 'Demo Class',
  counseling: 'Counseling',
  admission: 'Admission',
  payment: 'Payment',
  batch_allocation: 'Batch Allocation',
  converted: 'Student',
};

export function addLeadActivity(leadId, type, note) {
  const lead = getLead(leadId);
  if (!lead) return;
  lead.activities = lead.activities || [];
  lead.activities.unshift({
    id: uid('act'),
    type,
    note,
    at: new Date().toISOString(),
  });
  persist();
}

export function updateLead(id, fields) {
  const lead = getLead(id);
  if (!lead) return null;
  Object.assign(lead, fields);
  persist();
  return lead;
}

export function moveLead(id, stage) {
  const lead = getLead(id);
  if (!lead) return;
  const prev = lead.stage;
  lead.stage = stage;
  if (prev !== stage) {
    addLeadActivity(id, 'stage', `Moved to ${LEAD_STAGE_LABELS[stage] || stage}`);
  }
  persist();
}

export function deleteLead(id) {
  state.leads = state.leads.filter((l) => l.id !== id);
  persist();
}

export function convertLeadToStudent(leadId, batchId) {
  const lead = getLead(leadId);
  if (!lead) return null;
  const batch = getBatch(batchId);
  if (batch && getStudents(batchId).length >= (batch.capacity || 999)) {
    return { error: 'Batch is at full capacity' };
  }
  const student = {
    name: lead.name,
    batchId,
    grade: lead.grade || '',
    email: lead.email || '',
    phone: lead.phone || '',
    parentName: lead.parentName || lead.name + ' (Parent)',
    parentPhone: lead.parentPhone || lead.phone || '',
    parentEmail: lead.parentEmail || lead.email || '',
    joinDate: new Date().toISOString().slice(0, 10),
    notes: lead.notes || '',
  };
  saveStudent(student);
  lead.stage = 'converted';
  lead.convertedStudentId = student.id;
  addLeadActivity(leadId, 'converted', `Enrolled in ${batch?.name || 'batch'}`);
  persist();
  return student;
}

export function markSessionComplete(batchId, sessionId, completed = true) {
  const batch = getBatch(batchId);
  const session = batch?.sessions?.find((s) => s.id === sessionId);
  if (!session) return false;
  session.completed = completed;
  persist();
  return true;
}

export function getTeacherReport(teacherId) {
  const teacher = getTeacher(teacherId);
  if (!teacher) return null;

  const batches = state.batches.filter((b) => b.teacherId === teacherId);
  const students = batches.flatMap((b) => getStudents(b.id));
  const sessions = batches.flatMap((b) => b.sessions || []);
  const progress = getSessionProgress(sessions);
  const upcoming = getUpcomingSessions(batches, 5);

  return {
    teacher,
    batchCount: batches.length,
    studentCount: students.length,
    sessionsTotal: sessions.length,
    sessionsCompleted: progress.completed,
    completionRate: progress.percent,
    upcoming,
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      students: getStudents(b.id).length,
      progress: getSessionProgress(b.sessions).percent,
    })),
  };
}

// Batches
export function getRawState() {
  ensureState();
  return state;
}

export function getBatches() {
  let batches = scopeCenter(state.batches);
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s?.role === 'teacher' && s.linkedTeacherId) {
      batches = batches.filter((b) => b.teacherId === s.linkedTeacherId);
    }
  } catch { /* ignore */ }
  return batches;
}

export function getBatch(id) {
  return scopeCenter(state.batches).find((b) => b.id === id);
}

export function saveBatch(batch) {
  const normalized = migrateBatch(batch);
  normalized.schedule =
    normalized.schedule ||
    formatScheduleLabel(normalized.scheduleDays, normalized.startTime, normalized.endTime);

  const idx = state.batches.findIndex((b) => b.id === normalized.id);
  if (idx >= 0) state.batches[idx] = normalized;
  else state.batches.push(withCenter({ ...normalized, id: uid('batch'), createdAt: new Date().toISOString() }));
  persist();
}

export function deleteBatch(id) {
  state.batches = state.batches.filter((b) => b.id !== id);
  state.students = state.students.filter((s) => s.batchId !== id);
  state.attendance = state.attendance.filter((a) => a.batchId !== id);
  state.tests = state.tests.filter((t) => t.batchId !== id);
  persist();
}

export function updateBatchSessions(batchId, sessions) {
  const batch = getBatch(batchId);
  if (!batch) return;
  batch.sessions = sessions;
  persist();
}

export function getBatchProgress(batchId) {
  const batch = getBatch(batchId);
  return getSessionProgress(batch?.sessions || []);
}

export function getStudentReport(studentId) {
  const student = getStudent(studentId);
  if (!student) return null;

  const batch = getBatch(student.batchId);
  const attendance = getStudentAttendanceStats(studentId);
  const tests = getStudentTestStats(studentId);
  const curriculum = getBatchProgress(student.batchId);

  return {
    student,
    batch,
    attendance,
    tests,
    curriculumProgress: curriculum.percent,
    sessionsCompleted: curriculum.completed,
    sessionsTotal: curriculum.total,
  };
}

// Students
export function getStudents(batchId) {
  let students = scopeCenter(state.students);
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s?.role === 'student' && s.linkedStudentId) {
      students = students.filter((x) => x.id === s.linkedStudentId);
    } else if (s?.role === 'parent' && s.linkedStudentIds?.length) {
      students = students.filter((x) => s.linkedStudentIds.includes(x.id));
    } else if (s?.role === 'teacher' && s.linkedTeacherId) {
      const batchIds = new Set(getBatches().map((b) => b.id));
      students = students.filter((x) => batchIds.has(x.batchId));
    }
  } catch { /* ignore */ }
  if (batchId) students = students.filter((s) => s.batchId === batchId);
  return students;
}

export function getStudent(id) {
  return scopeCenter(state.students).find((s) => s.id === id);
}

export function saveStudent(student) {
  const idx = state.students.findIndex((s) => s.id === student.id);
  if (idx >= 0) state.students[idx] = student;
  else state.students.push(withCenter({ ...student, id: uid('student') }));
  persist();
}

export function deleteStudent(id) {
  state.students = state.students.filter((s) => s.id !== id);
  persist();
}

// Attendance
export function getAttendance(batchId, date) {
  return state.attendance.find((a) => a.batchId === batchId && a.date === date);
}

export function getAttendanceHistory(batchId) {
  return scopeCenter(state.attendance)
    .filter((a) => !batchId || a.batchId === batchId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function saveAttendance(batchId, date, records) {
  const existing = getAttendance(batchId, date);
  if (existing) {
    existing.records = records;
  } else {
    state.attendance.push(withCenter({ id: uid('att'), batchId, date, records }));
  }
  persist();
}

export function getStudentAttendanceStats(studentId) {
  const records = scopeCenter(state.attendance).flatMap((a) =>
    a.records[studentId] ? [{ date: a.date, status: a.records[studentId] }] : []
  );
  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  const absent = records.filter((r) => r.status === 'absent').length;
  const late = records.filter((r) => r.status === 'late').length;
  return { total, present, absent, late, rate: total ? Math.round((present / total) * 100) : 0, records };
}

// Tests
export function getTests(batchId) {
  let tests = scopeCenter(state.tests);
  if (batchId) tests = tests.filter((t) => t.batchId === batchId);
  return tests;
}

export function getTest(id) {
  return scopeCenter(state.tests).find((t) => t.id === id);
}

export function saveTest(test) {
  const idx = state.tests.findIndex((t) => t.id === test.id);
  if (idx >= 0) state.tests[idx] = test;
  else state.tests.push(withCenter({ ...test, id: uid('test') }));
  persist();
}

export function deleteTest(id) {
  state.tests = state.tests.filter((t) => t.id !== id);
  persist();
}

export function getStudentTestStats(studentId) {
  const results = scopeCenter(state.tests).flatMap((t) => {
    const score = t.marks[studentId];
    if (score == null) return [];
    return [{ test: t.name, subject: t.subject, date: t.date, score, max: t.maxMarks, pct: Math.round((score / t.maxMarks) * 100) }];
  });
  const avg = results.length
    ? Math.round(results.reduce((s, r) => s + r.pct, 0) / results.length)
    : 0;
  return { results, avg };
}

// Messages
export function getMessages() {
  return [...scopeCenter(state.messages)].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function addMessage(message) {
  state.messages.unshift(withCenter({ ...message, id: uid('msg'), sentAt: new Date().toISOString() }));
  persist();
}

export function exportAll() {
  return JSON.stringify(state, null, 2);
}

export function importAll(json) {
  const parsed = JSON.parse(json);
  state = { ...defaultData(), ...parsed };
  state.batches = (state.batches || []).map(migrateBatch);
  persist();
  return state;
}

export { getUpcomingSessions, getSessionProgress };
