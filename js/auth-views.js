import { login, registerCenter, DEMO_PASSWORD } from './auth.js';
import { getRawState } from './store.js';
import { renderTuitionMarketplace, bindTuitionMarketplaceEvents, TUITION_PENDING_KEY } from './tuition-marketplace.js';
import {
  renderLandingHeader,
  renderLandingHero,
  renderLandingFeatures,
  renderLandingPricing,
  renderLandingTestimonials,
  renderLandingFooter,
  bindLandingScroll,
  LOGIN_PORTALS,
} from './home-landing.js';

export function renderAuthScreen(mode = 'home') {
  if (mode === 'register') return renderRegisterPage();
  if (mode.startsWith('login-')) return renderLoginPage(mode.replace('login-', ''));
  return renderAuthHome();
}

function renderAuthHome() {
  const rawState = getRawState();
  const marketplaceHtml = renderTuitionMarketplace(rawState, { publicHome: true });

  return `
    <div class="landing-page">
      ${renderLandingHeader()}
      <main>
        ${renderLandingHero()}
        ${renderLandingFeatures()}
        ${renderLandingPricing()}
        ${renderLandingTestimonials()}
        <section class="landing-section landing-marketplace-wrap" id="tuitions">
          <div class="landing-section-head">
            <p class="landing-eyebrow">Tuition marketplace</p>
            <h2>Find the right tuition center</h2>
            <p class="landing-section-sub">Browse academics, dance, art, drawing, music, sports, coding, and more — send an inquiry without signing in. The center will follow up to schedule a demo and enrollment.</p>
          </div>
          <div class="auth-marketplace" id="authMarketplace">
            ${marketplaceHtml}
          </div>
        </section>
      </main>
      ${renderLandingFooter()}
    </div>`;
}

export function renderLoginChooserHtml() {
  return `
    <p class="auth-modal-lead">Choose your portal — each role gets a focused workspace on EduOS.</p>
    <div class="auth-grid auth-grid-modal">
      ${LOGIN_PORTALS.map((p) => `
        <button type="button" class="auth-tile" data-auth-portal="${p.id}">
          <strong>${p.title}</strong>
          <span>${p.subtitle}</span>
        </button>`).join('')}
    </div>
    <div class="auth-modal-footer">
      <button type="button" class="btn btn-primary" data-auth-register-modal>Register your tuition center</button>
      <p class="auth-demo">Demo password for all accounts: <code>${DEMO_PASSWORD}</code></p>
    </div>`;
}

const PORTAL_META = {
  platform: { title: 'Platform owner login', hint: 'owner@eduos.app' },
  center: { title: 'Center admin login', hint: 'admin@brightminds.demo' },
  teacher: { title: 'Teacher login', hint: 'anita@tutorhub.com' },
  family: { title: 'Family login', hint: 'sharma@family.demo' },
  student: { title: 'Student login', hint: 'aarav@email.com' },
  parent: { title: 'Parent login', hint: 'rajesh@email.com' },
};

export function renderLoginFormHtml(portal, { compact = false } = {}) {
  const meta = PORTAL_META[portal] || { title: 'Login', hint: 'your email' };
  return `
    <p class="auth-sub">Try <code>${meta.hint}</code> · password <code>${DEMO_PASSWORD}</code></p>
    <div class="form-grid" style="margin-top:${compact ? 12 : 20}px">
      <div class="form-group full"><label>Email</label><input id="authEmail" type="email" placeholder="${meta.hint}" autocomplete="username"></div>
      <div class="form-group full"><label>Password</label><input id="authPassword" type="password" value="${DEMO_PASSWORD}" autocomplete="current-password"></div>
    </div>
    <button class="btn btn-primary" type="button" style="width:100%;margin-top:16px" data-auth-submit="${portal}">Sign in</button>`;
}

export function renderRegisterFormHtml() {
  return `
    <p class="auth-sub">Create your workspace — add teachers and batches after signup.</p>
    <div class="form-grid" style="margin-top:16px">
      <div class="form-group full"><label>Center name *</label><input id="regCenter" placeholder="Bright Minds Academy"></div>
      <div class="form-group"><label>Your name *</label><input id="regOwner" placeholder="Owner name"></div>
      <div class="form-group"><label>City</label><input id="regCity" placeholder="Mumbai"></div>
      <div class="form-group full"><label>Email *</label><input id="regEmail" type="email"></div>
      <div class="form-group"><label>Phone</label><input id="regPhone"></div>
      <div class="form-group"><label>Password *</label><input id="regPassword" type="password"></div>
    </div>
    <button class="btn btn-primary" type="button" style="width:100%;margin-top:16px" data-auth-register>Create center</button>`;
}

function renderLoginPage(portal) {
  const meta = PORTAL_META[portal] || { title: 'Login' };
  return `
    <div class="auth-shell auth-shell-form">
      <div class="auth-card">
        <button class="btn btn-ghost auth-back" type="button" data-auth-mode="home">← Back to home</button>
        <h2 style="margin-top:16px;font-family:var(--font-display)">${meta.title}</h2>
        ${renderLoginFormHtml(portal)}
      </div>
    </div>`;
}

function renderRegisterPage() {
  return `
    <div class="auth-shell auth-shell-form">
      <div class="auth-card auth-card-wide">
        <button class="btn btn-ghost auth-back" type="button" data-auth-mode="home">← Back to home</button>
        <h2 style="margin-top:12px;font-family:var(--font-display)">Register your tuition center</h2>
        ${renderRegisterFormHtml()}
      </div>
    </div>`;
}

function bindLoginSubmit(onAuthed, toast, closeModal) {
  document.querySelector('[data-auth-submit]')?.addEventListener('click', () => {
    const portal = document.querySelector('[data-auth-submit]')?.dataset.authSubmit;
    const email = document.getElementById('authEmail')?.value;
    const password = document.getElementById('authPassword')?.value;
    const result = login(email, password, portal);
    if (!result.ok) return toast(result.error, 'error');
    closeModal?.();
    toast(`Welcome, ${result.session.name}`, 'success');
    onAuthed(result.session);
  });
}

function bindRegisterSubmit(onAuthed, toast, closeModal) {
  document.querySelector('[data-auth-register]')?.addEventListener('click', () => {
    const result = registerCenter({
      centerName: document.getElementById('regCenter')?.value,
      ownerName: document.getElementById('regOwner')?.value,
      email: document.getElementById('regEmail')?.value,
      phone: document.getElementById('regPhone')?.value,
      city: document.getElementById('regCity')?.value,
      password: document.getElementById('regPassword')?.value,
    });
    if (!result.ok) return toast(result.error, 'error');
    closeModal?.();
    toast(`${result.center.name} created`, 'success');
    onAuthed();
  });
}

export function bindAuthEvents({ onAuthed, toast, onModeChange, showModal, closeModal }) {
  bindLandingScroll();

  const isLanding = () => Boolean(document.querySelector('.landing-page'));

  const showLoginChooser = () => {
    showModal({
      title: 'Sign in to EduOS',
      body: renderLoginChooserHtml(),
      footer: '<button type="button" class="btn btn-secondary" data-modal-cancel>Close</button>',
      wide: true,
      onMount: () => {
        document.querySelectorAll('[data-auth-portal]').forEach((btn) => {
          btn.addEventListener('click', () => showLoginPortal(btn.dataset.authPortal));
        });
        document.querySelector('[data-auth-register-modal]')?.addEventListener('click', showRegisterModal);
      },
    });
  };

  const showLoginPortal = (portal) => {
    const meta = PORTAL_META[portal] || { title: 'Login' };
    showModal({
      title: meta.title,
      body: renderLoginFormHtml(portal, { compact: true }),
      footer: '<button type="button" class="btn btn-ghost" data-auth-back-chooser>← All portals</button><button type="button" class="btn btn-secondary" data-modal-cancel>Close</button>',
      onMount: () => {
        document.querySelector('[data-auth-back-chooser]')?.addEventListener('click', showLoginChooser);
        bindLoginSubmit(onAuthed, toast, closeModal);
      },
    });
  };

  const showRegisterModal = () => {
    showModal({
      title: 'Register your tuition center',
      body: renderRegisterFormHtml(),
      footer: '<button type="button" class="btn btn-ghost" data-auth-back-chooser>← Sign in</button><button type="button" class="btn btn-secondary" data-modal-cancel>Close</button>',
      wide: true,
      onMount: () => {
        document.querySelector('[data-auth-back-chooser]')?.addEventListener('click', showLoginChooser);
        bindRegisterSubmit(onAuthed, toast, closeModal);
      },
    });
  };

  document.querySelectorAll('[data-auth-open-login]').forEach((btn) => {
    btn.addEventListener('click', showLoginChooser);
  });

  document.querySelectorAll('[data-auth-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.authMode;
      if (isLanding()) {
        if (mode === 'register') {
          showRegisterModal();
          return;
        }
        if (mode.startsWith('login-')) {
          showLoginPortal(mode.replace('login-', ''));
          return;
        }
      }
      onModeChange?.(mode);
    });
  });

  const marketplace = document.getElementById('authMarketplace');
  if (marketplace) {
    bindTuitionMarketplaceEvents({
      showModal,
      closeModal,
      toast,
      rawState: getRawState(),
      onLoginRequest: (portal, centerId) => {
        if (centerId) sessionStorage.setItem(TUITION_PENDING_KEY, centerId);
        closeModal();
        showLoginPortal(portal);
      },
    });
  }

  if (!isLanding()) {
    bindLoginSubmit(onAuthed, toast, closeModal);
    bindRegisterSubmit(onAuthed, toast, closeModal);
  }
}

export function renderAuthHomeScreen() {
  return renderAuthScreen('home');
}
