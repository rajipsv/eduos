import {
  getStudents, getStudent, getBatches, getBatch, getTeachers, getTeacher, getUpcomingSessions, getMessages, getState, saveLead,
  addLeadActivity,
} from './store.js';
import { openWhatsAppWeb } from './whatsapp.js';
import {
  getAssignments, saveAssignment, deleteAssignment,
  getLessonPlans, saveLessonPlan, deleteLessonPlan, generateLessonPlanAI,
  getCertificates, saveCertificate,
  getSkills, getFeedback, saveFeedback, getProjects,
  computeSuccessScore,
  getCommTemplates, getCommAutomations, toggleAutomation,
  getMarketplace, installMarketplaceItem, uninstallMarketplaceItem, getInstalledMarketplaceItems,
  getMarketplaceStats, searchMarketplace, rateMarketplaceItem, marketplaceBrowseOrder,
  getMarketplaceTypeLabel, getMarketplaceInstallHint, getMarketplaceInstallMessage, getMarketplaceActionLabel,
  getSdkIntegrations, toggleSdkIntegration,
  getTutorAvailability, saveTutorAvailability, formatTutorAvailabilitySummary, getPublicSite, savePublicSite,
  getInterventions, saveIntervention, resolveIntervention, buildLearningJourney,
  submitAssignment, gradeAssignment, generateInterventionPlan, applyInterventionPlan,
  generateParentSummary, sendParentSummary, getAllStudentsSuccessOverview,
  checkHomeworkReminders,
  computeTutorPerformance, getAllTutorsOverview, markLessonPlanDelivered,
  getHomeworkToReview, getTutorPd, saveTutorPdEntry, getTutorSchedule,
  getParentDashboard, getParentAttendanceHistory, getParentPreferences,
  saveParentPreferences, getParentMessages, contactTeacherFromParent, getParentInquiries,
} from './platform.js';
import {
  getCommStats, saveCommSettings, getCommSettings, saveCommTemplate, saveCommAutomation,
  sendViaChannel, runClassReminders, broadcastToParents, COMM_EVENTS,
} from './communication.js';
import { formatTime, dayPickerHtml, bindDayPicker, getSelectedDays } from './scheduler.js';
import { getRecentWebInquiries } from './crm.js';
import { academyBanner } from './academy.js';
import { getEffectiveRole, getLinkedTeacherId } from './auth.js';

function canManageStudentSuccess() {
  const role = getEffectiveRole();
  return role === 'center_admin' || role === 'teacher' || role === 'platform_owner';
}

function studentSuccessManageToolbar(students, selectedId, selectId = 'ssStudent') {
  return `
    <div class="toolbar">
      <select id="${selectId}">${students.map((s) => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
      <button class="btn btn-primary" data-action="add-hw">+ Assignment</button>
      <button class="btn btn-secondary" data-action="issue-cert">Issue Certificate</button>
      <button class="btn btn-secondary" data-action="add-feedback">+ Feedback</button>
    </div>`;
}

export const layerPageMeta = {
  studentSuccess: { title: 'Student Success', subtitle: 'Learning journey, skills, interventions' },
  tutorHub: { title: 'Tutor Success', subtitle: 'Performance, lesson plans, homework review, PD' },
  parentPortal: { title: 'Parent Portal', subtitle: 'Progress, homework, attendance, fees, messages' },
  commHub: { title: 'Communication Hub', subtitle: 'Email, SMS, WhatsApp, push automations' },
  marketplace: { title: 'Extensions & Partners', subtitle: 'Connect tools, ops templates, and partner services' },
  publicSite: { title: 'Public Website', subtitle: 'Marketing page and inquiry capture to CRM' },
};

export function renderLayerView(view) {
  const map = {
    studentSuccess: renderStudentSuccess,
    tutorHub: renderTutorHub,
    parentPortal: renderParentPortal,
    commHub: renderCommHub,
    marketplace: renderMarketplace,
    publicSite: renderPublicSite,
  };
  return map[view]?.() || '';
}

export function bindLayerEvents(view, ctx) {
  const binders = {
    studentSuccess: bindStudentSuccessEvents,
    tutorHub: bindTutorHubEvents,
    parentPortal: bindParentPortalEvents,
    commHub: bindCommHubEvents,
    marketplace: bindMarketplaceEvents,
    publicSite: bindPublicSiteEvents,
  };
  binders[view]?.(ctx);
}

function renderStudentSuccess() {
  const students = getStudents();
  const sel = students[0]?.id || '';
  const role = getEffectiveRole();

  if (role === 'parent') {
    return `
      <div class="vision-banner"><h3>Homework</h3><p>View your child's assignments, due dates, and grades.</p></div>
      <div class="toolbar">
        <label>Child:</label>
        <select id="ssStudent">${students.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
      </div>
      <div id="ssContent">${parentHomeworkView(sel)}</div>`;
  }

  if (role === 'student') {
    return `
      <div class="vision-banner"><h3>My Homework</h3><p>Your assignments and submission status.</p></div>
      <div id="ssContent">${studentSuccessAssignments(sel, { mode: 'student' })}</div>`;
  }

  if (!canManageStudentSuccess()) {
    return '<div class="panel"><div class="panel-body empty-state"><h4>Access restricted</h4><p>This page is not available for your role.</p></div></div>';
  }

  return `
    <div class="vision-banner"><h3>Student Success Engine</h3><p>Track learning journeys, trigger interventions, and send parent progress summaries — all in one place.</p></div>
    ${studentSuccessManageToolbar(students, sel)}
    <div class="report-tabs">
      <button class="report-tab active" data-ss-tab="overview">Overview</button>
      <button class="report-tab" data-ss-tab="journey">Journey</button>
      <button class="report-tab" data-ss-tab="interventions">Interventions</button>
      <button class="report-tab" data-ss-tab="assignments">Assignments</button>
      <button class="report-tab" data-ss-tab="parent">Parent Summary</button>
    </div>
    <div id="ssContent">${studentSuccessOverview(sel)}</div>`;
}

function studentSuccessOverview(selectedId) {
  const rows = getAllStudentsSuccessOverview();
  const detailId = selectedId || rows[0]?.id || '';
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Students tracked</div><div class="value">${rows.length}</div></div>
      <div class="stat-card"><div class="label">At-risk (&lt;60)</div><div class="value">${rows.filter((r) => r.risk === 'high').length}</div></div>
      <div class="stat-card"><div class="label">Active interventions</div><div class="value">${rows.reduce((s, r) => s + r.interventions, 0)}</div></div>
      <div class="stat-card"><div class="label">Avg success score</div><div class="value">${rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0}</div></div>
    </div>
    <div class="panel" style="margin-top:16px">
      <div class="panel-header"><h3>All Students</h3></div>
      <div class="panel-body table-wrap">
        <table><thead><tr><th>Student</th><th>Batch</th><th>Score</th><th>Attendance</th><th>Tests</th><th>Homework</th><th>Risk</th><th>Interventions</th></tr></thead>
        <tbody>${rows.map((r) => `<tr data-ss-row="${r.id}" style="cursor:pointer">
          <td>${r.name}</td><td>${r.batch || '—'}</td><td><strong>${r.score}</strong></td>
          <td>${r.attendance}%</td><td>${r.tests || '—'}${r.tests ? '%' : ''}</td><td>${r.homework}%</td>
          <td><span class="badge ${r.risk === 'high' ? 'badge-red' : r.risk === 'medium' ? 'badge-orange' : 'badge-green'}">${r.risk}</span></td>
          <td>${r.interventions || '—'}</td></tr>`).join('') || '<tr><td colspan="8">No students</td></tr>'}</tbody></table>
      </div>
    </div>
    <div id="ssStudentDetail">${studentSuccessDetail(detailId)}</div>`;
}

function studentSuccessDetail(studentId) {
  if (!studentId) return '<div class="empty-state">Add students first</div>';
  const student = getStudent(studentId);
  const success = computeSuccessScore(studentId);
  const skills = getSkills(studentId);
  const certs = getCertificates(studentId);
  const projects = getProjects(studentId);

  return `
    <div class="panel" style="margin-top:16px">
      <div class="panel-header"><h3>${student.name} — Success Profile</h3></div>
      <div class="panel-body">
        <div class="stats-grid">
          <div class="stat-card"><div class="label">Success Score</div><div class="value">${success.score}</div></div>
          <div class="stat-card"><div class="label">Attendance</div><div class="value">${success.breakdown.attendance}%</div></div>
          <div class="stat-card"><div class="label">Test Avg</div><div class="value">${success.breakdown.tests || '—'}${success.breakdown.tests ? '%' : ''}</div></div>
          <div class="stat-card"><div class="label">Curriculum</div><div class="value">${success.breakdown.curriculum}%</div></div>
        </div>
        <div class="grid-2" style="margin-top:16px">
          <div>
            <h4 style="font-size:0.85rem;margin:0 0 6px">Strengths</h4>
            ${success.strengths.map((s) => `<div class="insight-item" style="background:var(--primary-soft);border-color:rgba(45,106,79,0.2)">${s}</div>`).join('')}
          </div>
          <div>
            <h4 style="font-size:0.85rem;margin:0 0 6px">Recommendations</h4>
            ${success.recommendations.map((r) => `<div class="insight-item">${r}</div>`).join('')}
          </div>
        </div>
        <h4 style="font-size:0.85rem;margin:16px 0 8px">Skills & Projects</h4>
        <table><thead><tr><th>Subject</th><th>Level</th><th>Progress</th></tr></thead>
        <tbody>${skills.map((sk) => `<tr><td>${sk.subject}</td><td>${sk.level}</td><td><div class="progress-bar" style="width:80px"><span style="width:${sk.progress}%"></span></div> ${sk.progress}%</td></tr>`).join('') || '<tr><td colspan="3">No skills tracked</td></tr>'}</tbody></table>
        ${projects.map((p) => `<div class="session-row"><div class="session-info"><h4>${p.title}</h4><p>${p.status}${p.grade ? ' · Grade ' + p.grade : ''}</p></div></div>`).join('') || ''}
        ${certs.map((c) => `<span class="badge badge-green" style="margin:6px 6px 0 0">${c.title}</span>`).join('')}
      </div>
    </div>`;
}

function studentSuccessJourney(studentId) {
  if (!studentId) return '<div class="empty-state">Select a student</div>';
  const events = buildLearningJourney(studentId);
  const student = getStudent(studentId);
  const success = computeSuccessScore(studentId);
  return `
    <div class="panel"><div class="panel-header"><h3>Learning Journey — ${student?.name}</h3></div>
    <div class="panel-body">
      <p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 16px">Curriculum progress: ${success.breakdown.curriculum}%</p>
      <div class="progress-bar" style="margin-bottom:20px"><span style="width:${success.breakdown.curriculum}%"></span></div>
      ${events.length ? events.map((e) => `
        <div class="session-row"><div class="session-info"><h4>${e.icon} ${e.label}</h4><p>${e.date} · ${e.type}</p></div></div>`).join('') : '<p class="empty-state">No journey events yet — add attendance, tests, and homework.</p>'}
    </div></div>`;
}

function studentSuccessInterventions(studentId) {
  if (!studentId) return '<div class="empty-state">Select a student</div>';
  const student = getStudent(studentId);
  const interventions = getInterventions(studentId);
  const suggested = generateInterventionPlan(studentId);
  return `
    <div class="toolbar">
      <button class="btn btn-primary" data-action="apply-intervention">Generate & Apply Plan</button>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><h3>Active Interventions — ${student?.name}</h3></div>
        <div class="panel-body">
          ${interventions.length ? interventions.map((i) => `
            <div class="batch-card" style="margin-bottom:10px">
              <h4>${i.title}</h4>
              <div class="meta">${i.reason} · <span class="badge ${i.priority === 'high' ? 'badge-red' : i.priority === 'medium' ? 'badge-orange' : 'badge-green'}">${i.priority}</span> · ${i.status}</div>
              <ul style="font-size:0.82rem;margin:8px 0;padding-left:18px">${(i.actions || []).map((a) => `<li>${a}</li>`).join('')}</ul>
              ${i.status === 'active' ? `<button class="btn btn-sm btn-secondary" data-action="resolve-int" data-id="${i.id}">Mark resolved</button>` : ''}
            </div>`).join('') : '<p class="empty-state">No interventions yet — generate a plan from success data.</p>'}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Suggested Actions</h3></div>
        <div class="panel-body">
          ${suggested.map((s) => `<div class="insight-item"><strong>${s.title}</strong><br><span style="font-size:0.82rem">${s.reason}</span></div>`).join('')}
        </div>
      </div>
    </div>`;
}

function studentSuccessAssignments(studentId, { mode = 'admin' } = {}) {
  if (!studentId) return '<div class="empty-state">Select a student</div>';
  const student = getStudent(studentId);
  const assignments = getAssignments().filter((a) => a.batchId === student?.batchId);
  const actionCell = (a, sub) => {
    if (mode === 'student' && sub.status === 'pending') {
      return `<button class="btn btn-sm btn-primary" data-action="submit-hw" data-id="${a.id}">Submit</button>`;
    }
    if (mode !== 'admin') return '';
    if (sub.status === 'pending') {
      return `<button class="btn btn-sm btn-primary" data-action="submit-hw" data-id="${a.id}">Submit</button>`;
    }
    if (sub.status !== 'pending' && !sub.grade) {
      return `<button class="btn btn-sm btn-secondary" data-action="grade-hw" data-id="${a.id}">Grade</button>`;
    }
    return '';
  };
  return `
    <div class="panel"><div class="panel-header"><h3>Homework & Assignments — ${student?.name}</h3></div>
    <div class="panel-body table-wrap">
      <table><thead><tr><th>Assignment</th><th>Subject</th><th>Due</th><th>Status</th><th>Grade</th>${mode === 'admin' || mode === 'student' ? '<th></th>' : ''}</tr></thead>
      <tbody>${assignments.map((a) => {
        const sub = a.submissions?.[studentId] || { status: 'pending' };
        return `<tr><td>${a.title}</td><td>${a.subject}</td><td>${a.dueDate}</td>
          <td><span class="badge ${sub.status === 'submitted' ? 'badge-green' : sub.status === 'late' ? 'badge-red' : 'badge-orange'}">${sub.status}</span></td>
          <td>${sub.grade || '—'}</td>
          ${mode === 'admin' || mode === 'student' ? `<td>${actionCell(a, sub)}</td>` : ''}</tr>`;
      }).join('') || `<tr><td colspan="${mode === 'admin' || mode === 'student' ? 6 : 5}">No assignments</td></tr>`}</tbody></table>
    </div></div>`;
}

function studentSuccessParentSummary(studentId) {
  if (!studentId) return '<div class="empty-state">Select a student</div>';
  const summary = generateParentSummary(studentId);
  const student = getStudent(studentId);
  return `
    <div class="panel"><div class="panel-header"><h3>Parent Summary — ${student?.name}</h3>
      <button class="btn btn-sm btn-primary" data-action="send-parent-summary">Send to Parents</button></div>
    <div class="panel-body">
      <pre style="white-space:pre-wrap;font-family:inherit;font-size:0.88rem;line-height:1.6;background:var(--surface-2);padding:16px;border-radius:var(--radius-sm)">${summary}</pre>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-top:12px">Sends via configured automations (email + WhatsApp) through the Communication Engine.</p>
    </div></div>`;
}

function ssTabContent(tab, studentId) {
  if (tab === 'overview') return studentSuccessOverview(studentId);
  if (tab === 'journey') return studentSuccessJourney(studentId);
  if (tab === 'interventions') return studentSuccessInterventions(studentId);
  if (tab === 'assignments') return studentSuccessAssignments(studentId);
  if (tab === 'parent') return studentSuccessParentSummary(studentId);
  return studentSuccessOverview();
}

function renderTutorHub() {
  const teachers = getTeachers();
  const students = getStudents();
  const linkedTeacherId = getLinkedTeacherId();
  const sel = (linkedTeacherId && teachers.some((t) => t.id === linkedTeacherId))
    ? linkedTeacherId
    : (teachers[0]?.id || '');
  const studentSel = students[0]?.id || '';
  const manage = canManageStudentSuccess()
    ? studentSuccessManageToolbar(students, studentSel, 'tutorStudent')
    : '';
  return `
    <div class="vision-banner"><h3>Tutor Success Platform</h3><p>Performance insights, lesson planning, homework review, schedule, and professional development — all in one tutor workspace.</p></div>
    <div class="toolbar">
      <select id="tutorSel">${teachers.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
      <button class="btn btn-primary" data-action="gen-lesson">AI Lesson Plan</button>
      <button class="btn btn-secondary" data-action="add-lesson">+ Lesson Plan</button>
    </div>
    ${manage}
    <div class="report-tabs">
      <button class="report-tab active" data-tutor-tab="overview">Overview</button>
      <button class="report-tab" data-tutor-tab="performance">Performance</button>
      <button class="report-tab" data-tutor-tab="lessons">Lesson Plans</button>
      <button class="report-tab" data-tutor-tab="homework">Homework</button>
      <button class="report-tab" data-tutor-tab="schedule">Schedule</button>
      <button class="report-tab" data-tutor-tab="development">Development</button>
    </div>
    <div id="tutorContent">${tutorOverview(sel)}</div>`;
}

function tutorTabContent(tab, teacherId) {
  if (tab === 'overview') return tutorOverview(teacherId);
  if (tab === 'performance') return tutorPerformanceView(teacherId);
  if (tab === 'lessons') return tutorLessonsView(teacherId);
  if (tab === 'homework') return tutorHomeworkView(teacherId);
  if (tab === 'schedule') return tutorScheduleView(teacherId);
  if (tab === 'development') return tutorDevelopmentView(teacherId);
  return tutorOverview(teacherId);
}

function tutorOverview(selectedId) {
  const rows = getAllTutorsOverview();
  const detailId = selectedId || rows[0]?.id || '';
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Tutors</div><div class="value">${rows.length}</div></div>
      <div class="stat-card"><div class="label">Pending homework reviews</div><div class="value">${rows.reduce((s, r) => s + r.pendingReview, 0)}</div></div>
      <div class="stat-card"><div class="label">Upcoming classes (7d)</div><div class="value">${rows.reduce((s, r) => s + r.upcoming, 0)}</div></div>
      <div class="stat-card"><div class="label">Avg tutor score</div><div class="value">${rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0}</div></div>
    </div>
    <div class="panel" style="margin-top:16px">
      <div class="panel-header"><h3>All Tutors</h3></div>
      <div class="panel-body table-wrap">
        <table><thead><tr><th>Tutor</th><th>Subjects</th><th>Batches</th><th>Students</th><th>Score</th><th>Pending Review</th><th>Upcoming</th></tr></thead>
        <tbody>${rows.map((r) => `<tr data-tutor-row="${r.id}" style="cursor:pointer">
          <td>${r.name}</td><td>${r.subjects || '—'}</td><td>${r.batches}</td><td>${r.students}</td>
          <td><strong>${r.score}</strong></td><td>${r.pendingReview || '—'}</td><td>${r.upcoming}</td></tr>`).join('') || '<tr><td colspan="7">No tutors</td></tr>'}</tbody></table>
      </div>
    </div>
    <div id="tutorDetail">${tutorProfileCard(detailId)}</div>`;
}

function availabilitySlotsDisplayHtml(slots) {
  if (!slots?.length) {
    return '<p class="empty-state" style="padding:8px 0">No availability slots yet.</p>';
  }
  return `<ul class="avail-slots-list">${slots.map((s, i) => `
    <li class="avail-slot-item">
      <span class="avail-slot-label">Slot ${i + 1}</span>
      <span>${formatTutorAvailabilitySummary({ slots: [s] })}</span>
    </li>`).join('')}</ul>`;
}

function tutorProfileCard(teacherId) {
  if (!teacherId) return '';
  const teacher = getTeacher(teacherId);
  const perf = computeTutorPerformance(teacherId);
  const avail = getTutorAvailability(teacherId);
  if (!teacher || !perf) return '';
  return `
    <div class="panel" style="margin-top:16px">
      <div class="panel-header"><h3>${teacher.name} — Tutor Profile</h3></div>
      <div class="panel-body">
        <div class="stats-grid">
          <div class="stat-card"><div class="label">Performance Score</div><div class="value">${perf.score}</div></div>
          <div class="stat-card"><div class="label">Students</div><div class="value">${perf.breakdown.students}</div></div>
          <div class="stat-card"><div class="label">Curriculum</div><div class="value">${perf.breakdown.curriculum}%</div></div>
          <div class="stat-card"><div class="label">HW Review Rate</div><div class="value">${perf.breakdown.hwReviewRate}%</div></div>
        </div>
        <p style="margin-top:12px;font-size:0.85rem"><strong>Availability:</strong> ${formatTutorAvailabilitySummary(avail)}</p>
      </div>
    </div>`;
}

function tutorPerformanceView(teacherId) {
  const teacher = getTeacher(teacherId);
  const perf = computeTutorPerformance(teacherId);
  if (!teacher || !perf) return '<div class="empty-state">Select a tutor</div>';
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Performance Score</div><div class="value">${perf.score}</div></div>
      <div class="stat-card"><div class="label">Student Attendance</div><div class="value">${perf.breakdown.avgAttendance}%</div></div>
      <div class="stat-card"><div class="label">Test Average</div><div class="value">${perf.breakdown.avgTests || '—'}${perf.breakdown.avgTests ? '%' : ''}</div></div>
      <div class="stat-card"><div class="label">Lesson Plans Delivered</div><div class="value">${perf.breakdown.delivered}/${perf.breakdown.lessonPlans}</div></div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="panel"><div class="panel-header"><h3>Strengths</h3></div><div class="panel-body">
        ${perf.strengths.map((s) => `<div class="insight-item" style="background:var(--primary-soft)">${s}</div>`).join('')}
      </div></div>
      <div class="panel"><div class="panel-header"><h3>Recommendations</h3></div><div class="panel-body">
        ${perf.recommendations.map((r) => `<div class="insight-item">${r}</div>`).join('')}
        ${perf.improvements.length ? `<h4 style="font-size:0.85rem;margin-top:12px">Areas to improve</h4>${perf.improvements.map((i) => `<div class="insight-item">${i}</div>`).join('')}` : ''}
      </div></div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Batch Progress</h3></div><div class="panel-body table-wrap">
      <table><thead><tr><th>Batch</th><th>Students</th><th>Progress</th></tr></thead>
      <tbody>${(perf.report?.batches || []).map((b) => `<tr><td>${b.name}</td><td>${b.students}</td><td><div class="progress-bar" style="width:100px"><span style="width:${b.progress}%"></span></div> ${b.progress}%</td></tr>`).join('') || '<tr><td colspan="3">No batches assigned</td></tr>'}</tbody></table>
    </div></div>`;
}

function tutorLessonsView(teacherId) {
  const plans = getLessonPlans(teacherId);
  return `
    <div class="panel"><div class="panel-header"><h3>Lesson Plans</h3></div><div class="panel-body">
      ${plans.map((lp) => `
        <div class="batch-card" style="margin-bottom:10px">
          <h4>${lp.topic} · ${lp.date}</h4>
          <div class="meta">${getBatch(lp.batchId)?.name || ''} · <span class="badge ${lp.status === 'delivered' ? 'badge-green' : lp.status === 'ready' ? 'badge-orange' : 'badge-gray'}">${lp.status}</span></div>
          <p style="font-size:0.82rem;margin:8px 0"><strong>Objectives:</strong> ${lp.objectives || '—'}</p>
          ${lp.activities ? `<p style="font-size:0.82rem;margin:4px 0"><strong>Activities:</strong> ${lp.activities.slice(0, 120)}${lp.activities.length > 120 ? '…' : ''}</p>` : ''}
          ${lp.homework ? `<p style="font-size:0.82rem;margin:4px 0"><strong>Homework:</strong> ${lp.homework}</p>` : ''}
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            ${lp.status !== 'delivered' ? `<button class="btn btn-sm btn-primary" data-action="deliver-lesson" data-id="${lp.id}">Mark delivered</button>` : ''}
            <button class="btn btn-sm btn-secondary" data-action="view-lesson" data-id="${lp.id}">View</button>
            <button class="btn btn-sm btn-danger" data-action="del-lesson" data-id="${lp.id}">Delete</button>
          </div>
        </div>`).join('') || '<p class="empty-state">No lesson plans yet — use AI or add manually.</p>'}
    </div></div>`;
}

function tutorHomeworkView(teacherId) {
  const toReview = getHomeworkToReview(teacherId);
  const batches = getBatches().filter((b) => b.teacherId === teacherId);
  const allHw = getAssignments().filter((a) => batches.some((b) => b.id === a.batchId));
  return `
    <div class="panel"><div class="panel-header"><h3>Pending Review (${toReview.length})</h3></div>
    <div class="panel-body table-wrap">
      <table><thead><tr><th>Student</th><th>Assignment</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
      <tbody>${toReview.map((item) => `<tr>
        <td>${item.studentName}</td><td>${item.assignmentTitle}</td>
        <td><span class="badge badge-orange">${item.status}</span></td><td>${item.submittedAt || '—'}</td>
        <td><button class="btn btn-sm btn-primary" data-action="grade-hw-tutor" data-aid="${item.assignmentId}" data-sid="${item.studentId}">Grade</button></td>
      </tr>`).join('') || '<tr><td colspan="5">All caught up — no submissions waiting</td></tr>'}</tbody></table>
    </div></div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>All Assignments</h3></div>
    <div class="panel-body table-wrap">
      <table><thead><tr><th>Assignment</th><th>Batch</th><th>Due</th><th>Pending</th></tr></thead>
      <tbody>${allHw.map((a) => {
        const pending = Object.values(a.submissions || {}).filter((s) => s.status !== 'submitted').length;
        return `<tr><td>${a.title}</td><td>${getBatch(a.batchId)?.name}</td><td>${a.dueDate}</td><td>${pending}</td></tr>`;
      }).join('') || '<tr><td colspan="4">No homework assigned</td></tr>'}</tbody></table>
    </div></div>`;
}

function tutorScheduleView(teacherId) {
  const teacher = getTeacher(teacherId);
  const schedule = getTutorSchedule(teacherId);
  const avail = getTutorAvailability(teacherId);
  return `
    <div class="grid-2">
      <div class="panel"><div class="panel-header"><h3>Upcoming Classes — ${teacher?.name || ''}</h3></div>
      <div class="panel-body">
        ${schedule.length ? schedule.map((s) => `
          <div class="session-row"><div class="session-info"><h4>${s.topic}</h4><p>${s.batchName} · ${s.date} · ${formatTime(s.startTime)}</p></div>
          <a href="${s.meetingLink}" target="_blank" class="btn btn-sm btn-primary">Join</a></div>`).join('') : '<p class="empty-state">No upcoming classes scheduled</p>'}
      </div></div>
      <div class="panel"><div class="panel-header"><h3>Availability</h3><button class="btn btn-sm btn-secondary" data-action="edit-avail">Manage slots</button></div>
      <div class="panel-body">
        ${availabilitySlotsDisplayHtml(avail.slots)}
        <p style="margin-top:10px;font-size:0.82rem;color:var(--text-muted)">Add multiple time windows — e.g. morning and evening batches on different days.</p>
      </div></div>
    </div>`;
}

function tutorDevelopmentView(teacherId) {
  const pd = getTutorPd(teacherId);
  const totalHours = pd.reduce((s, p) => s + (p.hours || 0), 0);
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">PD Activities</div><div class="value">${pd.length}</div></div>
      <div class="stat-card"><div class="label">Total PD Hours</div><div class="value">${totalHours}</div></div>
    </div>
    <div class="toolbar" style="margin-top:12px"><button class="btn btn-primary" data-action="add-pd">+ Log PD Activity</button></div>
    <div class="panel"><div class="panel-header"><h3>Professional Development</h3></div><div class="panel-body">
      ${pd.map((p) => `<div class="session-row"><div class="session-info"><h4>${p.title}</h4><p>${p.type} · ${p.hours}h · ${p.date} · ${p.status}</p></div></div>`).join('') || '<p class="empty-state">No PD logged yet</p>'}
      <p style="font-size:0.82rem;color:var(--text-muted);margin-top:14px">Ops extensions: Fee Reminder Pack, Zoom Class Connector, Academy Growth Consulting</p>
    </div></div>`;
}

function renderParentPortal() {
  const students = getStudents();
  const sel = students[0]?.id || '';
  return `
    <div class="vision-banner"><h3>Parent Experience Portal</h3><p>Real-time visibility into your child's classes, progress, homework, attendance, and teacher communication.</p></div>
    <div class="toolbar">
      <label>Viewing as parent of:</label>
      <select id="parentStudent">${students.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
      <button class="btn btn-secondary" data-action="parent-request-summary">Request Progress Summary</button>
    </div>
    <div class="report-tabs">
      <button class="report-tab active" data-parent-tab="home">Home</button>
      <button class="report-tab" data-parent-tab="progress">Progress</button>
      <button class="report-tab" data-parent-tab="homework">Homework</button>
      <button class="report-tab" data-parent-tab="attendance">Attendance</button>
      <button class="report-tab" data-parent-tab="fees">Fees</button>
      <button class="report-tab" data-parent-tab="feedback">Feedback</button>
      <button class="report-tab" data-parent-tab="messages">Messages</button>
      <button class="report-tab" data-parent-tab="settings">Settings</button>
    </div>
    <div id="parentContent">${parentHomeView(sel)}</div>`;
}

function parentTabContent(tab, studentId) {
  if (tab === 'home') return parentHomeView(studentId);
  if (tab === 'progress') return parentProgressView(studentId);
  if (tab === 'homework') return parentHomeworkView(studentId);
  if (tab === 'attendance') return parentAttendanceView(studentId);
  if (tab === 'fees') return parentFeesView(studentId);
  if (tab === 'feedback') return parentFeedbackView(studentId);
  if (tab === 'messages') return parentMessagesView(studentId);
  if (tab === 'settings') return parentSettingsView(studentId);
  return parentHomeView(studentId);
}

function parentHomeView(studentId) {
  const dash = getParentDashboard(studentId);
  if (!dash) return '<div class="empty-state">No students</div>';
  const { student, success, batch, teacher, upcoming, pendingHw, certificates } = dash;
  const fees = getStudentFeeSummary(studentId);
  const billing = getBillingSettings();
  const feeAlert = fees.outstanding > 0 ? `
    <div class="panel parent-fee-alert" style="margin-top:16px">
      <div class="panel-header"><h3>Fee due</h3><button class="btn btn-sm btn-secondary" data-parent-tab-link="fees">View all invoices</button></div>
      <div class="panel-body">
        <p><strong>₹${fees.outstanding.toLocaleString('en-IN')}</strong> outstanding
          ${fees.nextDue ? ` · next due <strong>${fees.nextDue.dueDate}</strong> (${fees.nextDue.batchName})` : ''}
          ${fees.overdue.length ? ` · <span class="badge badge-red">${fees.overdue.length} overdue</span>` : ''}
        </p>
        ${billing.upiId ? `<p style="font-size:0.88rem;color:var(--text-muted);margin-top:8px">Pay via UPI: <strong>${billing.upiId}</strong></p>` : ''}
        ${fees.nextDue && canParentReportPayment(fees.nextDue) ? `<button class="btn btn-primary" style="margin-top:12px" data-action="parent-report-payment" data-id="${fees.nextDue.id}">I've paid — notify center</button>` : ''}
        ${fees.nextDue?.status === 'payment_reported' ? `<p style="margin-top:10px;font-size:0.88rem;color:var(--text-muted)">Payment reported — center will confirm shortly.</p>` : ''}
      </div>
    </div>` : '';
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Success Score</div><div class="value">${success.score}</div></div>
      <div class="stat-card"><div class="label">Attendance</div><div class="value">${success.breakdown.attendance}%</div></div>
      <div class="stat-card"><div class="label">Pending Homework</div><div class="value">${pendingHw}</div></div>
      <div class="stat-card"><div class="label">${fees.outstanding > 0 ? 'Fee due' : 'Fees'}</div><div class="value ${fees.overdue.length ? 'stat-red' : ''}">${fees.outstanding > 0 ? `₹${fees.outstanding.toLocaleString('en-IN')}` : 'Clear'}</div></div>
    </div>
    ${feeAlert}
    <div class="grid-2" style="margin-top:16px">
      <div class="panel"><div class="panel-header"><h3>Next Class</h3></div><div class="panel-body">
        ${upcoming[0] ? `<div class="session-row"><div class="session-info"><h4>${upcoming[0].topic}</h4><p>${batch?.name} · ${upcoming[0].date} · ${formatTime(upcoming[0].startTime)}</p></div>
        <a href="${upcoming[0].meetingLink}" target="_blank" class="btn btn-sm btn-primary">Join Class</a></div>` : '<p>No class scheduled soon</p>'}
      </div></div>
      <div class="panel"><div class="panel-header"><h3>Recent Activity</h3></div><div class="panel-body">
        ${dash.journey.map((e) => `<div class="session-row"><div class="session-info"><h4>${e.icon} ${e.label}</h4><p>${e.date}</p></div></div>`).join('') || '<p>No recent activity</p>'}
      </div></div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Achievements</h3></div>
    <div class="panel-body">${certificates.map((c) => `<span class="badge badge-green" style="margin:0 6px 6px 0">${c.title}</span>`).join('') || 'No achievements yet'}</div></div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Contact Teacher</h3></div>
    <div class="panel-body">
      <textarea id="parentQuickMsg" rows="3" placeholder="Ask a question about ${student.name}'s progress…"></textarea>
      <button class="btn btn-primary" style="margin-top:10px" data-action="parent-contact">Send Message</button>
    </div></div>`;
}

function parentProgressView(studentId) {
  const dash = getParentDashboard(studentId);
  if (!dash) return '<div class="empty-state">No data</div>';
  const { success, tests, student } = dash;
  const skills = getSkills(studentId);
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Success Score</div><div class="value">${success.score}</div></div>
      <div class="stat-card"><div class="label">Tests</div><div class="value">${success.breakdown.tests || '—'}${success.breakdown.tests ? '%' : ''}</div></div>
      <div class="stat-card"><div class="label">Homework</div><div class="value">${success.breakdown.homework}%</div></div>
      <div class="stat-card"><div class="label">Curriculum</div><div class="value">${success.breakdown.curriculum}%</div></div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="panel"><div class="panel-header"><h3>Strengths & Recommendations</h3></div><div class="panel-body">
        ${success.strengths.map((s) => `<div class="insight-item" style="background:var(--primary-soft)">${s}</div>`).join('')}
        ${success.recommendations.map((r) => `<div class="insight-item">${r}</div>`).join('')}
      </div></div>
      <div class="panel"><div class="panel-header"><h3>Skills</h3></div><div class="panel-body">
        <table><thead><tr><th>Subject</th><th>Level</th><th>Progress</th></tr></thead>
        <tbody>${skills.map((sk) => `<tr><td>${sk.subject}</td><td>${sk.level}</td><td>${sk.progress}%</td></tr>`).join('') || '<tr><td colspan="3">Not tracked</td></tr>'}</tbody></table>
      </div></div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Test History — ${student.name}</h3></div>
    <div class="panel-body table-wrap">
      <table><thead><tr><th>Test</th><th>Subject</th><th>Date</th><th>Score</th></tr></thead>
      <tbody>${tests.map((t) => `<tr><td>${t.test}</td><td>${t.subject}</td><td>${t.date}</td><td>${t.score}/${t.max} (${t.pct}%)</td></tr>`).join('') || '<tr><td colspan="4">No tests yet</td></tr>'}</tbody></table>
    </div></div>`;
}

function parentHomeworkView(studentId) {
  const dash = getParentDashboard(studentId);
  if (!dash) return '';
  return `
    <div class="panel"><div class="panel-header"><h3>Homework — ${dash.student.name}</h3></div>
    <div class="panel-body table-wrap">
      <table><thead><tr><th>Assignment</th><th>Subject</th><th>Due</th><th>Status</th><th>Grade</th><th></th></tr></thead>
      <tbody>${dash.assignments.map((a) => {
        const sub = a.submissions?.[studentId] || { status: 'pending' };
        return `<tr><td>${a.title}</td><td>${a.subject}</td><td>${a.dueDate}</td>
          <td><span class="badge ${sub.status === 'submitted' ? 'badge-green' : sub.status === 'late' ? 'badge-red' : 'badge-orange'}">${sub.status}</span></td>
          <td>${sub.grade || '—'}</td>
          <td>${sub.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-action="parent-submit-hw" data-id="${a.id}">Mark submitted</button>` : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="6">No homework</td></tr>'}</tbody></table>
    </div></div>`;
}

function parentAttendanceView(studentId) {
  const student = getStudent(studentId);
  const records = getParentAttendanceHistory(studentId);
  const stats = computeSuccessScore(studentId);
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Attendance Rate</div><div class="value">${stats.breakdown.attendance}%</div></div>
      <div class="stat-card"><div class="label">Records</div><div class="value">${records.length}</div></div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Attendance History — ${student?.name}</h3></div>
    <div class="panel-body table-wrap">
      <table><thead><tr><th>Date</th><th>Status</th></tr></thead>
      <tbody>${records.map((r) => `<tr><td>${r.date}</td><td><span class="badge ${r.status === 'present' ? 'badge-green' : r.status === 'absent' ? 'badge-red' : 'badge-orange'}">${r.status}</span></td></tr>`).join('') || '<tr><td colspan="2">No records yet</td></tr>'}</tbody></table>
    </div></div>`;
}

function parentFeesView(studentId) {
  const student = getStudent(studentId);
  const fees = getStudentFeeSummary(studentId);
  const billing = getBillingSettings();
  if (!fees.invoices.length) {
    return `<div class="panel"><div class="panel-body empty-state"><h4>No invoices yet</h4><p>When the center generates a fee invoice and sends a reminder, it will appear here.</p></div></div>`;
  }
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Outstanding</div><div class="value ${fees.outstanding ? 'stat-red' : ''}">₹${fees.outstanding.toLocaleString('en-IN')}</div></div>
      <div class="stat-card"><div class="label">Overdue</div><div class="value">${fees.overdue.length}</div></div>
      <div class="stat-card"><div class="label">Paid invoices</div><div class="value">${fees.invoices.filter((i) => i.status === 'paid').length}</div></div>
    </div>
    ${billing.upiId || billing.bankDetails ? `<div class="panel" style="margin-top:16px"><div class="panel-header"><h3>How to pay</h3></div><div class="panel-body">
      ${billing.upiId ? `<p><strong>UPI:</strong> ${billing.upiId}</p>` : ''}
      ${billing.bankDetails ? `<p style="margin-top:8px;font-size:0.88rem;color:var(--text-muted)">${billing.bankDetails}</p>` : ''}
      <p style="margin-top:10px;font-size:0.82rem;color:var(--text-muted)">After paying offline, tap <strong>I've paid — notify center</strong>. The center verifies and confirms in EduOS.</p>
    </div></div>` : ''}
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Invoices — ${student?.name || 'Student'}</h3></div>
    <div class="panel-body table-wrap">
      <table class="invoice-table">
        <thead><tr><th>Invoice</th><th>Batch</th><th>Period</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr></thead>
        <tbody>${fees.invoices.map((inv) => `<tr>
          <td><strong>${inv.invoiceNumber}</strong></td>
          <td>${inv.batchName}</td>
          <td>${inv.periodLabel || inv.periodStart?.slice(0, 7)}</td>
          <td>₹${inv.amount.toLocaleString('en-IN')}</td>
          <td>${inv.dueDate}</td>
          <td>${parentInvoiceStatusLabel(inv.status)}</td>
          <td>${canParentReportPayment(inv) ? `<button class="btn btn-sm btn-primary" data-action="parent-report-payment" data-id="${inv.id}">I've paid — notify center</button>` : (inv.status === 'payment_reported' ? '<small>Awaiting confirmation</small>' : '')}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div></div>`;
}

function parentFeedbackView(studentId) {
  const feedback = getFeedback(studentId);
  const student = getStudent(studentId);
  return `
    <div class="panel"><div class="panel-header"><h3>Teacher Feedback — ${student?.name}</h3></div>
    <div class="panel-body">
      ${feedback.map((f) => `<div class="message-item sent"><div class="meta"><span>${getTeacher(f.teacherId)?.name}</span><span>${f.date}</span><span class="badge ${f.type === 'positive' ? 'badge-green' : 'badge-orange'}">${f.type}</span></div><div class="body">${f.message}</div></div>`).join('') || '<p class="empty-state">No feedback yet</p>'}
    </div></div>`;
}

function parentMessagesView(studentId) {
  const messages = getParentMessages(studentId);
  const inquiries = getParentInquiries(studentId);
  const student = getStudent(studentId);
  return `
    <div class="grid-2">
      <div class="panel"><div class="panel-header"><h3>Notifications — ${student?.name}</h3></div>
      <div class="panel-body">${messages.slice(0, 15).map((m) => `
        <div class="message-item ${m.status}"><div class="meta"><span>${m.type || 'update'} · ${m.channel || 'whatsapp'}</span><span>${new Date(m.sentAt).toLocaleString()}</span></div>
        <div class="body">${m.message.slice(0, 200)}${m.message.length > 200 ? '…' : ''}</div></div>`).join('') || '<p class="empty-state">No messages yet</p>'}
      </div></div>
      <div class="panel"><div class="panel-header"><h3>Your Inquiries</h3></div>
      <div class="panel-body">${inquiries.map((q) => `<div class="message-item"><div class="meta"><span>${q.date}</span><span>${q.status}</span></div><div class="body">${q.message}</div></div>`).join('') || '<p class="empty-state">No inquiries sent</p>'}
        <textarea id="parentMsgBox" rows="3" placeholder="Message the teacher…" style="margin-top:12px"></textarea>
        <button class="btn btn-primary" style="margin-top:8px" data-action="parent-contact">Send to Teacher</button>
      </div></div>
    </div>`;
}

function parentSettingsView(studentId) {
  const prefs = getParentPreferences(studentId);
  const student = getStudent(studentId);
  return `
    <div class="panel"><div class="panel-header"><h3>Notification Preferences — ${student?.parentName || student?.name}</h3></div>
    <div class="panel-body">
      <div class="form-grid">
        <div class="form-group full"><label><input type="checkbox" id="prefAtt" ${prefs.notifyAttendance ? 'checked' : ''}> Attendance alerts</label></div>
        <div class="form-group full"><label><input type="checkbox" id="prefTest" ${prefs.notifyTests ? 'checked' : ''}> Test result notifications</label></div>
        <div class="form-group full"><label><input type="checkbox" id="prefHw" ${prefs.notifyHomework ? 'checked' : ''}> Homework reminders</label></div>
        <div class="form-group full"><label><input type="checkbox" id="prefFb" ${prefs.notifyFeedback ? 'checked' : ''}> Teacher feedback alerts</label></div>
        <div class="form-group"><label>Preferred channel</label><select id="prefChannel"><option value="whatsapp" ${prefs.preferredChannel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option><option value="email" ${prefs.preferredChannel === 'email' ? 'selected' : ''}>Email</option><option value="sms" ${prefs.preferredChannel === 'sms' ? 'selected' : ''}>SMS</option></select></div>
        <div class="form-group"><label>Language</label><select id="prefLang"><option ${prefs.language === 'English' ? 'selected' : ''}>English</option><option ${prefs.language === 'Hindi' ? 'selected' : ''}>Hindi</option></select></div>
      </div>
      <button class="btn btn-primary" style="margin-top:12px" data-action="save-parent-prefs">Save Preferences</button>
    </div></div>`;
}

function renderCommHub() {
  const stats = getCommStats();
  return `
    <div class="vision-banner"><h3>Unified Communication Engine</h3><p>One event triggers messages across WhatsApp, email, SMS, and push notifications.</p></div>
    <div class="report-tabs">
      <button class="report-tab active" data-comm-tab="dashboard">Dashboard</button>
      <button class="report-tab" data-comm-tab="automations">Automations</button>
      <button class="report-tab" data-comm-tab="templates">Templates</button>
      <button class="report-tab" data-comm-tab="channels">Channels</button>
      <button class="report-tab" data-comm-tab="calendar">Reminders</button>
      <button class="report-tab" data-comm-tab="send">Send</button>
      <button class="report-tab" data-comm-tab="log">Event Log</button>
    </div>
    <div id="commTabContent">${commDashboardHtml(stats)}</div>`;
}

function commDashboardHtml(stats) {
  const channelCards = Object.entries(stats.byChannel).map(([ch, n]) =>
    `<div class="stat-card"><div class="label">${ch}</div><div class="value">${n}</div></div>`
  ).join('');
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Total messages</div><div class="value">${stats.total}</div></div>
      <div class="stat-card"><div class="label">Sent successfully</div><div class="value">${stats.sent}</div></div>
      <div class="stat-card"><div class="label">Active automations</div><div class="value">${stats.activeAutomations}/${stats.totalAutomations}</div></div>
      ${channelCards || '<div class="stat-card"><div class="label">Channels</div><div class="value">—</div></div>'}
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Recent Messages</h3></div>
    <div class="panel-body">${messageLogHtml('', 8)}</div></div>`;
}

function messageLogHtml(channelFilter, limit = 20) {
  let messages = getMessages();
  if (channelFilter) messages = messages.filter((m) => (m.channel || 'whatsapp') === channelFilter);
  return `<div class="whatsapp-log">${messages.slice(0, limit).map((m) => `
    <div class="message-item ${m.status}">
      <div class="meta"><span>${m.channel || 'whatsapp'} · ${m.to} · ${m.type || 'general'}</span><span>${new Date(m.sentAt).toLocaleString()}</span></div>
      <div class="body">${m.message}</div>
    </div>`).join('') || '<p class="empty-state">No messages yet</p>'}</div>`;
}

function automationsHtml(automations, templates) {
  return `
    <div class="toolbar"><button class="btn btn-primary" data-action="add-auto">+ Automation</button></div>
    <div class="panel"><div class="panel-header"><h3>Event Automations</h3></div><div class="panel-body table-wrap">
      <table><thead><tr><th>Event</th><th>Channels</th><th>Template</th><th>Status</th><th></th></tr></thead>
      <tbody>${automations.map((a) => {
        const tpl = templates.find((t) => t.id === a.templateId);
        return `<tr><td>${a.event}</td><td>${a.channels.join(', ')}</td><td>${tpl?.name || '—'}</td><td><span class="badge ${a.enabled ? 'badge-green' : 'badge-gray'}">${a.enabled ? 'Active' : 'Off'}</span></td>
        <td><button class="btn btn-sm btn-secondary" data-action="toggle-auto" data-id="${a.id}">${a.enabled ? 'Disable' : 'Enable'}</button>
        <button class="btn btn-sm btn-secondary" data-action="edit-auto" data-id="${a.id}">Edit</button></td></tr>`;
      }).join('')}</tbody></table>
    </div></div>`;
}

function templatesHtml(templates) {
  return `<div class="toolbar"><button class="btn btn-primary" data-action="add-tpl">+ Template</button></div>
  <div class="panel"><div class="panel-header"><h3>Message Templates</h3></div><div class="panel-body">
    ${templates.map((t) => `<div class="message-item"><div class="meta"><span>${t.name} · ${t.channel}</span><span>${t.event}</span>
      <button class="btn btn-sm btn-secondary" data-action="edit-tpl" data-id="${t.id}">Edit</button></div>
      <div class="body">${t.body}</div></div>`).join('')}
  </div></div>`;
}

function channelsHtml() {
  const s = getCommSettings();
  return `<div class="panel"><div class="panel-header"><h3>Channel Configuration</h3></div><div class="panel-body">
    <div class="form-grid">
      <div class="form-group"><label>Email from</label><input id="commEmailFrom" value="${s.emailFrom}"></div>
      <div class="form-group full"><label><input type="checkbox" id="commEmail" ${s.emailEnabled ? 'checked' : ''}> Email enabled</label></div>
      <div class="form-group full"><label><input type="checkbox" id="commSms" ${s.smsEnabled ? 'checked' : ''}> SMS enabled</label></div>
      <div class="form-group full"><label><input type="checkbox" id="commPush" ${s.pushEnabled ? 'checked' : ''}> Push enabled</label></div>
      <div class="form-group full"><label><input type="checkbox" id="commVoice" ${s.voiceEnabled ? 'checked' : ''}> Voice calls</label></div>
      <div class="form-group full"><label><input type="checkbox" id="commAutoAtt" ${s.autoOnAttendance ? 'checked' : ''}> Auto on attendance events</label></div>
      <div class="form-group full"><label><input type="checkbox" id="commAutoTest" ${s.autoOnTests ? 'checked' : ''}> Auto on test results</label></div>
      <div class="form-group full"><label><input type="checkbox" id="commAutoHw" ${s.autoOnHomework ? 'checked' : ''}> Auto on homework due</label></div>
      <div class="form-group full"><label><input type="checkbox" id="commAutoFb" ${s.autoOnFeedback ? 'checked' : ''}> Auto on teacher feedback</label></div>
    </div>
    <button class="btn btn-primary" style="margin-top:12px" data-action="save-comm-settings">Save Settings</button>
    <div class="card-grid" style="margin-top:20px">
      ${['WhatsApp', 'Email', 'SMS', 'Push', 'Voice'].map((ch, i) => {
        const enabled = [true, s.emailEnabled, s.smsEnabled, s.pushEnabled, s.voiceEnabled][i];
        return `<div class="batch-card"><h4>${ch}</h4><span class="badge ${enabled ? 'badge-green' : 'badge-gray'}">${enabled ? 'Ready' : 'Disabled'}</span></div>`;
      }).join('')}
    </div>
  </div></div>`;
}

function calendarHtml() {
  const s = getCommSettings();
  return `<div class="panel"><div class="panel-header"><h3>Class & Homework Reminders</h3></div><div class="panel-body">
    <p style="font-size:0.88rem;margin-bottom:16px">Run automated reminders for classes tomorrow and homework due in 24 hours.</p>
    <div class="form-group"><label><input type="checkbox" id="commCalRem" ${s.calendarReminders ? 'checked' : ''}> Enable calendar reminders</label></div>
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-primary" data-action="run-class-reminders">Send Class Reminders (24h)</button>
      <button class="btn btn-secondary" data-action="run-hw-reminders">Send Homework Due Reminders</button>
      <button class="btn btn-secondary" data-action="broadcast-all">Broadcast to All Parents</button>
    </div>
    <div class="form-group full" style="margin-top:16px"><label>Broadcast message</label><textarea id="broadcastMsg" rows="3" placeholder="Academy announcement…"></textarea></div>
  </div></div>`;
}

function logHtml() {
  return `<div class="toolbar">
    <label>Filter channel:</label>
    <select id="commLogFilter"><option value="">All</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option><option value="push">Push</option></select>
  </div>
  <div class="panel"><div class="panel-header"><h3>Full Event Log</h3></div><div class="panel-body" id="commLogBody">${messageLogHtml('', 30)}</div></div>`;
}

function sendHtml() {
  return `<div class="panel"><div class="panel-body"><div class="form-grid">
    <div class="form-group"><label>Phone / Email</label><input id="waPhone" placeholder="Recipient"></div>
    <div class="form-group"><label>Channel</label><select id="waChannel"><option>whatsapp</option><option>email</option><option>sms</option><option>push</option></select></div>
    <div class="form-group full"><label>Message</label><textarea id="waMessage" rows="4"></textarea></div>
  </div>
  <div style="margin-top:12px;display:flex;gap:10px"><button class="btn btn-primary" data-action="send-wa">Send</button><button class="btn btn-secondary" data-action="open-wa-web">WhatsApp Web</button></div></div></div>`;
}

function renderMarketplace() {
  const stats = getMarketplaceStats();
  return `
    <div class="vision-banner"><h3>Extensions &amp; Partners</h3><p>Connect the tools you already use for teaching. EduOS handles operations — scheduling, communication, and parent updates — not course content.</p></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Integrations</div><div class="value">${stats.integrations}</div></div>
      <div class="stat-card"><div class="label">Ops templates</div><div class="value">${stats.templates}</div></div>
      <div class="stat-card"><div class="label">Partner services</div><div class="value">${stats.partners}</div></div>
      <div class="stat-card"><div class="label">Active</div><div class="value">${stats.installed}</div></div>
    </div>
    <div class="report-tabs" style="margin-top:16px">
      <button class="report-tab active" data-mp-tab="browse">Browse</button>
      <button class="report-tab" data-mp-tab="installed">Connected</button>
      <button class="report-tab" data-mp-tab="connections">Connections</button>
    </div>
    <div id="mpContent">${mpBrowseHtml()}</div>`;
}

function mpBrowseHtml() {
  const items = marketplaceBrowseOrder(getMarketplace());
  return `
    <div class="mp-partner-banner" style="margin-top:12px">
      <h4>Need tutor payroll or GST?</h4>
      <p>Partner services below handle salaries, tax filing, and fee reconciliation. EduOS tracks student fees — payroll stays with your bookkeeper or partner.</p>
    </div>
    <div class="toolbar" style="margin-top:12px">
      <input id="mpSearch" placeholder="Search extensions… (try payroll, GST)" style="flex:1;max-width:280px">
      <select id="mpFilter"><option value="">All types</option><option value="partner">Partner services</option><option value="integration">Integrations</option><option value="template">Ops templates</option></select>
    </div>
    <div class="card-grid" id="mpGrid">${marketplaceCards(items)}</div>`;
}

function mpInstalledHtml() {
  const items = getInstalledMarketplaceItems();
  return `
    <div class="panel" style="margin-top:12px"><div class="panel-header"><h3>Connected in your academy (${items.length})</h3></div>
    <div class="panel-body">${items.length ? `<div class="card-grid">${marketplaceCards(items, true)}</div>` : '<p class="empty-state">Nothing connected yet — browse integrations and ops templates to extend your workflow.</p>'}</div></div>`;
}

function mpConnectionsHtml() {
  const sdks = getSdkIntegrations().filter((s) => !['sdk_js', 'sdk_py'].includes(s.id));
  return `
    <div class="panel" style="margin-top:12px"><div class="panel-header"><h3>Connected tools</h3></div>
    <div class="panel-body">
      <p style="font-size:0.84rem;color:var(--text-muted);margin-bottom:14px">Link the apps you already use for teaching and parent communication. EduOS handles scheduling and ops — not lesson content.</p>
      <div class="card-grid">${sdks.map((s) => `
        <div class="batch-card"><h4>${s.name}</h4><div class="meta">v${s.version}</div>
        <p style="font-size:0.78rem;margin:8px 0;color:var(--text-muted)">${s.command}</p>
        <span class="badge ${s.installed ? 'badge-green' : 'badge-gray'}">${s.installed ? 'Connected' : 'Not connected'}</span>
        <button class="btn btn-sm btn-secondary" style="margin-top:8px" data-action="toggle-sdk" data-id="${s.id}">${s.installed ? 'Disconnect' : 'Connect'}</button>
        </div>`).join('')}</div>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-top:14px">OpenAI and WhatsApp credentials are configured in <strong>Settings</strong>.</p>
    </div></div>`;
}

function mpTabContent(tab) {
  if (tab === 'installed') return mpInstalledHtml();
  if (tab === 'connections') return mpConnectionsHtml();
  return mpBrowseHtml();
}

function marketplaceCards(items, showUninstall = false) {
  return items.map((i) => `
    <div class="batch-card">
      <div class="meta">${getMarketplaceTypeLabel(i.type)} · ★ ${i.rating} · ${i.installs} academies</div>
      <h4>${i.title}</h4>
      <p style="font-size:0.82rem;color:var(--text-muted);margin:8px 0">${i.description}</p>
      <div class="meta">by ${i.author} · ${i.price}${i.contact ? ` · ${i.contact}` : ''}</div>
      ${i.installed ? `<p style="font-size:0.78rem;color:var(--accent);margin-top:8px">${getMarketplaceInstallHint(i)}</p>` : ''}
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        ${i.installed && showUninstall ? `<button class="btn btn-sm btn-secondary" data-action="uninstall-mp" data-id="${i.id}">Disconnect</button>` : !i.installed ? `<button class="btn btn-sm btn-primary" data-action="install-mp" data-id="${i.id}">${getMarketplaceActionLabel(i)}</button>` : `<span class="badge badge-green">${getMarketplaceActionLabel(i, true)}</span>`}
        <button class="btn btn-sm btn-secondary" data-action="view-mp" data-id="${i.id}">Details</button>
        ${i.type !== 'partner' ? `<button class="btn btn-sm btn-secondary" data-action="rate-mp" data-id="${i.id}">Rate</button>` : ''}
      </div>
    </div>`).join('') || '<p class="empty-state">No items match your search.</p>';
}

function renderPublicSite() {
  const site = getPublicSite();
  const inquiries = getRecentWebInquiries(8);
  return `
    ${academyBanner('Public Website', 'Your marketing front door — inquiries flow straight into the Education CRM pipeline.')}
    <div class="report-tabs" style="margin-top:16px">
      <button class="report-tab active" data-site-tab="preview">Live preview</button>
      <button class="report-tab" data-site-tab="settings">Page settings</button>
      <button class="report-tab" data-site-tab="inquiries">Web inquiries (${inquiries.length})</button>
    </div>
    <div id="siteContent">${sitePreviewHtml(site)}</div>`;
}

function sitePreviewHtml(site) {
  return `
    <div class="grid-2" style="margin-top:12px">
      <div class="panel">
        <div class="panel-header"><h3>Landing Page Preview</h3></div>
        <div class="panel-body" style="text-align:center;padding:40px 24px;background:var(--surface-2);border-radius:var(--radius-sm)">
          <h2 style="font-family:var(--font-display);font-size:2rem;margin-bottom:12px">${site.headline}</h2>
          <p style="color:var(--text-muted);margin-bottom:20px">${site.subheadline || ''}</p>
          <button class="btn btn-primary" type="button">${site.ctaText || 'Request Demo'}</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Inquiry Form (visitor view)</h3></div>
        <div class="panel-body">
          ${site.captureEnabled ? `<div class="form-grid">
            <div class="form-group"><label>Student name</label><input id="inqName" placeholder="Full name"></div>
            <div class="form-group"><label>Parent phone</label><input id="inqPhone" placeholder="Mobile number"></div>
            <div class="form-group"><label>Email</label><input id="inqEmail" placeholder="email@example.com"></div>
            <div class="form-group"><label>Grade</label><input id="inqGrade" placeholder="8, 9, 10…"></div>
            <div class="form-group full"><label>Course interest</label><input id="inqCourse" placeholder="Science, Math…"></div>
          </div>
          <button class="btn btn-primary" style="margin-top:12px" data-action="submit-inquiry">Submit inquiry</button>
          <p style="font-size:0.82rem;color:var(--text-muted);margin-top:10px">Creates a lead in CRM → Pipeline (Lead stage)</p>` : '<p class="empty-state">Lead capture is disabled — enable it in Page settings.</p>'}
        </div>
      </div>
    </div>`;
}

function siteSettingsHtml(site) {
  return `
    <div class="panel" style="margin-top:12px"><div class="panel-header"><h3>Page settings</h3></div>
    <div class="panel-body">
      <div class="form-grid">
        <div class="form-group full"><label>Headline</label><input id="siteHeadline" value="${site.headline}"></div>
        <div class="form-group full"><label>Subheadline</label><input id="siteSubheadline" value="${site.subheadline || ''}"></div>
        <div class="form-group"><label>Button text</label><input id="siteCta" value="${site.ctaText || ''}"></div>
        <div class="form-group full"><label><input type="checkbox" id="siteCapture" ${site.captureEnabled ? 'checked' : ''}> Enable inquiry form → CRM</label></div>
      </div>
      <button class="btn btn-primary" style="margin-top:12px" data-action="save-site">Save settings</button>
    </div></div>`;
}

function siteInquiriesHtml() {
  const inquiries = getRecentWebInquiries(20);
  return `
    <div class="panel" style="margin-top:12px"><div class="panel-header"><h3>Website inquiries</h3></div>
    <div class="panel-body table-wrap">
      <table><thead><tr><th>Name</th><th>Grade</th><th>Course</th><th>Phone</th><th>Stage</th><th>Date</th></tr></thead>
      <tbody>${inquiries.length ? inquiries.map((l) => `<tr>
        <td><strong>${l.name}</strong></td><td>${l.grade || '—'}</td><td>${l.course || '—'}</td><td>${l.phone}</td>
        <td><span class="badge badge-gray">${l.stage}</span></td><td>${l.createdAt}</td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">No website inquiries yet</td></tr>'}
      </tbody></table>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-top:12px">Open Education CRM to advance leads through demo → enrollment.</p>
    </div></div>`;
}

function siteTabContent(tab) {
  const site = getPublicSite();
  if (tab === 'settings') return siteSettingsHtml(site);
  if (tab === 'inquiries') return siteInquiriesHtml();
  return sitePreviewHtml(site);
}

function getManageStudentId() {
  return document.getElementById('ssStudent')?.value
    || document.getElementById('tutorStudent')?.value
    || getStudents()[0]?.id;
}

function bindStudentSuccessManageActions({ showModal, closeModal, toast, refresh, studentId = getManageStudentId }) {
  document.querySelector('[data-action="add-feedback"]')?.addEventListener('click', () => {
    const teachers = getTeachers();
    const sid = studentId();
    showModal({
      title: 'Add Teacher Feedback',
      body: `<div class="form-grid">
        <div class="form-group"><label>Teacher</label><select id="fbTeacher">${teachers.map((t) => `<option value="${t.id}">${t.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Type</label><select id="fbType"><option value="positive">Positive</option><option value="improvement">Improvement</option></select></div>
        <div class="form-group full"><label>Message</label><textarea id="fbMsg" rows="4"></textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveFb">Save & Notify Parent</button>`,
      onMount: () => {
        document.getElementById('saveFb').onclick = () => {
          saveFeedback({ studentId: sid, teacherId: document.getElementById('fbTeacher').value, message: document.getElementById('fbMsg').value.trim(), type: document.getElementById('fbType').value });
          closeModal(); toast('Feedback saved — parent notified via comm engine', 'success'); refresh();
        };
      },
    });
  });

  document.querySelector('[data-action="add-hw"]')?.addEventListener('click', () => {
    const batches = getBatches();
    showModal({
      title: 'New Assignment',
      body: `<div class="form-grid">
        <div class="form-group full"><label>Title</label><input id="hwTitle"></div>
        <div class="form-group"><label>Batch</label><select id="hwBatch">${batches.map((b) => `<option value="${b.id}">${b.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Subject</label><input id="hwSubject"></div>
        <div class="form-group"><label>Due date</label><input type="date" id="hwDue"></div>
        <div class="form-group full"><label>Description</label><textarea id="hwDesc"></textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveHw">Save</button>`,
      onMount: () => {
        document.getElementById('saveHw').onclick = () => {
          saveAssignment({ title: document.getElementById('hwTitle').value.trim(), batchId: document.getElementById('hwBatch').value, subject: document.getElementById('hwSubject').value.trim(), dueDate: document.getElementById('hwDue').value, description: document.getElementById('hwDesc').value.trim(), submissions: {} });
          closeModal(); toast('Assignment created', 'success'); refresh();
        };
      },
    });
  });

  document.querySelector('[data-action="issue-cert"]')?.addEventListener('click', () => {
    const sid = studentId();
    const title = prompt('Certificate title:');
    if (!title || !sid) return;
    saveCertificate({ studentId: sid, title, type: 'achievement' });
    toast('Certificate issued', 'success');
    refresh();
  });
}

function bindStudentSuccessEvents({ showModal, closeModal, toast, refresh }) {
  const role = getEffectiveRole();
  const studentId = () => document.getElementById('ssStudent')?.value || getStudents()[0]?.id;

  if (role === 'parent') {
    const reloadParentHomework = () => {
      document.getElementById('ssContent').innerHTML = parentHomeworkView(studentId());
      bindStudentSuccessEvents({ showModal, closeModal, toast, refresh });
    };
    document.getElementById('ssStudent')?.addEventListener('change', reloadParentHomework);
    document.querySelectorAll('[data-action="parent-submit-hw"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        submitAssignment(btn.dataset.id, studentId());
        toast('Homework marked as submitted', 'success');
        refresh();
      });
    });
    return;
  }

  if (role === 'student') {
    document.querySelectorAll('[data-action="submit-hw"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        submitAssignment(btn.dataset.id, studentId());
        toast('Assignment submitted', 'success');
        refresh();
      });
    });
    return;
  }

  const reloadTab = () => {
    const tab = document.querySelector('[data-ss-tab].active')?.dataset.ssTab || 'overview';
    document.getElementById('ssContent').innerHTML = ssTabContent(tab, studentId());
    bindStudentSuccessEvents({ showModal, closeModal, toast, refresh });
  };

  document.getElementById('ssStudent')?.addEventListener('change', reloadTab);

  document.querySelectorAll('[data-ss-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-ss-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('ssContent').innerHTML = ssTabContent(tab.dataset.ssTab, studentId());
      bindStudentSuccessEvents({ showModal, closeModal, toast, refresh });
    });
  });

  document.querySelectorAll('[data-ss-row]').forEach((row) => {
    row.addEventListener('click', () => {
      const sel = document.getElementById('ssStudent');
      if (sel) sel.value = row.dataset.ssRow;
      reloadTab();
    });
  });

  document.querySelector('[data-action="apply-intervention"]')?.addEventListener('click', () => {
    const plans = applyInterventionPlan(studentId());
    toast(`${plans.length} intervention(s) applied`, 'success');
    refresh();
  });

  document.querySelectorAll('[data-action="resolve-int"]').forEach((btn) => {
    btn.addEventListener('click', () => { resolveIntervention(btn.dataset.id); toast('Intervention resolved', 'success'); refresh(); });
  });

  document.querySelectorAll('[data-action="submit-hw"]').forEach((btn) => {
    btn.addEventListener('click', () => { submitAssignment(btn.dataset.id, studentId()); toast('Assignment submitted', 'success'); refresh(); });
  });

  document.querySelectorAll('[data-action="grade-hw"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const grade = prompt('Enter grade (e.g. A, B+):');
      if (!grade) return;
      gradeAssignment(btn.dataset.id, studentId(), grade);
      toast('Grade saved', 'success');
      refresh();
    });
  });

  document.querySelector('[data-action="send-parent-summary"]')?.addEventListener('click', async () => {
    const results = await sendParentSummary(studentId());
    toast(`Parent summary sent (${results.length} message(s))`, 'success');
    refresh();
  });

  bindStudentSuccessManageActions({ showModal, closeModal, toast, refresh, studentId });
}

function openManageAvailabilityModal(tid, { showModal, closeModal, toast, refresh }) {
  if (!tid) return toast('Select a teacher first', 'error');
  let draftSlots = [...(getTutorAvailability(tid).slots || [])];

  const renderSlotsList = () => {
    const el = document.getElementById('availDraftList');
    if (!el) return;
    if (!draftSlots.length) {
      el.innerHTML = '<p class="empty-state" style="padding:8px 0">No slots yet — add one below.</p>';
      return;
    }
    el.innerHTML = draftSlots.map((s, i) => `
      <div class="avail-slot-item avail-slot-edit-row">
        <div><strong>Slot ${i + 1}</strong> · ${formatTutorAvailabilitySummary({ slots: [s] })}</div>
        <button type="button" class="btn btn-sm btn-ghost" data-remove-slot="${i}">Remove</button>
      </div>`).join('');
    el.querySelectorAll('[data-remove-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        draftSlots.splice(Number(btn.dataset.removeSlot), 1);
        renderSlotsList();
      });
    });
  };

  showModal({
    title: 'Manage availability slots',
    wide: true,
    body: `
      <p style="margin:0 0 12px;font-size:0.88rem;color:var(--text-muted)">Add one or more windows when you are available for classes or demos.</p>
      <div id="availDraftList"></div>
      <div class="avail-add-slot" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <h4 style="margin:0 0 10px;font-size:0.92rem">Add time slot</h4>
        ${dayPickerHtml([], 'newAvailDay')}
        <div class="form-grid" style="margin-top:12px">
          <div class="form-group"><label>Start time</label><input type="time" id="newAvailStart" value="16:00"></div>
          <div class="form-group"><label>End time</label><input type="time" id="newAvailEnd" value="18:00"></div>
        </div>
        <button type="button" class="btn btn-secondary" id="addAvailSlotBtn" style="margin-top:10px">+ Add slot</button>
      </div>`,
    footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveAvailSlots">Save availability</button>`,
    onMount: () => {
      bindDayPicker('newAvailDayPicker');
      renderSlotsList();
      document.getElementById('addAvailSlotBtn')?.addEventListener('click', () => {
        const days = getSelectedDays('newAvailDayPicker');
        const startTime = document.getElementById('newAvailStart')?.value;
        const endTime = document.getElementById('newAvailEnd')?.value;
        if (!days.length) return toast('Select at least one day', 'error');
        if (!startTime || !endTime) return toast('Start and end time required', 'error');
        if (startTime >= endTime) return toast('End time must be after start time', 'error');
        draftSlots.push({
          id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          days,
          startTime,
          endTime,
        });
        document.querySelectorAll('#newAvailDayPicker .day-chip.active').forEach((c) => c.classList.remove('active'));
        renderSlotsList();
        toast('Slot added — click Save availability when done', 'success');
      });
      document.getElementById('saveAvailSlots')?.addEventListener('click', () => {
        saveTutorAvailability(tid, { slots: draftSlots });
        closeModal();
        toast('Availability saved', 'success');
        refresh();
      });
    },
  });
}

function bindTutorHubEvents({ showModal, closeModal, toast, refresh }) {
  const teacherId = () => document.getElementById('tutorSel')?.value;
  const reloadTab = () => {
    const tab = document.querySelector('[data-tutor-tab].active')?.dataset.tutorTab || 'overview';
    document.getElementById('tutorContent').innerHTML = tutorTabContent(tab, teacherId());
    bindTutorHubEvents({ showModal, closeModal, toast, refresh });
  };

  document.getElementById('tutorSel')?.addEventListener('change', reloadTab);

  document.querySelectorAll('[data-tutor-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-tutor-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tutorContent').innerHTML = tutorTabContent(tab.dataset.tutorTab, teacherId());
      bindTutorHubEvents({ showModal, closeModal, toast, refresh });
    });
  });

  document.querySelectorAll('[data-tutor-row]').forEach((row) => {
    row.addEventListener('click', () => {
      const sel = document.getElementById('tutorSel');
      if (sel) sel.value = row.dataset.tutorRow;
      reloadTab();
    });
  });

  document.querySelector('[data-action="gen-lesson"]')?.addEventListener('click', () => {
    const topic = prompt('Topic for AI lesson plan:');
    if (!topic) return;
    const ai = generateLessonPlanAI(topic);
    const tid = teacherId();
    const batches = getBatches().filter((b) => b.teacherId === tid);
    saveLessonPlan({ teacherId: tid, batchId: batches[0]?.id, date: new Date().toISOString().slice(0, 10), topic, ...ai, status: 'ready' });
    toast('AI lesson plan generated', 'success');
    refresh();
  });

  document.querySelector('[data-action="add-lesson"]')?.addEventListener('click', () => {
    const tid = teacherId();
    const batches = getBatches().filter((b) => b.teacherId === tid);
    showModal({
      title: 'New Lesson Plan', wide: true,
      body: `<div class="form-grid">
        <div class="form-group"><label>Topic</label><input id="lpTopic"></div>
        <div class="form-group"><label>Date</label><input type="date" id="lpDate"></div>
        <div class="form-group"><label>Batch</label><select id="lpBatch">${batches.map((b) => `<option value="${b.id}">${b.name}</option>`).join('')}</select></div>
        <div class="form-group full"><label>Objectives</label><textarea id="lpObj"></textarea></div>
        <div class="form-group full"><label>Activities</label><textarea id="lpAct"></textarea></div>
        <div class="form-group full"><label>Homework</label><textarea id="lpHw"></textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveLp">Save</button>`,
      onMount: () => {
        document.getElementById('saveLp').onclick = () => {
          saveLessonPlan({ teacherId: tid, batchId: document.getElementById('lpBatch').value, date: document.getElementById('lpDate').value, topic: document.getElementById('lpTopic').value.trim(), objectives: document.getElementById('lpObj').value, activities: document.getElementById('lpAct').value, homework: document.getElementById('lpHw').value, quiz: '', status: 'draft' });
          closeModal(); toast('Lesson plan saved', 'success'); refresh();
        };
      },
    });
  });

  document.querySelectorAll('[data-action="del-lesson"]').forEach((btn) => {
    btn.addEventListener('click', () => { deleteLessonPlan(btn.dataset.id); toast('Deleted', 'success'); refresh(); });
  });

  document.querySelectorAll('[data-action="deliver-lesson"]').forEach((btn) => {
    btn.addEventListener('click', () => { markLessonPlanDelivered(btn.dataset.id); toast('Lesson marked as delivered', 'success'); refresh(); });
  });

  document.querySelectorAll('[data-action="view-lesson"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lp = getLessonPlans(teacherId()).find((l) => l.id === btn.dataset.id);
      if (!lp) return;
      showModal({
        title: lp.topic,
        wide: true,
        body: `<div style="font-size:0.88rem;line-height:1.6">
          <p><strong>Date:</strong> ${lp.date} · <strong>Batch:</strong> ${getBatch(lp.batchId)?.name}</p>
          <p><strong>Objectives:</strong><br>${lp.objectives || '—'}</p>
          <p><strong>Activities:</strong><br>${(lp.activities || '—').replace(/\n/g, '<br>')}</p>
          <p><strong>Homework:</strong><br>${lp.homework || '—'}</p>
          <p><strong>Quiz:</strong><br>${lp.quiz || '—'}</p>
        </div>`,
        footer: `<button class="btn btn-secondary" data-modal-cancel>Close</button>`,
      });
    });
  });

  document.querySelectorAll('[data-action="grade-hw-tutor"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const grade = prompt('Enter grade (e.g. A, B+):');
      if (!grade) return;
      gradeAssignment(btn.dataset.aid, btn.dataset.sid, grade);
      toast('Homework graded', 'success');
      refresh();
    });
  });

  document.querySelector('[data-action="edit-avail"]')?.addEventListener('click', () => {
    openManageAvailabilityModal(teacherId(), { showModal, closeModal, toast, refresh });
  });

  document.querySelector('[data-action="add-pd"]')?.addEventListener('click', () => {
    const tid = teacherId();
    showModal({
      title: 'Log PD Activity',
      body: `<div class="form-grid">
        <div class="form-group full"><label>Title</label><input id="pdTitle"></div>
        <div class="form-group"><label>Type</label><select id="pdType"><option>course</option><option>webinar</option><option>workshop</option><option>certification</option></select></div>
        <div class="form-group"><label>Hours</label><input type="number" id="pdHours" value="2"></div>
        <div class="form-group"><label>Date</label><input type="date" id="pdDate"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="savePd">Save</button>`,
      onMount: () => {
        document.getElementById('savePd').onclick = () => {
          saveTutorPdEntry({ teacherId: tid, title: document.getElementById('pdTitle').value.trim(), type: document.getElementById('pdType').value, hours: Number(document.getElementById('pdHours').value) || 0, date: document.getElementById('pdDate').value });
          closeModal(); toast('PD activity logged', 'success'); refresh();
        };
      },
    });
  });

  if (canManageStudentSuccess()) {
    bindStudentSuccessManageActions({
      showModal,
      closeModal,
      toast,
      refresh,
      studentId: () => document.getElementById('tutorStudent')?.value || getStudents()[0]?.id,
    });
  }
}

function bindParentPortalEvents({ toast, refresh, showModal, closeModal }) {
  const studentId = () => document.getElementById('parentStudent')?.value;
  const reloadTab = () => {
    const tab = document.querySelector('[data-parent-tab].active')?.dataset.parentTab || 'home';
    document.getElementById('parentContent').innerHTML = parentTabContent(tab, studentId());
    bindParentPortalEvents({ toast, refresh, showModal, closeModal });
  };

  document.getElementById('parentStudent')?.addEventListener('change', reloadTab);

  document.querySelectorAll('[data-parent-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-parent-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('parentContent').innerHTML = parentTabContent(tab.dataset.parentTab, studentId());
      bindParentPortalEvents({ toast, refresh, showModal, closeModal });
    });
  });

  document.querySelectorAll('[data-parent-tab-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.parentTabLink;
      document.querySelectorAll('[data-parent-tab]').forEach((t) => {
        t.classList.toggle('active', t.dataset.parentTab === target);
      });
      document.getElementById('parentContent').innerHTML = parentTabContent(target, studentId());
      bindParentPortalEvents({ toast, refresh, showModal, closeModal });
    });
  });

  const openReportPaymentModal = (invoiceId) => {
    if (!showModal || !closeModal) return;
    showModal({
      title: 'Report offline payment',
      body: `<p style="margin:0 0 12px;font-size:0.88rem;color:var(--text-muted)">Tell the center you've paid outside EduOS. They will verify and confirm — this does not process payment in the app.</p>
      <div class="form-grid">
        <div class="form-group"><label>Payment method</label>
          <select id="parentPayMethod">
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>
        <div class="form-group"><label>Reference (optional)</label><input id="parentPayRef" placeholder="UPI ref, receipt no."></div>
        <div class="form-group full"><label>Note (optional)</label><textarea id="parentPayNote" rows="2" placeholder="Paid on 23 Jul, etc."></textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="parentPaySubmitBtn">Notify center</button>`,
      onMount: () => {
        document.getElementById('parentPaySubmitBtn').onclick = async () => {
          const result = await reportParentPayment(invoiceId, {
            paymentMethod: document.getElementById('parentPayMethod').value,
            paymentRef: document.getElementById('parentPayRef').value.trim(),
            note: document.getElementById('parentPayNote').value.trim(),
          });
          if (result.ok) {
            closeModal();
            toast('Center notified — they will confirm after verifying payment', 'success');
            refresh();
          } else {
            toast(result.error || 'Could not report payment', 'error');
          }
        };
      },
    });
  };

  document.querySelectorAll('[data-action="parent-report-payment"]').forEach((btn) => {
    btn.addEventListener('click', () => openReportPaymentModal(btn.dataset.id));
  });

  const sendParentMessage = async () => {
    const msg = document.getElementById('parentQuickMsg')?.value.trim() || document.getElementById('parentMsgBox')?.value.trim();
    if (!msg) return toast('Enter a message', 'error');
    const results = await contactTeacherFromParent(studentId(), msg);
    toast(`Message sent (${results.length} notification(s))`, 'success');
    refresh();
  };

  document.querySelectorAll('[data-action="parent-contact"]').forEach((btn) => {
    btn.addEventListener('click', sendParentMessage);
  });

  document.querySelector('[data-action="parent-request-summary"]')?.addEventListener('click', async () => {
    const results = await sendParentSummary(studentId());
    toast(`Progress summary sent (${results.length} message(s))`, 'success');
    refresh();
  });

  document.querySelectorAll('[data-action="parent-submit-hw"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      submitAssignment(btn.dataset.id, studentId());
      toast('Homework marked as submitted', 'success');
      refresh();
    });
  });

  document.querySelector('[data-action="save-parent-prefs"]')?.addEventListener('click', () => {
    saveParentPreferences(studentId(), {
      notifyAttendance: document.getElementById('prefAtt')?.checked,
      notifyTests: document.getElementById('prefTest')?.checked,
      notifyHomework: document.getElementById('prefHw')?.checked,
      notifyFeedback: document.getElementById('prefFb')?.checked,
      preferredChannel: document.getElementById('prefChannel')?.value,
      language: document.getElementById('prefLang')?.value,
    });
    toast('Preferences saved', 'success');
    refresh();
  });
}

function bindCommHubEvents({ showModal, closeModal, toast, refresh }) {
  const reloadCommTab = (tabName) => {
    const templates = getCommTemplates();
    const automations = getCommAutomations();
    const stats = getCommStats();
    const content = tabName === 'dashboard' ? commDashboardHtml(stats)
      : tabName === 'templates' ? templatesHtml(templates)
      : tabName === 'channels' ? channelsHtml()
      : tabName === 'calendar' ? calendarHtml()
      : tabName === 'send' ? sendHtml()
      : tabName === 'log' ? logHtml()
      : automationsHtml(automations, templates);
    document.getElementById('commTabContent').innerHTML = content;
    bindCommHubEvents({ showModal, closeModal, toast, refresh });
  };

  document.querySelectorAll('[data-comm-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-comm-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      reloadCommTab(tab.dataset.commTab);
    });
  });

  document.getElementById('commLogFilter')?.addEventListener('change', (e) => {
    document.getElementById('commLogBody').innerHTML = messageLogHtml(e.target.value, 30);
  });

  document.querySelector('[data-action="save-comm-settings"]')?.addEventListener('click', () => {
    saveCommSettings({
      emailFrom: document.getElementById('commEmailFrom')?.value.trim(),
      emailEnabled: document.getElementById('commEmail')?.checked,
      smsEnabled: document.getElementById('commSms')?.checked,
      pushEnabled: document.getElementById('commPush')?.checked,
      voiceEnabled: document.getElementById('commVoice')?.checked,
      autoOnAttendance: document.getElementById('commAutoAtt')?.checked,
      autoOnTests: document.getElementById('commAutoTest')?.checked,
      autoOnHomework: document.getElementById('commAutoHw')?.checked,
      autoOnFeedback: document.getElementById('commAutoFb')?.checked,
    });
    toast('Communication settings saved', 'success');
    refresh();
  });

  document.querySelector('[data-action="run-class-reminders"]')?.addEventListener('click', async () => {
    const results = await runClassReminders();
    toast(`Class reminders sent (${results.length} message(s))`, 'success');
    refresh();
  });

  document.querySelector('[data-action="run-hw-reminders"]')?.addEventListener('click', async () => {
    const results = await checkHomeworkReminders();
    toast(`Homework reminders sent (${results.length} message(s))`, 'success');
    refresh();
  });

  document.querySelector('[data-action="broadcast-all"]')?.addEventListener('click', async () => {
    const msg = document.getElementById('broadcastMsg')?.value.trim();
    if (!msg) return toast('Enter a broadcast message', 'error');
    const results = await broadcastToParents(msg, ['whatsapp', 'email']);
    toast(`Broadcast sent (${results.length} message(s))`, 'success');
    refresh();
  });

  document.querySelector('[data-action="add-tpl"]')?.addEventListener('click', () => {
    showModal({
      title: 'New Template',
      body: `<div class="form-grid">
        <div class="form-group"><label>Name</label><input id="tplName"></div>
        <div class="form-group"><label>Channel</label><select id="tplChannel"><option>whatsapp</option><option>email</option><option>sms</option><option>push</option></select></div>
        <div class="form-group"><label>Event</label><select id="tplEvent">${Object.entries(COMM_EVENTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="form-group full"><label>Body (use {{placeholders}})</label><textarea id="tplBody" rows="4"></textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveTpl">Save</button>`,
      onMount: () => {
        document.getElementById('saveTpl').onclick = () => {
          saveCommTemplate({ name: document.getElementById('tplName').value.trim(), channel: document.getElementById('tplChannel').value, event: document.getElementById('tplEvent').value, body: document.getElementById('tplBody').value.trim() });
          closeModal(); toast('Template saved', 'success'); refresh();
        };
      },
    });
  });

  document.querySelectorAll('[data-action="edit-tpl"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tpl = getCommTemplates().find((t) => t.id === btn.dataset.id);
      if (!tpl) return;
      showModal({
        title: 'Edit Template',
        body: `<div class="form-grid">
          <div class="form-group"><label>Name</label><input id="tplName" value="${tpl.name}"></div>
          <div class="form-group"><label>Channel</label><select id="tplChannel">${['whatsapp', 'email', 'sms', 'push'].map((c) => `<option ${tpl.channel === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div class="form-group full"><label>Body</label><textarea id="tplBody" rows="4">${tpl.body}</textarea></div>
        </div>`,
        footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveTpl">Save</button>`,
        onMount: () => {
          document.getElementById('saveTpl').onclick = () => {
            saveCommTemplate({ ...tpl, name: document.getElementById('tplName').value.trim(), channel: document.getElementById('tplChannel').value, body: document.getElementById('tplBody').value.trim() });
            closeModal(); toast('Template updated', 'success'); refresh();
          };
        },
      });
    });
  });

  document.querySelector('[data-action="add-auto"]')?.addEventListener('click', () => {
    const templates = getCommTemplates();
    showModal({
      title: 'New Automation',
      body: `<div class="form-grid">
        <div class="form-group"><label>Event</label><select id="autoEvent">${Object.entries(COMM_EVENTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="form-group"><label>Template</label><select id="autoTpl">${templates.map((t) => `<option value="${t.id}">${t.name}</option>`).join('')}</select></div>
        <div class="form-group full"><label>Channels (comma-separated)</label><input id="autoChannels" value="whatsapp, email"></div>
      </div>`,
      footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveAuto">Save</button>`,
      onMount: () => {
        document.getElementById('saveAuto').onclick = () => {
          const eventKey = document.getElementById('autoEvent').value;
          saveCommAutomation({
            event: COMM_EVENTS[eventKey] || eventKey,
            eventKey,
            templateId: document.getElementById('autoTpl').value,
            channels: document.getElementById('autoChannels').value.split(',').map((s) => s.trim()),
            enabled: true,
          });
          closeModal(); toast('Automation created', 'success'); refresh();
        };
      },
    });
  });

  document.querySelectorAll('[data-action="edit-auto"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const auto = getCommAutomations().find((a) => a.id === btn.dataset.id);
      if (!auto) return;
      showModal({
        title: 'Edit Automation',
        body: `<div class="form-grid">
          <div class="form-group full"><label>Channels (comma-separated)</label><input id="autoChannels" value="${auto.channels.join(', ')}"></div>
          <div class="form-group full"><label><input type="checkbox" id="autoEnabled" ${auto.enabled ? 'checked' : ''}> Enabled</label></div>
        </div>`,
        footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveAuto">Save</button>`,
        onMount: () => {
          document.getElementById('saveAuto').onclick = () => {
            saveCommAutomation({ ...auto, channels: document.getElementById('autoChannels').value.split(',').map((s) => s.trim()), enabled: document.getElementById('autoEnabled').checked });
            closeModal(); toast('Automation updated', 'success'); refresh();
          };
        },
      });
    });
  });

  document.querySelector('[data-action="send-wa"]')?.addEventListener('click', async () => {
    const phone = document.getElementById('waPhone')?.value.trim();
    const message = document.getElementById('waMessage')?.value.trim();
    const channel = document.getElementById('waChannel')?.value || 'whatsapp';
    if (!phone || !message) return toast('Recipient and message required', 'error');
    await sendViaChannel(channel, { to: phone, message, type: 'manual' });
    toast('Message sent', 'success');
    refresh();
  });

  document.querySelector('[data-action="open-wa-web"]')?.addEventListener('click', () => {
    const phone = document.getElementById('waPhone')?.value.trim();
    const message = document.getElementById('waMessage')?.value.trim();
    if (!phone) return toast('Phone required', 'error');
    openWhatsAppWeb(phone, message, getState().settings.defaultCountryCode);
  });

  document.querySelectorAll('[data-action="toggle-auto"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleAutomation(btn.dataset.id);
      toast('Automation updated', 'success');
      refresh();
    });
  });
}

function bindMarketplaceEvents({ showModal, closeModal, toast, refresh, navigate }) {
  const reloadMp = (tab) => {
    document.getElementById('mpContent').innerHTML = mpTabContent(tab);
    bindMarketplaceEvents({ showModal, closeModal, toast, refresh, navigate });
  };

  document.querySelectorAll('[data-mp-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-mp-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      reloadMp(tab.dataset.mpTab);
    });
  });

  const filterGrid = () => {
    const q = document.getElementById('mpSearch')?.value.trim();
    const type = document.getElementById('mpFilter')?.value;
    const grid = document.getElementById('mpGrid');
    if (grid) grid.innerHTML = marketplaceCards(marketplaceBrowseOrder(searchMarketplace(q, type || undefined)));
    bindMarketplaceEvents({ showModal, closeModal, toast, refresh, navigate });
  };

  document.getElementById('mpSearch')?.addEventListener('input', filterGrid);
  document.getElementById('mpFilter')?.addEventListener('change', filterGrid);

  document.querySelectorAll('[data-action="toggle-sdk"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleSdkIntegration(btn.dataset.id);
      toast('Connection updated', 'success');
      reloadMp(document.querySelector('[data-mp-tab].active')?.dataset.mpTab || 'browse');
    });
  });

  document.querySelectorAll('[data-action="install-mp"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = installMarketplaceItem(btn.dataset.id);
      toast(getMarketplaceInstallMessage(item), 'success');
      refresh();
    });
  });

  document.querySelectorAll('[data-action="uninstall-mp"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uninstallMarketplaceItem(btn.dataset.id);
      toast('Disconnected', 'success');
      refresh();
    });
  });

  document.querySelectorAll('[data-action="view-mp"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = getMarketplace().find((i) => i.id === btn.dataset.id);
      if (!item) return;
      const hint = getMarketplaceInstallHint(item);
      showModal({
        title: item.title,
        wide: true,
        body: `<div style="font-size:0.88rem;line-height:1.6">
          <p><strong>Type:</strong> ${getMarketplaceTypeLabel(item.type)} · <strong>Price:</strong> ${item.price}</p>
          <p><strong>Provider:</strong> ${item.author} · <strong>Rating:</strong> ★ ${item.rating} · <strong>Used by:</strong> ${item.installs} academies</p>
          <p style="margin-top:12px">${item.description}</p>
          ${item.contact ? `<p style="margin-top:10px"><strong>Contact:</strong> ${item.contact}</p>` : ''}
          <p style="margin-top:12px;font-size:0.82rem;color:var(--text-muted)">${hint}</p>
          ${item.installed ? `<p style="margin-top:12px"><span class="badge badge-green">Connected${item.installedAt ? ' since ' + item.installedAt : ''}</span></p>` : ''}
        </div>`,
        footer: `<button class="btn btn-secondary" data-modal-cancel>Close</button>${item.type === 'partner' && item.contact ? `<a class="btn btn-secondary" href="mailto:${item.contact}">Email partner</a>` : ''}${!item.installed ? `<button class="btn btn-primary" id="modalInstallMp">${getMarketplaceActionLabel(item)}</button>` : (item.linkView || item.sdkId ? `<button class="btn btn-primary" id="modalGoMp">Open ${item.linkView === 'commHub' ? 'Communication Hub' : item.linkView === 'schedule' ? 'Class Schedule' : 'Connections'}</button>` : '')}`,
        onMount: () => {
          document.getElementById('modalInstallMp')?.addEventListener('click', () => {
            installMarketplaceItem(item.id);
            closeModal();
            toast(getMarketplaceInstallMessage(item), 'success');
            refresh();
          });
          document.getElementById('modalGoMp')?.addEventListener('click', () => {
            closeModal();
            if (item.linkView === 'schedule') navigate?.('schedule');
            else if (item.linkView === 'commHub') navigate?.('commHub');
            else {
              document.querySelectorAll('[data-mp-tab]').forEach((t) => t.classList.toggle('active', t.dataset.mpTab === 'connections'));
              reloadMp('connections');
            }
          });
        },
      });
    });
  });

  document.querySelectorAll('[data-action="rate-mp"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rating = prompt('Rate 1–5 stars:');
      if (!rating || isNaN(rating)) return;
      rateMarketplaceItem(btn.dataset.id, Number(rating));
      toast('Rating saved', 'success');
      refresh();
    });
  });
}

function bindPublicSiteEvents({ toast, refresh }) {
  const reloadSite = (tab) => {
    document.getElementById('siteContent').innerHTML = siteTabContent(tab);
    bindPublicSiteEvents({ toast, refresh });
  };

  document.querySelectorAll('[data-site-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-site-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      reloadSite(tab.dataset.siteTab);
    });
  });

  document.querySelector('[data-action="save-site"]')?.addEventListener('click', () => {
    savePublicSite({
      headline: document.getElementById('siteHeadline').value.trim(),
      subheadline: document.getElementById('siteSubheadline')?.value.trim() || '',
      ctaText: document.getElementById('siteCta')?.value.trim() || 'Request Demo',
      captureEnabled: document.getElementById('siteCapture').checked,
    });
    toast('Website settings saved', 'success');
    refresh();
  });

  document.querySelector('[data-action="submit-inquiry"]')?.addEventListener('click', () => {
    if (!getPublicSite().captureEnabled) return toast('Lead capture is disabled', 'error');
    const name = document.getElementById('inqName')?.value.trim();
    const phone = document.getElementById('inqPhone')?.value.trim();
    if (!name || !phone) return toast('Name and phone required', 'error');
    const lead = saveLead({
      name,
      phone,
      email: document.getElementById('inqEmail')?.value.trim() || '',
      grade: document.getElementById('inqGrade')?.value.trim() || '',
      course: document.getElementById('inqCourse')?.value.trim() || '',
      source: 'Website',
      stage: 'lead',
      notes: 'Submitted via public website inquiry form',
      followUpDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    });
    addLeadActivity(lead.id, 'inquiry', 'Website inquiry form submitted');
    toast('Inquiry sent to CRM pipeline', 'success');
    refresh();
  });
}
