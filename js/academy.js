import { getBatches, getStudents, getTeachers, getTests, getAttendanceHistory } from './store.js';
import { getAllSessions, getUpcomingSessions } from './scheduler.js';

export function getAcademyStats() {
  const batches = getBatches();
  const students = getStudents();
  const teachers = getTeachers();
  const today = new Date().toISOString().slice(0, 10);
  const sessions = getAllSessions(batches);
  const upcoming = getUpcomingSessions(batches, 100).length;
  const completed = sessions.filter((s) => s.completed).length;
  const todayClasses = sessions.filter((s) => s.date === today && !s.completed).length;
  const capacityPct = batches.length
    ? Math.round(
        batches.reduce((sum, b) => {
          const cap = b.capacity || 1;
          return sum + (getStudents(b.id).length / cap) * 100;
        }, 0) / batches.length
      )
    : 0;
  const fullBatches = batches.filter((b) => getStudents(b.id).length >= (b.capacity || 999)).length;

  return {
    batches: batches.length,
    students: students.length,
    teachers: teachers.length,
    upcoming,
    completed,
    todayClasses,
    capacityPct,
    fullBatches,
    tests: getTests().length,
    attendanceSessions: getAttendanceHistory().filter((a) => a.date === today).length,
  };
}

export function academyBanner(title, description) {
  return `<div class="vision-banner"><h3>${title}</h3><p>${description}</p></div>`;
}

const STAT_LABELS = {
  batches: 'Batches',
  students: 'Students',
  teachers: 'Teachers',
  upcoming: 'Upcoming classes',
  todayClasses: 'Classes today',
  capacityPct: 'Avg capacity',
  fullBatches: 'Full batches',
  tests: 'Tests recorded',
  attendanceSessions: 'Attendance today',
  completed: 'Classes completed',
};

export function academyStatsGrid(keys) {
  const stats = getAcademyStats();
  return `<div class="stats-grid">${keys
    .map((k) => {
      const val = stats[k];
      const display = k === 'capacityPct' ? `${val}%` : val;
      return `<div class="stat-card"><div class="label">${STAT_LABELS[k] || k}</div><div class="value">${display}</div></div>`;
    })
    .join('')}</div>`;
}
