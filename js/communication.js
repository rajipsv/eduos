import { addMessage, getState, persist } from './store.js';
import { getCommTemplates, getCommAutomations } from './platform.js';
import { sendWhatsApp } from './whatsapp.js';
import { formatTime } from './scheduler.js';

export const COMM_EVENTS = {
  attendance_absent: 'Student absent',
  attendance_late: 'Student late',
  homework_due: 'Homework due in 24h',
  test_result: 'Test marks recorded',
  class_upcoming: 'Class in 24 hours',
  feedback: 'Teacher feedback posted',
  intervention: 'Intervention plan created',
  parent_summary: 'Parent progress summary',
};

function uid() {
  return `comm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getCommSettings() {
  const s = getState();
  if (!s.commSettings) s.commSettings = defaultCommSettings();
  return s.commSettings;
}

export function defaultCommSettings() {
  return {
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
}

export function saveCommSettings(partial) {
  Object.assign(getCommSettings(), partial);
  persist();
}

export function fillTemplate(body, vars) {
  return String(body).replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

export async function sendViaChannel(channel, { to, message, type = 'general', meta = {} }) {
  const ch = channel.toLowerCase();

  if (ch === 'whatsapp') {
    const result = await sendWhatsApp({ to, message, type, meta });
    return { ...result, channel: 'whatsapp' };
  }

  const record = {
    to,
    message,
    type,
    channel: ch,
    status: 'sent',
    simulated: true,
    meta,
  };

  if (ch === 'email') record.subject = meta.subject || `Update from ${getState().settings.tutorName}`;
  if (ch === 'voice' && !getCommSettings().voiceEnabled) record.status = 'skipped';

  addMessage(record);
  return record;
}

export async function dispatchCommunicationEvent(eventKey, payload = {}) {
  const settings = getCommSettings();
  if (eventKey === 'attendance_absent' && !settings.autoOnAttendance) return [];
  if (eventKey === 'test_result' && !settings.autoOnTests) return [];
  if (eventKey === 'homework_due' && !settings.autoOnHomework) return [];
  if (eventKey === 'feedback' && !settings.autoOnFeedback) return [];

  const automations = getCommAutomations().filter((a) => a.enabled && matchesEvent(a, eventKey));
  const templates = getCommTemplates();
  const results = [];

  for (const auto of automations) {
    const tpl = templates.find((t) => t.id === auto.templateId);
    const body = tpl ? fillTemplate(tpl.body, payload) : buildFallbackMessage(eventKey, payload);

    for (const channel of auto.channels) {
      const to = resolveRecipient(channel, payload);
      if (!to) continue;
      results.push(await sendViaChannel(channel, {
        to,
        message: body,
        type: eventKey,
        meta: { ...payload, automationId: auto.id, event: eventKey },
      }));
    }
  }
  return results;
}

function matchesEvent(auto, eventKey) {
  const tpl = getCommTemplates().find((t) => t.id === auto.templateId);
  if (tpl?.event === eventKey) return true;
  return auto.eventKey === eventKey;
}

function resolveRecipient(channel, payload) {
  if (channel === 'email') return payload.parentEmail || payload.email;
  if (channel === 'push') return payload.parentPhone || payload.studentId;
  return payload.parentPhone || payload.phone || payload.to;
}

function buildFallbackMessage(eventKey, p) {
  const academy = getState().settings.tutorName;
  if (eventKey === 'attendance_absent') return `Dear ${p.parent}, ${p.student} was absent on ${p.date}. — ${academy}`;
  if (eventKey === 'test_result') return `${p.student} scored ${p.score}/${p.max} on ${p.test}. — ${academy}`;
  if (eventKey === 'homework_due') return `Reminder: ${p.assignment} is due ${p.dueDate} for ${p.student}. — ${academy}`;
  if (eventKey === 'class_upcoming') return `Class tomorrow: ${p.topic} at ${p.time}. Join: ${p.link}`;
  if (eventKey === 'attendance_late') return `Dear ${p.parent}, ${p.student} arrived late on ${p.date}. — ${academy}`;
  if (eventKey === 'intervention') return p.summary || `Intervention plan update for ${p.student}. — ${academy}`;
  if (eventKey === 'feedback') return `Feedback for ${p.student} from ${p.teacher}: ${p.message}`;
  if (eventKey === 'parent_summary') return p.summary;
  return `Update from ${academy} regarding ${p.student || 'your child'}.`;
}

export function saveCommTemplate(tpl) {
  const s = getState();
  const idx = s.commTemplates.findIndex((t) => t.id === tpl.id);
  if (idx >= 0) s.commTemplates[idx] = tpl;
  else s.commTemplates.push({ ...tpl, id: tpl.id || uid() });
  persist();
}

export function saveCommAutomation(auto) {
  const s = getState();
  const idx = s.commAutomations.findIndex((a) => a.id === auto.id);
  if (idx >= 0) s.commAutomations[idx] = auto;
  else s.commAutomations.push({ ...auto, id: auto.id || uid(), eventKey: auto.eventKey || 'attendance_absent' });
  persist();
}

export function getCommStats() {
  const messages = getState().messages || [];
  const byChannel = {};
  for (const m of messages) {
    const ch = m.channel || 'whatsapp';
    byChannel[ch] = (byChannel[ch] || 0) + 1;
  }
  const automations = getCommAutomations();
  return {
    total: messages.length,
    sent: messages.filter((m) => m.status === 'sent').length,
    byChannel,
    activeAutomations: automations.filter((a) => a.enabled).length,
    totalAutomations: automations.length,
  };
}

export async function runClassReminders() {
  const { getBatches, getStudents } = await import('./store.js');
  const { getUpcomingSessions } = await import('./scheduler.js');
  const batches = getBatches();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const sessions = getUpcomingSessions(batches, 50).filter((s) => s.date === tomorrow);
  const results = [];

  for (const session of sessions) {
    const students = getStudents(session.batchId);
    for (const student of students) {
      const payload = {
        student: student.name,
        parent: student.parentName,
        parentPhone: student.parentPhone,
        parentEmail: student.parentEmail,
        topic: session.topic,
        time: formatTime(session.startTime),
        link: session.meetingLink,
        date: session.date,
      };
      results.push(...(await dispatchCommunicationEvent('class_upcoming', payload)));
    }
  }
  return results;
}

export async function broadcastToParents(message, channels = ['whatsapp']) {
  const { getStudents } = await import('./store.js');
  const results = [];
  for (const s of getStudents()) {
    for (const ch of channels) {
      const to = ch === 'email' ? s.parentEmail : s.parentPhone;
      if (!to) continue;
      results.push(await sendViaChannel(ch, { to, message, type: 'announcement', meta: { studentId: s.id } }));
    }
  }
  return results;
}

export function buildAttendancePayload(student, batch, date, status) {
  return {
    student: student.name,
    parent: student.parentName,
    parentPhone: student.parentPhone,
    parentEmail: student.parentEmail,
    date,
    status,
    batch: batch?.name,
  };
}

export function buildTestPayload(student, test, score) {
  return {
    student: student.name,
    parent: student.parentName,
    parentPhone: student.parentPhone,
    parentEmail: student.parentEmail,
    test: test.name,
    score,
    max: test.maxMarks,
  };
}
