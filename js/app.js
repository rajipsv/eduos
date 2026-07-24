import { exportAll, getRawState, initStore, getStorageLabel } from './store.js';
import { renderView, pageMeta, initCharts, bindViewEvents } from './views.js';
import { initAuth, getSession, logout, getSessionLabel, platformExitCenterView, canSwitchBranch, setActiveBranch, getActiveBranchId, setFamilyView, isFamilyAccount } from './auth.js';
import { renderNavHtml, getDefaultView, canAccessView, getNavRole, getSectionIdForView } from './portals.js';
import { renderAuthScreen, bindAuthEvents } from './auth-views.js';
import { platformPageMeta } from './platform-views.js';
import { TUITION_PENDING_KEY, TUITION_OPEN_KEY, canSendTuitionInquiry } from './tuition-marketplace.js';
import { getBranches } from './store.js';

let currentView = 'dashboard';
let platformDetailCenterId = null;
let openNavSectionId = null;

const appShell = document.getElementById('appShell');
const authRoot = document.getElementById('authRoot');
const content = document.getElementById('content');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const mainNav = document.getElementById('mainNav');
const sessionLabel = document.getElementById('sessionLabel');
const storageLabelEl = document.getElementById('storageLabel');
const branchSelect = document.getElementById('branchSelect');
const familyViewSelect = document.getElementById('familyViewSelect');
const modalOverlay = document.getElementById('modalOverlay');
const modalRoot = document.getElementById('modalRoot');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalFooter = document.getElementById('modalFooter');
const toastContainer = document.getElementById('toastContainer');

const ctx = {
  showModal,
  closeModal,
  toast,
  navigate,
  refresh: () => {
    buildShellForSession(getSession());
    const params = currentView === 'platformCenterDetail' && platformDetailCenterId
      ? { centerId: platformDetailCenterId }
      : {};
    navigate(currentView, params);
  },
  rawState: null,
};

function getStorageFallbackHint() {
  const host = location.hostname || '';
  if (host.endsWith('.vercel.app') || host.includes('vercel')) {
    return 'Set DATABASE_URL in Vercel env vars and redeploy (api/health must return db: true)';
  }
  return 'Data is in browser only — restart via start.bat for Neon sync';
}

function toast(message, type = 'default') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function showModal({ title, body, footer = '', wide = false, onMount }) {
  modalTitle.textContent = title;
  modalBody.innerHTML = body;
  modalFooter.innerHTML = footer;
  modalRoot.classList.toggle('modal-wide', wide);
  modalOverlay.classList.remove('hidden');
  modalFooter.querySelector('[data-modal-cancel]')?.addEventListener('click', closeModal);
  onMount?.();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalRoot.classList.remove('modal-wide');
}

function navigate(view, params = {}) {
  const session = getSession();
  const navRole = getNavRole(session);
  if (params.centerId) platformDetailCenterId = params.centerId;

  if (navRole && !canAccessView(navRole, view)) {
    toast('You do not have access to that page', 'error');
    return;
  }

  currentView = view;
  ctx.rawState = getRawState();

  const renderParams = view === 'platformCenterDetail' && !params.centerId && platformDetailCenterId
    ? { centerId: platformDetailCenterId }
    : params;

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.querySelectorAll('.nav-subitem, .nav-shortcut').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (navRole === 'center_admin') {
    openNavSectionId = getSectionIdForView(navRole, view) || 'command';
    syncPillarNav(view);
  }

  const meta = { ...pageMeta, ...platformPageMeta }[view] || pageMeta.dashboard;
  pageTitle.textContent = meta.title;
  pageSubtitle.textContent = meta.subtitle;
  content.innerHTML = renderView(view, ctx, renderParams);
  bindViewEvents(view, ctx, renderParams);
  requestAnimationFrame(() => initCharts(view));
}

function syncPillarNav(activeView) {
  const openId = openNavSectionId || getSectionIdForView('center_admin', activeView) || 'command';

  document.querySelectorAll('.nav-pillar').forEach((pillar) => {
    const id = pillar.dataset.pillarId;
    const isOpen = id === openId;
    const hasActive = pillar.querySelector(`.nav-subitem[data-view="${activeView}"]`) != null
      || pillar.querySelector(`.nav-item[data-view="${activeView}"]`) != null
      || pillar.querySelector(`[data-single-view="${activeView}"]`) != null;

    pillar.classList.toggle('open', isOpen);
    pillar.classList.toggle('has-active', hasActive);

    const toggle = pillar.querySelector('[data-pillar-toggle]');
    const body = pillar.querySelector('[data-pillar-body]');
    toggle?.classList.toggle('open', isOpen);
    toggle?.classList.toggle('has-active', hasActive);
    toggle?.setAttribute('aria-expanded', body ? (isOpen ? 'true' : 'false') : 'false');
    body?.classList.toggle('open', isOpen);
  });

  document.querySelectorAll('.nav-item, .nav-subitem, .nav-shortcut').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === activeView);
  });
}

function bindNavClicks() {
  document.querySelectorAll('.nav-item, .nav-subitem, .nav-shortcut').forEach((btn) => {
    btn.replaceWith(btn.cloneNode(true));
  });
  document.querySelectorAll('[data-pillar-toggle]').forEach((btn) => {
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll('[data-pillar-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.pillarToggle;
      const singleView = btn.dataset.singleView;
      openNavSectionId = sectionId;

      if (singleView) {
        navigate(singleView);
        document.getElementById('sidebar').classList.remove('open');
        return;
      }

      syncPillarNav(currentView);
    });
  });

  document.querySelectorAll('.nav-item, .nav-subitem, .nav-shortcut').forEach((btn) => {
    btn.addEventListener('click', () => {
      openNavSectionId = getSectionIdForView(getNavRole(getSession()), btn.dataset.view) || openNavSectionId;
      navigate(btn.dataset.view);
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function syncBranchSwitcher(session) {
  if (!branchSelect) return;
  const show = canSwitchBranch();
  branchSelect.classList.toggle('hidden', !show);
  if (!show) return;
  const branches = getBranches();
  const active = getActiveBranchId() || '';
  branchSelect.innerHTML = `<option value="">All branches</option>${branches.map((b) =>
    `<option value="${b.id}"${b.id === active ? ' selected' : ''}>${b.name}${b.city ? ` · ${b.city}` : ''}</option>`,
  ).join('')}`;
}

function syncFamilyViewSwitcher(session) {
  if (!familyViewSelect) return;
  const show = isFamilyAccount();
  familyViewSelect.classList.toggle('hidden', !show);
  if (!show) return;
  familyViewSelect.value = session?.familyView === 'student' ? 'student' : 'parent';
}

function syncTopbarForRole(session) {
  const role = session?.role;
  const navRole = getNavRole(session);
  const showAdminChrome = role === 'center_admin' || role === 'platform_owner';

  storageLabelEl?.classList.toggle('hidden', !showAdminChrome);
  document.getElementById('exportBtn')?.classList.toggle('hidden', !showAdminChrome);
  document.getElementById('quickNotifyBtn')?.classList.toggle('hidden', navRole === 'parent' || navRole === 'student');
}

function buildShellForSession(session) {
  document.querySelector('.support-banner')?.remove();
  const navRole = getNavRole(session);
  openNavSectionId = getSectionIdForView(navRole, getDefaultView(session.role)) || 'command';
  mainNav.innerHTML = renderNavHtml(navRole, { activeView: currentView, openSectionId: openNavSectionId });
  sessionLabel.textContent = getSessionLabel();
  syncBranchSwitcher(session);
  syncFamilyViewSwitcher(session);
  syncTopbarForRole(session);
  if (storageLabelEl) {
    const label = getStorageLabel();
    storageLabelEl.textContent = label;
    storageLabelEl.classList.toggle('session-pill-warn', label !== 'Neon PostgreSQL');
  }
  bindNavClicks();
  if (navRole === 'center_admin') syncPillarNav(currentView);

  if (session.role === 'platform_owner' && session.viewCenterId) {
    const banner = document.createElement('div');
    banner.className = 'support-banner';
    banner.innerHTML = `<span>Support view — viewing center data</span> <button type="button" class="btn btn-sm btn-secondary" id="exitSupport">Back to platform</button>`;
    content.parentElement.insertBefore(banner, content);
    document.getElementById('exitSupport')?.addEventListener('click', () => {
      platformExitCenterView();
      buildShellForSession(getSession());
      navigate('platformCenters');
    });
  }
}

function showApp(session) {
  authRoot.classList.add('hidden');
  appShell.classList.remove('hidden');
  buildShellForSession(session);

  const pendingCenter = sessionStorage.getItem(TUITION_PENDING_KEY);
  if (pendingCenter) {
    if (canSendTuitionInquiry()) {
      sessionStorage.removeItem(TUITION_PENDING_KEY);
      sessionStorage.setItem(TUITION_OPEN_KEY, pendingCenter);
      navigate('tuitionMarketplace');
      return;
    }
    sessionStorage.removeItem(TUITION_PENDING_KEY);
  }

  navigate(getDefaultView(session.role));
}

function mountAuth(mode = 'home') {
  authRoot.classList.remove('hidden');
  appShell.classList.add('hidden');
  try {
    authRoot.innerHTML = renderAuthScreen(mode);
    bindAuthEvents({
      onAuthed: () => showApp(getSession()),
      toast,
      onModeChange: (m) => mountAuth(m),
      showModal,
      closeModal,
    });
  } catch (err) {
    console.error('Auth screen failed:', err);
    authRoot.innerHTML = `<div class="auth-shell"><div class="auth-card"><h2>Could not load sign-in</h2><p>${err.message}</p></div></div>`;
  }
}

document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('modalClose')?.addEventListener('click', closeModal);
modalOverlay?.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.getElementById('exportBtn')?.addEventListener('click', () => {
  const blob = new Blob([exportAll()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eduos-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Data exported', 'success');
});

document.getElementById('quickNotifyBtn')?.addEventListener('click', () => {
  const session = getSession();
  const navRole = getNavRole(session);
  if (session?.role === 'platform_owner' && !session.viewCenterId) {
    toast('Open a center in support view first', 'error');
    return;
  }
  navigate(canAccessView(navRole, 'commHub') ? 'commHub' : getDefaultView(session.role));
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  logout();
  mountAuth('home');
});

branchSelect?.addEventListener('change', () => {
  setActiveBranch(branchSelect.value || null);
  buildShellForSession(getSession());
  ctx.refresh();
});

familyViewSelect?.addEventListener('change', () => {
  setFamilyView(familyViewSelect.value);
  buildShellForSession(getSession());
  navigate(getDefaultView('family'));
});

try {
  await initStore();
  const storageLabel = getStorageLabel();
  console.info(`EduOS storage: ${storageLabel}`);
  if (storageLabelEl) {
    storageLabelEl.textContent = storageLabel;
    storageLabelEl.classList.toggle('session-pill-warn', storageLabel !== 'Neon PostgreSQL');
  }
  initAuth();

  const session = getSession();
  const showAdminChrome = session?.role === 'center_admin' || session?.role === 'platform_owner';
  if (storageLabel !== 'Neon PostgreSQL' && showAdminChrome) {
    toast(getStorageFallbackHint(), 'error');
  }
  if (session) {
    showApp(session);
  } else {
    mountAuth('home');
  }
} catch (err) {
  console.error(err);
  if (content) {
    content.innerHTML = `<div class="panel"><div class="panel-body empty-state"><h4>Something went wrong</h4><p>${err.message}</p></div></div>`;
  }
}

export { platformDetailCenterId };
