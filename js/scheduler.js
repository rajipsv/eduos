const DAY_LABELS = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };
const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function formatTime(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatScheduleLabel(days, startTime, endTime) {
  if (!days?.length) return 'No schedule set';
  const labels = days.map((d) => DAY_LABELS[d] || d);
  return `${labels.join(', ')} · ${formatTime(startTime)}–${formatTime(endTime)}`;
}

function randomCode(length = 3) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function randomDigits(length = 10) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

export function generateMeetingLink(platform, batchName, index) {
  const slug = batchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);
  const code = `${randomCode(3)}-${randomCode(4)}-${randomCode(3)}`;

  if (platform === 'zoom') {
    return `https://zoom.us/j/${randomDigits(10)}?pwd=${randomDigits(6)}`;
  }
  if (platform === 'teams') {
    return `https://teams.microsoft.com/l/meetup-join/19%3Ameeting_${randomDigits(8)}`;
  }
  return `https://meet.google.com/${code}`;
}

export function normalizeSession(session) {
  if (!session) return session;
  const s = { ...session };
  if (!s.status) {
    if (s.cancelled) s.status = 'cancelled';
    else if (s.completed) s.status = 'completed';
    else s.status = 'scheduled';
  }
  s.completed = s.status === 'completed';
  return s;
}

export function isScheduledSession(session, today = new Date().toISOString().slice(0, 10)) {
  const s = normalizeSession(session);
  return s.status === 'scheduled' && s.date >= today;
}

export function sessionStatusBadge(session) {
  const s = normalizeSession(session);
  if (s.status === 'cancelled') return '<span class="badge badge-red">Cancelled</span>';
  if (s.status === 'completed') return '<span class="badge badge-green">Done</span>';
  if (s.rescheduledFrom) return '<span class="badge badge-orange">Rescheduled</span>';
  return '';
}

export function generateSchedule({
  topics,
  scheduleDays,
  startTime,
  endTime,
  startDate,
  meetingPlatform = 'google-meet',
  batchName = 'batch',
  existingSessions = [],
}) {
  const cleanTopics = topics.map((t) => t.trim()).filter(Boolean);
  if (!cleanTopics.length || !scheduleDays?.length || !startDate) return [];

  const targetDays = scheduleDays.map((d) => DAY_INDEX[d.toLowerCase()]).filter((d) => d != null);
  const sessions = [];
  const current = new Date(startDate + 'T12:00:00');
  let topicIndex = 0;
  let safety = 0;

  while (topicIndex < cleanTopics.length && safety < 400) {
    if (targetDays.includes(current.getDay())) {
      const dateStr = current.toISOString().slice(0, 10);
      const existing = existingSessions.find((s) => s.date === dateStr && s.topic === cleanTopics[topicIndex]);
      sessions.push({
        id: existing?.id || `session_${Date.now()}_${topicIndex}_${Math.random().toString(36).slice(2, 6)}`,
        date: dateStr,
        topic: cleanTopics[topicIndex],
        startTime,
        endTime,
        meetingLink: existing?.meetingLink || generateMeetingLink(meetingPlatform, batchName, topicIndex),
        status: existing?.status || (existing?.completed ? 'completed' : existing?.cancelled ? 'cancelled' : 'scheduled'),
        completed: existing?.completed || false,
        cancelReason: existing?.cancelReason || '',
        rescheduleReason: existing?.rescheduleReason || '',
        rescheduledFrom: existing?.rescheduledFrom || null,
      });
      sessions[sessions.length - 1] = normalizeSession(sessions[sessions.length - 1]);
      topicIndex++;
    }
    current.setDate(current.getDate() + 1);
    safety++;
  }

  return sessions;
}

export function getUpcomingSessions(batches, limit = 20) {
  const today = new Date().toISOString().slice(0, 10);
  return getAllSessions(batches, { includeCompleted: false, includeCancelled: false })
    .filter((s) => s.date >= today)
    .slice(0, limit);
}

export function getAllSessions(batches, { includeCompleted = true, includeCancelled = true, batchId = null } = {}) {
  const list = (batchId ? batches.filter((b) => b.id === batchId) : batches).flatMap((batch) =>
    (batch.sessions || []).map((session) => normalizeSession({ ...session, batchId: batch.id, batchName: batch.name }))
  );
  return list
    .filter((s) => (includeCompleted || s.status !== 'completed') && (includeCancelled || s.status !== 'cancelled'))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
}

export function getSessionProgress(sessions) {
  const list = (sessions || []).map(normalizeSession).filter((s) => s.status !== 'cancelled');
  if (!list.length) return { total: 0, completed: 0, percent: 0 };
  const completed = list.filter((s) => s.status === 'completed').length;
  return {
    total: list.length,
    completed,
    percent: Math.round((completed / list.length) * 100),
  };
}

export function dayPickerHtml(selectedDays = [], prefix = 'day') {
  return `<div class="day-picker" id="${prefix}Picker">
    ${WEEKDAYS.map(
      (d) =>
        `<button type="button" class="day-chip ${selectedDays.includes(d) ? 'active' : ''}" data-day="${d}">${DAY_LABELS[d]}</button>`
    ).join('')}
  </div>`;
}

export function bindDayPicker(containerId, onChange) {
  const picker = document.getElementById(containerId);
  if (!picker) return () => [];

  picker.querySelectorAll('.day-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      onChange?.(getSelectedDays(containerId));
    });
  });

  return () => getSelectedDays(containerId);
}

export function getSelectedDays(containerId) {
  const picker = document.getElementById(containerId);
  if (!picker) return [];
  return [...picker.querySelectorAll('.day-chip.active')].map((c) => c.dataset.day);
}

export function sessionsPreviewHtml(sessions, editable = false) {
  if (!sessions.length) {
    return '<p class="empty-state" style="padding:20px">Add topics and click Generate Schedule to preview classes.</p>';
  }

  return `<div class="table-wrap schedule-preview">
    <table>
      <thead><tr><th>#</th><th>Date</th><th>Topic</th><th>Time</th><th>Meeting Link</th>${editable ? '<th>Done</th>' : ''}</tr></thead>
      <tbody>
        ${sessions
          .map(
            (s, i) => `<tr data-session-id="${s.id}">
              <td>${i + 1}</td>
              <td>${s.date}</td>
              <td>${s.topic}</td>
              <td>${formatTime(s.startTime)}–${formatTime(s.endTime)}</td>
              <td>${editable ? `<input class="meeting-link-input" data-session-link="${s.id}" value="${s.meetingLink}">` : `<a href="${s.meetingLink}" target="_blank" class="link-btn">Join Class</a>`}</td>
              ${editable ? `<td><input type="checkbox" data-session-done="${s.id}" ${s.completed ? 'checked' : ''}></td>` : ''}
            </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>`;
}
