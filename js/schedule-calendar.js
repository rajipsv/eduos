import { formatTime, normalizeSession } from './scheduler.js';

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function getMondayOfWeek(dateInput = new Date()) {
  const d = typeof dateInput === 'string' ? new Date(`${dateInput}T12:00:00`) : new Date(dateInput);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getWeekDates(weekStartMonday) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartMonday, i));
}

export function formatWeekRange(weekStartMonday) {
  const end = addDays(weekStartMonday, 6);
  const startLabel = formatShortDate(weekStartMonday);
  const endLabel = formatShortDate(end);
  return `${startLabel} – ${endLabel}`;
}

export function formatShortDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function sessionsInWeek(sessions, weekStartMonday) {
  const dates = new Set(getWeekDates(weekStartMonday));
  return sessions
    .map((s) => normalizeSession(s))
    .filter((s) => dates.has(s.date))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
}

function sessionCardClass(session) {
  const s = normalizeSession(session);
  if (s.status === 'cancelled') return 'schedule-cal-event schedule-cal-event-cancelled';
  if (s.status === 'completed') return 'schedule-cal-event schedule-cal-event-done';
  return 'schedule-cal-event schedule-cal-event-upcoming';
}

function sessionCardHtml(session) {
  const s = normalizeSession(session);
  const time = `${formatTime(s.startTime)}${s.endTime ? `–${formatTime(s.endTime)}` : ''}`;
  return `
    <button
      type="button"
      class="${sessionCardClass(s)}"
      data-action="open-session"
      data-batch="${s.batchId}"
      data-session="${s.id}"
      title="${s.batchName} · ${s.topic}"
    >
      <span class="schedule-cal-event-time">${time}</span>
      <span class="schedule-cal-event-topic">${s.topic}</span>
      <span class="schedule-cal-event-batch">${s.batchName}</span>
    </button>`;
}

export function renderWeekCalendarHtml(sessions, weekStartMonday) {
  const weekDates = getWeekDates(weekStartMonday);
  const today = new Date().toISOString().slice(0, 10);
  const byDate = Object.fromEntries(weekDates.map((d) => [d, []]));
  sessionsInWeek(sessions, weekStartMonday).forEach((s) => {
    if (byDate[s.date]) byDate[s.date].push(s);
  });

  return `
    <div class="schedule-cal" data-week-start="${weekStartMonday}">
      <div class="schedule-cal-nav">
        <button type="button" class="btn btn-sm btn-secondary" data-action="cal-prev-week">← Previous</button>
        <strong class="schedule-cal-range">${formatWeekRange(weekStartMonday)}</strong>
        <button type="button" class="btn btn-sm btn-secondary" data-action="cal-next-week">Next →</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="cal-this-week">This week</button>
      </div>
      <div class="schedule-cal-grid">
        ${weekDates.map((dateStr, i) => `
          <div class="schedule-cal-day${dateStr === today ? ' schedule-cal-day-today' : ''}">
            <div class="schedule-cal-day-head">
              <span class="schedule-cal-dow">${SHORT_DAYS[i]}</span>
              <span class="schedule-cal-date">${formatShortDate(dateStr)}</span>
            </div>
            <div class="schedule-cal-day-body">
              ${byDate[dateStr].length
    ? byDate[dateStr].map(sessionCardHtml).join('')
    : '<span class="schedule-cal-empty">—</span>'}
            </div>
          </div>`).join('')}
      </div>
      <p class="schedule-cal-legend">
        <span class="schedule-cal-legend-item"><i class="dot dot-green"></i> Scheduled</span>
        <span class="schedule-cal-legend-item"><i class="dot dot-gray"></i> Done</span>
        <span class="schedule-cal-legend-item"><i class="dot dot-red"></i> Cancelled</span>
      </p>
    </div>`;
}
