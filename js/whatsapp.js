import { addMessage, getState, isDatabaseMode } from './store.js';
import { apiFetch } from './api-client.js';

function formatPhone(phone, countryCode) {
  const digits = String(phone).replace(/\D/g, '');
  const code = (countryCode || '+91').replace(/\D/g, '');
  if (digits.startsWith(code)) return digits;
  return code + digits;
}

export function buildAttendanceMessage(student, batch, date, status) {
  const statusText = { present: 'was present', absent: 'was absent', late: 'arrived late' }[status] || status;
  return `Dear ${student.parentName},

This is an update from ${getState().settings.tutorName}.

${student.name} ${statusText} for ${batch?.name || 'class'} on ${date}.

Thank you,
${getState().settings.tutorName}`;
}

export function buildTestResultMessage(student, test, score) {
  const pct = Math.round((score / test.maxMarks) * 100);
  let remark = 'Keep practicing!';
  if (pct >= 90) remark = 'Excellent performance! 🌟';
  else if (pct >= 75) remark = 'Good work! Keep it up.';
  else if (pct >= 50) remark = 'Room for improvement — let\'s work together.';

  return `Dear ${student.parentName},

Test result for ${student.name}:

📋 Test: ${test.name}
📚 Subject: ${test.subject}
📅 Date: ${test.date}
📊 Score: ${score}/${test.maxMarks} (${pct}%)

${remark}

— ${getState().settings.tutorName}`;
}

export function buildBulkAnnouncement(title, body) {
  return `${title}

${body}

— ${getState().settings.tutorName}`;
}

export async function sendWhatsApp({ to, message, type = 'general', meta = {} }) {
  const settings = getState().settings;
  const phone = formatPhone(to, settings.defaultCountryCode);

  const record = {
    to: phone,
    message,
    type,
    channel: 'whatsapp',
    status: 'pending',
    meta,
  };

  if (isDatabaseMode()) {
    // The server sends with the center's WhatsApp token; it reports "simulated" when none is set.
    try {
      const res = await apiFetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'sent') {
        record.status = 'sent';
        if (data.simulated) record.simulated = true;
        if (data.providerId) record.providerId = data.providerId;
      } else {
        record.status = 'failed';
        record.error = data.error || `HTTP ${res.status}`;
      }
    } catch (err) {
      record.status = 'failed';
      record.error = err.message;
    }
  } else {
    // Browser-only demo: messages are simulated.
    record.status = 'sent';
    record.simulated = true;
  }

  addMessage(record);
  return record;
}

export async function sendTestResultsToParents(test, students) {
  const { dispatchCommunicationEvent, buildTestPayload } = await import('./communication.js');
  const results = [];
  for (const student of students) {
    const score = test.marks[student.id];
    if (score == null || !student.parentPhone) continue;
    const sent = await dispatchCommunicationEvent('test_result', buildTestPayload(student, test, score));
    results.push(...sent);
  }
  return results;
}

export async function sendAttendanceUpdate(student, batch, date, status) {
  if (!student.parentPhone) return null;
  const message = buildAttendanceMessage(student, batch, date, status);
  return sendWhatsApp({
    to: student.parentPhone,
    message,
    type: 'attendance',
    meta: { studentId: student.id, date, status },
  });
}

/** A wa.me link that opens WhatsApp with `message` ready to send to `phone`. */
export function waMeLink(phone, message, countryCode) {
  return `https://wa.me/${formatPhone(phone, countryCode)}?text=${encodeURIComponent(message)}`;
}

export function openWhatsAppWeb(phone, message, countryCode) {
  window.open(waMeLink(phone, message, countryCode), '_blank');
}
