import { getState, persist, getStudents, getStudent, getTeachers, getTeacher, getBatch, getBatches, getStudentAttendanceStats, getStudentTestStats, getBatchProgress, getTeacherReport, getTests } from './store.js';
import { getUpcomingSessions } from './scheduler.js';

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ensurePlatformData(state) {
  state.assignments = state.assignments || [];
  state.lessonPlans = state.lessonPlans || [];
  state.certificates = state.certificates || [];
  state.skills = state.skills || [];
  state.feedback = state.feedback || [];
  state.projects = state.projects || [];
  state.commTemplates = state.commTemplates || defaultCommTemplates();
  state.commAutomations = state.commAutomations || defaultAutomations();
  mergeCommDefaults(state);
  state.marketplace = state.marketplace || defaultMarketplace();
  mergeMarketplaceDefaults(state);
  state.webhooks = state.webhooks || [];
  state.apiKeys = state.apiKeys || [{ id: 'key_demo', name: 'Demo API Key', key: 'edos_sk_demo_x7k2m9p4q1', scopes: ['read', 'write'], createdAt: new Date().toISOString().slice(0, 10) }];
  state.tutorAvailability = state.tutorAvailability || {};
  state.publicSite = state.publicSite || defaultPublicSite();
  mergePublicSiteDefaults(state);
  state.interventions = state.interventions || [];
  state.tutorPd = state.tutorPd || [];
  state.parentPreferences = state.parentPreferences || {};
  state.parentInquiries = state.parentInquiries || [];
  state.aiHistory = state.aiHistory || [];
  state.apiEventLog = state.apiEventLog || [];
  state.sdkIntegrations = state.sdkIntegrations || defaultSdkIntegrations();
  state.commSettings = state.commSettings || {
    emailFrom: 'noreply@youracademy.com',
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    voiceEnabled: false,
    calendarReminders: true,
    reminderHoursBefore: 24,
    autoOnAttendance: true,
    autoOnTests: true,
    autoOnHomework: true,
    autoOnFeedback: true,
  };
  return state;
}

function defaultCommTemplates() {
  return [
    { id: 'tpl_att', name: 'Absence Alert', channel: 'whatsapp', event: 'attendance_absent', body: 'Dear {{parent}}, {{student}} was absent on {{date}}.' },
    { id: 'tpl_hw', name: 'Homework Reminder', channel: 'email', event: 'homework_due', body: 'Reminder: {{assignment}} is due on {{dueDate}} for {{student}}.' },
    { id: 'tpl_test', name: 'Test Results', channel: 'whatsapp', event: 'test_result', body: '{{student}} scored {{score}}/{{max}} on {{test}}.' },
    { id: 'tpl_class', name: 'Class Reminder', channel: 'sms', event: 'class_upcoming', body: 'Class tomorrow: {{topic}} at {{time}}. Join: {{link}}' },
    { id: 'tpl_fb', name: 'Teacher Feedback', channel: 'push', event: 'feedback', body: 'New feedback for {{student}} from {{teacher}}: {{message}}' },
    { id: 'tpl_parent', name: 'Parent Progress Summary', channel: 'email', event: 'parent_summary', body: '{{summary}}' },
    { id: 'tpl_int', name: 'Intervention Alert', channel: 'whatsapp', event: 'intervention', body: '{{summary}}' },
  ];
}

function defaultAutomations() {
  return [
    { id: 'auto_att', event: 'Student absent', channels: ['whatsapp', 'email'], enabled: true, templateId: 'tpl_att' },
    { id: 'auto_hw', event: 'Homework due in 24h', channels: ['whatsapp', 'sms'], enabled: true, templateId: 'tpl_hw' },
    { id: 'auto_test', event: 'Test marks recorded', channels: ['whatsapp'], enabled: true, templateId: 'tpl_test' },
    { id: 'auto_class', event: 'Class in 24 hours', channels: ['sms', 'push'], enabled: false, templateId: 'tpl_class' },
    { id: 'auto_parent', event: 'Parent progress summary', channels: ['email', 'whatsapp'], enabled: true, templateId: 'tpl_parent', eventKey: 'parent_summary' },
    { id: 'auto_int', event: 'Intervention plan created', channels: ['whatsapp'], enabled: true, templateId: 'tpl_int', eventKey: 'intervention' },
  ];
}

function mergeCommDefaults(state) {
  for (const tpl of defaultCommTemplates()) {
    if (!state.commTemplates.some((t) => t.id === tpl.id)) state.commTemplates.push(tpl);
  }
  for (const auto of defaultAutomations()) {
    if (!state.commAutomations.some((a) => a.id === auto.id)) state.commAutomations.push(auto);
  }
}

function defaultPublicSite() {
  return {
    headline: 'Enroll in our academy — expert tutors, proven results',
    subheadline: 'Flexible batches · Proven results · Free demo class',
    ctaText: 'Request Free Demo',
    captureEnabled: true,
  };
}

function mergePublicSiteDefaults(state) {
  state.publicSite = { ...defaultPublicSite(), ...state.publicSite };
}

const LEGACY_MARKETPLACE_TYPES = ['worksheet', 'course', 'assessment', 'lesson_plan', 'consultant'];

export const MARKETPLACE_TYPE_LABELS = {
  integration: 'Integration',
  template: 'Ops template',
  partner: 'Partner service',
};

function defaultMarketplace() {
  return [
    {
      id: 'mp_zoom',
      type: 'integration',
      title: 'Zoom Class Connector',
      author: 'EduOS',
      price: 'Free',
      rating: 4.6,
      installs: 3200,
      description: 'Auto-attach Zoom join links to scheduled classes. You teach on Zoom — EduOS handles scheduling and reminders.',
      sdkId: 'sdk_zoom',
      linkView: 'schedule',
    },
    {
      id: 'mp_gcal',
      type: 'integration',
      title: 'Google Calendar Sync',
      author: 'EduOS',
      price: 'Free',
      rating: 4.4,
      installs: 2100,
      description: 'Sync academy class schedule with Google Calendar for tutors and admins.',
      sdkId: 'sdk_gcal',
      linkView: 'schedule',
    },
    {
      id: 'mp_wa',
      type: 'integration',
      title: 'WhatsApp Business',
      author: 'EduOS',
      price: 'Free',
      rating: 4.7,
      installs: 4100,
      description: 'Send attendance alerts, homework reminders, and parent updates on WhatsApp.',
      linkView: 'commHub',
    },
    {
      id: 'mp_twilio',
      type: 'integration',
      title: 'Twilio SMS',
      author: 'EduOS',
      price: 'Free',
      rating: 4.3,
      installs: 980,
      description: 'SMS class reminders and fee notices when parents prefer text over WhatsApp.',
      sdkId: 'sdk_twilio',
      linkView: 'commHub',
    },
    {
      id: 'mp_tpl_fee',
      type: 'template',
      title: 'Fee Reminder Pack',
      author: 'EduOS Ops',
      price: 'Free',
      rating: 4.5,
      installs: 890,
      description: 'WhatsApp and email templates for monthly fee reminders and overdue follow-ups.',
      templatePayload: {
        id: 'tpl_fee',
        name: 'Fee Reminder',
        channel: 'whatsapp',
        event: 'fee_due',
        body: 'Dear {{parent}}, fee of {{amount}} for {{student}} is due on {{dueDate}}. Reply if you need assistance.',
      },
      linkView: 'commHub',
    },
    {
      id: 'mp_tpl_onboard',
      type: 'template',
      title: 'Parent Onboarding Pack',
      author: 'EduOS Ops',
      price: 'Free',
      rating: 4.8,
      installs: 560,
      description: 'Welcome email, schedule confirmation, and first-week check-in templates for new admissions.',
      templatePayload: {
        id: 'tpl_onboard',
        name: 'New Student Welcome',
        channel: 'email',
        event: 'admission_welcome',
        body: 'Welcome {{parent}}! {{student}} is enrolled. First class: {{date}} at {{time}}. Batch: {{batch}}.',
      },
      linkView: 'commHub',
    },
    {
      id: 'mp_tpl_report',
      type: 'template',
      title: 'Monthly Progress Update',
      author: 'EduOS Ops',
      price: 'Free',
      rating: 4.6,
      installs: 720,
      description: 'Parent-friendly monthly summary template — attendance, homework status, and tutor notes (not lesson content).',
      templatePayload: {
        id: 'tpl_monthly',
        name: 'Monthly Progress Update',
        channel: 'email',
        event: 'monthly_summary',
        body: 'Monthly update for {{student}}: Attendance {{attendance}}%, Homework {{homeworkStatus}}. Notes: {{notes}}',
      },
      linkView: 'commHub',
    },
    {
      id: 'mp_partner_growth',
      type: 'partner',
      title: 'Academy Growth Consulting',
      author: 'EduGrowth Partners',
      price: 'Contact',
      rating: 5.0,
      installs: 89,
      description: 'External consultants for scaling centers, hiring, and operations — your teaching platform stays yours.',
      contact: 'hello@edugrowth.example',
    },
    {
      id: 'mp_partner_books',
      type: 'partner',
      title: 'Tutoring Center Bookkeeping',
      author: 'EduBooks India',
      price: 'Contact',
      rating: 4.9,
      installs: 45,
      description: 'GST, payroll, and fee reconciliation for independent tutoring businesses.',
      contact: 'ops@edubooks.example',
    },
  ];
}

function mergeMarketplaceDefaults(state) {
  const legacy = (state.marketplace || []).some((i) => LEGACY_MARKETPLACE_TYPES.includes(i.type));
  if (legacy || !state.marketplace?.length) {
    state.marketplace = defaultMarketplace();
  }
}

export function getMarketplaceTypeLabel(type) {
  return MARKETPLACE_TYPE_LABELS[type] || (type || '').replace(/_/g, ' ');
}

export function getMarketplaceInstallHint(item) {
  if (!item) return '';
  if (item.type === 'template') return 'Templates appear in Communication Hub → Message Templates.';
  if (item.type === 'integration' && item.sdkId) return 'Finish OAuth/setup in Extensions → Connections.';
  if (item.type === 'integration' && item.linkView === 'commHub') return 'Configure channels in Communication Hub.';
  if (item.type === 'integration' && item.linkView === 'schedule') return 'Join links appear on Class Schedule sessions.';
  if (item.type === 'partner') return 'Contact the partner directly — EduOS connects ops, not classroom content.';
  return 'Active in your academy operations.';
}

export function getMarketplaceInstallMessage(item) {
  if (!item) return 'Added to your academy';
  if (item.type === 'template') return 'Added to Communication Hub templates';
  if (item.type === 'integration') return 'Connected — finish setup in Connections or Communication Hub';
  if (item.type === 'partner') return 'Saved to your partners list';
  return 'Added to your academy';
}

export function getMarketplaceActionLabel(item, installed = false) {
  if (installed) return 'Connected';
  if (item?.type === 'template') return 'Add template';
  if (item?.type === 'partner') return 'Save';
  return 'Connect';
}

export function seedPlatformDemo(state, students = [], batches = [], teachers = []) {
  ensurePlatformData(state);
  if (state.assignments.length) return state;
  if (!batches[0] || !batches[1] || !teachers[0] || !teachers[1] || !students[0]) return state;

  const batch1 = batches[0];
  const batch2 = batches[1];
  const t1 = teachers[0];
  const t2 = teachers[1];

  state.assignments = [
    { id: uid('hw'), batchId: batch1.id, title: 'Newton Laws Problem Set', subject: 'Physics', dueDate: '2025-07-25', description: 'Solve problems 1-15 from chapter 4', submissions: { [students[0].id]: { status: 'submitted', grade: 'A', submittedAt: '2025-07-20' }, [students[1].id]: { status: 'pending' } } },
    { id: uid('hw'), batchId: batch1.id, title: 'Chemical Reactions Lab Report', subject: 'Chemistry', dueDate: '2025-07-28', description: 'Lab report from last session', submissions: { [students[0].id]: { status: 'pending' }, [students[1].id]: { status: 'late' } } },
    { id: uid('hw'), batchId: batch2.id, title: 'Quadratic Equations Practice', subject: 'Algebra', dueDate: '2025-07-24', description: 'Worksheet pages 12-18', submissions: { [students[2].id]: { status: 'submitted', grade: 'B+', submittedAt: '2025-07-21' } } },
  ];

  state.lessonPlans = [
    { id: uid('lp'), teacherId: t1.id, batchId: batch1.id, date: '2025-07-23', topic: 'Laws of Motion', objectives: 'Understand Newton\'s three laws', activities: 'Demo with carts, group discussion', homework: 'Problem set 1-10', quiz: '5 MCQ on Newton laws', status: 'ready' },
    { id: uid('lp'), teacherId: t2.id, batchId: batch2.id, date: '2025-07-24', topic: 'Quadratic Equations', objectives: 'Solve by factoring and formula', activities: 'Whiteboard examples, pair practice', homework: 'Worksheet pages 12-18', quiz: '3 short answer questions', status: 'draft' },
  ];

  state.certificates = [
    { id: uid('cert'), studentId: students[0].id, title: 'Physics Unit 1 Completion', issuedDate: '2025-07-01', type: 'completion' },
    { id: uid('cert'), studentId: students[0].id, title: 'Perfect Attendance — June', issuedDate: '2025-07-01', type: 'achievement' },
  ];

  state.skills = [
    { studentId: students[0].id, subject: 'Physics', level: 'Advanced', progress: 78 },
    { studentId: students[0].id, subject: 'Chemistry', level: 'Intermediate', progress: 65 },
    { studentId: students[1].id, subject: 'Physics', level: 'Intermediate', progress: 58 },
    { studentId: students[1].id, subject: 'Chemistry', level: 'Beginner', progress: 42 },
    { studentId: students[2].id, subject: 'Algebra', level: 'Intermediate', progress: 72 },
    { studentId: students[2].id, subject: 'Geometry', level: 'Beginner', progress: 55 },
  ];

  state.feedback = [
    { id: uid('fb'), studentId: students[0].id, teacherId: t1.id, date: '2025-07-18', message: 'Excellent participation. Keep pushing on problem-solving speed.', type: 'positive' },
    { id: uid('fb'), studentId: students[1].id, teacherId: t1.id, date: '2025-07-17', message: 'Needs more practice on chemical equations.', type: 'improvement' },
    { id: uid('fb'), studentId: students[2].id, teacherId: t2.id, date: '2025-07-16', message: 'Strong improvement in algebra.', type: 'positive' },
  ];

  state.projects = [
    { id: uid('proj'), studentId: students[0].id, batchId: batch1.id, title: 'Science Fair: Renewable Energy Model', status: 'in_progress', grade: null },
    { id: uid('proj'), studentId: students[2].id, batchId: batch2.id, title: 'Math Portfolio: Real-world Statistics', status: 'completed', grade: 'A' },
  ];

  state.interventions = [
    { id: uid('int'), studentId: students[1].id, title: 'Extra chemistry practice sessions', reason: 'Low progress in Chemical Reactions', status: 'active', priority: 'high', createdAt: '2025-07-17', actions: ['Schedule 2 remedial classes', 'Send homework reminders'] },
    { id: uid('int'), studentId: students[0].id, title: 'Maintain excellence streak', reason: 'Success score above 80', status: 'monitoring', priority: 'low', createdAt: '2025-07-18', actions: ['Assign advanced physics project'] },
  ];

  state.tutorAvailability = {
    [t1.id]: { days: ['mon', 'wed', 'fri'], hours: '14:00-20:00' },
    [t2.id]: { days: ['tue', 'thu', 'sat'], hours: '15:00-21:00' },
  };

  state.tutorPd = [
    { id: uid('pd'), teacherId: t1.id, title: 'Differentiated Instruction Workshop', type: 'course', hours: 6, date: '2025-07-10', status: 'completed' },
    { id: uid('pd'), teacherId: t2.id, title: 'Online Assessment Best Practices', type: 'webinar', hours: 2, date: '2025-07-15', status: 'completed' },
  ];

  state.parentPreferences = {
    [students[0].id]: { notifyAttendance: true, notifyTests: true, notifyHomework: true, notifyFeedback: true, preferredChannel: 'whatsapp', language: 'English' },
    [students[1].id]: { notifyAttendance: true, notifyTests: true, notifyHomework: false, notifyFeedback: true, preferredChannel: 'email', language: 'English' },
    [students[2].id]: { notifyAttendance: true, notifyTests: true, notifyHomework: true, notifyFeedback: true, preferredChannel: 'whatsapp', language: 'Hindi' },
  };

  if (!state.webhooks.length) {
    state.webhooks = [{ id: uid('wh'), url: 'https://hooks.example.com/eduos', events: ['student.created', 'attendance.marked'], active: true }];
  }
  if (!state.apiEventLog.length) {
    state.apiEventLog = [
      { id: uid('apilog'), method: 'GET', path: '/v1/students', status: 200, summary: 'GET /v1/students → 200', timestamp: new Date(Date.now() - 3600000).toISOString() },
    ];
  }
  const zoomMp = state.marketplace.find((i) => i.id === 'mp_zoom');
  if (zoomMp) zoomMp.installed = true;

  return state;
}

export function getAssignments(batchId) {
  const s = ensurePlatformData(getState());
  if (batchId) return s.assignments.filter((a) => a.batchId === batchId);
  return s.assignments;
}

export function saveAssignment(a) {
  const s = ensurePlatformData(getState());
  const idx = s.assignments.findIndex((x) => x.id === a.id);
  if (idx >= 0) s.assignments[idx] = a;
  else s.assignments.push({ ...a, id: uid('hw'), submissions: a.submissions || {} });
  persist();
}

export function deleteAssignment(id) {
  ensurePlatformData(getState()).assignments = getState().assignments.filter((a) => a.id !== id);
  persist();
}

export function getLessonPlans(teacherId) {
  const s = ensurePlatformData(getState());
  if (teacherId) return s.lessonPlans.filter((l) => l.teacherId === teacherId);
  return s.lessonPlans;
}

export function saveLessonPlan(lp) {
  const s = ensurePlatformData(getState());
  const idx = s.lessonPlans.findIndex((x) => x.id === lp.id);
  if (idx >= 0) s.lessonPlans[idx] = lp;
  else s.lessonPlans.push({ ...lp, id: uid('lp') });
  persist();
}

export function deleteLessonPlan(id) {
  ensurePlatformData(getState()).lessonPlans = getState().lessonPlans.filter((l) => l.id !== id);
  persist();
}

export function getCertificates(studentId) {
  const s = ensurePlatformData(getState());
  if (studentId) return s.certificates.filter((c) => c.studentId === studentId);
  return s.certificates;
}

export function saveCertificate(c) {
  ensurePlatformData(getState()).certificates.push({ ...c, id: uid('cert'), issuedDate: c.issuedDate || new Date().toISOString().slice(0, 10) });
  persist();
}

export function getSkills(studentId) {
  return ensurePlatformData(getState()).skills.filter((sk) => !studentId || sk.studentId === studentId);
}

export function getFeedback(studentId) {
  return ensurePlatformData(getState()).feedback.filter((f) => !studentId || f.studentId === studentId);
}

export function saveFeedback(fb) {
  const entry = { ...fb, id: uid('fb'), date: fb.date || new Date().toISOString().slice(0, 10) };
  ensurePlatformData(getState()).feedback.push(entry);
  persist();
  const student = getStudent(fb.studentId);
  const teacher = getTeachers().find((t) => t.id === fb.teacherId);
  if (student) {
    import('./communication.js').then(({ dispatchCommunicationEvent }) => {
      dispatchCommunicationEvent('feedback', {
        student: student.name,
        parent: student.parentName,
        parentPhone: student.parentPhone,
        parentEmail: student.parentEmail,
        teacher: teacher?.name || 'Teacher',
        message: fb.message,
      });
    });
  }
  return entry;
}

export function getProjects(studentId) {
  return ensurePlatformData(getState()).projects.filter((p) => !studentId || p.studentId === studentId);
}

export function getCommTemplates() {
  return ensurePlatformData(getState()).commTemplates;
}

export function getCommAutomations() {
  return ensurePlatformData(getState()).commAutomations;
}

export function toggleAutomation(id) {
  const auto = ensurePlatformData(getState()).commAutomations.find((a) => a.id === id);
  if (auto) auto.enabled = !auto.enabled;
  persist();
}

export function getMarketplace(type) {
  const items = ensurePlatformData(getState()).marketplace;
  if (type) return items.filter((i) => i.type === type);
  return items;
}

export function installMarketplaceItem(id) {
  const s = ensurePlatformData(getState());
  const item = s.marketplace.find((i) => i.id === id);
  if (!item) return null;
  item.installed = true;
  item.installedAt = new Date().toISOString().slice(0, 10);
  if (item.templatePayload && !s.commTemplates.some((t) => t.id === item.templatePayload.id)) {
    s.commTemplates.push({ ...item.templatePayload });
  }
  if (item.sdkId) {
    const sdk = s.sdkIntegrations.find((x) => x.id === item.sdkId);
    if (sdk) sdk.installed = true;
  }
  persist();
  return item;
}

export function uninstallMarketplaceItem(id) {
  const s = ensurePlatformData(getState());
  const item = s.marketplace.find((i) => i.id === id);
  if (!item) return null;
  item.installed = false;
  if (item.templatePayload) {
    s.commTemplates = s.commTemplates.filter((t) => t.id !== item.templatePayload.id);
  }
  if (item.sdkId) {
    const sdk = s.sdkIntegrations.find((x) => x.id === item.sdkId);
    if (sdk) sdk.installed = false;
  }
  persist();
  return item;
}

export function getInstalledMarketplaceItems() {
  return getMarketplace().filter((i) => i.installed);
}

export function getMarketplaceStats() {
  const items = getMarketplace();
  const installed = items.filter((i) => i.installed);
  return {
    total: items.length,
    installed: installed.length,
    integrations: items.filter((i) => i.type === 'integration').length,
    templates: items.filter((i) => i.type === 'template').length,
    partners: items.filter((i) => i.type === 'partner').length,
    byType: items.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {}),
  };
}

export function searchMarketplace(query, type) {
  let items = getMarketplace(type || undefined);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter((i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.author.toLowerCase().includes(q));
  }
  return items;
}

export function rateMarketplaceItem(id, rating) {
  const item = ensurePlatformData(getState()).marketplace.find((i) => i.id === id);
  if (item) item.rating = Math.min(5, Math.max(1, rating));
  persist();
}

export function getWebhooks() {
  return ensurePlatformData(getState()).webhooks;
}

export function saveWebhook(wh) {
  const s = ensurePlatformData(getState());
  if (wh.id) {
    const idx = s.webhooks.findIndex((w) => w.id === wh.id);
    if (idx >= 0) s.webhooks[idx] = wh;
  } else {
    s.webhooks.push({ ...wh, id: uid('wh'), active: true });
  }
  persist();
}

export function deleteWebhook(id) {
  ensurePlatformData(getState()).webhooks = getState().webhooks.filter((w) => w.id !== id);
  persist();
}

export function getApiKeys() {
  return ensurePlatformData(getState()).apiKeys;
}

export function createApiKey(name, scopes = ['read']) {
  const key = `edos_sk_${Math.random().toString(36).slice(2, 18)}`;
  ensurePlatformData(getState()).apiKeys.push({
    id: uid('key'),
    name: name || 'API Key',
    key,
    scopes,
    createdAt: new Date().toISOString().slice(0, 10),
  });
  persist();
  return key;
}

export function revokeApiKey(id) {
  ensurePlatformData(getState()).apiKeys = getState().apiKeys.filter((k) => k.id !== id);
  persist();
}

export function toggleWebhook(id) {
  const wh = ensurePlatformData(getState()).webhooks.find((w) => w.id === id);
  if (wh) wh.active = !wh.active;
  persist();
}

export function getApiEventLog() {
  return ensurePlatformData(getState()).apiEventLog || [];
}

export function logApiEvent(entry) {
  const s = ensurePlatformData(getState());
  s.apiEventLog.unshift({ ...entry, id: uid('apilog'), timestamp: new Date().toISOString() });
  if (s.apiEventLog.length > 100) s.apiEventLog = s.apiEventLog.slice(0, 100);
  persist();
}

export const API_ENDPOINTS = [
  { method: 'GET', path: '/v1/students', desc: 'List all students' },
  { method: 'GET', path: '/v1/students/:id', desc: 'Get student by ID' },
  { method: 'POST', path: '/v1/students', desc: 'Create student' },
  { method: 'GET', path: '/v1/batches', desc: 'List batches' },
  { method: 'POST', path: '/v1/attendance', desc: 'Mark attendance' },
  { method: 'GET', path: '/v1/leads', desc: 'List CRM leads' },
  { method: 'POST', path: '/v1/leads', desc: 'Create lead' },
  { method: 'GET', path: '/v1/tests', desc: 'List tests' },
];

export const WEBHOOK_EVENTS = [
  'student.created', 'student.updated', 'attendance.marked', 'test.recorded',
  'lead.created', 'lead.converted', 'assignment.submitted', 'message.sent',
];

export function simulateApiCall(method, path) {
  let status = 200;
  let data = {};

  if (path.includes('/students') && method === 'GET') {
    data = { students: getStudents(), count: getStudents().length };
  } else if (path.includes('/batches')) {
    data = { batches: getBatches(), count: getBatches().length };
  } else if (path.includes('/leads')) {
    const leads = getState().leads || [];
    data = { leads, count: leads.length };
  } else if (path.includes('/tests')) {
    data = { tests: getTests(), count: getTests().length };
  } else if (method === 'POST') {
    data = { success: true, id: uid('sim'), message: 'Resource created (simulated)' };
  } else {
    status = 404;
    data = { error: 'Endpoint not found in simulator' };
  }

  logApiEvent({ method, path, status, summary: `${method} ${path} → ${status}` });
  return { status, data, latencyMs: Math.floor(Math.random() * 80) + 20 };
}

function defaultSdkIntegrations() {
  return [
    { id: 'sdk_js', name: 'JavaScript SDK', version: '1.2.0', installed: true, command: 'npm install @eduos/sdk', docs: 'https://docs.eduos.app/sdk/js' },
    { id: 'sdk_py', name: 'Python SDK', version: '1.1.0', installed: false, command: 'pip install eduos-sdk', docs: 'https://docs.eduos.app/sdk/python' },
    { id: 'sdk_zapier', name: 'Zapier', version: '1.0.0', installed: false, command: 'Connect via Zapier marketplace', docs: 'https://zapier.com/apps/eduos' },
    { id: 'sdk_zoom', name: 'Zoom Connector', version: '2.0.1', installed: true, command: 'OAuth connect in Settings', docs: 'https://docs.eduos.app/integrations/zoom' },
    { id: 'sdk_gcal', name: 'Google Calendar', version: '1.3.0', installed: false, command: 'OAuth connect in Settings', docs: 'https://docs.eduos.app/integrations/google-calendar' },
    { id: 'sdk_openai', name: 'OpenAI', version: '1.0.0', installed: true, command: 'Add API key in Settings', docs: 'https://docs.eduos.app/integrations/openai' },
    { id: 'sdk_twilio', name: 'Twilio SMS', version: '1.0.0', installed: false, command: 'Configure in Communication Hub', docs: 'https://docs.eduos.app/integrations/twilio' },
    { id: 'sdk_stripe', name: 'Stripe', version: '0.9.0', installed: false, command: 'Coming with Payments layer', docs: 'https://docs.eduos.app/integrations/stripe' },
  ];
}

export function getSdkIntegrations() {
  return ensurePlatformData(getState()).sdkIntegrations;
}

export function toggleSdkIntegration(id) {
  const sdk = ensurePlatformData(getState()).sdkIntegrations.find((s) => s.id === id);
  if (sdk) sdk.installed = !sdk.installed;
  persist();
}

export function getDeveloperStats() {
  return {
    apiKeys: getApiKeys().length,
    webhooks: getWebhooks().length,
    activeWebhooks: getWebhooks().filter((w) => w.active !== false).length,
    apiCalls: getApiEventLog().length,
    sdksInstalled: getSdkIntegrations().filter((s) => s.installed).length,
  };
}

export function getTutorAvailability(teacherId) {
  return ensurePlatformData(getState()).tutorAvailability[teacherId] || { days: [], hours: '' };
}

export function saveTutorAvailability(teacherId, data) {
  ensurePlatformData(getState()).tutorAvailability[teacherId] = data;
  persist();
}

export function getPublicSite() {
  return ensurePlatformData(getState()).publicSite;
}

export function savePublicSite(data) {
  Object.assign(ensurePlatformData(getState()).publicSite, data);
  persist();
}

export function computeSuccessScore(studentId) {
  const student = getStudent(studentId);
  if (!student) return null;
  const att = getStudentAttendanceStats(studentId);
  const tests = getStudentTestStats(studentId);
  const curriculum = getBatchProgress(student.batchId);
  const skills = getSkills(studentId);
  const assignments = getAssignments().filter((a) => a.submissions?.[studentId]);
  const submitted = assignments.filter((a) => a.submissions[studentId]?.status === 'submitted').length;
  const hwRate = assignments.length ? Math.round((submitted / assignments.length) * 100) : 70;
  const skillAvg = skills.length ? Math.round(skills.reduce((s, k) => s + k.progress, 0) / skills.length) : 50;

  const score = Math.round(att.rate * 0.25 + (tests.avg || 50) * 0.3 + curriculum.percent * 0.2 + hwRate * 0.15 + skillAvg * 0.1);

  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (att.rate >= 85) strengths.push('Strong attendance consistency');
  else { weaknesses.push('Attendance needs improvement'); recommendations.push('Set up parent reminders for missed classes'); }
  if ((tests.avg || 0) >= 75) strengths.push('Good test performance');
  else { weaknesses.push('Test scores below target'); recommendations.push('Schedule extra practice for weak topics'); }
  if (hwRate >= 80) strengths.push('Homework completion on track');
  else { weaknesses.push('Missing homework submissions'); recommendations.push('Send homework reminders via WhatsApp'); }
  for (const sk of skills.filter((s) => s.progress < 50)) {
    weaknesses.push(`Low progress in ${sk.subject}`);
    recommendations.push(`Assign targeted ${sk.subject} practice`);
  }
  if (!strengths.length) strengths.push('Engaged in learning program');
  if (!recommendations.length) recommendations.push('Continue current learning path');

  return { score, strengths, weaknesses, recommendations, breakdown: { attendance: att.rate, tests: tests.avg, curriculum: curriculum.percent, homework: hwRate, skills: skillAvg } };
}

export function generateLessonPlanAI(topic) {
  return {
    objectives: `Students will understand key concepts of ${topic}`,
    activities: `1. Warm-up recap (10 min)\n2. Interactive explanation of ${topic} (25 min)\n3. Group practice (20 min)\n4. Q&A summary (5 min)`,
    homework: `Complete practice exercises on ${topic}`,
    quiz: `5 questions on ${topic} — MCQ and short answer`,
  };
}

export function getInterventions(studentId) {
  const list = ensurePlatformData(getState()).interventions;
  if (studentId) return list.filter((i) => i.studentId === studentId);
  return list;
}

export function saveIntervention(intervention) {
  const s = ensurePlatformData(getState());
  const idx = s.interventions.findIndex((i) => i.id === intervention.id);
  if (idx >= 0) s.interventions[idx] = intervention;
  else s.interventions.push({ ...intervention, id: uid('int'), createdAt: intervention.createdAt || new Date().toISOString().slice(0, 10), status: intervention.status || 'active' });
  persist();
}

export function resolveIntervention(id) {
  const item = ensurePlatformData(getState()).interventions.find((i) => i.id === id);
  if (item) item.status = 'resolved';
  persist();
}

export function buildLearningJourney(studentId) {
  const student = getStudent(studentId);
  if (!student) return [];
  const events = [];
  const att = getStudentAttendanceStats(studentId);
  for (const r of att.records.slice(0, 8)) {
    events.push({ date: r.date, type: 'attendance', label: `Attendance: ${r.status}`, icon: r.status === 'present' ? '✓' : r.status === 'absent' ? '✗' : '⏰' });
  }
  for (const t of getStudentTestStats(studentId).results.slice(0, 6)) {
    events.push({ date: t.date, type: 'test', label: `${t.test}: ${t.score}/${t.max} (${t.pct}%)`, icon: '📝' });
  }
  for (const a of getAssignments().filter((x) => x.submissions?.[studentId])) {
    const sub = a.submissions[studentId];
    events.push({ date: sub.submittedAt || a.dueDate, type: 'homework', label: `${a.title}: ${sub.status}${sub.grade ? ' · ' + sub.grade : ''}`, icon: '📚' });
  }
  for (const f of getFeedback(studentId)) {
    events.push({ date: f.date, type: 'feedback', label: `Feedback: ${f.message.slice(0, 60)}${f.message.length > 60 ? '…' : ''}`, icon: '💬' });
  }
  for (const c of getCertificates(studentId)) {
    events.push({ date: c.issuedDate, type: 'certificate', label: `Certificate: ${c.title}`, icon: '🏆' });
  }
  for (const p of getProjects(studentId)) {
    events.push({ date: p.completedAt || new Date().toISOString().slice(0, 10), type: 'project', label: `Project: ${p.title} (${p.status})`, icon: '🔬' });
  }
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export function submitAssignment(assignmentId, studentId) {
  const a = ensurePlatformData(getState()).assignments.find((x) => x.id === assignmentId);
  if (!a) return null;
  a.submissions = a.submissions || {};
  const today = new Date().toISOString().slice(0, 10);
  const late = today > a.dueDate;
  a.submissions[studentId] = { status: late ? 'late' : 'submitted', submittedAt: today };
  persist();
  return a.submissions[studentId];
}

export function gradeAssignment(assignmentId, studentId, grade) {
  const a = ensurePlatformData(getState()).assignments.find((x) => x.id === assignmentId);
  if (!a?.submissions?.[studentId]) return null;
  a.submissions[studentId].grade = grade;
  persist();
  return a.submissions[studentId];
}

export function updateSkillProgress(studentId, subject, progress) {
  const s = ensurePlatformData(getState());
  let sk = s.skills.find((k) => k.studentId === studentId && k.subject === subject);
  if (sk) sk.progress = Math.min(100, Math.max(0, progress));
  else s.skills.push({ studentId, subject, level: progress >= 70 ? 'Advanced' : progress >= 45 ? 'Intermediate' : 'Beginner', progress });
  persist();
}

export function updateProjectStatus(projectId, status, grade) {
  const p = ensurePlatformData(getState()).projects.find((x) => x.id === projectId);
  if (!p) return null;
  p.status = status;
  if (grade) p.grade = grade;
  if (status === 'completed') p.completedAt = new Date().toISOString().slice(0, 10);
  persist();
  return p;
}

export function generateInterventionPlan(studentId) {
  const success = computeSuccessScore(studentId);
  const student = getStudent(studentId);
  if (!success || !student) return [];
  const plans = [];
  for (const w of success.weaknesses) {
    plans.push({
      studentId,
      title: `Address: ${w}`,
      reason: w,
      priority: success.score < 60 ? 'high' : 'medium',
      status: 'active',
      actions: success.recommendations.slice(0, 2),
    });
  }
  if (!plans.length) {
    plans.push({
      studentId,
      title: 'Continue enrichment path',
      reason: 'Student performing well across metrics',
      priority: 'low',
      status: 'monitoring',
      actions: ['Assign stretch project', 'Celebrate achievements with parents'],
    });
  }
  return plans;
}

export function applyInterventionPlan(studentId) {
  const plans = generateInterventionPlan(studentId);
  for (const p of plans) saveIntervention(p);
  import('./communication.js').then(({ dispatchCommunicationEvent }) => {
    const student = getStudent(studentId);
    if (!student) return;
    dispatchCommunicationEvent('intervention', {
      student: student.name,
      parent: student.parentName,
      parentPhone: student.parentPhone,
      parentEmail: student.parentEmail,
      summary: `Intervention plan created for ${student.name}: ${plans.map((p) => p.title).join('; ')}`,
    });
  });
  return plans;
}

export function generateParentSummary(studentId) {
  const student = getStudent(studentId);
  const batch = getBatch(student?.batchId);
  const success = computeSuccessScore(studentId);
  if (!student || !success) return '';
  const skills = getSkills(studentId);
  const pendingHw = getAssignments().filter((a) => a.batchId === student.batchId && a.submissions?.[studentId]?.status === 'pending').length;
  const recentFb = getFeedback(studentId)[0];

  return `Progress Summary — ${student.name}
Batch: ${batch?.name || 'N/A'}
Success Score: ${success.score}/100

Attendance: ${success.breakdown.attendance}%
Test Average: ${success.breakdown.tests || 'N/A'}%
Homework Completion: ${success.breakdown.homework}%
Curriculum Progress: ${success.breakdown.curriculum}%

Strengths: ${success.strengths.join('; ')}
Areas to improve: ${success.weaknesses.length ? success.weaknesses.join('; ') : 'None flagged'}
Recommendations: ${success.recommendations.join('; ')}

Skills: ${skills.map((s) => `${s.subject} (${s.progress}%)`).join(', ') || 'Not tracked'}
Pending homework: ${pendingHw}
${recentFb ? `Latest teacher feedback (${recentFb.date}): ${recentFb.message}` : ''}

— ${getState().settings.tutorName}`;
}

export function getAllStudentsSuccessOverview() {
  return getStudents().map((s) => {
    const success = computeSuccessScore(s.id);
    const batch = getBatch(s.batchId);
    return {
      id: s.id,
      name: s.name,
      batch: batch?.name,
      score: success?.score ?? 0,
      attendance: success?.breakdown?.attendance ?? 0,
      tests: success?.breakdown?.tests ?? 0,
      homework: success?.breakdown?.homework ?? 0,
      interventions: getInterventions(s.id).filter((i) => i.status === 'active').length,
      risk: (success?.score ?? 100) < 60 ? 'high' : (success?.score ?? 100) < 75 ? 'medium' : 'low',
    };
  }).sort((a, b) => a.score - b.score);
}

export async function sendParentSummary(studentId) {
  const summary = generateParentSummary(studentId);
  const student = getStudent(studentId);
  if (!student) return [];
  const { dispatchCommunicationEvent } = await import('./communication.js');
  return dispatchCommunicationEvent('parent_summary', {
    student: student.name,
    parent: student.parentName,
    parentPhone: student.parentPhone,
    parentEmail: student.parentEmail,
    summary,
  });
}

export async function checkHomeworkReminders() {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dueSoon = getAssignments().filter((a) => a.dueDate === tomorrow);
  const { dispatchCommunicationEvent } = await import('./communication.js');
  const results = [];
  for (const a of dueSoon) {
    for (const s of getStudents(a.batchId)) {
      const sub = a.submissions?.[s.id];
      if (sub?.status === 'submitted') continue;
      results.push(...(await dispatchCommunicationEvent('homework_due', {
        student: s.name,
        parent: s.parentName,
        parentPhone: s.parentPhone,
        parentEmail: s.parentEmail,
        assignment: a.title,
        dueDate: a.dueDate,
      })));
    }
  }
  return results;
}

export function computeTutorPerformance(teacherId) {
  const teacher = getTeacher(teacherId);
  if (!teacher) return null;
  const report = getTeacherReport(teacherId);
  const batches = getBatches().filter((b) => b.teacherId === teacherId);
  const students = batches.flatMap((b) => getStudents(b.id));
  const plans = getLessonPlans(teacherId);
  const delivered = plans.filter((p) => p.status === 'delivered').length;

  let attSum = 0;
  let testSum = 0;
  let testCount = 0;
  for (const s of students) {
    attSum += getStudentAttendanceStats(s.id).rate;
    const t = getStudentTestStats(s.id);
    if (t.avg) { testSum += t.avg; testCount++; }
  }
  const avgAtt = students.length ? Math.round(attSum / students.length) : 0;
  const avgTest = testCount ? Math.round(testSum / testCount) : 0;

  let hwTotal = 0;
  let hwGraded = 0;
  for (const a of getAssignments().filter((x) => batches.some((b) => b.id === x.batchId))) {
    for (const s of students) {
      const sub = a.submissions?.[s.id];
      if (sub && (sub.status === 'submitted' || sub.status === 'late')) {
        hwTotal++;
        if (sub.grade) hwGraded++;
      }
    }
  }
  const hwReviewRate = hwTotal ? Math.round((hwGraded / hwTotal) * 100) : 100;
  const curriculum = report?.completionRate ?? 0;
  const planScore = plans.length ? Math.round(((delivered + plans.filter((p) => p.status === 'ready').length) / plans.length) * 100) : 80;

  const score = Math.round(avgAtt * 0.2 + avgTest * 0.2 + curriculum * 0.2 + hwReviewRate * 0.2 + planScore * 0.2);

  const strengths = [];
  const improvements = [];
  const recommendations = [];
  if (avgAtt >= 80) strengths.push('Students maintain strong attendance');
  else { improvements.push('Student attendance below target'); recommendations.push('Coordinate with parents on absenteeism'); }
  if (avgTest >= 75) strengths.push('Solid student test outcomes');
  else { improvements.push('Class test averages need lift'); recommendations.push('Add remedial sessions for weak topics'); }
  if (hwReviewRate >= 85) strengths.push('Timely homework grading');
  else { improvements.push('Homework grading backlog'); recommendations.push('Block 30 min daily for homework review'); }
  if (curriculum >= 70) strengths.push('Curriculum on track');
  else recommendations.push('Accelerate session completion to stay on syllabus');
  if (!strengths.length) strengths.push('Active teaching engagement');
  if (!recommendations.length) recommendations.push('Continue current teaching approach');

  return {
    score,
    breakdown: { avgAttendance: avgAtt, avgTests: avgTest, curriculum, hwReviewRate, lessonPlans: plans.length, delivered, batches: batches.length, students: students.length },
    strengths,
    improvements,
    recommendations,
    report,
  };
}

export function getAllTutorsOverview() {
  return getTeachers().map((t) => {
    const perf = computeTutorPerformance(t.id);
    const batches = getBatches().filter((b) => b.teacherId === t.id);
    return {
      id: t.id,
      name: t.name,
      subjects: (t.subjects || []).join(', '),
      batches: batches.length,
      students: batches.reduce((s, b) => s + getStudents(b.id).length, 0),
      score: perf?.score ?? 0,
      upcoming: getUpcomingSessions(batches, 7).length,
      pendingReview: getHomeworkToReview(t.id).length,
      lessonPlans: getLessonPlans(t.id).length,
    };
  }).sort((a, b) => a.score - b.score);
}

export function markLessonPlanDelivered(id) {
  const lp = ensurePlatformData(getState()).lessonPlans.find((l) => l.id === id);
  if (!lp) return null;
  lp.status = 'delivered';
  lp.deliveredAt = new Date().toISOString().slice(0, 10);
  persist();
  return lp;
}

export function getHomeworkToReview(teacherId) {
  const batchIds = getBatches().filter((b) => b.teacherId === teacherId).map((b) => b.id);
  const items = [];
  for (const a of getAssignments().filter((x) => batchIds.includes(x.batchId))) {
    for (const s of getStudents(a.batchId)) {
      const sub = a.submissions?.[s.id];
      if (sub && (sub.status === 'submitted' || sub.status === 'late') && !sub.grade) {
        items.push({ assignmentId: a.id, assignmentTitle: a.title, batchId: a.batchId, studentId: s.id, studentName: s.name, status: sub.status, submittedAt: sub.submittedAt });
      }
    }
  }
  return items;
}

export function getTutorPd(teacherId) {
  return ensurePlatformData(getState()).tutorPd.filter((p) => p.teacherId === teacherId);
}

export function saveTutorPdEntry(entry) {
  ensurePlatformData(getState()).tutorPd.push({
    ...entry,
    id: uid('pd'),
    date: entry.date || new Date().toISOString().slice(0, 10),
    status: entry.status || 'completed',
  });
  persist();
}

export function getTutorSchedule(teacherId) {
  const batches = getBatches().filter((b) => b.teacherId === teacherId);
  return getUpcomingSessions(batches, 14);
}

function defaultParentPreferences() {
  return { notifyAttendance: true, notifyTests: true, notifyHomework: true, notifyFeedback: true, preferredChannel: 'whatsapp', language: 'English' };
}

export function getParentPreferences(studentId) {
  const prefs = ensurePlatformData(getState()).parentPreferences[studentId];
  return prefs ? { ...defaultParentPreferences(), ...prefs } : defaultParentPreferences();
}

export function saveParentPreferences(studentId, prefs) {
  ensurePlatformData(getState()).parentPreferences[studentId] = { ...getParentPreferences(studentId), ...prefs };
  persist();
}

export function getParentMessages(studentId) {
  const student = getStudent(studentId);
  if (!student) return [];
  const digits = String(student.parentPhone || '').replace(/\D/g, '').slice(-10);
  return getState().messages.filter((m) => {
    if (m.meta?.studentId === studentId) return true;
    if (!digits) return false;
    return String(m.to || '').replace(/\D/g, '').slice(-10) === digits;
  }).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function getParentAttendanceHistory(studentId) {
  return getStudentAttendanceStats(studentId).records.sort((a, b) => b.date.localeCompare(a.date));
}

export function getParentDashboard(studentId) {
  const student = getStudent(studentId);
  if (!student) return null;
  const batch = getBatch(student.batchId);
  const teacher = batch?.teacherId ? getTeacher(batch.teacherId) : null;
  const success = computeSuccessScore(studentId);
  const upcoming = getUpcomingSessions([batch].filter(Boolean), 5);
  const assignments = getAssignments(student.batchId);
  const pendingHw = assignments.filter((a) => (a.submissions?.[studentId]?.status || 'pending') === 'pending').length;
  return {
    student,
    batch,
    teacher,
    success,
    upcoming,
    pendingHw,
    assignments,
    feedback: getFeedback(studentId),
    certificates: getCertificates(studentId),
    tests: getStudentTestStats(studentId).results,
    journey: buildLearningJourney(studentId).slice(0, 5),
  };
}

export function getParentInquiries(studentId) {
  return ensurePlatformData(getState()).parentInquiries.filter((q) => q.studentId === studentId);
}

export async function contactTeacherFromParent(studentId, message) {
  const student = getStudent(studentId);
  const batch = getBatch(student?.batchId);
  const teacher = batch?.teacherId ? getTeacher(batch.teacherId) : null;
  if (!student || !message.trim()) return [];

  ensurePlatformData(getState()).parentInquiries.push({
    id: uid('inq'),
    studentId,
    message: message.trim(),
    date: new Date().toISOString().slice(0, 10),
    status: 'sent',
    teacherId: teacher?.id,
  });
  persist();

  const { sendViaChannel } = await import('./communication.js');
  const results = [];
  const body = `Parent message from ${student.parentName} (student: ${student.name}):\n\n${message.trim()}`;
  if (teacher?.phone) {
    results.push(await sendViaChannel('whatsapp', { to: teacher.phone, message: body, type: 'parent_inquiry', meta: { studentId, teacherId: teacher.id } }));
  }
  if (student.parentPhone) {
    results.push(await sendViaChannel(getParentPreferences(studentId).preferredChannel || 'whatsapp', {
      to: student.parentPhone,
      message: `Your message was sent to ${teacher?.name || 'the teacher'}. We'll respond soon.`,
      type: 'parent_inquiry_ack',
      meta: { studentId },
    }));
  }
  return results;
}

export function saveAIConversation(role, userMessage, assistantReply, action) {
  const s = ensurePlatformData(getState());
  s.aiHistory.unshift({
    id: uid('aih'),
    role,
    userMessage,
    assistantReply,
    action: action || null,
    timestamp: new Date().toISOString(),
  });
  if (s.aiHistory.length > 100) s.aiHistory = s.aiHistory.slice(0, 100);
  persist();
}

export function getAIHistory(role) {
  const history = ensurePlatformData(getState()).aiHistory;
  if (role) return history.filter((h) => h.role === role);
  return history;
}

export function clearAIHistory(role) {
  const s = ensurePlatformData(getState());
  s.aiHistory = role ? s.aiHistory.filter((h) => h.role !== role) : [];
  persist();
}
