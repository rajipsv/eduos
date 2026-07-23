import { getLeads, getState } from './store.js';
import { CRM_STAGES, getLeadAnalytics } from './intelligence.js';

export function getCrmStats() {
  const leads = getLeads();
  const today = new Date().toISOString().slice(0, 10);
  const active = leads.filter((l) => l.stage !== 'converted');
  const converted = leads.filter((l) => l.stage === 'converted');
  const conversionRate = leads.length ? Math.round((converted.length / leads.length) * 100) : 0;
  const needsFollowUp = active.filter((l) => l.followUpDate && l.followUpDate <= today);
  const demosScheduled = active.filter((l) => l.demoDate && l.stage === 'demo');
  const analytics = getLeadAnalytics();

  return {
    total: leads.length,
    active: active.length,
    converted: converted.length,
    conversionRate,
    needsFollowUp: needsFollowUp.length,
    demosScheduled: demosScheduled.length,
    byStage: CRM_STAGES.map((s) => ({
      ...s,
      count: leads.filter((l) => l.stage === s.id).length,
    })),
    bySource: analytics.bySource.slice(0, 5),
    followUpLeads: needsFollowUp,
  };
}

export function searchLeads(query, stage, source) {
  let leads = getLeads();
  if (stage) leads = leads.filter((l) => l.stage === stage);
  if (source) leads = leads.filter((l) => l.source === source);
  if (query) {
    const q = query.toLowerCase();
    leads = leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.phone || '').includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.course || '').toLowerCase().includes(q)
    );
  }
  return leads.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function getStageLabel(stageId) {
  return CRM_STAGES.find((s) => s.id === stageId)?.label || stageId;
}

export function formatLeadAge(createdAt) {
  if (!createdAt) return '';
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function getRecentWebInquiries(limit = 10) {
  return getLeads()
    .filter((l) => l.source === 'Website')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, limit);
}
