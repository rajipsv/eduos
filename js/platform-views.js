import { getCenters, getTeachers, getStudents, getBatches, getLeads } from './store.js';
import { getSession, platformViewCenter, platformExitCenterView, setCenterStatus, isPlatformOwner } from './auth.js';
import { PLATFORM_LAYERS } from './intelligence.js';
import { getUpcomingSessions, formatTime } from './scheduler.js';

export const platformPageMeta = {
  platformDashboard: { title: 'Platform Dashboard', subtitle: 'Tutorsala operator — all tuition centers' },
  platformInboundLeads: { title: 'Demo requests', subtitle: 'Inbound leads from start-page and Meta ads' },
  platformCenters: { title: 'All Centers', subtitle: 'Registered tuition centers on Tutorsala' },
  platformCenterDetail: { title: 'Center detail', subtitle: 'Inspect and manage a center' },
  platformRoadmap: { title: 'Product Roadmap', subtitle: 'Capabilities included in every tuition center' },
};

function centerStats(centerId) {
  const inCenter = (items) => (items || []).filter((i) => i.centerId === centerId);
  const batches = inCenter(getBatches().concat([])); // getBatches scoped - need raw
  return null;
}

function rawByCenter(arr, centerId) {
  return (arr || []).filter((x) => x.centerId === centerId);
}

export function getCenterOpsStats(centerId, rawState) {
  return {
    teachers: rawByCenter(rawState.teachers, centerId).length,
    students: rawByCenter(rawState.students, centerId).length,
    batches: rawByCenter(rawState.batches, centerId).length,
    leads: rawByCenter(rawState.leads, centerId).filter((l) => l.stage !== 'converted').length,
  };
}

export function renderPlatformDashboard(rawState) {
  const centers = getCenters();
  const active = centers.filter((c) => c.status !== 'suspended').length;
  const totalTeachers = (rawState.teachers || []).length;
  const totalStudents = (rawState.students || []).length;
  return `
    <div class="vision-banner"><h3>Platform owner</h3><p>You see every tuition center on Tutorsala — onboard, support, and monitor usage.</p></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Centers</div><div class="value">${centers.length}</div></div>
      <div class="stat-card"><div class="label">Active</div><div class="value">${active}</div></div>
      <div class="stat-card"><div class="label">Teachers (all)</div><div class="value">${totalTeachers}</div></div>
      <div class="stat-card"><div class="label">Students (all)</div><div class="value">${totalStudents}</div></div>
    </div>
    <div class="panel" style="margin-top:20px" id="platformInboundPanel">
      <div class="panel-header">
        <h3>Demo requests</h3>
        <button class="btn btn-sm btn-secondary" data-action="go-platformInboundLeads">View all</button>
      </div>
      <div class="panel-body" id="platformInboundPanelBody"><p class="empty-state">Loading inbound leads…</p></div>
    </div>
    <div class="panel" style="margin-top:20px"><div class="panel-header"><h3>Recent centers</h3><button class="btn btn-sm btn-secondary" data-action="go-platformCenters">View all</button></div>
    <div class="panel-body">${centers.slice(0, 5).map((c) => {
      const st = getCenterOpsStats(c.id, rawState);
      return `<div class="session-row"><div class="session-info"><h4>${c.name}</h4><p>${c.city || '—'} · ${st.teachers} teachers · ${st.students} students · <span class="badge ${c.status === 'suspended' ? 'badge-red' : 'badge-green'}">${c.status || 'active'}</span></p></div>
      <button class="btn btn-sm btn-primary" data-action="open-center" data-id="${c.id}">Open</button></div>`;
    }).join('')}</div></div>`;
}

function inboundStageOptions(selected) {
  const stages = [
    ['inquiry', 'Inquiry'],
    ['contacted', 'Contacted'],
    ['demo', 'Demo scheduled'],
    ['pilot', 'Pilot'],
    ['won', 'Won'],
    ['lost', 'Lost'],
  ];
  return stages.map(([id, label]) => `<option value="${id}"${selected === id ? ' selected' : ''}>${label}</option>`).join('');
}

function renderInboundLeadRows(leads) {
  if (!leads.length) {
    return '<p class="empty-state">No demo requests yet. Share <code>start-page.html</code> in Meta ads or from the website.</p>';
  }
  return `<div class="table-wrap"><table>
    <thead><tr><th>When</th><th>Contact</th><th>Center</th><th>Students</th><th>Source</th><th>Stage</th><th></th></tr></thead>
    <tbody>${leads.map((lead) => `
      <tr data-inbound-id="${lead.id}">
        <td><small>${(lead.createdAt || '').slice(0, 10)}</small></td>
        <td><strong>${lead.name}</strong><br><small>${lead.phone}<br>${lead.email}</small></td>
        <td>${lead.centerName}<br><small>${lead.city}</small></td>
        <td>${lead.students || '—'}</td>
        <td><span class="badge badge-gray">${lead.source || 'Start Page'}</span></td>
        <td><select class="inbound-stage-select" data-inbound-stage="${lead.id}">${inboundStageOptions(lead.stage)}</select></td>
        <td><a class="btn btn-sm btn-secondary" href="https://wa.me/919553371972?text=${encodeURIComponent(`Hi ${lead.firstName}, following up on your Tutorsala demo request for ${lead.centerName}.`)}" target="_blank" rel="noopener noreferrer">WhatsApp</a></td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

function renderInboundLeadCards(leads) {
  if (!leads.length) {
    return '<p class="empty-state">No demo requests yet.</p>';
  }
  return leads.slice(0, 5).map((lead) => `
    <div class="session-row">
      <div class="session-info">
        <h4>${lead.centerName} · ${lead.city}</h4>
        <p>${lead.name} · ${lead.phone} · ${lead.students} students · <span class="badge badge-gray">${lead.source || 'Start Page'}</span></p>
      </div>
      <span class="badge badge-orange">${lead.stage || 'inquiry'}</span>
    </div>`).join('');
}

export function renderPlatformInboundLeads() {
  return `
    <div class="vision-banner"><h3>Demo request pipeline</h3><p>Leads captured from <code>start-page.html</code> — Meta ads and website CTAs. Updates sync from the server.</p></div>
    <div class="panel"><div class="panel-body" id="platformInboundFullBody"><p class="empty-state">Loading inbound leads…</p></div></div>`;
}

async function fetchInboundLeads() {
  const res = await fetch('/api/leads', { credentials: 'include' });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Sign in as platform owner to view demo requests.');
  }
  if (!res.ok) throw new Error(`Could not load leads (${res.status})`);
  const payload = await res.json();
  return payload.leads || [];
}

export async function hydrateInboundLeadsPanels({ toast, navigate, full = false } = {}) {
  const bodyId = full ? 'platformInboundFullBody' : 'platformInboundPanelBody';
  const body = document.getElementById(bodyId);
  if (!body) return;

  try {
    const leads = await fetchInboundLeads();
    body.innerHTML = full ? renderInboundLeadRows(leads) : renderInboundLeadCards(leads);
    if (full) bindInboundStageHandlers({ toast });
  } catch (err) {
    body.innerHTML = `<p class="empty-state">${err.message}</p>`;
    if (full && err.message.includes('platform owner')) {
      body.innerHTML += '<p class="empty-state">Local dev: log in as <code>owner@tutorsala.app</code> or disable JWT auth.</p>';
    }
  }
}

function bindInboundStageHandlers({ toast }) {
  document.querySelectorAll('[data-inbound-stage]').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const id = e.target.dataset.inboundStage;
      const stage = e.target.value;
      try {
        const res = await fetch('/api/leads', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, stage }),
        });
        if (!res.ok) throw new Error('update_failed');
        toast?.('Lead stage updated', 'success');
      } catch {
        toast?.('Could not update stage', 'error');
      }
    });
  });
}

export function renderPlatformCenters(rawState) {
  const centers = getCenters();
  return `
    <div class="toolbar"><input id="centerSearch" placeholder="Search centers…" style="flex:1;max-width:280px"></div>
    <div class="panel"><div class="panel-body table-wrap">
      <table><thead><tr><th>Center</th><th>City</th><th>Plan</th><th>Teachers</th><th>Students</th><th>Leads</th><th>Status</th><th></th></tr></thead>
      <tbody id="centersTableBody">${centersTableRows(centers, rawState)}</tbody></table>
    </div></div>`;
}

function centersTableRows(centers, rawState) {
  return centers.map((c) => {
    const st = getCenterOpsStats(c.id, rawState);
    return `<tr data-center-row="${c.name.toLowerCase()}">
      <td><strong>${c.name}</strong><br><small>${c.slug || ''}</small></td>
      <td>${c.city || '—'}</td>
      <td>${c.plan || 'trial'}</td>
      <td>${st.teachers}</td>
      <td>${st.students}</td>
      <td>${st.leads}</td>
      <td><span class="badge ${c.status === 'suspended' ? 'badge-red' : 'badge-green'}">${c.status || 'active'}</span></td>
      <td><button class="btn btn-sm btn-primary" data-action="open-center" data-id="${c.id}">Open</button></td>
    </tr>`;
  }).join('');
}

export function renderPlatformCenterDetail(centerId, rawState) {
  const center = getCenters().find((c) => c.id === centerId);
  if (!center) return '<p class="empty-state">Center not found</p>';
  const st = getCenterOpsStats(centerId, rawState);
  const session = getSession();
  const viewing = session?.viewCenterId === centerId;
  return `
    <div class="toolbar">
      <button class="btn btn-secondary" data-action="go-platformCenters">← All centers</button>
      ${viewing ? `<button class="btn btn-primary" data-action="enter-center-app">Enter center workspace</button>` : `<button class="btn btn-primary" data-action="support-view" data-id="${center.id}">Support view</button>`}
    </div>
    <div class="panel"><div class="panel-header"><h3>${center.name}</h3><span class="badge badge-gray">${center.plan || 'trial'}</span></div>
    <div class="panel-body">
      <p style="font-size:0.88rem;line-height:1.7"><strong>City:</strong> ${center.city || '—'} · <strong>Phone:</strong> ${center.phone || '—'} · <strong>Owner email:</strong> ${center.ownerEmail || '—'} · <strong>Joined:</strong> ${center.createdAt || '—'}</p>
      <div class="stats-grid" style="margin-top:16px">
        <div class="stat-card"><div class="label">Teachers</div><div class="value">${st.teachers}</div></div>
        <div class="stat-card"><div class="label">Students</div><div class="value">${st.students}</div></div>
        <div class="stat-card"><div class="label">Batches</div><div class="value">${st.batches}</div></div>
        <div class="stat-card"><div class="label">Active leads</div><div class="value">${st.leads}</div></div>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        ${center.status === 'suspended'
    ? `<button class="btn btn-secondary" data-action="activate-center" data-id="${center.id}">Reactivate center</button>`
    : `<button class="btn btn-danger" data-action="suspend-center" data-id="${center.id}">Suspend center</button>`}
      </div>
    </div></div>`;
}

export function renderPlatformRoadmap() {
  return `
    <div class="vision-banner"><h3>Tutorsala product roadmap</h3><p>What each tuition center gets on the platform.</p></div>
    <div class="layer-grid">
      ${PLATFORM_LAYERS.map((layer) => `
        <div class="batch-card">
          <div class="meta">${layer.name} · ${layer.status} · ${layer.pct}%</div>
          <h4>${layer.name}</h4>
          <p style="font-size:0.82rem;color:var(--text-muted)">${layer.desc}</p>
        </div>`).join('')}
    </div>`;
}

export function bindPlatformEvents(ctx) {
  const { navigate, toast, refresh, rawState } = ctx;

  hydrateInboundLeadsPanels({ toast, navigate, full: false });
  if (document.getElementById('platformInboundFullBody')) {
    hydrateInboundLeadsPanels({ toast, navigate, full: true });
  }

  document.querySelectorAll('[data-action="open-center"]').forEach((btn) => {
    btn.addEventListener('click', () => navigate('platformCenterDetail', { centerId: btn.dataset.id }));
  });

  document.querySelector('[data-action="go-platformCenters"]')?.addEventListener('click', () => navigate('platformCenters'));

  document.querySelector('[data-action="go-platformInboundLeads"]')?.addEventListener('click', () => navigate('platformInboundLeads'));

  document.querySelector('[data-action="support-view"]')?.addEventListener('click', (e) => {
    platformViewCenter(e.target.dataset.id);
    toast('Support view enabled — open center workspace', 'success');
    refresh();
  });

  document.querySelector('[data-action="enter-center-app"]')?.addEventListener('click', () => {
    navigate('dashboard');
  });

  document.querySelector('[data-action="suspend-center"]')?.addEventListener('click', (e) => {
    if (!confirm('Suspend this center? Users cannot log in.')) return;
    setCenterStatus(e.target.dataset.id, 'suspended');
    toast('Center suspended', 'success');
    refresh();
  });

  document.querySelector('[data-action="activate-center"]')?.addEventListener('click', (e) => {
    setCenterStatus(e.target.dataset.id, 'active');
    toast('Center reactivated', 'success');
    refresh();
  });

  document.getElementById('centerSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('[data-center-row]').forEach((row) => {
      row.style.display = row.dataset.centerRow.includes(q) ? '' : 'none';
    });
  });
}

export function renderTeacherHome() {
  const batches = getBatches();
  const upcoming = getUpcomingSessions(batches, 6);
  return `
    <div class="vision-banner"><h3>Teacher workspace</h3><p>Your classes and ops tasks — scoped to your batches only.</p></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="label">My batches</div><div class="value">${batches.length}</div></div>
      <div class="stat-card"><div class="label">My students</div><div class="value">${getStudents().length}</div></div>
    </div>
    <div class="panel" style="margin-top:16px">
      <div class="panel-header">
        <h3>Upcoming classes</h3>
        <button type="button" class="btn btn-sm btn-secondary" data-view-link="schedule">Open calendar</button>
      </div>
      <div class="panel-body">${upcoming.length ? upcoming.map((s) => `
        <div class="session-row">
          <div class="session-info">
            <h4>${s.topic}</h4>
            <p>${s.batchName} · ${s.date} · ${formatTime(s.startTime)}–${formatTime(s.endTime)}</p>
          </div>
          <div class="session-actions">
            <a href="${s.meetingLink}" target="_blank" class="btn btn-sm btn-primary">Join</a>
            <button type="button" class="btn btn-sm btn-secondary" data-action="open-session" data-batch="${s.batchId}" data-session="${s.id}">Cancel / reschedule</button>
          </div>
        </div>`).join('') : '<p class="empty-state">No upcoming classes</p>'}
      </div>
    </div>`;
}

export function renderStudentHome() {
  const student = getStudents()[0];
  const batch = student ? getBatches().find((b) => b.id === student.batchId) : null;
  return `
    <div class="vision-banner"><h3>Student portal</h3><p>Your schedule and homework status — teaching happens on your tutor's platform.</p></div>
    ${student ? `<div class="panel"><div class="panel-body"><p><strong>${student.name}</strong> · Grade ${student.grade} · ${batch?.name || 'No batch'}</p></div></div>` : '<p class="empty-state">Profile not linked</p>'}
    <div class="panel" style="margin-top:16px"><div class="panel-header"><h3>Quick links</h3></div><div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-secondary" data-view-link="schedule">My classes</button>
      <button class="btn btn-secondary" data-view-link="studentSuccess">Homework</button>
      <button class="btn btn-secondary" data-view-link="tuitionMarketplace">Find tuitions</button>
    </div></div>`;
}
