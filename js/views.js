import {
  getBatches,
  getBatch,
  getStudents,
  getStudent,
  getTeachers,
  getTeacher,
  getTests,
  getTest,
  getAttendanceHistory,
  getStudentAttendanceStats,
  getStudentTestStats,
  getStudentReport,
  getTeacherReport,
  getBatchProgress,
  getUpcomingSessions,
  getLeads,
  getLead,
  saveLead,
  moveLead,
  deleteLead,
  convertLeadToStudent,
  addLeadActivity,
  updateLead,
  markSessionComplete,
  cancelBatchSession,
  rescheduleBatchSession,
  restoreBatchSession,
  getBatchSession,
  getMessages,
  getState,
  saveBatch,
  deleteBatch,
  updateBatchSessions,
  saveTeacher,
  deleteTeacher,
  saveStudent,
  deleteStudent,
  saveAttendance,
  saveTest,
  deleteTest,
  updateSettings,
  resetDemo,
  exportAll,
  importAll,
  getInvoices,
  getBillingSettings,
  saveBillingSettings,
} from './store.js';
import {
  generateMonthlyInvoices,
  sendInvoiceReminder,
  sendBulkFeeReminders,
  markInvoicePaid,
  voidInvoice,
  getBillingStats,
  invoiceStatusBadge,
  periodLabel,
} from './billing.js';
import {
  sendWhatsApp,
  sendTestResultsToParents,
  sendAttendanceUpdate,
  openWhatsAppWeb,
  buildBulkAnnouncement,
} from './whatsapp.js';
import {
  dispatchCommunicationEvent,
  buildAttendancePayload,
  buildTestPayload,
} from './communication.js';
import { generateInsights, chatWithAI, runAIAction, getAICapabilities } from './ai.js';
import {
  generateOwnerDecisions, PLATFORM_LAYERS, CRM_STAGES, CRM_SOURCES,
  computeBusinessKPIs, getDropoutRiskStudents, getLeadAnalytics, getBatchAnalytics,
  generateTrendData, generatePredictions,
} from './intelligence.js';
import {
  getAIHistory,
  clearAIHistory,
  getTutorAvailability,
  formatTutorAvailabilitySummary,
  getAvailableAvailabilitySlots,
  getAvailabilitySlotBookings,
} from './platform.js';
import { renderLayerView, bindLayerEvents, layerPageMeta } from './layer-views.js';
import {
  generateSchedule,
  formatScheduleLabel,
  dayPickerHtml,
  bindDayPicker,
  sessionsPreviewHtml,
  formatTime,
  getAllSessions,
  sessionStatusBadge,
  normalizeSession,
} from './scheduler.js';
import { renderWeekCalendarHtml, getMondayOfWeek, addDays } from './schedule-calendar.js';
import { getCrmStats, searchLeads, getStageLabel, formatLeadAge } from './crm.js';
import { academyBanner, academyStatsGrid } from './academy.js';
import {
  renderPlatformDashboard, renderPlatformCenters, renderPlatformCenterDetail, renderPlatformRoadmap,
  renderTeacherHome, renderStudentHome, bindPlatformEvents,
} from './platform-views.js';
import { renderTuitionMarketplace, bindTuitionMarketplaceEvents } from './tuition-marketplace.js';

let chartInstance = null;

export const pageMeta = {
  dashboard: { title: 'Command Center', subtitle: 'Your education business at a glance' },
  intelligence: { title: 'Business Intelligence', subtitle: 'KPIs, trends, predictions, and daily decisions' },
  platform: { title: 'Platform Roadmap', subtitle: 'Product capabilities for tuition centers' },
  crm: { title: 'Education CRM', subtitle: 'Lead pipeline, demos, follow-ups, enrollment' },
  batches: { title: 'Batch Management', subtitle: 'Auto-schedule batches from topics and timings' },
  schedule: { title: 'Class Schedule', subtitle: 'In-app week calendar — cancel, reschedule, notify parents' },
  teachers: { title: 'Teachers', subtitle: 'Tutor roster and batch assignments' },
  students: { title: 'Student Management', subtitle: 'Records, batches, parent contacts' },
  fees: { title: 'Fees & Invoices', subtitle: 'Monthly tuition billing per student per batch — generate, remind, mark paid' },
  attendance: { title: 'Attendance Tracking', subtitle: 'Daily marking and parent notifications' },
  tests: { title: 'Tests & Marks', subtitle: 'Exam records and parent result sharing' },
  reports: { title: 'Reports', subtitle: 'Student and teacher performance reports' },
  whatsapp: { title: 'Communication Hub', subtitle: 'WhatsApp, email, SMS, push automations' },
  studentSuccess: layerPageMeta.studentSuccess,
  tutorHub: layerPageMeta.tutorHub,
  parentPortal: layerPageMeta.parentPortal,
  commHub: layerPageMeta.commHub,
  marketplace: layerPageMeta.marketplace,
  publicSite: layerPageMeta.publicSite,
  ai: { title: 'AI Assistants', subtitle: 'Owner, tutor, parent and student AI with actions' },
  settings: { title: 'Settings', subtitle: 'Configure your tutoring center' },
  teacherHome: { title: 'Teacher Today', subtitle: 'Your classes and tasks' },
  studentHome: { title: 'Student Home', subtitle: 'Schedule and homework status' },
  tuitionMarketplace: { title: 'Find Tuitions', subtitle: 'Browse tuition centers on EduOS' },
};

export function renderView(view, ctx, params = {}) {
  const raw = ctx?.rawState;
  const renderers = {
    dashboard: renderDashboard,
    intelligence: renderIntelligence,
    platform: renderPlatform,
    platformDashboard: () => renderPlatformDashboard(raw),
    platformCenters: () => renderPlatformCenters(raw),
    platformCenterDetail: () => renderPlatformCenterDetail(params.centerId, raw),
    platformRoadmap: renderPlatformRoadmap,
    teacherHome: renderTeacherHome,
    studentHome: renderStudentHome,
    tuitionMarketplace: () => renderTuitionMarketplace(raw),
    crm: renderCRM,
    batches: renderBatches,
    schedule: renderSchedule,
    teachers: renderTeachers,
    students: renderStudents,
    fees: renderFees,
    attendance: renderAttendance,
    tests: renderTests,
    reports: renderReports,
    whatsapp: renderCommHubCombined,
    studentSuccess: () => renderLayerView('studentSuccess'),
    tutorHub: () => renderLayerView('tutorHub'),
    parentPortal: () => renderLayerView('parentPortal'),
    commHub: () => renderLayerView('commHub'),
    marketplace: () => renderLayerView('marketplace'),
    publicSite: () => renderLayerView('publicSite'),
    ai: renderAI,
    settings: renderSettings,
  };
  return renderers[view]?.(ctx) || '<div class="empty-state"><h4>Page not found</h4></div>';
}

function renderDashboard() {
  const batches = getBatches();
  const students = getStudents();
  const messages = getMessages();
  const insights = generateInsights().slice(0, 3);
  const decisions = generateOwnerDecisions().slice(0, 4);

  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = getAttendanceHistory().filter((a) => a.date === today).length;
  const upcoming = getUpcomingSessions(batches, 5);

  return `
    <div class="vision-banner">
      <h3>The Operating System for Education Businesses</h3>
      <p>Acquire students · Run operations · Deliver learning · Grow revenue. EduOS tells you what to do next.</p>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Active Batches</div><div class="value">${batches.length}</div></div>
      <div class="stat-card"><div class="label">Total Students</div><div class="value">${students.length}</div></div>
      <div class="stat-card"><div class="label">Pipeline Leads</div><div class="value">${getLeads().filter((l) => l.stage !== 'converted').length}</div></div>
      <div class="stat-card"><div class="label">WhatsApp Sent</div><div class="value">${messages.filter((m) => m.status === 'sent').length}</div><div class="hint">${todayAttendance} batch(es) marked today</div></div>
    </div>
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-header"><h3>Upcoming Classes</h3><button class="btn btn-sm btn-secondary" data-action="go-schedule">Full Schedule</button></div>
      <div class="panel-body">
        ${upcoming.length ? upcoming.map((s) => `
          <div class="session-row">
            <div class="session-info">
              <h4>${s.topic}</h4>
              <p>${s.batchName} · ${s.date} · ${formatTime(s.startTime)}–${formatTime(s.endTime)}</p>
            </div>
            <div class="session-actions">
              <a href="${s.meetingLink}" target="_blank" class="btn btn-sm btn-primary">Join Meeting</a>
            </div>
          </div>`).join('') : '<p class="empty-state">No upcoming classes — create a batch and generate a schedule.</p>'}
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><h3>Performance Overview</h3></div>
        <div class="panel-body"><div class="chart-box"><canvas id="perfChart"></canvas></div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Today's Decisions</h3><button class="btn btn-sm btn-secondary" data-action="go-intelligence">View All</button></div>
        <div class="panel-body">
          ${decisions.map((d) => `
            <div class="decision-card ${d.priority}">
              <h4>${d.title}</h4>
              <p>${d.detail}</p>
              <button class="btn btn-sm btn-secondary" data-action="go-${d.action}">Take action</button>
            </div>`).join('')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>AI Insights</h3><button class="btn btn-sm btn-secondary" data-action="go-ai">Open AI</button></div>
        <div class="panel-body">
          <div class="insight-list">
            ${insights.length ? insights.map((i) => `<div class="insight-item">${i.text}</div>`).join('') : '<p class="empty-state">No insights yet — add attendance and test data.</p>'}
          </div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:20px">
      <div class="panel-header"><h3>Recent Students</h3><button class="btn btn-sm btn-primary" data-action="go-students">View All</button></div>
      <div class="panel-body table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Batch</th><th>Attendance</th><th>Test Avg</th><th>Parent</th></tr></thead>
          <tbody>
            ${students.slice(0, 5).map((s) => {
              const batch = getBatch(s.batchId);
              const att = getStudentAttendanceStats(s.id);
              const tests = getStudentTestStats(s.id);
              return `<tr>
                <td><strong>${s.name}</strong><br><small>${s.grade}</small></td>
                <td>${batch?.name || '—'}</td>
                <td><span class="badge ${att.rate >= 75 ? 'badge-green' : att.rate >= 50 ? 'badge-orange' : 'badge-red'}">${att.rate}%</span></td>
                <td>${tests.avg ? tests.avg + '%' : '—'}</td>
                <td>${s.parentName}<br><small>${s.parentPhone}</small></td>
              </tr>`;
            }).join('') || '<tr><td colspan="5" class="empty-state">No students yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderIntelligence() {
  return `
    <div class="vision-banner">
      <h3>Business Intelligence — Decisions, not reports</h3>
      <p>ERP systems record what happened. EduOS tells academy owners what to do next — with KPIs, trends, and predictions.</p>
    </div>
    <div class="report-tabs" id="biTabs">
      <button class="report-tab active" data-bi-tab="decisions">Decisions</button>
      <button class="report-tab" data-bi-tab="kpis">KPIs</button>
      <button class="report-tab" data-bi-tab="trends">Trends</button>
      <button class="report-tab" data-bi-tab="predictions">Predictions</button>
      <button class="report-tab" data-bi-tab="leads">Lead Analytics</button>
      <button class="report-tab" data-bi-tab="batches">Batch Analytics</button>
    </div>
    <div id="biContent">${biDecisionsHtml()}</div>`;
}

function biDecisionsHtml() {
  const decisions = generateOwnerDecisions();
  return `
    <div class="panel">
      <div class="panel-header"><h3>Today's Priority Decisions</h3></div>
      <div class="panel-body">
        ${decisions.map((d) => `
          <div class="decision-card ${d.priority}">
            <h4>${d.title}</h4>
            <p>${d.detail}</p>
            <button class="btn btn-sm btn-primary" data-action="go-${d.action}">Resolve</button>
          </div>`).join('')}
      </div>
    </div>`;
}

function biKpisHtml() {
  const k = computeBusinessKPIs();
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Overall Attendance</div><div class="value">${k.overallAttendance}%</div></div>
      <div class="stat-card"><div class="label">Avg Test Score</div><div class="value">${k.avgTestScore || '—'}${k.avgTestScore ? '%' : ''}</div></div>
      <div class="stat-card"><div class="label">Lead Conversion</div><div class="value">${k.leadConversion}%</div></div>
      <div class="stat-card"><div class="label">Curriculum Progress</div><div class="value">${k.avgCurriculum}%</div></div>
      <div class="stat-card"><div class="label">Capacity Used</div><div class="value">${k.capacityUsed}%</div></div>
      <div class="stat-card"><div class="label">At-Risk Students</div><div class="value">${k.atRiskStudents}</div></div>
      <div class="stat-card"><div class="label">Active Leads</div><div class="value">${k.activeLeads}</div></div>
      <div class="stat-card"><div class="label">Messages Sent</div><div class="value">${k.messagesSent}</div></div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Metrics → Decisions</h3></div>
    <div class="panel-body table-wrap">
      <table><thead><tr><th>Metric</th><th>Value</th><th>Status</th><th>Recommended Action</th></tr></thead>
      <tbody>
        <tr><td>Weekly attendance</td><td>${k.overallAttendance}%</td><td><span class="badge ${k.overallAttendance >= 80 ? 'badge-green' : 'badge-orange'}">${k.overallAttendance >= 80 ? 'OK' : 'Monitor'}</span></td><td>${k.overallAttendance < 80 ? 'Notify at-risk parents' : 'Maintain reminders'}</td></tr>
        <tr><td>Batch capacity</td><td>${k.capacityUsed}%</td><td><span class="badge ${k.capacityUsed >= 90 ? 'badge-red' : 'badge-green'}">${k.capacityUsed >= 90 ? 'Action' : 'OK'}</span></td><td>${k.capacityUsed >= 90 ? 'Open parallel batch' : 'Monitor enrollment'}</td></tr>
        <tr><td>Lead conversion</td><td>${k.leadConversion}%</td><td><span class="badge ${k.leadConversion >= 40 ? 'badge-green' : 'badge-orange'}">${k.leadConversion >= 40 ? 'OK' : 'Monitor'}</span></td><td>Schedule demo follow-ups</td></tr>
        <tr><td>Tutor utilization</td><td>${k.tutorUtilization}%</td><td><span class="badge badge-green">OK</span></td><td>${k.tutorUtilization > 150 ? 'Consider hiring' : 'Maintain load'}</td></tr>
        <tr><td>Dropout risk</td><td>${k.atRiskStudents} students</td><td><span class="badge ${k.atRiskStudents ? 'badge-red' : 'badge-green'}">${k.atRiskStudents ? 'Action' : 'OK'}</span></td><td>Apply intervention plans</td></tr>
      </tbody></table>
    </div></div>`;
}

function biTrendsHtml() {
  return `
    <div class="grid-2">
      <div class="panel"><div class="panel-header"><h3>Attendance Trend (4 weeks)</h3></div>
      <div class="panel-body"><div class="chart-box"><canvas id="biAttTrend"></canvas></div></div></div>
      <div class="panel"><div class="panel-header"><h3>Weekly Sessions Marked</h3></div>
      <div class="panel-body"><div class="chart-box"><canvas id="biSessionsTrend"></canvas></div></div></div>
    </div>`;
}

function biPredictionsHtml() {
  const predictions = generatePredictions();
  const atRisk = getDropoutRiskStudents();
  return `
    <div class="panel"><div class="panel-header"><h3>30-Day Forecast</h3></div><div class="panel-body">
      ${predictions.map((p) => `
        <div class="decision-card ${p.type === 'risk' ? 'high' : p.type === 'capacity' ? 'medium' : 'info'}">
          <h4>${p.title} <span class="badge badge-gray">${p.confidence}% confidence</span></h4>
          <p>${p.detail}</p>
        </div>`).join('')}
    </div></div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Dropout Risk Register</h3></div>
    <div class="panel-body table-wrap">
      <table><thead><tr><th>Student</th><th>Batch</th><th>Risk</th><th>Attendance</th><th>Tests</th><th>Factors</th><th></th></tr></thead>
      <tbody>${atRisk.map((s) => `<tr>
        <td>${s.name}</td><td>${s.batch || '—'}</td>
        <td><span class="badge ${s.risk === 'high' ? 'badge-red' : s.risk === 'medium' ? 'badge-orange' : 'badge-green'}">${s.risk}</span></td>
        <td>${s.attendance}%</td><td>${s.tests || '—'}${s.tests ? '%' : ''}</td><td>${s.factors.join(', ')}</td>
        <td><button class="btn btn-sm btn-secondary" data-action="go-studentSuccess">Intervene</button></td></tr>`).join('')}</tbody></table>
    </div></div>`;
}

function biLeadsHtml() {
  const analytics = getLeadAnalytics();
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Total Leads</div><div class="value">${analytics.total}</div></div>
      <div class="stat-card"><div class="label">Converted</div><div class="value">${analytics.converted}</div></div>
      <div class="stat-card"><div class="label">Conversion Rate</div><div class="value">${analytics.total ? Math.round((analytics.converted / analytics.total) * 100) : 0}%</div></div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="panel"><div class="panel-header"><h3>Leads by Source</h3></div><div class="panel-body table-wrap">
        <table><thead><tr><th>Source</th><th>Total</th><th>Converted</th><th>Rate</th></tr></thead>
        <tbody>${analytics.bySource.map((s) => `<tr><td>${s.source}</td><td>${s.total}</td><td>${s.converted}</td><td>${s.rate}%</td></tr>`).join('') || '<tr><td colspan="4">No leads</td></tr>'}</tbody></table>
      </div></div>
      <div class="panel"><div class="panel-header"><h3>Conversion Funnel</h3></div><div class="panel-body">
        ${analytics.funnel.map((f) => `<div class="session-row"><div class="session-info"><h4>${f.stage}</h4><p>${f.count} lead(s)</p></div><div class="progress-bar" style="width:80px"><span style="width:${analytics.total ? (f.count / analytics.total) * 100 : 0}%"></span></div></div>`).join('')}
      </div></div>
    </div>`;
}

function biBatchesHtml() {
  const batches = getBatchAnalytics();
  return `
    <div class="panel"><div class="panel-header"><h3>Batch Performance & Capacity</h3></div>
    <div class="panel-body table-wrap">
      <table><thead><tr><th>Batch</th><th>Teacher</th><th>Enrolled</th><th>Capacity</th><th>Utilization</th><th>Curriculum</th></tr></thead>
      <tbody>${batches.map((b) => `<tr>
        <td>${b.name}</td><td>${b.teacher}</td><td>${b.enrolled}</td><td>${b.capacity}</td>
        <td><span class="badge ${b.utilization >= 90 ? 'badge-red' : b.utilization >= 70 ? 'badge-orange' : 'badge-green'}">${b.utilization}%</span></td>
        <td><div class="progress-bar" style="width:80px"><span style="width:${b.progress}%"></span></div> ${b.progress}%</td></tr>`).join('') || '<tr><td colspan="6">No batches</td></tr>'}</tbody></table>
    </div></div>`;
}

function biTabContent(tab) {
  if (tab === 'decisions') return biDecisionsHtml();
  if (tab === 'kpis') return biKpisHtml();
  if (tab === 'trends') return biTrendsHtml();
  if (tab === 'predictions') return biPredictionsHtml();
  if (tab === 'leads') return biLeadsHtml();
  if (tab === 'batches') return biBatchesHtml();
  return biDecisionsHtml();
}

function renderPlatform() {
  return `
    <div class="vision-banner">
      <h3>EduOS platform roadmap</h3>
      <p>Nine capabilities that power a modern tuition center — from first inquiry to parent satisfaction.</p>
    </div>
    <div class="layer-grid">
      ${PLATFORM_LAYERS.map((layer) => `
        <div class="layer-card">
          <div class="layer-num">${layer.name} · Phase ${layer.phase}</div>
          <h4>${layer.name}</h4>
          <p style="font-size:0.82rem;color:var(--text-muted);margin:8px 0 12px">${layer.desc}</p>
          <div class="progress-bar"><span style="width:${layer.pct}%"></span></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:0.78rem">
            <span class="badge ${layer.status === 'building' ? 'badge-green' : layer.status === 'started' ? 'badge-orange' : 'badge-gray'}">${layer.status}</span>
            <span>${layer.pct}% built</span>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderCRM() {
  const stats = getCrmStats();
  return `
    ${academyBanner('Education CRM', 'Capture inquiries, run demos, follow up, and enroll students — your sales-to-operations pipeline.')}
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Active leads</div><div class="value">${stats.active}</div></div>
      <div class="stat-card"><div class="label">Conversion rate</div><div class="value">${stats.conversionRate}%</div></div>
      <div class="stat-card"><div class="label">Demos scheduled</div><div class="value">${stats.demosScheduled}</div></div>
      <div class="stat-card"><div class="label">Needs follow-up</div><div class="value">${stats.needsFollowUp}</div></div>
    </div>
    <div class="report-tabs" style="margin-top:16px">
      <button class="report-tab active" data-crm-tab="pipeline">Pipeline</button>
      <button class="report-tab" data-crm-tab="leads">All Leads</button>
      <button class="report-tab" data-crm-tab="followups">Follow-ups</button>
    </div>
    <div id="crmContent">${crmPipelineHtml()}</div>`;
}

function crmPipelineHtml() {
  const leads = getLeads();
  return `
    <div class="toolbar" style="margin-top:12px">
      <button class="btn btn-primary" data-action="add-lead">+ New Lead</button>
      <span style="font-size:0.85rem;color:var(--text-muted)">${leads.filter((l) => l.stage !== 'converted').length} active · ${leads.filter((l) => l.stage === 'converted').length} enrolled</span>
    </div>
    <div class="pipeline-board">
      ${CRM_STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.stage === stage.id);
        return `<div class="pipeline-column">
          <div class="pipeline-column-header">${stage.label} (${stageLeads.length})</div>
          ${stageLeads.map((lead) => crmLeadCard(lead, stage.id)).join('')}
        </div>`;
      }).join('')}
    </div>`;
}

function crmLeadCard(lead, stageId) {
  const meta = [
    lead.demoDate ? `Demo ${lead.demoDate}${lead.demoTime ? ' ' + formatTime(lead.demoTime) : ''}` : '',
    lead.followUpDate ? `Follow-up ${lead.followUpDate}` : '',
    formatLeadAge(lead.createdAt),
  ].filter(Boolean).join(' · ');
  return `
    <div class="pipeline-card" data-lead-id="${lead.id}">
      <h5>${lead.name}</h5>
      <p>${lead.course || 'General'} · Grade ${lead.grade || '—'}</p>
      <p>${lead.source} · ${lead.phone}</p>
      ${meta ? `<p style="font-size:0.75rem;color:var(--accent)">${meta}</p>` : ''}
      <div class="pipeline-actions">
        <button class="btn btn-sm btn-secondary" data-action="view-lead" data-id="${lead.id}">Details</button>
        ${stageId !== 'converted' ? `<button class="btn btn-sm btn-secondary" data-action="advance-lead" data-id="${lead.id}">Advance →</button>` : ''}
        ${stageId === 'batch_allocation' ? `<button class="btn btn-sm btn-primary" data-action="convert-lead" data-id="${lead.id}">Enroll</button>` : ''}
        ${lead.phone ? `<button class="btn btn-sm btn-secondary" data-action="wa-lead" data-id="${lead.id}">WhatsApp</button>` : ''}
        <button class="btn btn-sm btn-danger" data-action="delete-lead" data-id="${lead.id}">×</button>
      </div>
    </div>`;
}

function crmLeadsTableHtml() {
  const leads = searchLeads();
  return `
    <div class="toolbar" style="margin-top:12px">
      <input id="crmSearch" placeholder="Search leads…" style="flex:1;max-width:260px">
      <select id="crmStageFilter"><option value="">All stages</option>${CRM_STAGES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}</select>
      <select id="crmSourceFilter"><option value="">All sources</option>${CRM_SOURCES.map((s) => `<option value="${s}">${s}</option>`).join('')}</select>
      <button class="btn btn-primary" data-action="add-lead">+ New Lead</button>
    </div>
    <div class="panel"><div class="panel-body table-wrap">
      <table><thead><tr><th>Name</th><th>Stage</th><th>Source</th><th>Course</th><th>Contact</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody id="crmLeadsBody">${crmLeadRows(leads)}</tbody></table>
    </div></div>`;
}

function crmLeadRows(leads) {
  if (!leads.length) return '<tr><td colspan="7" class="empty-state">No leads match</td></tr>';
  return leads.map((l) => `<tr>
    <td><strong>${l.name}</strong><br><small>Grade ${l.grade || '—'}</small></td>
    <td><span class="badge badge-gray">${getStageLabel(l.stage)}</span></td>
    <td>${l.source}</td>
    <td>${l.course || '—'}</td>
    <td>${l.phone}<br><small>${l.email || ''}</small></td>
    <td>${l.createdAt || '—'}<br><small>${formatLeadAge(l.createdAt)}</small></td>
    <td><button class="btn btn-sm btn-secondary" data-action="view-lead" data-id="${l.id}">Open</button></td>
  </tr>`).join('');
}

function crmFollowUpsHtml() {
  const stats = getCrmStats();
  const today = new Date().toISOString().slice(0, 10);
  return `
    <div class="panel" style="margin-top:12px"><div class="panel-header"><h3>Due today or overdue (${stats.followUpLeads.length})</h3></div>
    <div class="panel-body">
      ${stats.followUpLeads.length ? stats.followUpLeads.map((l) => `
        <div class="session-row">
          <div class="session-info"><h4>${l.name}</h4><p>${getStageLabel(l.stage)} · Follow-up ${l.followUpDate} · ${l.phone}</p><p style="font-size:0.82rem;color:var(--text-muted)">${l.notes || ''}</p></div>
          <button class="btn btn-sm btn-primary" data-action="view-lead" data-id="${l.id}">Open</button>
          <button class="btn btn-sm btn-secondary" data-action="wa-lead" data-id="${l.id}">WhatsApp</button>
        </div>`).join('') : '<p class="empty-state">No follow-ups due — set follow-up dates on lead details.</p>'}
    </div></div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Pipeline by stage</h3></div>
    <div class="panel-body">${stats.byStage.filter((s) => s.count).map((s) => `
      <div class="session-row"><div class="session-info"><h4>${s.label}</h4><p>${s.count} lead(s)</p></div></div>`).join('') || '<p class="empty-state">No leads yet</p>'}
    </div></div>`;
}

function crmTabContent(tab) {
  if (tab === 'leads') return crmLeadsTableHtml();
  if (tab === 'followups') return crmFollowUpsHtml();
  return crmPipelineHtml();
}

function showEnrollLeadModal(leadId, { showModal, closeModal, toast, refresh }) {
  const batches = getBatches();
  if (!batches.length) return toast('Create a batch first', 'error');
  showModal({
    title: 'Enroll in batch',
    body: `<div class="form-group"><label>Batch</label><select id="enrollBatch">${batches.map((b) => `<option value="${b.id}">${b.name} (${getStudents(b.id).length}/${b.capacity})</option>`).join('')}</select></div>`,
    footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="confirmEnroll">Enroll student</button>`,
    onMount: () => {
      document.getElementById('confirmEnroll').onclick = () => {
        const result = convertLeadToStudent(leadId, document.getElementById('enrollBatch').value);
        if (result?.error) return toast(result.error, 'error');
        closeModal();
        toast('Lead enrolled as student', 'success');
        refresh();
      };
    },
  });
}

function showLeadModal(lead, ctx) {
  const { showModal, closeModal, toast, refresh } = ctx;
  const activities = (lead.activities || []).slice(0, 8);
  showModal({
    title: lead.name,
    wide: true,
    body: `<div class="grid-2">
      <div>
        <p style="font-size:0.88rem;line-height:1.7">
          <strong>Stage:</strong> ${getStageLabel(lead.stage)}<br>
          <strong>Source:</strong> ${lead.source}<br>
          <strong>Course:</strong> ${lead.course || '—'} · Grade ${lead.grade || '—'}<br>
          <strong>Phone:</strong> ${lead.phone || '—'} · <strong>Email:</strong> ${lead.email || '—'}<br>
          ${lead.demoDate ? `<strong>Demo:</strong> ${lead.demoDate} ${lead.demoTime ? formatTime(lead.demoTime) : ''}<br>` : ''}
          ${lead.followUpDate ? `<strong>Follow-up:</strong> ${lead.followUpDate}<br>` : ''}
          <strong>Notes:</strong> ${lead.notes || '—'}
        </p>
        ${lead.stage !== 'converted' ? `<div class="form-grid" style="margin-top:14px">
          <div class="form-group"><label>Move to stage</label>
            <select id="leadStageMove">${CRM_STAGES.filter((s) => s.id !== 'converted').map((s) => `<option value="${s.id}" ${s.id === lead.stage ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>Demo date</label><input type="date" id="leadDemoDate" value="${lead.demoDate || ''}"></div>
          <div class="form-group"><label>Demo time</label><input type="time" id="leadDemoTime" value="${lead.demoTime || ''}"></div>
          <div class="form-group"><label>Follow-up date</label><input type="date" id="leadFollowUp" value="${lead.followUpDate || ''}"></div>
          <div class="form-group full"><label>Notes</label><textarea id="leadNotesEdit" rows="2">${lead.notes || ''}</textarea></div>
          <div class="form-group full"><label>Log activity</label><input id="leadActivityNote" placeholder="Called parent, sent fee quote…"></div>
        </div>` : ''}
      </div>
      <div>
        <h4 style="margin-bottom:10px">Activity log</h4>
        ${activities.length ? activities.map((a) => `<div class="message-item"><div class="meta"><span>${a.type}</span><span>${new Date(a.at).toLocaleString()}</span></div><div class="body">${a.note}</div></div>`).join('') : '<p class="empty-state">No activity yet</p>'}
      </div>
    </div>`,
    footer: `<button class="btn btn-secondary" data-modal-cancel>Close</button>
      ${lead.phone ? `<button class="btn btn-secondary" id="leadWaBtn">WhatsApp</button>` : ''}
      ${lead.stage === 'batch_allocation' ? `<button class="btn btn-primary" id="leadEnrollBtn">Enroll</button>` : ''}
      ${lead.stage !== 'converted' ? `<button class="btn btn-primary" id="leadSaveBtn">Save</button>` : ''}`,
    onMount: () => {
      document.getElementById('leadWaBtn')?.addEventListener('click', () => {
        openWhatsAppWeb(lead.phone, `Hi ${lead.name}, this is ${getState().settings.tutorName}. Following up on your inquiry.`, getState().settings.defaultCountryCode);
      });
      document.getElementById('leadEnrollBtn')?.addEventListener('click', () => showEnrollLeadModal(lead.id, ctx));
      document.getElementById('leadSaveBtn')?.addEventListener('click', () => {
        const newStage = document.getElementById('leadStageMove')?.value;
        if (newStage && newStage !== lead.stage) moveLead(lead.id, newStage);
        updateLead(lead.id, {
          demoDate: document.getElementById('leadDemoDate')?.value || '',
          demoTime: document.getElementById('leadDemoTime')?.value || '',
          followUpDate: document.getElementById('leadFollowUp')?.value || '',
          notes: document.getElementById('leadNotesEdit')?.value.trim() || '',
        });
        const actNote = document.getElementById('leadActivityNote')?.value.trim();
        if (actNote) addLeadActivity(lead.id, 'note', actNote);
        closeModal();
        toast('Lead updated', 'success');
        refresh();
      });
    },
  });
}

function renderCommHubCombined() {
  return renderLayerView('commHub') + renderWhatsAppSendSection();
}

function renderWhatsAppSendSection() {
  const messages = getMessages();
  return `
    <div class="panel" style="margin-top:20px">
      <div class="panel-header"><h3>Send Message (WhatsApp)</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          <div class="form-group"><label>Phone</label><input id="waPhone" placeholder="Parent phone"></div>
          <div class="form-group full"><label>Message</label><textarea id="waMessage" rows="3"></textarea></div>
        </div>
        <div style="margin-top:12px;display:flex;gap:10px">
          <button class="btn btn-primary" data-action="send-wa">Send</button>
          <button class="btn btn-secondary" data-action="open-wa-web">WhatsApp Web</button>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:16px">
      <div class="panel-header"><h3>Recent Messages</h3></div>
      <div class="panel-body"><div class="whatsapp-log">${messages.slice(0, 5).map((m) => `<div class="message-item ${m.status}"><div class="meta"><span>${m.to}</span><span>${new Date(m.sentAt).toLocaleString()}</span></div><div class="body">${m.message}</div></div>`).join('') || 'No messages'}</div></div>
    </div>`;
}

function renderBatches() {
  const batches = getBatches();
  return `
    ${academyBanner('Academy OS — Batches', 'Create batches, assign tutors, auto-generate class schedules from your topic list.')}
    ${academyStatsGrid(['batches', 'students', 'capacityPct', 'fullBatches'])}
    <div class="toolbar" style="margin-top:12px">
      <button class="btn btn-primary" data-action="add-batch">+ New Batch</button>
    </div>
    <div class="card-grid">
      ${batches.map((b) => {
        const count = getStudents(b.id).length;
        const atCapacity = count >= (b.capacity || 999);
        const progress = getBatchProgress(b.id);
        const teacher = getTeacher(b.teacherId);
        const nextClass = (b.sessions || []).map(normalizeSession).find((s) => s.status === 'scheduled' && s.date >= new Date().toISOString().slice(0, 10));
        return `<div class="batch-card">
          <h4>${b.name}</h4>
          <div class="meta">${b.schedule || 'No schedule'}</div>
          <div class="tags">${(b.subjects || []).map((s) => `<span class="tag">${s}</span>`).join('')}</div>
          <div class="meta">${teacher ? `👩‍🏫 ${teacher.name} · ` : ''}${count}/${b.capacity} students ${atCapacity ? '· <span class="badge badge-orange">Full</span>' : ''}</div>
          <div class="meta">Fee: ₹${(b.monthlyFee || 0).toLocaleString('en-IN')}/mo · due day ${b.feeDueDay || 5}</div>
          <div class="meta">Curriculum: ${progress.completed}/${progress.total} classes (${progress.percent}%)</div>
          <div class="progress-bar"><span style="width:${progress.percent}%"></span></div>
          ${nextClass ? `<div class="meta" style="margin-top:10px">Next: ${nextClass.topic} on ${nextClass.date}</div>` : ''}
          <div class="actions" style="margin-top:12px">
            <button class="btn btn-sm btn-primary" data-action="view-schedule" data-id="${b.id}">Schedule</button>
            <button class="btn btn-sm btn-secondary" data-action="edit-batch" data-id="${b.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-action="delete-batch" data-id="${b.id}">Delete</button>
          </div>
        </div>`;
      }).join('') || '<div class="empty-state"><h4>No batches yet</h4><p>Create a batch, add topics, pick days & time — schedule generates automatically.</p></div>'}
    </div>`;
}

function renderSchedule() {
  const batches = getBatches();
  const weekStart = getMondayOfWeek(new Date());
  const calendarSessions = getAllSessions(batches, { includeCompleted: true, includeCancelled: true });
  const upcoming = scheduleTabSessions('upcoming', '');

  return `
    ${academyBanner('Class Schedule', 'In-app week calendar for all batches — click a class to cancel, reschedule, or mark done. Optional WhatsApp alerts to parents.')}
    ${academyStatsGrid(['todayClasses', 'upcoming', 'completed'])}
    <div class="report-tabs" style="margin-top:16px">
      <button class="report-tab active" data-sched-layout="calendar">Calendar</button>
      <button class="report-tab" data-sched-layout="list">List</button>
    </div>
    <div class="toolbar" style="margin-top:12px">
      <select id="scheduleFilter">
        <option value="">All batches</option>
        ${batches.map((b) => `<option value="${b.id}">${b.name}</option>`).join('')}
      </select>
    </div>
    <div class="panel" id="scheduleCalendarPanel">
      <div class="panel-header"><h3>Week calendar</h3></div>
      <div class="panel-body" id="scheduleCalendarWrap">
        ${renderWeekCalendarHtml(calendarSessions, weekStart)}
      </div>
    </div>
    <div class="panel hidden" id="scheduleListPanel">
      <div class="panel-header"><h3>Session list</h3></div>
      <div class="panel-body">
        <div class="report-tabs" style="margin-bottom:12px">
          <button class="report-tab active" data-sched-tab="upcoming">Upcoming</button>
          <button class="report-tab" data-sched-tab="all">All</button>
          <button class="report-tab" data-sched-tab="completed">Completed</button>
          <button class="report-tab" data-sched-tab="cancelled">Cancelled</button>
        </div>
        <div id="scheduleList">
          ${scheduleListHtml(upcoming, { showManage: true })}
        </div>
      </div>
    </div>`;
}

function scheduleTabSessions(tab, batchId) {
  const batches = getBatches();
  const filtered = batchId ? batches.filter((b) => b.id === batchId) : batches;
  const today = new Date().toISOString().slice(0, 10);
  if (tab === 'completed') return getAllSessions(filtered).filter((s) => s.status === 'completed');
  if (tab === 'cancelled') return getAllSessions(filtered, { includeCompleted: true }).filter((s) => s.status === 'cancelled');
  if (tab === 'all') return getAllSessions(filtered, { includeCompleted: true, includeCancelled: true });
  return getAllSessions(filtered, { includeCompleted: false, includeCancelled: false }).filter((s) => s.date >= today);
}

function sessionRescheduleNote(session) {
  const s = normalizeSession(session);
  if (!s.rescheduledFrom) return '';
  return `<br><small>Was ${s.rescheduledFrom.date} · ${formatTime(s.rescheduledFrom.startTime)}</small>`;
}

function sessionManageButtons(s) {
  const st = normalizeSession(s);
  const base = `data-batch="${s.batchId}" data-session="${s.id}"`;
  if (st.status === 'scheduled') {
    return `
      <button class="btn btn-sm btn-secondary" data-action="reschedule-session" ${base}>Reschedule</button>
      <button class="btn btn-sm btn-secondary" data-action="cancel-session" ${base}>Cancel</button>
      <button class="btn btn-sm btn-secondary" data-action="complete-session" ${base}>Mark done</button>`;
  }
  if (st.status === 'cancelled') {
    return `<button class="btn btn-sm btn-secondary" data-action="restore-session" ${base}>Restore</button>`;
  }
  if (st.status === 'completed') {
    return `<button class="btn btn-sm btn-secondary" data-action="undo-session" ${base}>Undo</button>`;
  }
  return '';
}

function scheduleListHtml(sessions, { showManage = false } = {}) {
  if (!sessions.length) {
    return '<div class="empty-state"><h4>No sessions</h4><p>Create a batch, add topics, and generate a schedule.</p></div>';
  }

  return sessions.map((s) => {
    const st = normalizeSession(s);
    return `
    <div class="session-row" data-batch-id="${s.batchId}" data-session-id="${s.id}">
      <div class="session-info">
        <h4>${s.topic} ${sessionStatusBadge(s)}</h4>
        <p><strong>${s.batchName}</strong> · ${s.date} · ${formatTime(s.startTime)}–${formatTime(s.endTime)}${sessionRescheduleNote(s)}</p>
        ${st.cancelReason ? `<p style="font-size:0.82rem;color:var(--text-muted)">Cancel note: ${st.cancelReason}</p>` : ''}
      </div>
      <div class="session-actions">
        ${st.status === 'scheduled' ? `<a href="${s.meetingLink}" target="_blank" class="btn btn-sm btn-primary">Join Meeting</a>` : ''}
        <button class="btn btn-sm btn-secondary" data-action="copy-link" data-link="${s.meetingLink || ''}">Copy Link</button>
        <button class="btn btn-sm btn-ghost" data-action="open-session" data-batch="${s.batchId}" data-session="${s.id}">Details</button>
        ${showManage ? sessionManageButtons(s) : ''}
      </div>
    </div>`;
  }).join('');
}

function renderTeachers() {
  const teachers = getTeachers();
  return `
    ${academyBanner('Teachers', 'Manage your tutor roster and see batch load at a glance.')}
    ${academyStatsGrid(['teachers', 'batches', 'students'])}
    <div class="toolbar" style="margin-top:12px">
      <button class="btn btn-primary" data-action="add-teacher">+ Add Teacher</button>
    </div>
    <div class="card-grid">
      ${teachers.map((t) => {
        const report = getTeacherReport(t.id);
        return `<div class="batch-card">
          <h4>${t.name}</h4>
          <div class="meta">${t.email} · ${t.phone}</div>
          <div class="tags">${(t.subjects || []).map((s) => `<span class="tag">${s}</span>`).join('')}</div>
          <div class="meta">${report.batchCount} batches · ${report.studentCount} students · ${report.completionRate}% curriculum done</div>
          <div class="actions" style="margin-top:12px">
            <button class="btn btn-sm btn-secondary" data-action="edit-teacher" data-id="${t.id}">Edit</button>
            <button class="btn btn-sm btn-primary" data-action="teacher-report" data-id="${t.id}">Report</button>
            <button class="btn btn-sm btn-danger" data-action="delete-teacher" data-id="${t.id}">Delete</button>
          </div>
        </div>`;
      }).join('') || '<div class="empty-state"><h4>No teachers yet</h4><p>Add teachers and assign them to batches.</p></div>'}
    </div>`;
}

function renderReports() {
  return `
    <div class="report-tabs">
      <button class="report-tab active" data-report-tab="students">Student Reports</button>
      <button class="report-tab" data-report-tab="teachers">Teacher Reports</button>
    </div>
    <div id="reportContent">${studentReportHtml()}</div>`;
}

function studentReportHtml() {
  const students = getStudents();
  return `
    <div class="panel">
      <div class="panel-header"><h3>Student Performance Report</h3></div>
      <div class="panel-body table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Batch</th><th>Attendance</th><th>Test Avg</th><th>Curriculum</th><th>Progress</th></tr></thead>
          <tbody>
            ${students.map((s) => {
              const report = getStudentReport(s.id);
              return `<tr>
                <td><strong>${s.name}</strong><br><small>Grade ${s.grade}</small></td>
                <td>${report.batch?.name || '—'}</td>
                <td><span class="badge ${report.attendance.rate >= 75 ? 'badge-green' : report.attendance.rate >= 50 ? 'badge-orange' : 'badge-red'}">${report.attendance.rate}%</span></td>
                <td>${report.tests.avg ? report.tests.avg + '%' : '—'}</td>
                <td>${report.sessionsCompleted}/${report.sessionsTotal} classes</td>
                <td>
                  <div class="progress-bar" style="width:100px"><span style="width:${report.curriculumProgress}%"></span></div>
                  <small>${report.curriculumProgress}%</small>
                </td>
              </tr>`;
            }).join('') || '<tr><td colspan="6" class="empty-state">No students yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function teacherReportHtml() {
  const teachers = getTeachers();
  return `
    <div class="panel">
      <div class="panel-header"><h3>Teacher Performance Report</h3></div>
      <div class="panel-body table-wrap">
        <table>
          <thead><tr><th>Teacher</th><th>Batches</th><th>Students</th><th>Classes Done</th><th>Completion</th><th>Upcoming</th></tr></thead>
          <tbody>
            ${teachers.map((t) => {
              const report = getTeacherReport(t.id);
              return `<tr>
                <td><strong>${t.name}</strong><br><small>${(t.subjects || []).join(', ')}</small></td>
                <td>${report.batchCount}</td>
                <td>${report.studentCount}</td>
                <td>${report.sessionsCompleted}/${report.sessionsTotal}</td>
                <td><span class="badge ${report.completionRate >= 75 ? 'badge-green' : 'badge-orange'}">${report.completionRate}%</span></td>
                <td>${report.upcoming.length ? report.upcoming[0].topic + ' (' + report.upcoming[0].date + ')' : '—'}</td>
              </tr>`;
            }).join('') || '<tr><td colspan="6" class="empty-state">No teachers yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderStudents() {
  const students = getStudents();
  const batches = getBatches();
  return `
    ${academyBanner('Students', 'Student records with batch assignment and parent contact details.')}
    ${academyStatsGrid(['students', 'batches', 'capacityPct'])}
    <div class="toolbar" style="margin-top:12px">
      <button class="btn btn-primary" data-action="add-student">+ Add Student</button>
      <select id="filterBatch">
        <option value="">All batches</option>
        ${batches.map((b) => `<option value="${b.id}">${b.name}</option>`).join('')}
      </select>
    </div>
    <div class="panel">
      <div class="panel-body table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Batch</th><th>Contact</th><th>Parent</th><th>Actions</th></tr></thead>
          <tbody id="studentsTable">
            ${studentRows(students)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function studentRows(students) {
  if (!students.length) return '<tr><td colspan="5" class="empty-state">No students yet</td></tr>';
  return students.map((s) => {
    const batch = getBatch(s.batchId);
    return `<tr data-batch="${s.batchId}">
      <td><strong>${s.name}</strong><br><small>Grade ${s.grade}</small></td>
      <td>${batch?.name || '—'}</td>
      <td>${s.phone}<br><small>${s.email}</small></td>
      <td>${s.parentName}<br><small>${s.parentPhone}</small></td>
      <td>
        <button class="btn btn-sm btn-secondary" data-action="edit-student" data-id="${s.id}">Edit</button>
        <button class="btn btn-sm btn-danger" data-action="delete-student" data-id="${s.id}">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

function renderFees() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const batches = getBatches();
  const stats = getBillingStats(getInvoices().filter((i) => i.periodStart === periodStart));
  const invoices = getInvoices();

  return `
    ${academyBanner('Fees & Invoices', 'Bill each student per batch monthly. Generate invoices, send WhatsApp reminders with UPI, and mark offline payments.')}
    <div class="fee-stats">
      <div class="stat-card"><div class="stat-label">Expected this month</div><div class="stat-value">₹${stats.expected.toLocaleString('en-IN')}</div></div>
      <div class="stat-card"><div class="stat-label">Collected</div><div class="stat-value stat-green">₹${stats.collected.toLocaleString('en-IN')}</div></div>
      <div class="stat-card"><div class="stat-label">Overdue</div><div class="stat-value ${stats.overdue ? 'stat-red' : ''}">${stats.overdue}</div></div>
      <div class="stat-card"><div class="stat-label">Parent reported</div><div class="stat-value">${stats.reported || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Paid / Total</div><div class="stat-value">${stats.paid} / ${stats.total}</div></div>
    </div>
    <div class="toolbar" style="margin-top:16px">
      <select id="feeMonth">
        ${[-2, -1, 0, 1].map((offset) => {
          const d = new Date(year, month - 1 + offset, 1);
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          const val = `${y}-${String(m).padStart(2, '0')}`;
          return `<option value="${val}" ${val === `${year}-${String(month).padStart(2, '0')}` ? 'selected' : ''}>${periodLabel(y, m)}</option>`;
        }).join('')}
      </select>
      <select id="feeBatchFilter">
        <option value="">All batches</option>
        ${batches.map((b) => `<option value="${b.id}">${b.name}</option>`).join('')}
      </select>
      <select id="feeStatusFilter">
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="sent">Sent</option>
        <option value="overdue">Overdue</option>
        <option value="payment_reported">Parent reported paid</option>
        <option value="paid">Paid</option>
      </select>
      <button class="btn btn-primary" data-action="generate-invoices">Generate invoices</button>
      <button class="btn btn-secondary" data-action="send-overdue-reminders">Send overdue reminders</button>
    </div>
    <div class="panel">
      <div class="panel-header"><h3>Invoices — ${periodLabel(year, month)}</h3></div>
      <div class="panel-body table-wrap">
        <table class="invoice-table">
          <thead>
            <tr><th>Invoice</th><th>Student</th><th>Batch</th><th>Amount</th><th>Due</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody id="invoiceTableBody">
            ${invoiceRows(invoices, periodStart)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function invoiceRows(invoices, periodStart) {
  const batchFilter = document.getElementById('feeBatchFilter')?.value;
  const statusFilter = document.getElementById('feeStatusFilter')?.value;
  const monthFilter = document.getElementById('feeMonth')?.value;

  let list = invoices;
  if (monthFilter) {
    const ps = `${monthFilter}-01`;
    list = list.filter((i) => i.periodStart === ps);
  } else if (periodStart) {
    list = list.filter((i) => i.periodStart === periodStart);
  }
  if (batchFilter) list = list.filter((i) => i.batchId === batchFilter);
  if (statusFilter) list = list.filter((i) => i.status === statusFilter);

  if (!list.length) {
    return `<tr><td colspan="7" class="empty-state">No invoices yet. Set batch fees, then click <strong>Generate invoices</strong>.</td></tr>`;
  }

  return list.map((inv) => `
    <tr class="${inv.status === 'payment_reported' ? 'invoice-reported' : ''}">
      <td><strong>${inv.invoiceNumber}</strong><br><small>${inv.periodLabel || inv.periodStart?.slice(0, 7)}</small></td>
      <td>${inv.studentName}<br><small>${inv.parentName || '—'}</small></td>
      <td>${inv.batchName}</td>
      <td>₹${inv.amount.toLocaleString('en-IN')}</td>
      <td>${inv.dueDate}</td>
      <td>${invoiceStatusBadge(inv.status)}${inv.parentReportedAt ? `<br><small>Reported ${new Date(inv.parentReportedAt).toLocaleDateString()}</small>` : ''}</td>
      <td class="invoice-actions">
        ${inv.status !== 'paid' && inv.status !== 'void' && inv.status !== 'payment_reported' ? `<button class="btn btn-sm btn-primary" data-action="send-invoice-reminder" data-id="${inv.id}">Send</button>` : ''}
        ${inv.status !== 'paid' && inv.status !== 'void' ? `<button class="btn btn-sm ${inv.status === 'payment_reported' ? 'btn-primary' : 'btn-secondary'}" data-action="mark-invoice-paid" data-id="${inv.id}">${inv.status === 'payment_reported' ? 'Confirm payment' : 'Mark paid'}</button>` : ''}
        ${inv.status === 'draft' ? `<button class="btn btn-sm btn-ghost" data-action="void-invoice" data-id="${inv.id}">Void</button>` : ''}
      </td>
    </tr>`).join('');
}

function renderAttendance() {
  const batches = getBatches();
  const today = new Date().toISOString().slice(0, 10);
  return `
    ${academyBanner('Attendance', 'Mark daily attendance and optionally notify parents — logistics, not lesson delivery.')}
    ${academyStatsGrid(['attendanceSessions', 'students', 'todayClasses'])}
    <div class="toolbar" style="margin-top:12px">
      <select id="attBatch">${batches.map((b) => `<option value="${b.id}">${b.name}</option>`).join('') || '<option value="">No batches</option>'}</select>
      <input type="date" id="attDate" value="${today}">
      <button class="btn btn-primary" data-action="save-attendance">Save Attendance</button>
      <label><input type="checkbox" id="notifyParents"> Notify parents via WhatsApp</label>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><h3>Mark Attendance</h3></div>
        <div class="panel-body"><div class="attendance-grid" id="attendanceGrid">${attendanceGridHtml(batches[0]?.id, today)}</div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Attendance Patterns</h3></div>
        <div class="panel-body"><div class="chart-box"><canvas id="attChart"></canvas></div></div>
      </div>
    </div>
    <div class="panel" style="margin-top:20px">
      <div class="panel-header"><h3>History</h3></div>
      <div class="panel-body table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Batch</th><th>Present</th><th>Absent</th><th>Late</th></tr></thead>
          <tbody>${attendanceHistoryRows()}</tbody>
        </table>
      </div>
    </div>`;
}

function attendanceGridHtml(batchId, date) {
  if (!batchId) return '<div class="empty-state">Create a batch first</div>';
  const students = getStudents(batchId);
  const existing = getAttendanceHistory().find((a) => a.batchId === batchId && a.date === date);
  if (!students.length) return '<div class="empty-state">No students in this batch</div>';

  return students.map((s) => {
    const status = existing?.records[s.id] || 'present';
    return `<div class="attendance-item" data-student="${s.id}">
      <div class="name">${s.name}</div>
      <div class="att-toggle">
        <button class="${status === 'present' ? 'active-present' : ''}" data-status="present">Present</button>
        <button class="${status === 'absent' ? 'active-absent' : ''}" data-status="absent">Absent</button>
        <button class="${status === 'late' ? 'active-late' : ''}" data-status="late">Late</button>
      </div>
    </div>`;
  }).join('');
}

function attendanceHistoryRows() {
  return getAttendanceHistory().slice(0, 10).map((a) => {
    const batch = getBatch(a.batchId);
    const vals = Object.values(a.records);
    return `<tr>
      <td>${a.date}</td>
      <td>${batch?.name || '—'}</td>
      <td>${vals.filter((v) => v === 'present').length}</td>
      <td>${vals.filter((v) => v === 'absent').length}</td>
      <td>${vals.filter((v) => v === 'late').length}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty-state">No records yet</td></tr>';
}

function renderTests() {
  const tests = getTests();
  return `
    ${academyBanner('Tests & Marks', 'Record exam scores and share results with parents via WhatsApp.')}
    ${academyStatsGrid(['tests', 'students', 'batches'])}
    <div class="toolbar" style="margin-top:12px">
      <button class="btn btn-primary" data-action="add-test">+ Record Test</button>
    </div>
    <div class="panel">
      <div class="panel-body table-wrap">
        <table>
          <thead><tr><th>Test</th><th>Batch</th><th>Subject</th><th>Date</th><th>Avg Score</th><th>Actions</th></tr></thead>
          <tbody>
            ${tests.map((t) => {
              const batch = getBatch(t.batchId);
              const scores = Object.values(t.marks);
              const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
              const pct = scores.length ? Math.round((avg / t.maxMarks) * 100) : 0;
              return `<tr>
                <td><strong>${t.name}</strong></td>
                <td>${batch?.name || '—'}</td>
                <td>${t.subject}</td>
                <td>${t.date}</td>
                <td><span class="badge ${pct >= 75 ? 'badge-green' : pct >= 50 ? 'badge-orange' : 'badge-red'}">${pct}%</span></td>
                <td>
                  <button class="btn btn-sm btn-secondary" data-action="edit-test" data-id="${t.id}">Edit</button>
                  <button class="btn btn-sm btn-primary" data-action="whatsapp-test" data-id="${t.id}">Send to Parents</button>
                  <button class="btn btn-sm btn-danger" data-action="delete-test" data-id="${t.id}">Delete</button>
                </td>
              </tr>`;
            }).join('') || '<tr><td colspan="6" class="empty-state">No tests recorded yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderWhatsApp() {
  const messages = getMessages();
  return `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><h3>Send Message</h3></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="form-group"><label>Recipient phone</label><input id="waPhone" placeholder="Parent phone number"></div>
            <div class="form-group"><label>Message type</label>
              <select id="waType">
                <option value="general">General</option>
                <option value="attendance">Attendance</option>
                <option value="test_result">Test Result</option>
                <option value="announcement">Announcement</option>
              </select>
            </div>
            <div class="form-group full"><label>Message</label><textarea id="waMessage" rows="6" placeholder="Type your message..."></textarea></div>
          </div>
          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" data-action="send-wa">Send via API / Simulate</button>
            <button class="btn btn-secondary" data-action="open-wa-web">Open in WhatsApp Web</button>
          </div>
          <p style="margin-top:14px;font-size:0.82rem;color:var(--text-muted)">Configure WhatsApp Business API credentials in Settings for live sending. Without credentials, messages are simulated and logged.</p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Quick Announcement</h3></div>
        <div class="panel-body">
          <div class="form-group"><label>Title</label><input id="announceTitle" placeholder="Holiday notice"></div>
          <div class="form-group" style="margin-top:10px"><label>Body</label><textarea id="announceBody" rows="4"></textarea></div>
          <button class="btn btn-primary" style="margin-top:12px" data-action="broadcast">Send to All Parents</button>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:20px">
      <div class="panel-header"><h3>Message Log</h3></div>
      <div class="panel-body">
        <div class="whatsapp-log">
          ${messages.length ? messages.map((m) => `
            <div class="message-item ${m.status}">
              <div class="meta"><span>To: ${m.to} · ${m.type}</span><span>${new Date(m.sentAt).toLocaleString()} ${m.simulated ? '(simulated)' : ''}</span></div>
              <div class="body">${m.message}</div>
            </div>`).join('') : '<div class="empty-state">No messages sent yet</div>'}
        </div>
      </div>
    </div>`;
}

function renderAI() {
  const history = getAIHistory().slice(0, 5);
  return `
    <div class="vision-banner"><h3>AI Assistants</h3><p>Four specialized AI assistants with chat, one-click actions, auto insights, and conversation history.</p></div>
    <div class="report-tabs" id="aiMainTabs">
      <button class="report-tab active" data-ai-main="chat">Chat</button>
      <button class="report-tab" data-ai-main="actions">Actions</button>
      <button class="report-tab" data-ai-main="insights">Insights</button>
      <button class="report-tab" data-ai-main="history">History</button>
    </div>
    <div id="aiMainContent">${aiChatHtml()}</div>
    ${history.length ? `<div class="panel" style="margin-top:16px;display:none" id="aiHistoryPanel"><div class="panel-header"><h3>Recent Conversations</h3><button class="btn btn-sm btn-danger" data-action="clear-ai-history">Clear</button></div>
    <div class="panel-body">${history.map((h) => `<div class="message-item"><div class="meta"><span>${h.role}</span><span>${new Date(h.timestamp).toLocaleString()}</span></div><div class="body"><strong>You:</strong> ${h.userMessage.slice(0, 80)}…</div></div>`).join('')}</div></div>` : ''}`;
}

function aiChatHtml() {
  return `
    <div class="report-tabs" id="aiRoleTabs" style="margin-bottom:16px">
      <button class="report-tab active" data-ai-role="owner">Academy Owner</button>
      <button class="report-tab" data-ai-role="tutor">Tutor</button>
      <button class="report-tab" data-ai-role="parent">Parent</button>
      <button class="report-tab" data-ai-role="student">Student</button>
    </div>
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><h3 id="aiRoleTitle">AI Academy Manager</h3><span class="badge badge-gray" id="aiModeBadge">${getState().settings.openaiApiKey ? 'GPT enabled' : 'Rule-based'}</span></div>
        <div class="panel-body ai-chat">
          <div class="ai-suggestions" id="aiSuggestions">
            <button data-ai-prompt="Show me today's problems">Today's problems</button>
            <button data-ai-prompt="Show insights">Insights</button>
            <button data-ai-prompt="How is attendance?">Attendance</button>
          </div>
          <div class="ai-messages" id="aiMessages">
            <div class="ai-msg assistant">I'm your AI Academy Manager. Ask about operations, attendance, capacity, or lead pipeline.</div>
          </div>
          <div class="ai-input-row">
            <input id="aiInput" placeholder="Ask the academy manager...">
            <button class="btn btn-primary" data-action="ai-send">Send</button>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3>Auto Insights</h3><button class="btn btn-sm btn-secondary" data-action="refresh-insights">Refresh</button></div>
        <div class="panel-body"><div class="insight-list" id="aiInsights">${insightHtml()}</div></div>
      </div>
    </div>`;
}

function aiActionsHtml(role = 'owner') {
  const caps = getAICapabilities(role);
  const students = getStudents();
  return `
    <div class="toolbar">
      <label>Role:</label>
      <select id="aiActionRole">
        <option value="owner" ${role === 'owner' ? 'selected' : ''}>Academy Owner</option>
        <option value="tutor" ${role === 'tutor' ? 'selected' : ''}>Tutor</option>
        <option value="parent" ${role === 'parent' ? 'selected' : ''}>Parent</option>
        <option value="student" ${role === 'student' ? 'selected' : ''}>Student</option>
      </select>
      ${students.length ? `<select id="aiActionStudent" style="margin-left:10px">${students.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}</select>` : ''}
      <input id="aiActionTopic" placeholder="Topic (optional)" style="margin-left:10px">
    </div>
    <div class="card-grid" id="aiActionGrid">${caps.map((c) => `
      <div class="batch-card">
        <h4>${c.label}</h4>
        <p style="font-size:0.82rem;color:var(--text-muted);margin:8px 0">${c.desc}</p>
        <button class="btn btn-sm btn-primary" data-ai-action="${c.id}">Run</button>
      </div>`).join('')}</div>
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Action Result</h3></div>
    <div class="panel-body"><pre id="aiActionResult" style="white-space:pre-wrap;font-family:inherit;font-size:0.88rem;background:var(--surface-2);padding:16px;border-radius:var(--radius-sm)">Select an action above to see results.</pre></div></div>`;
}

function aiHistoryHtml(role) {
  const history = getAIHistory(role);
  return `
    <div class="toolbar">
      <label>Filter role:</label>
      <select id="aiHistoryRole"><option value="">All</option><option value="owner">Owner</option><option value="tutor">Tutor</option><option value="parent">Parent</option><option value="student">Student</option></select>
      <button class="btn btn-secondary" data-action="clear-ai-history">Clear History</button>
    </div>
    <div class="panel"><div class="panel-body">${history.length ? history.map((h) => `
      <div class="message-item"><div class="meta"><span class="badge badge-gray">${h.role}</span><span>${new Date(h.timestamp).toLocaleString()}</span></div>
      <div class="body"><strong>Q:</strong> ${h.userMessage}<br><br><strong>A:</strong> ${h.assistantReply.slice(0, 300)}${h.assistantReply.length > 300 ? '…' : ''}</div></div>`).join('') : '<p class="empty-state">No conversations yet — start chatting in the Chat tab.</p>'}</div></div>`;
}

function formatAIActionResult(result) {
  if (result.type === 'lesson_plan') return `Lesson Plan: ${result.topic}\n\nObjectives: ${result.objectives}\n\nActivities:\n${result.activities}\n\nHomework: ${result.homework}\n\nQuiz: ${result.quiz}`;
  if (result.type === 'parent_message') return `Message for ${result.student}:\n\n${result.body}`;
  if (result.type === 'quiz') return `Quiz: ${result.topic}\n\n${result.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
  if (result.type === 'decisions') return result.items.map((d, i) => `${i + 1}. [${d.priority}] ${d.title}: ${d.detail}`).join('\n\n');
  if (result.type === 'dropout_risk') return result.students.length ? result.students.map((s) => `• ${s.name} (${s.batch}) — ${s.risk} risk: ${s.factors.join(', ')}`).join('\n') : 'No at-risk students detected.';
  if (result.type === 'study_plan') return result.plan;
  return result.message || JSON.stringify(result, null, 2);
}

function insightHtml() {
  const insights = generateInsights();
  return insights.length
    ? insights.map((i) => `<div class="insight-item">${i.text}</div>`).join('')
    : '<p class="empty-state">Add more data to unlock insights.</p>';
}

function renderSettings() {
  const s = getState().settings;
  const billing = getBillingSettings();
  return `
    <div class="panel">
      <div class="panel-header"><h3>Center Details</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          <div class="form-group full"><label>Tutoring center name</label><input id="setTutorName" value="${s.tutorName}"></div>
          <div class="form-group"><label>Default country code</label><input id="setCountryCode" value="${s.defaultCountryCode}"></div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:20px">
      <div class="panel-header"><h3>WhatsApp Business API</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          <div class="form-group full"><label>API Access Token</label><input id="setWaKey" type="password" value="${s.whatsappApiKey}" placeholder="Meta WhatsApp Business API token"></div>
          <div class="form-group full"><label>Phone Number ID</label><input id="setWaPhoneId" value="${s.whatsappPhoneId}" placeholder="From Meta Developer Console"></div>
        </div>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-top:10px">Get credentials from Meta Business Suite. Without these, messages are simulated locally.</p>
      </div>
    </div>
    <div class="panel" style="margin-top:20px">
      <div class="panel-header"><h3>Billing & Invoices</h3></div>
      <div class="panel-body">
        <div class="form-grid">
          <div class="form-group"><label>Invoice prefix</label><input id="setInvPrefix" value="${billing.invoicePrefix || 'INV'}"></div>
          <div class="form-group"><label>Default due day (1–28)</label><input type="number" id="setDueDay" min="1" max="28" value="${billing.defaultDueDay || 5}"></div>
          <div class="form-group full"><label>UPI ID (shown in fee reminders)</label><input id="setUpiId" value="${billing.upiId || ''}" placeholder="yourname@upi"></div>
          <div class="form-group full"><label>Bank details (optional)</label><textarea id="setBankDetails" rows="2" placeholder="Account name, IFSC, account number">${billing.bankDetails || ''}</textarea></div>
        </div>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-top:10px">Set batch monthly fees under Batches. Per-student overrides are on the student form.</p>
      </div>
    </div>
    <div class="panel" style="margin-top:20px">
      <div class="panel-header"><h3>AI Assistant (OpenAI)</h3></div>
      <div class="panel-body">
        <div class="form-group"><label>OpenAI API Key</label><input id="setOpenAI" type="password" value="${s.openaiApiKey}" placeholder="sk-..."></div>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-top:10px">Optional. Enables GPT-powered conversational AI. Works offline with rule-based AI without a key.</p>
        <button class="btn btn-primary" style="margin-top:16px" data-action="save-settings">Save Settings</button>
      </div>
    </div>
    <div class="panel" style="margin-top:20px">
      <div class="panel-header"><h3>Data Management</h3></div>
      <div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-secondary" data-action="reset-demo">Reset Demo Data</button>
        <button class="btn btn-secondary" data-action="import-data">Import JSON</button>
      </div>
    </div>`;
}

export function initCharts(view) {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (view === 'dashboard') initPerfChart();
  if (view === 'attendance') initAttChart();
  if (view === 'intelligence') initBICharts();
}

function initPerfChart() {
  const canvas = document.getElementById('perfChart');
  if (!canvas || !window.Chart) return;

  const students = getStudents();
  const labels = students.map((s) => s.name.split(' ')[0]);
  const data = students.map((s) => getStudentTestStats(s.id).avg || 0);

  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Avg Test Score (%)',
        data,
        backgroundColor: 'rgba(45, 106, 79, 0.7)',
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  });
}

function initBICharts() {
  if (!window.Chart) return;
  const trends = generateTrendData();

  const attCanvas = document.getElementById('biAttTrend');
  if (attCanvas) {
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(attCanvas, {
      type: 'line',
      data: {
        labels: trends.map((t) => t.label),
        datasets: [{ label: 'Attendance %', data: trends.map((t) => t.attendance ?? 0), borderColor: '#2d6a4f', backgroundColor: 'rgba(45,106,79,0.15)', fill: true, tension: 0.3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } },
    });
  }

  const sessCanvas = document.getElementById('biSessionsTrend');
  if (sessCanvas) {
    const sessChart = new Chart(sessCanvas, {
      type: 'bar',
      data: {
        labels: trends.map((t) => t.label),
        datasets: [{ label: 'Sessions marked', data: trends.map((t) => t.sessions), backgroundColor: 'rgba(64, 145, 108, 0.7)', borderRadius: 8 }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
    if (!attCanvas) chartInstance = sessChart;
  }
}

function initAttChart() {
  const canvas = document.getElementById('attChart');
  if (!canvas || !window.Chart) return;

  const students = getStudents();
  chartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: students.map((s) => s.name.split(' ')[0]),
      datasets: [{
        data: students.map((s) => getStudentAttendanceStats(s.id).rate || 0),
        backgroundColor: ['#2d6a4f', '#40916c', '#52b788', '#bc6c25', '#e09f3e'],
      }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

export function bindViewEvents(view, ctx, params = {}) {
  const { showModal, closeModal, toast, navigate, refresh } = ctx;

  document.querySelectorAll('[data-action^="go-"]').forEach((btn) => {
    const target = btn.dataset.action.replace('go-', '');
    if (['ai', 'students', 'fees', 'schedule', 'intelligence', 'attendance', 'batches', 'teachers', 'crm', 'dashboard', 'studentSuccess', 'tutorHub', 'parentPortal', 'commHub', 'marketplace', 'publicSite', 'whatsapp', 'platformCenters', 'platformDashboard', 'tuitionMarketplace'].includes(target)) {
      btn.addEventListener('click', () => navigate(target));
    }
  });

  document.querySelectorAll('[data-view-link]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.viewLink));
  });

  if (['platformDashboard', 'platformCenters', 'platformCenterDetail'].includes(view)) {
    bindPlatformEvents(ctx);
  }

  if (view === 'crm') bindCRMEvents({ showModal, closeModal, toast, refresh });
  if (view === 'batches') bindBatchEvents({ showModal, closeModal, toast, refresh });
  if (view === 'schedule' || view === 'teacherHome') bindScheduleEvents({ showModal, closeModal, toast, refresh });
  if (view === 'teachers') bindTeacherEvents({ showModal, closeModal, toast, refresh, navigate });
  if (view === 'reports') bindReportEvents();
  if (view === 'students') bindStudentEvents({ showModal, closeModal, toast, refresh });
  if (view === 'fees') bindFeesEvents({ showModal, closeModal, toast, refresh });
  if (view === 'attendance') bindAttendanceEvents({ toast, refresh });
  if (view === 'tests') bindTestEvents({ showModal, closeModal, toast, refresh });
  if (view === 'whatsapp' || view === 'commHub') bindLayerEvents('commHub', ctx);
  if (view === 'studentSuccess') bindLayerEvents('studentSuccess', ctx);
  if (view === 'tutorHub') bindLayerEvents('tutorHub', ctx);
  if (view === 'parentPortal') bindLayerEvents('parentPortal', ctx);
  if (view === 'marketplace') bindLayerEvents('marketplace', ctx);
  if (view === 'publicSite') bindLayerEvents('publicSite', ctx);
  if (view === 'whatsapp') bindWhatsAppEvents({ toast, refresh });
  if (view === 'intelligence') bindIntelligenceEvents({ toast, refresh });
  if (view === 'ai') bindAIEvents({ toast, refresh });
  if (view === 'settings') bindSettingsEvents({ toast, refresh });
  if (view === 'tuitionMarketplace') bindTuitionMarketplaceEvents(ctx);
}

function bindCRMEvents({ showModal, closeModal, toast, refresh }) {
  const reloadCrm = (tab) => {
    document.getElementById('crmContent').innerHTML = crmTabContent(tab);
    bindCRMEvents({ showModal, closeModal, toast, refresh });
  };

  document.querySelectorAll('[data-crm-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-crm-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      reloadCrm(tab.dataset.crmTab);
    });
  });

  const filterLeadsTable = () => {
    const q = document.getElementById('crmSearch')?.value.trim();
    const stage = document.getElementById('crmStageFilter')?.value;
    const source = document.getElementById('crmSourceFilter')?.value;
    const body = document.getElementById('crmLeadsBody');
    if (body) body.innerHTML = crmLeadRows(searchLeads(q, stage || undefined, source || undefined));
    bindCRMEvents({ showModal, closeModal, toast, refresh });
  };

  document.getElementById('crmSearch')?.addEventListener('input', filterLeadsTable);
  document.getElementById('crmStageFilter')?.addEventListener('change', filterLeadsTable);
  document.getElementById('crmSourceFilter')?.addEventListener('change', filterLeadsTable);

  const openAddLead = () => {
    showModal({
      title: 'New Lead',
      body: `<div class="form-grid">
        <div class="form-group"><label>Name</label><input id="lName"></div>
        <div class="form-group"><label>Phone</label><input id="lPhone"></div>
        <div class="form-group"><label>Email</label><input id="lEmail"></div>
        <div class="form-group"><label>Grade</label><input id="lGrade"></div>
        <div class="form-group"><label>Course interest</label><input id="lCourse" placeholder="Science, Math..."></div>
        <div class="form-group"><label>Source</label><select id="lSource">${CRM_SOURCES.map((s) => `<option>${s}</option>`).join('')}</select></div>
        <div class="form-group"><label>Follow-up date</label><input type="date" id="lFollowUp"></div>
        <div class="form-group full"><label>Notes</label><textarea id="lNotes"></textarea></div>
      </div>`,
      footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveLeadBtn">Save Lead</button>`,
      onMount: () => {
        document.getElementById('saveLeadBtn').onclick = () => {
          const name = document.getElementById('lName').value.trim();
          if (!name) return toast('Name required', 'error');
          const created = saveLead({
            name,
            phone: document.getElementById('lPhone').value.trim(),
            email: document.getElementById('lEmail').value.trim(),
            grade: document.getElementById('lGrade').value.trim(),
            course: document.getElementById('lCourse').value.trim(),
            source: document.getElementById('lSource').value,
            followUpDate: document.getElementById('lFollowUp').value || '',
            notes: document.getElementById('lNotes').value.trim(),
            stage: 'lead',
          });
          addLeadActivity(created.id, 'created', 'Lead created');
          closeModal();
          toast('Lead added', 'success');
          refresh();
        };
      },
    });
  };

  document.querySelectorAll('[data-action="add-lead"]').forEach((btn) => btn.addEventListener('click', openAddLead));

  document.querySelectorAll('[data-action="view-lead"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lead = getLead(btn.dataset.id);
      if (lead) showLeadModal(lead, { showModal, closeModal, toast, refresh });
    });
  });

  document.querySelectorAll('[data-action="advance-lead"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lead = getLead(btn.dataset.id);
      const idx = CRM_STAGES.findIndex((s) => s.id === lead.stage);
      if (idx < CRM_STAGES.length - 1) {
        moveLead(lead.id, CRM_STAGES[idx + 1].id);
        toast(`Moved to ${CRM_STAGES[idx + 1].label}`, 'success');
        refresh();
      }
    });
  });

  document.querySelectorAll('[data-action="convert-lead"]').forEach((btn) => {
    btn.addEventListener('click', () => showEnrollLeadModal(btn.dataset.id, { showModal, closeModal, toast, refresh }));
  });

  document.querySelectorAll('[data-action="wa-lead"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lead = getLead(btn.dataset.id);
      if (!lead?.phone) return;
      openWhatsAppWeb(lead.phone, `Hi ${lead.name}, this is ${getState().settings.tutorName}. Following up on your inquiry.`, getState().settings.defaultCountryCode);
    });
  });

  document.querySelectorAll('[data-action="delete-lead"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this lead?')) {
        deleteLead(btn.dataset.id);
        toast('Lead deleted', 'success');
        refresh();
      }
    });
  });
}

function bindBatchEvents({ showModal, closeModal, toast, refresh }) {
  document.querySelector('[data-action="add-batch"]')?.addEventListener('click', () => showBatchForm(null, { showModal, closeModal, toast, refresh }));
  document.querySelectorAll('[data-action="edit-batch"]').forEach((btn) => {
    btn.addEventListener('click', () => showBatchForm(getBatch(btn.dataset.id), { showModal, closeModal, toast, refresh }));
  });
  document.querySelectorAll('[data-action="view-schedule"]').forEach((btn) => {
    btn.addEventListener('click', () => showScheduleModal(getBatch(btn.dataset.id), { showModal, closeModal, toast, refresh }));
  });
  document.querySelectorAll('[data-action="delete-batch"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this batch and unassign its students?')) {
        deleteBatch(btn.dataset.id);
        toast('Batch deleted', 'success');
        refresh();
      }
    });
  });
}

function sameDaySet(a, b) {
  return [...(a || [])].sort().join(',') === [...(b || [])].sort().join(',');
}

function findMatchingAvailabilitySlot(batch, slots) {
  if (!batch || !slots?.length) return null;
  if (batch.availabilitySlotId) {
    const byId = slots.find((s) => s.id === batch.availabilitySlotId);
    if (byId) return byId;
  }
  return slots.find((s) =>
    s.startTime === batch.startTime
    && s.endTime === batch.endTime
    && sameDaySet(s.days, batch.scheduleDays),
  ) || null;
}

function batchScheduleMetaFieldsHtml(batch) {
  return `
    <div class="form-grid" style="margin-top:14px">
      <div class="form-group"><label>Course start date</label><input type="date" id="fStartDate" value="${batch?.startDate || new Date().toISOString().slice(0, 10)}"></div>
      <div class="form-group"><label>Meeting platform</label>
        <select id="fPlatform">
          <option value="google-meet" ${!batch?.meetingPlatform || batch?.meetingPlatform === 'google-meet' ? 'selected' : ''}>Google Meet</option>
          <option value="zoom" ${batch?.meetingPlatform === 'zoom' ? 'selected' : ''}>Zoom</option>
          <option value="teams" ${batch?.meetingPlatform === 'teams' ? 'selected' : ''}>Microsoft Teams</option>
        </select>
      </div>
    </div>`;
}

function batchSchedulePanelHtml(teacherId, batch, excludeBatchId = null) {
  const meta = batchScheduleMetaFieldsHtml(batch);
  const editingBatchId = excludeBatchId ?? batch?.id ?? null;

  if (!teacherId) {
    return `<p class="empty-state" style="padding:12px 0">Select an assigned teacher to choose from their availability slots.</p>${meta}`;
  }

  const teacher = getTeacher(teacherId);
  const allSlots = getTutorAvailability(teacherId).slots || [];
  const slots = getAvailableAvailabilitySlots(teacherId, editingBatchId);
  const booked = getAvailabilitySlotBookings(teacherId, editingBatchId).filter(({ batch: b }) => b);

  if (!allSlots.length) {
    return `
      <p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 12px">No availability slots for ${teacher?.name || 'this teacher'}. Add them in Tutor Success → Schedule, or set manually below.</p>
      ${dayPickerHtml(batch?.scheduleDays || ['mon', 'wed', 'fri'], 'batchDay')}
      <div class="form-grid" style="margin-top:14px">
        <div class="form-group"><label>Start time</label><input type="time" id="fStartTime" value="${batch?.startTime || '16:00'}"></div>
        <div class="form-group"><label>End time</label><input type="time" id="fEndTime" value="${batch?.endTime || '18:00'}"></div>
      </div>
      ${meta}`;
  }

  if (!slots.length) {
    const bookedSummary = booked.map(({ slot, batch: b }) =>
      `${formatTutorAvailabilitySummary({ slots: [slot] })} (${b.name})`,
    ).join('; ');
    return `
      <p class="empty-state" style="padding:12px 0">All availability slots for ${teacher?.name || 'this teacher'} are already assigned.${bookedSummary ? ` In use: ${bookedSummary}.` : ''}</p>
      ${meta}`;
  }

  const matched = findMatchingAvailabilitySlot(batch, slots);
  const selectedId = matched?.id || slots[0]?.id || '';

  return `
    <p style="font-size:0.82rem;color:var(--text-muted);margin:0 0 12px">Choose a free slot from <strong>${teacher?.name || 'teacher'}</strong>'s availability.${booked.length ? ` ${booked.length} slot${booked.length === 1 ? '' : 's'} already in use.` : ''}</p>
    <div class="avail-slot-picker">${slots.map((s, i) => `
      <label class="avail-slot-option ${selectedId === s.id ? 'active' : ''}">
        <input type="radio" name="batchAvailSlot" value="${s.id}" data-days="${(s.days || []).join(',')}" data-start="${s.startTime}" data-end="${s.endTime}" ${selectedId === s.id ? 'checked' : ''}>
        <span><strong>Slot ${i + 1}</strong> · ${formatTutorAvailabilitySummary({ slots: [s] })}</span>
      </label>`).join('')}
    </div>
    ${meta}`;
}

function readBatchScheduleFields(getDaysFallback) {
  const slotInput = document.querySelector('input[name="batchAvailSlot"]:checked');
  if (slotInput) {
    return {
      scheduleDays: slotInput.dataset.days.split(',').filter(Boolean),
      startTime: slotInput.dataset.start,
      endTime: slotInput.dataset.end,
      availabilitySlotId: slotInput.value,
    };
  }
  return {
    scheduleDays: getDaysFallback(),
    startTime: document.getElementById('fStartTime')?.value || '16:00',
    endTime: document.getElementById('fEndTime')?.value || '18:00',
    availabilitySlotId: null,
  };
}

function bindBatchSchedulePanel(teacherId) {
  let getDaysFallback = () => [];
  const slots = teacherId ? (getTutorAvailability(teacherId).slots || []) : [];

  if (!teacherId || !slots.length) {
    getDaysFallback = bindDayPicker('batchDayPicker');
  } else {
    document.querySelectorAll('input[name="batchAvailSlot"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.avail-slot-option').forEach((el) => el.classList.remove('active'));
        radio.closest('.avail-slot-option')?.classList.add('active');
      });
    });
  }

  return getDaysFallback;
}

function showBatchForm(batch, { showModal, closeModal, toast, refresh }) {
  const teachers = getTeachers();
  let draftSessions = batch?.sessions ? [...batch.sessions] : [];

  showModal({
    title: batch ? 'Edit Batch & Schedule' : 'New Batch — Auto Schedule',
    wide: true,
    body: `<div class="form-grid">
      <div class="form-group full"><label>Batch name</label><input id="fName" value="${batch?.name || ''}"></div>
      <div class="form-group"><label>Assigned teacher</label>
        <select id="fTeacher">
          <option value="">— Select teacher —</option>
          ${teachers.map((t) => `<option value="${t.id}" ${batch?.teacherId === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Capacity</label><input type="number" id="fCapacity" value="${batch?.capacity || 20}"></div>
      <div class="form-group"><label>Monthly fee (₹)</label><input type="number" id="fMonthlyFee" value="${batch?.monthlyFee ?? 3000}" min="0" step="100"></div>
      <div class="form-group"><label>Fee due day</label><input type="number" id="fFeeDueDay" value="${batch?.feeDueDay ?? 5}" min="1" max="28"></div>
      <div class="form-group"><label>Subjects (comma-separated)</label><input id="fSubjects" value="${batch?.subjects?.join(', ') || ''}"></div>
      <div class="form-group full"><label>Notes</label><textarea id="fNotes">${batch?.notes || ''}</textarea></div>
    </div>

    <div class="schedule-panel">
      <h4>📅 Class schedule from teacher availability</h4>
      <div id="batchSchedulePanel">${batchSchedulePanelHtml(batch?.teacherId, batch, batch?.id)}</div>
    </div>

    <div class="form-group full" style="margin-top:16px">
      <label>Course topics (one per line — auto-schedules one class per topic)</label>
      <textarea id="fTopics" rows="8" placeholder="Introduction to Algebra&#10;Linear Equations&#10;Quadratic Equations">${(batch?.topics || []).join('\n')}</textarea>
    </div>

    <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
      <button type="button" class="btn btn-secondary" id="generateScheduleBtn">⚡ Auto-Generate Schedule</button>
      <span id="scheduleSummary" style="font-size:0.85rem;color:var(--text-muted);align-self:center"></span>
    </div>
    <div id="schedulePreview">${sessionsPreviewHtml(draftSessions)}</div>`,
    footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveBatchBtn">Save Batch</button>`,
    onMount: () => {
      let getDaysFallback = bindBatchSchedulePanel(document.getElementById('fTeacher')?.value);

      const renderSchedulePanel = () => {
        const teacherId = document.getElementById('fTeacher')?.value;
        const panel = document.getElementById('batchSchedulePanel');
        const batchForSchedule = teacherId && batch?.teacherId === teacherId ? batch : null;
        if (panel) {
          panel.innerHTML = batchSchedulePanelHtml(teacherId, batchForSchedule, batch?.id);
          getDaysFallback = bindBatchSchedulePanel(teacherId);
        }
      };

      document.getElementById('fTeacher')?.addEventListener('change', renderSchedulePanel);

      const runGenerate = () => {
        const name = document.getElementById('fName').value.trim() || 'batch';
        const topics = document.getElementById('fTopics').value.split('\n').map((t) => t.trim()).filter(Boolean);
        const { scheduleDays, startTime, endTime } = readBatchScheduleFields(getDaysFallback);
        if (!topics.length) return toast('Add at least one topic', 'error');
        if (!scheduleDays.length) return toast('Select a teacher availability slot', 'error');

        draftSessions = generateSchedule({
          topics,
          scheduleDays,
          startTime,
          endTime,
          startDate: document.getElementById('fStartDate').value,
          meetingPlatform: document.getElementById('fPlatform').value,
          batchName: name,
          existingSessions: draftSessions,
        });

        document.getElementById('schedulePreview').innerHTML = sessionsPreviewHtml(draftSessions);
        document.getElementById('scheduleSummary').textContent = `${draftSessions.length} classes scheduled`;
        toast('Schedule generated', 'success');
      };

      document.getElementById('generateScheduleBtn').onclick = runGenerate;

      document.getElementById('saveBatchBtn').onclick = () => {
        const name = document.getElementById('fName').value.trim();
        if (!name) return toast('Name is required', 'error');

        const teacherId = document.getElementById('fTeacher').value || null;
        const { scheduleDays, startTime, endTime, availabilitySlotId } = readBatchScheduleFields(getDaysFallback);
        const topics = document.getElementById('fTopics').value.split('\n').map((t) => t.trim()).filter(Boolean);

        if (teacherId && availabilitySlotId) {
          const conflict = getAvailabilitySlotBookings(teacherId, batch?.id)
            .find(({ slot, batch: bookedBy }) => slot.id === availabilitySlotId && bookedBy);
          if (conflict) {
            return toast(`That slot is already used by ${conflict.batch.name}`, 'error');
          }
        }
        if (teacherId && !availabilitySlotId && !scheduleDays.length) {
          return toast('Select a teacher availability slot', 'error');
        }

        if (topics.length && scheduleDays.length && !draftSessions.length) {
          draftSessions = generateSchedule({
            topics,
            scheduleDays,
            startTime,
            endTime,
            startDate: document.getElementById('fStartDate').value,
            meetingPlatform: document.getElementById('fPlatform').value,
            batchName: name,
          });
        }

        saveBatch({
          id: batch?.id,
          name,
          teacherId,
          scheduleDays,
          startTime,
          endTime,
          availabilitySlotId,
          startDate: document.getElementById('fStartDate').value,
          meetingPlatform: document.getElementById('fPlatform').value,
          schedule: formatScheduleLabel(scheduleDays, startTime, endTime),
          subjects: document.getElementById('fSubjects').value.split(',').map((s) => s.trim()).filter(Boolean),
          topics,
          sessions: draftSessions,
          capacity: Number(document.getElementById('fCapacity').value) || 20,
          monthlyFee: Number(document.getElementById('fMonthlyFee').value) || 0,
          feeDueDay: Number(document.getElementById('fFeeDueDay').value) || 5,
          notes: document.getElementById('fNotes').value.trim(),
        });
        closeModal();
        toast('Batch saved with schedule', 'success');
        refresh();
      };
    },
  });
}

function showScheduleModal(batch, { showModal, closeModal, toast, refresh }) {
  if (!batch) return;

  showModal({
    title: `${batch.name} — Class Schedule`,
    wide: true,
    body: `<p style="margin:0 0 12px;color:var(--text-muted)">${batch.schedule} · ${(batch.sessions || []).length} total classes</p>
    <div id="batchScheduleTable">${sessionsPreviewHtml(batch.sessions || [], true)}</div>`,
    footer: `<button class="btn btn-secondary" data-modal-cancel>Close</button><button class="btn btn-primary" id="saveSessionsBtn">Save Changes</button>`,
    onMount: () => {
      document.getElementById('saveSessionsBtn').onclick = () => {
        const sessions = (batch.sessions || []).map((s) => {
          const linkInput = document.querySelector(`[data-session-link="${s.id}"]`);
          const doneInput = document.querySelector(`[data-session-done="${s.id}"]`);
          const completed = doneInput?.checked || false;
          return normalizeSession({
            ...s,
            meetingLink: linkInput?.value || s.meetingLink,
            completed,
            status: completed ? 'completed' : (s.status === 'cancelled' ? 'cancelled' : 'scheduled'),
          });
        });
        updateBatchSessions(batch.id, sessions);
        closeModal();
        toast('Schedule updated', 'success');
        refresh();
      };
    },
  });
}

function showSessionDetailModal(batchId, sessionId, ctx) {
  const session = getBatchSession(batchId, sessionId);
  if (!session) return;
  const { showModal, closeModal, toast, refresh } = ctx;
  const st = normalizeSession(session);

  showModal({
    title: session.topic,
    body: `
      <div style="font-size:0.9rem;line-height:1.65">
        <p><strong>Batch:</strong> ${session.batchName}</p>
        <p><strong>When:</strong> ${session.date} · ${formatTime(session.startTime)}–${formatTime(session.endTime)}</p>
        <p><strong>Status:</strong> ${sessionStatusBadge(session) || 'Scheduled'}</p>
        ${session.rescheduledFrom ? `<p><strong>Previous slot:</strong> ${session.rescheduledFrom.date} · ${formatTime(session.rescheduledFrom.startTime)}</p>` : ''}
        ${session.cancelReason ? `<p><strong>Cancel note:</strong> ${session.cancelReason}</p>` : ''}
        ${st.status === 'scheduled' ? `<p><strong>Meeting:</strong> <a href="${session.meetingLink}" target="_blank" rel="noopener">${session.meetingLink}</a></p>` : ''}
      </div>`,
    footer: `
      <button type="button" class="btn btn-secondary" data-modal-cancel>Close</button>
      ${st.status === 'scheduled' ? `<a href="${session.meetingLink}" target="_blank" class="btn btn-primary">Join Meeting</a>` : ''}
      ${st.status === 'scheduled' ? `<button type="button" class="btn btn-secondary" id="modalRescheduleSession">Reschedule</button>` : ''}
      ${st.status === 'scheduled' ? `<button type="button" class="btn btn-secondary" id="modalCancelSession">Cancel class</button>` : ''}
      ${st.status === 'cancelled' ? `<button type="button" class="btn btn-primary" id="modalRestoreSession">Restore</button>` : ''}`,
    onMount: () => {
      document.getElementById('modalCancelSession')?.addEventListener('click', () => {
        closeModal();
        showCancelSessionModal(batchId, sessionId, ctx);
      });
      document.getElementById('modalRescheduleSession')?.addEventListener('click', () => {
        closeModal();
        showRescheduleSessionModal(batchId, sessionId, ctx);
      });
      document.getElementById('modalRestoreSession')?.addEventListener('click', () => {
        restoreBatchSession(batchId, sessionId);
        closeModal();
        toast('Class restored to schedule', 'success');
        refresh?.();
      });
    },
  });
}

function showCancelSessionModal(batchId, sessionId, ctx) {
  const session = getBatchSession(batchId, sessionId);
  if (!session) return;
  const { showModal, closeModal, toast, refresh } = ctx;

  showModal({
    title: 'Cancel class',
    body: `
      <p style="margin:0 0 12px;color:var(--text-muted)">${session.topic} · ${session.batchName} · ${session.date}</p>
      <div class="form-group full"><label>Reason (optional)</label><textarea id="cancelSessionReason" placeholder="Teacher unwell, holiday, etc."></textarea></div>
      <div class="form-group full"><label><input type="checkbox" id="cancelNotifyParents" checked> Notify parents on WhatsApp</label></div>`,
    footer: `<button type="button" class="btn btn-secondary" data-modal-cancel>Back</button><button type="button" class="btn btn-danger" id="confirmCancelSession">Cancel class</button>`,
    onMount: () => {
      document.getElementById('confirmCancelSession').onclick = async () => {
        const result = await cancelBatchSession(batchId, sessionId, {
          reason: document.getElementById('cancelSessionReason')?.value || '',
          notifyParents: document.getElementById('cancelNotifyParents')?.checked,
        });
        closeModal();
        if (!result.ok) return toast(result.error, 'error');
        toast(result.notified ? `Class cancelled · ${result.notified} parent(s) notified` : 'Class cancelled', 'success');
        refresh?.();
      };
    },
  });
}

function showRescheduleSessionModal(batchId, sessionId, ctx) {
  const session = getBatchSession(batchId, sessionId);
  if (!session) return;
  const { showModal, closeModal, toast, refresh } = ctx;

  showModal({
    title: 'Reschedule class',
    body: `
      <p style="margin:0 0 12px;color:var(--text-muted)">${session.topic} · ${session.batchName}</p>
      <div class="form-grid">
        <div class="form-group"><label>New date</label><input type="date" id="rescheduleDate" value="${session.date}"></div>
        <div class="form-group"><label>Start</label><input type="time" id="rescheduleStart" value="${session.startTime || '16:00'}"></div>
        <div class="form-group"><label>End</label><input type="time" id="rescheduleEnd" value="${session.endTime || '18:00'}"></div>
        <div class="form-group full"><label>Note for parents (optional)</label><textarea id="rescheduleReason" placeholder="Moved due to exam week"></textarea></div>
        <div class="form-group full"><label><input type="checkbox" id="rescheduleNotifyParents" checked> Notify parents on WhatsApp</label></div>
      </div>`,
    footer: `<button type="button" class="btn btn-secondary" data-modal-cancel>Back</button><button type="button" class="btn btn-primary" id="confirmRescheduleSession">Save new time</button>`,
    onMount: () => {
      document.getElementById('confirmRescheduleSession').onclick = async () => {
        const result = await rescheduleBatchSession(batchId, sessionId, {
          date: document.getElementById('rescheduleDate')?.value,
          startTime: document.getElementById('rescheduleStart')?.value,
          endTime: document.getElementById('rescheduleEnd')?.value,
          reason: document.getElementById('rescheduleReason')?.value || '',
          notifyParents: document.getElementById('rescheduleNotifyParents')?.checked,
        });
        closeModal();
        if (!result.ok) return toast(result.error, 'error');
        toast(result.notified ? `Class rescheduled · ${result.notified} parent(s) notified` : 'Class rescheduled', 'success');
        refresh?.();
      };
    },
  });
}

function bindScheduleEvents({ showModal, closeModal, toast, refresh }) {
  const ctx = { showModal, closeModal, toast, refresh };
  const activeTab = () => document.querySelector('[data-sched-tab].active')?.dataset.schedTab || 'upcoming';
  const activeLayout = () => document.querySelector('[data-sched-layout].active')?.dataset.schedLayout || 'calendar';

  const getWeekStart = () => document.querySelector('.schedule-cal')?.dataset.weekStart || getMondayOfWeek(new Date());

  const reloadCalendar = () => {
    const wrap = document.getElementById('scheduleCalendarWrap');
    if (!wrap) return;
    const batchId = document.getElementById('scheduleFilter')?.value || '';
    const batches = getBatches();
    const filtered = batchId ? batches.filter((b) => b.id === batchId) : batches;
    const weekStart = getWeekStart();
    const sessions = getAllSessions(filtered, { includeCompleted: true, includeCancelled: true });
    wrap.innerHTML = renderWeekCalendarHtml(sessions, weekStart);
    bindScheduleEvents(ctx);
  };

  const reloadList = () => {
    const list = document.getElementById('scheduleList');
    if (!list) return;
    const batchId = document.getElementById('scheduleFilter')?.value || '';
    const tab = activeTab();
    list.innerHTML = scheduleListHtml(scheduleTabSessions(tab, batchId || null), { showManage: true });
    bindScheduleEvents(ctx);
  };

  const reloadSchedule = () => {
    if (activeLayout() === 'list') reloadList();
    else reloadCalendar();
  };

  document.querySelectorAll('[data-sched-layout]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-sched-layout]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isList = tab.dataset.schedLayout === 'list';
      document.getElementById('scheduleCalendarPanel')?.classList.toggle('hidden', isList);
      document.getElementById('scheduleListPanel')?.classList.toggle('hidden', !isList);
      reloadSchedule();
    });
  });

  document.querySelectorAll('[data-sched-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-sched-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      reloadList();
    });
  });

  document.getElementById('scheduleFilter')?.addEventListener('change', reloadSchedule);

  document.querySelector('[data-action="cal-prev-week"]')?.addEventListener('click', () => {
    const weekStart = addDays(getWeekStart(), -7);
    const wrap = document.getElementById('scheduleCalendarWrap');
    if (!wrap) return;
    const batchId = document.getElementById('scheduleFilter')?.value || '';
    const batches = getBatches();
    const filtered = batchId ? batches.filter((b) => b.id === batchId) : batches;
    wrap.innerHTML = renderWeekCalendarHtml(getAllSessions(filtered, { includeCompleted: true, includeCancelled: true }), weekStart);
    bindScheduleEvents(ctx);
  });

  document.querySelector('[data-action="cal-next-week"]')?.addEventListener('click', () => {
    const weekStart = addDays(getWeekStart(), 7);
    const wrap = document.getElementById('scheduleCalendarWrap');
    if (!wrap) return;
    const batchId = document.getElementById('scheduleFilter')?.value || '';
    const batches = getBatches();
    const filtered = batchId ? batches.filter((b) => b.id === batchId) : batches;
    wrap.innerHTML = renderWeekCalendarHtml(getAllSessions(filtered, { includeCompleted: true, includeCancelled: true }), weekStart);
    bindScheduleEvents(ctx);
  });

  document.querySelector('[data-action="cal-this-week"]')?.addEventListener('click', () => {
    const wrap = document.getElementById('scheduleCalendarWrap');
    if (!wrap) return;
    const batchId = document.getElementById('scheduleFilter')?.value || '';
    const batches = getBatches();
    const filtered = batchId ? batches.filter((b) => b.id === batchId) : batches;
    wrap.innerHTML = renderWeekCalendarHtml(getAllSessions(filtered, { includeCompleted: true, includeCancelled: true }), getMondayOfWeek(new Date()));
    bindScheduleEvents(ctx);
  });

  document.querySelectorAll('[data-action="open-session"]').forEach((btn) => {
    btn.addEventListener('click', () => showSessionDetailModal(btn.dataset.batch, btn.dataset.session, ctx));
  });

  document.querySelectorAll('[data-action="copy-link"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!btn.dataset.link) return toast('No meeting link', 'error');
      await navigator.clipboard.writeText(btn.dataset.link);
      toast('Meeting link copied', 'success');
    });
  });

  document.querySelectorAll('[data-action="complete-session"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      markSessionComplete(btn.dataset.batch, btn.dataset.session, true);
      toast('Class marked complete', 'success');
      refresh?.();
      reloadSchedule();
    });
  });

  document.querySelectorAll('[data-action="undo-session"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      markSessionComplete(btn.dataset.batch, btn.dataset.session, false);
      toast('Class marked incomplete', 'success');
      refresh?.();
      reloadSchedule();
    });
  });

  document.querySelectorAll('[data-action="cancel-session"]').forEach((btn) => {
    btn.addEventListener('click', () => showCancelSessionModal(btn.dataset.batch, btn.dataset.session, ctx));
  });

  document.querySelectorAll('[data-action="reschedule-session"]').forEach((btn) => {
    btn.addEventListener('click', () => showRescheduleSessionModal(btn.dataset.batch, btn.dataset.session, ctx));
  });

  document.querySelectorAll('[data-action="restore-session"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const result = restoreBatchSession(btn.dataset.batch, btn.dataset.session);
      if (!result.ok) return toast(result.error, 'error');
      toast('Class restored to schedule', 'success');
      refresh?.();
      reloadSchedule();
    });
  });
}

function bindTeacherEvents({ showModal, closeModal, toast, refresh, navigate }) {
  document.querySelector('[data-action="add-teacher"]')?.addEventListener('click', () => showTeacherForm(null, { showModal, closeModal, toast, refresh }));
  document.querySelectorAll('[data-action="edit-teacher"]').forEach((btn) => {
    btn.addEventListener('click', () => showTeacherForm(getTeacher(btn.dataset.id), { showModal, closeModal, toast, refresh }));
  });
  document.querySelectorAll('[data-action="delete-teacher"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this teacher?')) {
        deleteTeacher(btn.dataset.id);
        toast('Teacher deleted', 'success');
        refresh();
      }
    });
  });
  document.querySelectorAll('[data-action="teacher-report"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate('reports');
      setTimeout(() => {
        document.querySelectorAll('.report-tab').forEach((t) => t.classList.toggle('active', t.dataset.reportTab === 'teachers'));
        document.getElementById('reportContent').innerHTML = teacherReportHtml();
      }, 50);
    });
  });
}

function showTeacherForm(teacher, { showModal, closeModal, toast, refresh }) {
  showModal({
    title: teacher ? 'Edit Teacher' : 'Add Teacher',
    body: `<div class="form-grid">
      <div class="form-group"><label>Full name</label><input id="tName" value="${teacher?.name || ''}"></div>
      <div class="form-group"><label>Email</label><input id="tEmail" value="${teacher?.email || ''}"></div>
      <div class="form-group"><label>Phone</label><input id="tPhone" value="${teacher?.phone || ''}"></div>
      <div class="form-group"><label>Subjects (comma-separated)</label><input id="tSubjects" value="${teacher?.subjects?.join(', ') || ''}"></div>
      <div class="form-group full"><label>Bio</label><textarea id="tBio">${teacher?.bio || ''}</textarea></div>
    </div>`,
    footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveTeacherBtn">Save</button>`,
    onMount: () => {
      document.getElementById('saveTeacherBtn').onclick = () => {
        const name = document.getElementById('tName').value.trim();
        if (!name) return toast('Name is required', 'error');
        saveTeacher({
          id: teacher?.id,
          name,
          email: document.getElementById('tEmail').value.trim(),
          phone: document.getElementById('tPhone').value.trim(),
          subjects: document.getElementById('tSubjects').value.split(',').map((s) => s.trim()).filter(Boolean),
          bio: document.getElementById('tBio').value.trim(),
        });
        closeModal();
        toast('Teacher saved', 'success');
        refresh();
      };
    },
  });
}

function bindReportEvents() {
  document.querySelectorAll('.report-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.report-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('reportContent').innerHTML =
        tab.dataset.reportTab === 'teachers' ? teacherReportHtml() : studentReportHtml();
    });
  });
}

function bindStudentEvents({ showModal, closeModal, toast, refresh }) {
  document.querySelector('[data-action="add-student"]')?.addEventListener('click', () => showStudentForm(null, { showModal, closeModal, toast, refresh }));
  document.querySelectorAll('[data-action="edit-student"]').forEach((btn) => {
    btn.addEventListener('click', () => showStudentForm(getStudent(btn.dataset.id), { showModal, closeModal, toast, refresh }));
  });
  document.querySelectorAll('[data-action="delete-student"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this student?')) {
        deleteStudent(btn.dataset.id);
        toast('Student deleted', 'success');
        refresh();
      }
    });
  });

  document.getElementById('filterBatch')?.addEventListener('change', (e) => {
    const batchId = e.target.value;
    const students = batchId ? getStudents(batchId) : getStudents();
    document.getElementById('studentsTable').innerHTML = studentRows(students);
    bindStudentEvents({ showModal, closeModal, toast, refresh });
  });
}

function showStudentForm(student, { showModal, closeModal, toast, refresh }) {
  const batches = getBatches();
  showModal({
    title: student ? 'Edit Student' : 'Add Student',
    body: `<div class="form-grid">
      <div class="form-group"><label>Full name</label><input id="sName" value="${student?.name || ''}"></div>
      <div class="form-group"><label>Grade</label><input id="sGrade" value="${student?.grade || ''}"></div>
      <div class="form-group"><label>Batch</label><select id="sBatch">${batches.map((b) => `<option value="${b.id}" ${student?.batchId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>Join date</label><input type="date" id="sJoin" value="${student?.joinDate || new Date().toISOString().slice(0, 10)}"></div>
      <div class="form-group"><label>Student phone</label><input id="sPhone" value="${student?.phone || ''}"></div>
      <div class="form-group"><label>Student email</label><input id="sEmail" value="${student?.email || ''}"></div>
      <div class="form-group"><label>Parent name</label><input id="sParentName" value="${student?.parentName || ''}"></div>
      <div class="form-group"><label>Parent phone (WhatsApp)</label><input id="sParentPhone" value="${student?.parentPhone || ''}"></div>
      <div class="form-group"><label>Parent email</label><input id="sParentEmail" value="${student?.parentEmail || ''}"></div>
      <div class="form-group"><label>Monthly fee override (₹)</label><input type="number" id="sFeeOverride" value="${student?.monthlyFeeOverride ?? ''}" placeholder="Leave blank for batch fee" min="0" step="100"></div>
      <div class="form-group"><label>Fee billing status</label>
        <select id="sFeeStatus">
          <option value="active" ${student?.feeStatus !== 'paused' ? 'selected' : ''}>Active</option>
          <option value="paused" ${student?.feeStatus === 'paused' ? 'selected' : ''}>Paused</option>
        </select>
      </div>
      <div class="form-group"><label>Fee start date</label><input type="date" id="sFeeStart" value="${student?.feeStartDate || student?.joinDate || new Date().toISOString().slice(0, 10)}"></div>
      <div class="form-group full"><label>Address</label><input id="sAddress" value="${student?.address || ''}"></div>
      <div class="form-group full"><label>Notes</label><textarea id="sNotes">${student?.notes || ''}</textarea></div>
    </div>`,
    footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveStudentBtn">Save</button>`,
    onMount: () => {
      document.getElementById('saveStudentBtn').onclick = () => {
        const name = document.getElementById('sName').value.trim();
        if (!name) return toast('Name is required', 'error');
        const feeOverrideRaw = document.getElementById('sFeeOverride').value.trim();
        saveStudent({
          id: student?.id,
          name,
          grade: document.getElementById('sGrade').value.trim(),
          batchId: document.getElementById('sBatch').value,
          joinDate: document.getElementById('sJoin').value,
          phone: document.getElementById('sPhone').value.trim(),
          email: document.getElementById('sEmail').value.trim(),
          parentName: document.getElementById('sParentName').value.trim(),
          parentPhone: document.getElementById('sParentPhone').value.trim(),
          parentEmail: document.getElementById('sParentEmail').value.trim(),
          monthlyFeeOverride: feeOverrideRaw === '' ? null : Number(feeOverrideRaw),
          feeStatus: document.getElementById('sFeeStatus').value,
          feeStartDate: document.getElementById('sFeeStart').value,
          address: document.getElementById('sAddress').value.trim(),
          notes: document.getElementById('sNotes').value.trim(),
        });
        closeModal();
        toast('Student saved', 'success');
        refresh();
      };
    },
  });
}

function bindAttendanceEvents({ toast, refresh }) {
  const batchSel = document.getElementById('attBatch');
  const dateInput = document.getElementById('attDate');

  const reloadGrid = () => {
    const grid = document.getElementById('attendanceGrid');
    if (grid) grid.innerHTML = attendanceGridHtml(batchSel?.value, dateInput?.value);
    bindAttendanceToggles();
  };

  batchSel?.addEventListener('change', reloadGrid);
  dateInput?.addEventListener('change', reloadGrid);
  bindAttendanceToggles();

  document.querySelector('[data-action="save-attendance"]')?.addEventListener('click', async () => {
    const batchId = batchSel.value;
    const date = dateInput.value;
    const records = {};
    document.querySelectorAll('.attendance-item').forEach((item) => {
      const active = item.querySelector('.att-toggle button[class*="active-"]');
      records[item.dataset.student] = active?.dataset.status || 'present';
    });
    saveAttendance(batchId, date, records);

    if (document.getElementById('notifyParents')?.checked) {
      const batch = getBatch(batchId);
      const students = getStudents(batchId);
      let sent = 0;
      for (const s of students) {
        const status = records[s.id];
        if (status === 'absent') {
          await dispatchCommunicationEvent('attendance_absent', buildAttendancePayload(s, batch, date, status));
          sent++;
        } else if (status === 'late') {
          await dispatchCommunicationEvent('attendance_late', buildAttendancePayload(s, batch, date, status));
          sent++;
        } else if (status !== 'present') {
          await sendAttendanceUpdate(s, batch, date, status);
          sent++;
        }
      }
      toast(`Attendance saved & ${sent} parent notification(s) sent`, 'success');
    } else {
      toast('Attendance saved', 'success');
    }
    refresh();
  });
}

function bindAttendanceToggles() {
  document.querySelectorAll('.att-toggle').forEach((toggle) => {
    toggle.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggle.querySelectorAll('button').forEach((b) => b.className = '');
        btn.classList.add(`active-${btn.dataset.status}`);
      });
    });
  });
}

function bindTestEvents({ showModal, closeModal, toast, refresh }) {
  document.querySelector('[data-action="add-test"]')?.addEventListener('click', () => showTestForm(null, { showModal, closeModal, toast, refresh }));
  document.querySelectorAll('[data-action="edit-test"]').forEach((btn) => {
    btn.addEventListener('click', () => showTestForm(getTest(btn.dataset.id), { showModal, closeModal, toast, refresh }));
  });
  document.querySelectorAll('[data-action="delete-test"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this test?')) {
        deleteTest(btn.dataset.id);
        toast('Test deleted', 'success');
        refresh();
      }
    });
  });
  document.querySelectorAll('[data-action="whatsapp-test"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const test = getTest(btn.dataset.id);
      const students = getStudents(test.batchId);
      const results = await sendTestResultsToParents(test, students);
      toast(`Sent ${results.length} message(s) to parents`, 'success');
      refresh();
    });
  });
}

function showTestForm(test, { showModal, closeModal, toast, refresh }) {
  const batches = getBatches();
  const batchId = test?.batchId || batches[0]?.id;
  const students = getStudents(batchId);

  showModal({
    title: test ? 'Edit Test' : 'Record Test',
    body: `<div class="form-grid">
      <div class="form-group full"><label>Test name</label><input id="tName" value="${test?.name || ''}"></div>
      <div class="form-group"><label>Batch</label><select id="tBatch">${batches.map((b) => `<option value="${b.id}" ${test?.batchId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>Subject</label><input id="tSubject" value="${test?.subject || ''}"></div>
      <div class="form-group"><label>Date</label><input type="date" id="tDate" value="${test?.date || new Date().toISOString().slice(0, 10)}"></div>
      <div class="form-group"><label>Max marks</label><input type="number" id="tMax" value="${test?.maxMarks || 100}"></div>
      <div class="form-group full"><label>Marks per student</label>
        <div id="marksFields">${students.map((s) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="min-width:120px">${s.name}</span><input type="number" data-student-mark="${s.id}" value="${test?.marks?.[s.id] ?? ''}" placeholder="Score"></div>`).join('') || '<p>No students in batch</p>'}
        </div>
      </div>
    </div>`,
    footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="saveTestBtn">Save</button>`,
    onMount: () => {
      document.getElementById('tBatch').addEventListener('change', (e) => {
        const st = getStudents(e.target.value);
        document.getElementById('marksFields').innerHTML = st.map((s) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="min-width:120px">${s.name}</span><input type="number" data-student-mark="${s.id}" placeholder="Score"></div>`).join('');
      });

      document.getElementById('saveTestBtn').onclick = async () => {
        const marks = {};
        document.querySelectorAll('[data-student-mark]').forEach((input) => {
          if (input.value !== '') marks[input.dataset.studentMark] = Number(input.value);
        });
        saveTest({
          id: test?.id,
          name: document.getElementById('tName').value.trim(),
          batchId: document.getElementById('tBatch').value,
          subject: document.getElementById('tSubject').value.trim(),
          date: document.getElementById('tDate').value,
          maxMarks: Number(document.getElementById('tMax').value) || 100,
          marks,
        });
        closeModal();
        toast('Test saved', 'success');
        const savedTest = test?.id ? getTest(test.id) : getTests(document.getElementById('tBatch').value).slice(-1)[0];
        const batchStudents = getStudents(savedTest.batchId);
        for (const s of batchStudents) {
          if (marks[s.id] != null) {
            await dispatchCommunicationEvent('test_result', buildTestPayload(s, savedTest, marks[s.id]));
          }
        }
        refresh();
      };
    },
  });
}

function bindWhatsAppEvents({ toast, refresh }) {
  document.querySelector('[data-action="send-wa"]')?.addEventListener('click', async () => {
    const phone = document.getElementById('waPhone').value.trim();
    const message = document.getElementById('waMessage').value.trim();
    if (!phone || !message) return toast('Phone and message required', 'error');
    await sendWhatsApp({ to: phone, message, type: document.getElementById('waType').value });
    toast('Message sent', 'success');
    refresh();
  });

  document.querySelector('[data-action="open-wa-web"]')?.addEventListener('click', () => {
    const phone = document.getElementById('waPhone').value.trim();
    const message = document.getElementById('waMessage').value.trim();
    if (!phone) return toast('Phone required', 'error');
    openWhatsAppWeb(phone, message, getState().settings.defaultCountryCode);
  });

  document.querySelector('[data-action="broadcast"]')?.addEventListener('click', async () => {
    const title = document.getElementById('announceTitle').value.trim();
    const body = document.getElementById('announceBody').value.trim();
    if (!body) return toast('Announcement body required', 'error');
    const message = buildBulkAnnouncement(title || 'Announcement', body);
    const students = getStudents();
    let count = 0;
    for (const s of students) {
      if (s.parentPhone) {
        await sendWhatsApp({ to: s.parentPhone, message, type: 'announcement' });
        count++;
      }
    }
    toast(`Broadcast sent to ${count} parents`, 'success');
    refresh();
  });
}

function bindIntelligenceEvents({ toast, refresh }) {
  const reloadBiTab = (tab) => {
    document.getElementById('biContent').innerHTML = biTabContent(tab);
    bindIntelligenceEvents({ toast, refresh });
    if (tab === 'trends') initBICharts();
  };

  document.querySelectorAll('[data-bi-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-bi-tab]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      reloadBiTab(tab.dataset.biTab);
    });
  });
}

function bindAIEvents({ toast, refresh }) {
  let currentRole = 'owner';

  const roleConfig = {
    owner: { title: 'AI Academy Manager', greeting: 'Ask about operations, problems, capacity, or leads.', suggestions: ['Show me today\'s problems', 'Show insights', 'How is attendance?'] },
    tutor: { title: 'AI Lesson Assistant', greeting: 'Ask me to generate lesson plans, quizzes, or homework.', suggestions: ['Generate lesson plan for tomorrow', 'Create a quiz on algebra', 'Homework ideas for physics'] },
    parent: { title: 'AI Parent Assistant', greeting: 'Ask why scores changed or how to help your child.', suggestions: ['Why did my child score lower?', 'How can I help at home?', 'Tell me about attendance'] },
    student: { title: 'AI Tutor', greeting: 'Ask me to explain any topic you\'re learning.', suggestions: ['Explain Newton\'s Laws', 'Help with quadratic equations', 'What is chemical bonding?'] },
  };

  const reloadMainTab = (mainTab) => {
    const content = document.getElementById('aiMainContent');
    if (mainTab === 'chat') content.innerHTML = aiChatHtml();
    else if (mainTab === 'actions') content.innerHTML = aiActionsHtml(currentRole);
    else if (mainTab === 'insights') content.innerHTML = `<div class="panel"><div class="panel-header"><h3>Auto Insights</h3><button class="btn btn-sm btn-secondary" data-action="refresh-insights">Refresh</button></div><div class="panel-body"><div class="insight-list" id="aiInsights">${insightHtml()}</div></div></div>`;
    else if (mainTab === 'history') content.innerHTML = aiHistoryHtml(currentRole);
    bindAIEvents({ toast, refresh });
  };

  document.querySelectorAll('#aiMainTabs [data-ai-main]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#aiMainTabs [data-ai-main]').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      reloadMainTab(tab.dataset.aiMain);
    });
  });

  const messagesEl = document.getElementById('aiMessages');
  const input = document.getElementById('aiInput');

  const setRole = (role) => {
    currentRole = role;
    const cfg = roleConfig[role];
    const titleEl = document.getElementById('aiRoleTitle');
    const suggEl = document.getElementById('aiSuggestions');
    if (!titleEl || !suggEl || !messagesEl) return;
    titleEl.textContent = cfg.title;
    suggEl.innerHTML = cfg.suggestions.map((s) => `<button data-ai-prompt="${s}">${s}</button>`).join('');
    messagesEl.innerHTML = `<div class="ai-msg assistant">${cfg.greeting}</div>`;
    document.querySelectorAll('#aiRoleTabs .report-tab').forEach((t) => t.classList.toggle('active', t.dataset.aiRole === role));
    document.querySelectorAll('#aiSuggestions [data-ai-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => send(btn.dataset.aiPrompt));
    });
  };

  document.querySelectorAll('#aiRoleTabs [data-ai-role]').forEach((tab) => {
    tab.addEventListener('click', () => setRole(tab.dataset.aiRole));
  });

  const appendMsg = (text, role) => {
    if (!messagesEl) return;
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const send = async (text) => {
    if (!text.trim() || !messagesEl) return;
    appendMsg(text, 'user');
    if (input) input.value = '';
    appendMsg('Thinking...', 'assistant');
    const reply = await chatWithAI(text, currentRole);
    messagesEl.lastChild.textContent = reply;
  };

  document.querySelector('[data-action="ai-send"]')?.addEventListener('click', () => send(input?.value || ''));
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(input.value); });
  document.querySelectorAll('[data-ai-prompt]').forEach((btn) => {
    btn.addEventListener('click', () => send(btn.dataset.aiPrompt));
  });

  document.getElementById('aiActionRole')?.addEventListener('change', (e) => {
    currentRole = e.target.value;
    document.getElementById('aiActionGrid').innerHTML = getAICapabilities(currentRole).map((c) => `
      <div class="batch-card"><h4>${c.label}</h4><p style="font-size:0.82rem;color:var(--text-muted);margin:8px 0">${c.desc}</p>
      <button class="btn btn-sm btn-primary" data-ai-action="${c.id}">Run</button></div>`).join('');
    bindAIEvents({ toast, refresh });
  });

  document.querySelectorAll('[data-ai-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const result = await runAIAction(btn.dataset.aiAction, {
        studentId: document.getElementById('aiActionStudent')?.value,
        topic: document.getElementById('aiActionTopic')?.value.trim(),
      });
      const out = document.getElementById('aiActionResult');
      if (out) out.textContent = formatAIActionResult(result);
      toast('Action completed', 'success');
    });
  });

  document.getElementById('aiHistoryRole')?.addEventListener('change', () => refresh());

  document.querySelectorAll('[data-action="clear-ai-history"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearAIHistory(document.getElementById('aiHistoryRole')?.value || null);
      toast('History cleared', 'success');
      refresh();
    });
  });

  document.querySelector('[data-action="refresh-insights"]')?.addEventListener('click', () => {
    const el = document.getElementById('aiInsights');
    if (el) el.innerHTML = insightHtml();
    toast('Insights refreshed', 'success');
  });
}

function bindFeesEvents({ showModal, closeModal, toast, refresh }) {
  const reloadTable = () => {
    const now = new Date();
    const monthVal = document.getElementById('feeMonth')?.value || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const periodStart = `${monthVal}-01`;
    const body = document.getElementById('invoiceTableBody');
    if (body) body.innerHTML = invoiceRows(getInvoices(), periodStart);
    bindFeesEvents({ showModal, closeModal, toast, refresh });
  };

  document.getElementById('feeBatchFilter')?.addEventListener('change', reloadTable);
  document.getElementById('feeStatusFilter')?.addEventListener('change', reloadTable);
  document.getElementById('feeMonth')?.addEventListener('change', () => refresh());

  document.querySelector('[data-action="generate-invoices"]')?.addEventListener('click', () => {
    const monthVal = document.getElementById('feeMonth')?.value;
    if (!monthVal) return toast('Select a month', 'error');
    const [y, m] = monthVal.split('-').map(Number);
    const result = generateMonthlyInvoices(y, m);
    if (result.created.length) {
      toast(`Created ${result.created.length} invoice(s) for ${result.periodLabel}`, 'success');
    } else {
      toast(`No new invoices — ${result.skipped.length} skipped (already billed, paused, or no fee)`, 'info');
    }
    refresh();
  });

  document.querySelector('[data-action="send-overdue-reminders"]')?.addEventListener('click', async () => {
    const results = await sendBulkFeeReminders({ status: 'overdue' });
    const sent = results.filter((r) => r.ok).length;
    toast(sent ? `Sent ${sent} overdue reminder(s)` : 'No overdue invoices with parent phone', sent ? 'success' : 'info');
    refresh();
  });

  document.querySelectorAll('[data-action="send-invoice-reminder"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const result = await sendInvoiceReminder(btn.dataset.id);
      if (result.ok) toast('Reminder sent via WhatsApp', 'success');
      else toast(result.error || 'Could not send', 'error');
      refresh();
    });
  });

  document.querySelectorAll('[data-action="mark-invoice-paid"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const inv = getInvoices().find((i) => i.id === btn.dataset.id);
      const reported = inv?.status === 'payment_reported';
      const method = inv?.parentPaymentMethod || 'cash';
      showModal({
        title: reported ? 'Confirm parent-reported payment' : 'Mark invoice paid',
        body: `${reported ? `<p style="margin:0 0 12px;font-size:0.88rem;color:var(--text-muted)">Parent reported payment on ${inv.parentReportedAt ? new Date(inv.parentReportedAt).toLocaleString() : '—'}${inv.parentPaymentRef ? ` · ref ${inv.parentPaymentRef}` : ''}</p>` : ''}
        <div class="form-grid">
          <div class="form-group"><label>Amount received (₹)</label><input type="number" id="paidAmount" value="${inv?.amount || 0}"></div>
          <div class="form-group"><label>Payment method</label>
            <select id="paidMethod">
              <option value="cash" ${method === 'cash' ? 'selected' : ''}>Cash</option>
              <option value="upi" ${method === 'upi' ? 'selected' : ''}>UPI</option>
              <option value="bank" ${method === 'bank' ? 'selected' : ''}>Bank transfer</option>
              <option value="cheque" ${method === 'cheque' ? 'selected' : ''}>Cheque</option>
            </select>
          </div>
          <div class="form-group full"><label>Reference / notes</label><input id="paidRef" value="${inv?.parentPaymentRef || ''}" placeholder="UPI ref, receipt no."></div>
        </div>`,
        footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="confirmPaidBtn">${reported ? 'Confirm payment' : 'Mark paid'}</button>`,
        onMount: () => {
          document.getElementById('confirmPaidBtn').onclick = () => {
            const result = markInvoicePaid(btn.dataset.id, {
              paidAmount: Number(document.getElementById('paidAmount').value),
              paymentMethod: document.getElementById('paidMethod').value,
              paymentRef: document.getElementById('paidRef').value.trim(),
            });
            if (result.ok) {
              closeModal();
              toast('Invoice marked paid', 'success');
              refresh();
            } else toast(result.error || 'Failed', 'error');
          };
        },
      });
    });
  });

  document.querySelectorAll('[data-action="void-invoice"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Void this draft invoice?')) return;
      const result = voidInvoice(btn.dataset.id);
      if (result.ok) {
        toast('Invoice voided', 'success');
        refresh();
      } else toast(result.error || 'Failed', 'error');
    });
  });
}

function bindSettingsEvents({ toast, refresh }) {
  document.querySelector('[data-action="save-settings"]')?.addEventListener('click', () => {
    updateSettings({
      tutorName: document.getElementById('setTutorName').value.trim(),
      defaultCountryCode: document.getElementById('setCountryCode').value.trim(),
      whatsappApiKey: document.getElementById('setWaKey').value.trim(),
      whatsappPhoneId: document.getElementById('setWaPhoneId').value.trim(),
      openaiApiKey: document.getElementById('setOpenAI').value.trim(),
    });
    saveBillingSettings({
      invoicePrefix: document.getElementById('setInvPrefix').value.trim() || 'INV',
      defaultDueDay: Number(document.getElementById('setDueDay').value) || 5,
      upiId: document.getElementById('setUpiId').value.trim(),
      bankDetails: document.getElementById('setBankDetails').value.trim(),
    });
    toast('Settings saved', 'success');
  });

  document.querySelector('[data-action="reset-demo"]')?.addEventListener('click', async () => {
    if (confirm('Reset all data to demo sample?')) {
      await resetDemo();
      toast('Demo data restored', 'success');
      refresh();
    }
  });

  document.querySelector('[data-action="import-data"]')?.addEventListener('click', () => {
    const json = prompt('Paste exported JSON data:');
    if (!json) return;
    try {
      importAll(json);
      toast('Data imported', 'success');
      refresh();
    } catch {
      toast('Invalid JSON', 'error');
    }
  });
}
