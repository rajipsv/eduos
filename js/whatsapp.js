import { addMessage, getState } from './store.js';

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

  if (settings.whatsappApiKey && settings.whatsappPhoneId) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${settings.whatsappPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${settings.whatsappApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: message },
          }),
        }
      );

      if (response.ok) {
        record.status = 'sent';
        const data = await response.json();
        record.providerId = data.messages?.[0]?.id;
      } else {
        record.status = 'failed';
        record.error = await response.text();
      }
    } catch (err) {
      record.status = 'failed';
      record.error = err.message;
    }
  } else {
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

export function openWhatsAppWeb(phone, message, countryCode) {
  const formatted = formatPhone(phone, countryCode);
  const url = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}
