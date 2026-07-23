import {
  getBatches,
  getStudents,
  getTeachers,
  getMessages,
  getAttendanceHistory,
  getState,
  getStudentAttendanceStats,
  getStudentTestStats,
  getBatchProgress,
} from './store.js';
import { getUpcomingSessions } from './scheduler.js';
import { generateInsights } from './ai.js';

export function generateOwnerDecisions() {
  const decisions = [];
  const batches = getBatches();
  const students = getStudents();
  const teachers = getTeachers();
  const insights = generateInsights();

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const recentAtt = getAttendanceHistory().filter((a) => a.date >= weekAgo);
  const totalRecords = recentAtt.reduce((s, a) => s + Object.keys(a.records).length, 0);
  const presentRecords = recentAtt.reduce(
    (s, a) => s + Object.values(a.records).filter((v) => v === 'present').length,
    0
  );
  const weekRate = totalRecords ? Math.round((presentRecords / totalRecords) * 100) : null;

  if (weekRate != null && weekRate < 80) {
    decisions.push({
      priority: 'high',
      title: 'Attendance dropped this week',
      detail: `Weekly attendance is ${weekRate}%. Review batches with frequent absences and notify parents.`,
      action: 'attendance',
    });
  }

  for (const batch of batches) {
    const count = getStudents(batch.id).length;
    if (count >= batch.capacity) {
      decisions.push({
        priority: 'medium',
        title: `${batch.name} is over capacity`,
        detail: `${count}/${batch.capacity} students enrolled. Recommend opening a parallel batch.`,
        action: 'batches',
      });
    }
  }

  const unassignedBatches = batches.filter((b) => !b.teacherId);
  if (unassignedBatches.length) {
    decisions.push({
      priority: 'high',
      title: `${unassignedBatches.length} batch(es) without a tutor`,
      detail: 'Assign teachers before the next scheduled class.',
      action: 'teachers',
    });
  }

  const upcoming = getUpcomingSessions(batches, 3);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const tomorrowClasses = upcoming.filter((s) => s.date === tomorrow);
  if (tomorrowClasses.length) {
    decisions.push({
      priority: 'info',
      title: `${tomorrowClasses.length} class(es) tomorrow`,
      detail: tomorrowClasses.map((c) => `${c.batchName}: ${c.topic}`).join(' · '),
      action: 'schedule',
    });
  }

  if (teachers.length < batches.length) {
    decisions.push({
      priority: 'medium',
      title: 'Tutor utilization risk',
      detail: `${teachers.length} tutors covering ${batches.length} batches. Consider hiring or redistributing.`,
      action: 'teachers',
    });
  }

  const pendingLeads = (getState().leads || []).filter((l) => l.stage !== 'converted').length;
  if (pendingLeads >= 3) {
    decisions.push({
      priority: 'medium',
      title: `${pendingLeads} leads in pipeline`,
      detail: 'Follow up on demo classes and counseling sessions to improve conversion.',
      action: 'crm',
    });
  }

  for (const insight of insights.slice(0, 2)) {
    decisions.push({
      priority: insight.type === 'alert' ? 'high' : 'medium',
      title: 'AI insight',
      detail: insight.text,
      action: 'ai',
    });
  }

  if (!decisions.length) {
    decisions.push({
      priority: 'info',
      title: 'Operations look healthy',
      detail: 'No urgent issues detected. Focus on lead conversion and curriculum progress.',
      action: 'dashboard',
    });
  }

  return decisions;
}

export function computeBusinessKPIs() {
  const batches = getBatches();
  const students = getStudents();
  const teachers = getTeachers();
  const leads = getState().leads || [];
  const messages = getMessages();
  const attHistory = getAttendanceHistory();

  let attTotal = 0;
  let attPresent = 0;
  for (const a of attHistory) {
    const recs = Object.values(a.records);
    attTotal += recs.length;
    attPresent += recs.filter((v) => v === 'present').length;
  }
  const overallAttendance = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;

  let testSum = 0;
  let testCount = 0;
  for (const s of students) {
    const t = getStudentTestStats(s.id);
    if (t.avg) { testSum += t.avg; testCount++; }
  }
  const avgTestScore = testCount ? Math.round(testSum / testCount) : 0;

  const converted = leads.filter((l) => l.stage === 'converted').length;
  const leadConversion = leads.length ? Math.round((converted / leads.length) * 100) : 0;

  let curriculumSum = 0;
  for (const b of batches) curriculumSum += getBatchProgress(b.id).percent;
  const avgCurriculum = batches.length ? Math.round(curriculumSum / batches.length) : 0;

  const tutorUtilization = teachers.length && batches.length
    ? Math.round((batches.length / teachers.length) * 100)
    : 0;

  const activeLeads = leads.filter((l) => l.stage !== 'converted').length;
  const capacityUsed = batches.length
    ? Math.round(batches.reduce((s, b) => s + getStudents(b.id).length, 0) / batches.reduce((s, b) => s + b.capacity, 0) * 100)
    : 0;

  return {
    overallAttendance,
    avgTestScore,
    leadConversion,
    avgCurriculum,
    tutorUtilization,
    activeLeads,
    capacityUsed,
    totalStudents: students.length,
    totalBatches: batches.length,
    messagesSent: messages.filter((m) => m.status === 'sent').length,
    atRiskStudents: getDropoutRiskStudents().filter((s) => s.risk === 'high').length,
  };
}

export function getDropoutRiskStudents() {
  return getStudents().map((s) => {
    const att = getStudentAttendanceStats(s.id);
    const tests = getStudentTestStats(s.id);
    let riskScore = 0;
    if (att.rate < 70) riskScore += 40;
    else if (att.rate < 85) riskScore += 15;
    if (tests.avg && tests.avg < 50) riskScore += 35;
    else if (tests.avg && tests.avg < 65) riskScore += 15;
    if (att.records.slice(0, 3).filter((r) => r.status === 'absent').length >= 2) riskScore += 25;

    const risk = riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low';
    const factors = [];
    if (att.rate < 75) factors.push('Low attendance');
    if (tests.avg && tests.avg < 60) factors.push('Below-target tests');
    if (!factors.length) factors.push('Monitoring');

    return { id: s.id, name: s.name, batch: getBatches().find((b) => b.id === s.batchId)?.name, risk, riskScore, factors, attendance: att.rate, tests: tests.avg };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

export function getLeadAnalytics() {
  const leads = getState().leads || [];
  const bySource = {};
  for (const l of leads) {
    const src = l.source || 'Other';
    if (!bySource[src]) bySource[src] = { total: 0, converted: 0 };
    bySource[src].total++;
    if (l.stage === 'converted') bySource[src].converted++;
  }

  const funnel = CRM_STAGES.map((stage) => ({
    stage: stage.label,
    count: leads.filter((l) => l.stage === stage.id).length,
  }));

  return { bySource: Object.entries(bySource).map(([source, data]) => ({
    source,
    total: data.total,
    converted: data.converted,
    rate: data.total ? Math.round((data.converted / data.total) * 100) : 0,
  })), funnel, total: leads.length, converted: leads.filter((l) => l.stage === 'converted').length };
}

export function getBatchAnalytics() {
  return getBatches().map((b) => {
    const enrolled = getStudents(b.id).length;
    return {
      id: b.id,
      name: b.name,
      enrolled,
      capacity: b.capacity,
      utilization: b.capacity ? Math.round((enrolled / b.capacity) * 100) : 0,
      progress: getBatchProgress(b.id).percent,
      teacher: getTeachers().find((t) => t.id === b.teacherId)?.name || 'Unassigned',
    };
  });
}

export function generateTrendData() {
  const weeks = [];
  for (let i = 3; i >= 0; i--) {
    const end = new Date(Date.now() - i * 7 * 86400000);
    const start = new Date(end.getTime() - 6 * 86400000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const weekAtt = getAttendanceHistory().filter((a) => a.date >= startStr && a.date <= endStr);
    let total = 0;
    let present = 0;
    for (const a of weekAtt) {
      const recs = Object.values(a.records);
      total += recs.length;
      present += recs.filter((v) => v === 'present').length;
    }
    weeks.push({
      label: i === 0 ? 'This week' : `${i}w ago`,
      attendance: total ? Math.round((present / total) * 100) : null,
      sessions: weekAtt.length,
    });
  }
  return weeks;
}

export function generatePredictions() {
  const predictions = [];
  const atRisk = getDropoutRiskStudents().filter((s) => s.risk === 'high');
  if (atRisk.length) {
    predictions.push({
      type: 'risk',
      title: `${atRisk.length} student(s) at dropout risk`,
      detail: `${atRisk.map((s) => s.name).join(', ')} — intervene within 7 days`,
      confidence: 82,
    });
  }

  const batches = getBatchAnalytics().filter((b) => b.utilization >= 90);
  for (const b of batches) {
    predictions.push({
      type: 'capacity',
      title: `${b.name} nearing capacity`,
      detail: `${b.enrolled}/${b.capacity} enrolled — open parallel batch within 2 weeks`,
      confidence: 75,
    });
  }

  const analytics = getLeadAnalytics();
  const topSource = [...analytics.bySource].sort((a, b) => b.total - a.total)[0];
  if (topSource && topSource.rate < 30) {
    predictions.push({
      type: 'leads',
      title: `Low conversion from ${topSource.source}`,
      detail: `${topSource.rate}% conversion — improve demo follow-up`,
      confidence: 68,
    });
  }

  const kpis = computeBusinessKPIs();
  if (kpis.overallAttendance < 80) {
    predictions.push({
      type: 'attendance',
      title: 'Attendance trend declining',
      detail: `Overall ${kpis.overallAttendance}% — parent reminders recommended`,
      confidence: 71,
    });
  }

  if (!predictions.length) {
    predictions.push({
      type: 'info',
      title: 'Stable operations forecast',
      detail: 'No major risks detected in the next 30 days',
      confidence: 90,
    });
  }

  return predictions;
}

export const PLATFORM_LAYERS = [
  { id: 1, name: 'Education CRM', desc: 'Public site, lead pipeline, demo scheduling, enrollment', phase: 2, status: 'live', pct: 100 },
  { id: 2, name: 'Academy OS', desc: 'Batches, schedule, tutors, students, attendance, exams', phase: 1, status: 'live', pct: 100 },
  { id: 3, name: 'Communication Platform', desc: 'WhatsApp, email, SMS, push — event-driven automations', phase: 1, status: 'live', pct: 100 },
  { id: 4, name: 'Student Success Engine', desc: 'Learning journey, skills, interventions, parent summaries', phase: 3, status: 'live', pct: 100 },
  { id: 5, name: 'Tutor Success Platform', desc: 'Performance, lesson plans, homework review, PD', phase: 1, status: 'live', pct: 100 },
  { id: 6, name: 'Parent Experience', desc: 'Progress, homework, attendance, messages, preferences', phase: 3, status: 'live', pct: 100 },
  { id: 7, name: 'AI Layer', desc: 'Role-based assistants, actions, insights, conversation history', phase: 3, status: 'live', pct: 100 },
  { id: 8, name: 'Business Intelligence', desc: 'KPIs, trends, predictions, lead analytics, decisions', phase: 3, status: 'live', pct: 100 },
  { id: 9, name: 'Extensions & Partners', desc: 'Connect teaching tools, ops message templates, and partner services', phase: 4, status: 'live', pct: 100 },
];

export const CRM_STAGES = [
  { id: 'lead', label: 'Lead' },
  { id: 'inquiry', label: 'Inquiry' },
  { id: 'demo', label: 'Demo Class' },
  { id: 'counseling', label: 'Counseling' },
  { id: 'admission', label: 'Admission' },
  { id: 'payment', label: 'Payment' },
  { id: 'batch_allocation', label: 'Batch Allocation' },
  { id: 'converted', label: 'Student' },
];

export const CRM_SOURCES = ['Website', 'WhatsApp', 'Facebook Ads', 'Referral', 'Walk-in', 'Student Marketplace', 'Parent Marketplace', 'Other'];
