import { getLinkedTeacherId, getLinkedStudentId, getLinkedStudentIds, getSession } from './auth.js';

const NAV_SVG = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21V12h6v9"/></svg>',
  roadmap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 6h8M7.2 7.6 10.8 16.4M16.8 7.6 13.2 16.4"/></svg>',
  crm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  academy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-6 10 6-10 6z"/><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/></svg>',
  communication: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  'student-success': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>',
  'tutor-success': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  'parent-portal': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
  intelligence: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 3 5-8"/></svg>',
  extensions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h4M17 10v4M6.5 10v4M10 17.5h4"/></svg>',
  system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
};

function navGlyph(key) {
  return `<span class="nav-glyph">${NAV_SVG[key] || NAV_SVG.system}</span>`;
}

export const PORTAL_CONFIG = {
  platform_owner: {
    defaultView: 'platformDashboard',
    label: 'Platform',
    nav: [
      { section: 'Platform', items: [
        { view: 'platformDashboard', icon: '◉', label: 'Dashboard' },
        { view: 'platformCenters', icon: '▣', label: 'All centers' },
        { view: 'platformRoadmap', icon: '◇', label: 'Product roadmap' },
      ]},
    ],
    views: ['platformDashboard', 'platformCenters', 'platformCenterDetail', 'platformRoadmap'],
  },
  center_admin: {
    defaultView: 'dashboard',
    label: 'Center',
    nav: [
      { id: 'command', section: 'Overview', collapsible: false, items: [
        { view: 'dashboard', iconKey: 'dashboard', label: 'Dashboard' },
      ]},
      { id: 'crm', accent: 'crm', section: 'Education CRM', items: [
        { view: 'publicSite', label: 'Public Website' },
        { view: 'crm', label: 'Lead pipeline' },
      ]},
      { id: 'academy', accent: 'academy', section: 'Academy', items: [
        { view: 'batches', label: 'Batches' },
        { view: 'schedule', label: 'Class Schedule' },
        { view: 'teachers', label: 'Teachers' },
        { view: 'students', label: 'Students' },
        { view: 'attendance', label: 'Attendance' },
        { view: 'tests', label: 'Tests & Marks' },
      ]},
      { id: 'communication', accent: 'communication', section: 'Communication', items: [
        { view: 'commHub', label: 'Communication Hub' },
      ]},
      { id: 'student-success', accent: 'student-success', section: 'Student Success', items: [{ view: 'studentSuccess', label: 'Student Success' }] },
      { id: 'tutor-success', accent: 'tutor-success', section: 'Tutor Success', items: [{ view: 'tutorHub', label: 'Tutor Success' }] },
      { id: 'parent-portal', accent: 'parent-portal', section: 'Parent Portal', items: [{ view: 'parentPortal', label: 'Parent Portal' }] },
      { id: 'ai', accent: 'ai', section: 'AI Assistants', items: [{ view: 'ai', label: 'AI Assistants' }] },
      { id: 'intelligence', accent: 'intelligence', section: 'Business Intelligence', items: [{ view: 'intelligence', label: 'Business Intelligence' }] },
      { id: 'extensions', accent: 'extensions', section: 'Extensions', items: [{ view: 'marketplace', label: 'Extensions & Partners' }] },
      { id: 'system', accent: 'system', section: 'System', items: [
        { view: 'reports', label: 'Reports' },
        { view: 'settings', label: 'Settings' },
      ]},
    ],
    views: null,
  },
  teacher: {
    defaultView: 'teacherHome',
    label: 'Teacher',
    nav: [
      { section: 'My workspace', items: [
        { view: 'teacherHome', icon: '◉', label: 'Today' },
        { view: 'schedule', icon: '▤', label: 'My schedule' },
        { view: 'attendance', icon: '▧', label: 'Mark attendance' },
        { view: 'tutorHub', icon: '✎', label: 'Homework & plans' },
        { view: 'studentSuccess', icon: '★', label: 'Student Success' },
        { view: 'students', icon: '▦', label: 'My students' },
        { view: 'commHub', icon: '▩', label: 'Messages' },
      ]},
    ],
    views: ['teacherHome', 'schedule', 'attendance', 'tutorHub', 'studentSuccess', 'students', 'commHub', 'whatsapp'],
  },
  student: {
    defaultView: 'studentHome',
    label: 'Student',
    nav: [
      { section: 'My portal', items: [
        { view: 'studentHome', icon: '◉', label: 'Home' },
        { view: 'schedule', icon: '▤', label: 'My classes' },
        { view: 'studentSuccess', icon: '★', label: 'Homework' },
        { view: 'tuitionMarketplace', icon: '⊞', label: 'Find Tuitions' },
      ]},
    ],
    views: ['studentHome', 'schedule', 'studentSuccess', 'tuitionMarketplace'],
  },
  parent: {
    defaultView: 'parentPortal',
    label: 'Parent',
    nav: [
      { section: 'Parent portal', items: [
        { view: 'parentPortal', icon: '♡', label: 'Dashboard' },
        { view: 'studentSuccess', icon: '★', label: 'Homework' },
        { view: 'commHub', icon: '▩', label: 'Messages' },
        { view: 'tuitionMarketplace', icon: '⊞', label: 'Find Tuitions' },
      ]},
    ],
    views: ['parentPortal', 'studentSuccess', 'commHub', 'tuitionMarketplace'],
  },
};

export function getPortalConfig(role) {
  return PORTAL_CONFIG[role] || PORTAL_CONFIG.center_admin;
}

export function getDefaultView(role) {
  return getPortalConfig(role).defaultView;
}

export function canAccessView(role, view) {
  const session = getSession();
  const ownerConsole = role === 'platform_owner' && !session?.viewCenterId;

  if (view === 'platform' || view === 'platformRoadmap') {
    return ownerConsole;
  }

  if (view === 'tuitionMarketplace') {
    return role === 'student' || role === 'parent';
  }

  if (role === 'platform_owner') {
    const platformViews = getPortalConfig('platform_owner').views;
    if (platformViews.includes(view)) return true;
    if (session?.viewCenterId) return canAccessView('center_admin', view);
    return false;
  }
  const cfg = getPortalConfig(role);
  if (cfg.views === null) {
    const allowed = cfg.nav.flatMap((s) => s.items.map((i) => i.view));
    return allowed.includes(view);
  }
  return cfg.views.includes(view);
}

export function getNavRole(session) {
  if (session?.role === 'platform_owner' && session.viewCenterId) return 'center_admin';
  return session?.role || 'center_admin';
}

function findSectionForView(nav, view) {
  return nav.find((section) => section.items.some((item) => item.view === view));
}

function renderNavItems(items, activeView, nested = false) {
  if (nested) {
    return items.map((item) => `
      <button class="nav-subitem${activeView === item.view ? ' active' : ''}" type="button" data-view="${item.view}">
        <span class="nav-subitem-line" aria-hidden="true"></span>
        ${item.label}
      </button>
    `).join('');
  }
  return items.map((item) => `
    <button class="nav-item${activeView === item.view ? ' active' : ''}" type="button" data-view="${item.view}">
      ${item.iconKey ? navGlyph(item.iconKey) : `<span class="nav-icon">${item.icon || '•'}</span>`}
      ${item.label}
    </button>
  `).join('');
}

function renderCommandShortcuts(items, activeView) {
  return `
    <div class="nav-shortcuts">
      ${items.map((item) => `
        <button class="nav-shortcut${activeView === item.view ? ' active' : ''}" type="button" data-view="${item.view}">
          ${navGlyph(item.iconKey)}
          <span>${item.label}</span>
        </button>
      `).join('')}
    </div>`;
}

function renderFlatNav(cfg, activeView) {
  return cfg.nav.map((section) => `
    <div class="nav-section">${section.section}</div>
    ${renderNavItems(section.items, activeView)}
  `).join('');
}

function renderPillarNav(cfg, activeView, openSectionId) {
  const activeSection = findSectionForView(cfg.nav, activeView);
  const openId = openSectionId || activeSection?.id || 'command';

  const blocks = cfg.nav.map((section) => {
    const isOpen = section.id === openId;
    const hasActive = section.items.some((item) => item.view === activeView);
    const isCommand = section.collapsible === false;
    const accent = section.accent || section.id;
    const singleItem = section.items.length === 1 ? section.items[0] : null;
    const isSingle = Boolean(singleItem);

    if (isCommand) {
      return `
        <div class="nav-block nav-block-command">
          <div class="nav-kicker">${section.section}</div>
          ${renderCommandShortcuts(section.items, activeView)}
        </div>`;
    }

    const toggleClass = ['nav-pillar-toggle', isOpen ? 'open' : '', hasActive ? 'has-active' : ''].filter(Boolean).join(' ');
    const bodyClass = ['nav-pillar-body', isOpen ? 'open' : ''].filter(Boolean).join(' ');

    return `
      <div class="nav-pillar${isOpen ? ' open' : ''}${hasActive ? ' has-active' : ''}${isSingle ? ' nav-pillar-single' : ''}" data-pillar-id="${section.id}" data-accent="${accent}">
        <button
          class="${toggleClass}"
          type="button"
          data-pillar-toggle="${section.id}"
          ${isSingle ? `data-single-view="${singleItem.view}"` : ''}
          aria-expanded="${isSingle ? 'false' : isOpen}"
        >
          <span class="nav-pillar-icon">${navGlyph(accent)}</span>
          <span class="nav-pillar-copy">
            <span class="nav-pillar-label">${section.section}</span>
            ${isSingle && singleItem.label !== section.section ? `<span class="nav-pillar-hint">${singleItem.label}</span>` : ''}
          </span>
          ${isSingle ? '' : `<span class="nav-pillar-chevron">${NAV_SVG.chevron}</span>`}
        </button>
        ${isSingle ? '' : `
        <div class="${bodyClass}" data-pillar-body="${section.id}">
          <div class="nav-pillar-items-wrap">
            ${renderNavItems(section.items, activeView, true)}
          </div>
        </div>`}
      </div>`;
  });

  const command = blocks[0];
  const pillars = blocks.slice(1, -1).join('');
  const system = blocks[blocks.length - 1];

  return `
    ${command}
    <div class="nav-block nav-block-groups">
      <div class="nav-kicker">Workspace</div>
      <div class="nav-pillar-list">${pillars}</div>
    </div>
    <div class="nav-block nav-block-system">${system}</div>`;
}

export function renderNavHtml(role, { activeView, openSectionId } = {}) {
  const cfg = getPortalConfig(role);
  if (role === 'center_admin') return renderPillarNav(cfg, activeView, openSectionId);
  return renderFlatNav(cfg, activeView);
}

export function getSectionIdForView(role, view) {
  const section = findSectionForView(getPortalConfig(role).nav, view);
  return section?.id || null;
}

export function filterBatchesForRole(batches, role) {
  if (role !== 'teacher') return batches;
  const tid = getLinkedTeacherId();
  if (!tid) return batches;
  return batches.filter((b) => b.teacherId === tid);
}

export function filterStudentsForRole(students, batches, role) {
  if (role === 'student') {
    const sid = getLinkedStudentId();
    return sid ? students.filter((s) => s.id === sid) : students;
  }
  if (role === 'parent') {
    const ids = getLinkedStudentIds();
    return ids.length ? students.filter((s) => ids.includes(s.id)) : students;
  }
  if (role === 'teacher') {
    const tid = getLinkedTeacherId();
    if (!tid) return students;
    const batchIds = new Set(filterBatchesForRole(batches, role).map((b) => b.id));
    return students.filter((s) => batchIds.has(s.batchId));
  }
  return students;
}
