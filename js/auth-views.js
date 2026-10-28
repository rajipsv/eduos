import { esc, safeUrl } from './html.js';
import {
  login,
  registerCenter,
  requestPasswordReset,
  resetPasswordWithToken,
  getPasswordResetTokenInfo,
  validatePassword,
} from './auth.js';
import { getRawState } from './store.js';
import { PHONE_COUNTRY_CODES, normalizePhone, passwordStrength } from './account-rules.js';

const STRENGTH = ['', 'Weak', 'Fair', 'Good', 'Strong'];

function strengthMeterHtml(id) {
  return `<div class="pw-meter" id="${id}" aria-live="polite"><span class="pw-meter-bar"><span></span></span><small></small></div>`;
}

/** Live strength meter and rule hint under a password field. */
function bindStrengthMeter(inputId, meterId, context = () => ({})) {
  const input = document.getElementById(inputId);
  const meter = document.getElementById(meterId);
  if (!input || !meter) return;
  const update = () => {
    const score = passwordStrength(input.value);
    const problem = input.value ? validatePassword(input.value, context()) : null;
    meter.dataset.score = String(score);
    meter.querySelector('.pw-meter-bar span').style.width = `${score * 25}%`;
    meter.querySelector('small').textContent = !input.value
      ? 'At least 8 characters, with a letter and a number'
      : problem || `Strength: ${STRENGTH[score] || 'Weak'}`;
  };
  input.addEventListener('input', update);
  update();
}
import { renderTuitionMarketplace, bindTuitionMarketplaceEvents, TUITION_PENDING_KEY } from './tuition-marketplace.js';
import {
  renderLandingPage,
  bindLandingScroll,
  LOGIN_PORTALS,
} from './home-landing.js';

export function renderAuthScreen(mode = 'home', params = {}) {
  if (mode === 'register') return renderRegisterPage();
  if (mode === 'forgot-password') return renderForgotPasswordPage();
  if (mode === 'reset-password') return renderResetPasswordPage(params.token);
  if (mode.startsWith('login-')) return renderLoginPage(mode.replace('login-', ''));
  return renderAuthHome();
}

function renderAuthHome() {
  const rawState = getRawState();
  const marketplaceHtml = renderTuitionMarketplace(rawState, { publicHome: true });

  return renderLandingPage(marketplaceHtml);
}

export function renderLoginChooserHtml() {
  return `
    <p class="auth-modal-lead">Choose your portal — each role gets a focused workspace on Tutorsala.</p>
    <div class="auth-grid auth-grid-modal">
      ${LOGIN_PORTALS.map((p) => `
        <button type="button" class="auth-tile" data-auth-portal="${esc(p.id)}">
          <strong>${esc(p.title)}</strong>
          <span>${esc(p.subtitle)}</span>
        </button>`).join('')}
    </div>
    <div class="auth-modal-footer">
      <button type="button" class="btn btn-primary" data-auth-register-modal>Register your tuition center</button>
    </div>`;
}

const PORTAL_META = {
  platform: { title: 'Platform owner login', label: 'platform owner' },
  center: { title: 'Center admin login', label: 'center admin' },
  teacher: { title: 'Teacher login', label: 'teacher' },
  family: { title: 'Family login', label: 'family' },
  student: { title: 'Student login', label: 'student' },
  parent: { title: 'Parent login', label: 'parent' },
};

export function renderLoginFormHtml(portal, { compact = false } = {}) {
  const meta = PORTAL_META[portal] || { title: 'Login', label: '' };
  const subtitle = `<p class="auth-sub">Sign in with your ${meta.label ? `${meta.label} ` : ''}email and password.</p>`;
  return `
    ${subtitle}
    <div class="form-grid" style="margin-top:${compact ? 12 : 20}px">
      <div class="form-group full"><label>Email</label><input id="authEmail" type="email" placeholder="your email" autocomplete="username"></div>
      <div class="form-group full"><label>Password</label><input id="authPassword" type="password" value="" autocomplete="current-password"></div>
    </div>
    <p class="auth-forgot-row"><button type="button" class="btn btn-ghost auth-forgot-link" data-auth-forgot>Forgot password?</button></p>
    <button class="btn btn-primary" type="button" style="width:100%;margin-top:8px" data-auth-submit="${portal}">Sign in</button>`;
}

export function renderRegisterFormHtml() {
  return `
    <p class="auth-sub">Create your workspace — add teachers and batches after signup.</p>
    <div class="form-grid" style="margin-top:16px">
      <div class="form-group full"><label>Center name *</label><input id="regCenter" placeholder="Bright Minds Academy"></div>
      <div class="form-group"><label>Your name *</label><input id="regOwner" placeholder="Owner name"></div>
      <div class="form-group"><label>City</label><input id="regCity" placeholder="Mumbai"></div>
      <div class="form-group full"><label>Email *</label><input id="regEmail" type="email"></div>
      <div class="form-group"><label>Phone (WhatsApp)</label>
        <div class="phone-input">
          <select id="regPhoneCode" aria-label="Country code">${PHONE_COUNTRY_CODES.map((c) => `<option value="${c.code}">${c.label}</option>`).join('')}</select>
          <input id="regPhone" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="9876543210" maxlength="15">
        </div>
      </div>
      <div class="form-group"><label>Password *</label><input id="regPassword" type="password" autocomplete="new-password">${strengthMeterHtml('regPasswordMeter')}</div>
    </div>
    <button class="btn btn-primary" type="button" style="width:100%;margin-top:16px" data-auth-register>Create center</button>`;
}

function renderForgotPasswordPage() {
  return `
    <div class="auth-shell auth-shell-form">
      <div class="auth-card">
        <button class="btn btn-ghost auth-back" type="button" data-auth-mode="home">← Back to home</button>
        <h2 style="margin-top:16px;font-family:var(--font-display)">Forgot password</h2>
        ${renderForgotPasswordFormHtml()}
      </div>
    </div>`;
}

export function renderForgotPasswordFormHtml() {
  return `
    <p class="auth-sub">Enter the email on your account. We will send a reset link (valid for 1 hour).</p>
    <div class="form-grid" style="margin-top:16px">
      <div class="form-group full"><label>Email</label><input id="forgotEmail" type="email" placeholder="you@example.com" autocomplete="username"></div>
    </div>
    <button class="btn btn-primary" type="button" style="width:100%;margin-top:16px" data-auth-forgot-submit>Send reset link</button>
    <div id="forgotPasswordResult" class="auth-reset-result hidden"></div>`;
}

function renderResetPasswordPage(token) {
  return `
    <div class="auth-shell auth-shell-form">
      <div class="auth-card">
        <button class="btn btn-ghost auth-back" type="button" data-auth-mode="home">← Back to home</button>
        <h2 style="margin-top:16px;font-family:var(--font-display)">Choose a new password</h2>
        <div id="resetPasswordContent" data-reset-token="${token || ''}">
          <p class="auth-sub">Checking reset link…</p>
        </div>
      </div>
    </div>`;
}

async function hydrateResetPasswordPage(toast, onModeChange) {
  const host = document.getElementById('resetPasswordContent');
  const token = host?.dataset.resetToken;
  if (!host || !token) {
    if (host) host.innerHTML = renderResetPasswordInvalidHtml('Missing reset token.');
    return;
  }
  const info = await getPasswordResetTokenInfo(token);
  host.innerHTML = info.ok
    ? renderResetPasswordFormHtml(token, info)
    : renderResetPasswordInvalidHtml(info.error);
  bindResetPasswordSubmit(toast, onModeChange);
}

function renderResetPasswordInvalidHtml(message) {
  return `
    <p class="auth-sub auth-reset-error">${message || 'This reset link is invalid or has expired.'}</p>
    <button class="btn btn-primary" type="button" style="width:100%;margin-top:16px" data-auth-mode="forgot-password">Request a new link</button>`;
}

function renderResetPasswordFormHtml(token, info) {
  return `
    <p class="auth-sub">Resetting password for <strong>${esc(info.email)}</strong></p>
    <div class="form-grid" style="margin-top:16px">
      <div class="form-group full"><label>New password</label><input id="resetPassword" type="password" autocomplete="new-password" minlength="8">${strengthMeterHtml('resetPasswordMeter')}</div>
      <div class="form-group full"><label>Confirm password</label><input id="resetPasswordConfirm" type="password" autocomplete="new-password" minlength="8"></div>
    </div>
    <button class="btn btn-primary" type="button" style="width:100%;margin-top:16px" data-auth-reset-submit data-reset-token="${token}">Update password</button>`;
}

function renderLoginPage(portal) {
  const meta = PORTAL_META[portal] || { title: 'Login' };
  return `
    <div class="auth-shell auth-shell-form">
      <div class="auth-card">
        <button class="btn btn-ghost auth-back" type="button" data-auth-mode="home">← Back to home</button>
        <h2 style="margin-top:16px;font-family:var(--font-display)">${esc(meta.title)}</h2>
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
  document.querySelector('[data-auth-submit]')?.addEventListener('click', async () => {
    const portal = document.querySelector('[data-auth-submit]')?.dataset.authSubmit;
    const email = document.getElementById('authEmail')?.value;
    const password = document.getElementById('authPassword')?.value;
    const result = await login(email, password, portal);
    if (!result.ok) return toast(result.error, 'error');
    closeModal?.();
    toast(`Welcome, ${result.session.name}`, 'success');
    onAuthed(result.session);
  });
}

function bindForgotPasswordSubmit(toast, { closeModal, onModeChange, compact = false } = {}) {
  document.querySelector('[data-auth-forgot-submit]')?.addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail')?.value;
    const result = await requestPasswordReset(email);
    if (!result.ok) return toast(result.error, 'error');

    const resultEl = document.getElementById('forgotPasswordResult');
    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `
        <p>${esc(result.message)}</p>
        ${result.demoResetUrl ? `<p class="auth-demo-reset"><strong>Demo reset link:</strong> <a href="${safeUrl(result.demoResetUrl)}">${esc(result.demoResetUrl)}</a></p><p style="font-size:0.82rem;color:var(--text-muted);margin:8px 0 0">In production this link is emailed only. It is also logged under Communication Hub when email is simulated.</p>` : ''}`;
    }

    toast(result.message, 'success');
    onModeChange?.('forgot-password');
  });
}

function bindResetPasswordSubmit(toast, onModeChange) {
  bindStrengthMeter('resetPassword', 'resetPasswordMeter');
  document.querySelector('[data-auth-reset-submit]')?.addEventListener('click', async () => {
    const token = document.querySelector('[data-auth-reset-submit]')?.dataset.resetToken;
    const password = document.getElementById('resetPassword')?.value;
    const confirm = document.getElementById('resetPasswordConfirm')?.value;
    if (password !== confirm) return toast('Passwords do not match', 'error');
    const weak = validatePassword(password);
    if (weak) return toast(weak, 'error');

    const result = await resetPasswordWithToken(token, password);
    if (!result.ok) return toast(result.error, 'error');
    toast(result.message, 'success');
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    onModeChange?.('home');
  });
}

function bindRegisterSubmit(onAuthed, toast, closeModal) {
  bindStrengthMeter('regPassword', 'regPasswordMeter', () => ({
    email: document.getElementById('regEmail')?.value,
    name: document.getElementById('regCenter')?.value,
  }));
  document.querySelector('[data-auth-register]')?.addEventListener('click', async () => {
    const { phone, error: phoneError } = normalizePhone(
      document.getElementById('regPhoneCode')?.value,
      document.getElementById('regPhone')?.value,
    );
    if (phoneError) return toast(phoneError, 'error');
    const result = await registerCenter({
      centerName: document.getElementById('regCenter')?.value,
      ownerName: document.getElementById('regOwner')?.value,
      email: document.getElementById('regEmail')?.value,
      phone: phone || '',
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
      title: 'Sign in to Tutorsala',
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

  const showForgotPassword = () => {
    showModal({
      title: 'Forgot password',
      body: renderForgotPasswordFormHtml(),
      footer: '<button type="button" class="btn btn-ghost" data-auth-back-chooser>← Sign in</button><button type="button" class="btn btn-secondary" data-modal-cancel>Close</button>',
      onMount: () => {
        document.querySelector('[data-auth-back-chooser]')?.addEventListener('click', showLoginChooser);
        bindForgotPasswordSubmit(toast, { closeModal, compact: true });
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
        document.querySelector('[data-auth-forgot]')?.addEventListener('click', showForgotPassword);
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
    bindForgotPasswordSubmit(toast, { onModeChange });
    if (document.getElementById('resetPasswordContent')) {
      hydrateResetPasswordPage(toast, onModeChange);
    } else {
      bindResetPasswordSubmit(toast, onModeChange);
    }
    document.querySelectorAll('[data-auth-forgot]').forEach((btn) => {
      btn.addEventListener('click', () => onModeChange?.('forgot-password'));
    });
  }
}

export function renderAuthHomeScreen() {
  return renderAuthScreen('home');
}
