// "Send login": a center admin gives a teacher or family their Tutorsala login without ever
// knowing their password. The person gets a one-time link (7 days) and chooses it themselves.
import { esc, safeUrl } from './html.js';
import {
  getUsers,
  getState,
  isDatabaseMode,
  createServerUser,
  createUser,
  updateUser,
  patchLocalUser,
  createPasswordResetToken,
  persist,
  getTeacher,
  saveTeacher,
  getStudent,
  saveStudent,
} from './store.js';
import { apiFetch } from './api-client.js';
import { getSession, buildPasswordResetUrl, validatePassword } from './auth.js';
import { waMeLink } from './whatsapp.js';
import { strengthMeterHtml, bindStrengthMeter } from './auth-views.js';
import { findTeacherLogin, findFamilyLogin, loginStatusText, buildInviteMessage, INVITE_DAYS } from './invite-rules.js';

/** Only center admins (and the platform owner looking at a center) hand out logins. */
export function canSendLogins() {
  return ['center_admin', 'platform_owner'].includes(getSession()?.role);
}

/** Who a "Send login" is for, from a teacher or student record. */
function personFor(kind, id) {
  if (kind === 'teacher') {
    const t = getTeacher(id);
    if (!t) return null;
    return {
      kind,
      recordId: t.id,
      name: t.name,
      email: t.email || '',
      phone: t.phone || '',
      role: 'teacher',
      login: findTeacherLogin(getUsers(), t),
      fields: { linkedTeacherId: t.id },
      who: 'They will see their own batches, schedule and attendance.',
    };
  }
  const s = getStudent(id);
  if (!s) return null;
  return {
    kind,
    recordId: s.id,
    studentName: s.name,
    name: s.parentName || `${s.name}'s family`,
    email: s.parentEmail || s.email || '',
    phone: s.parentPhone || s.phone || '',
    role: 'family',
    login: findFamilyLogin(getUsers(), s),
    fields: { linkedStudentIds: [s.id], parentName: s.parentName || null },
    who: `The family will see ${s.name}'s classes, attendance, tests and fees.`,
  };
}

/** Small badge for a teacher card or student row: whether the login has been used. */
export function loginBadgeHtml(kind, record) {
  const login = kind === 'teacher' ? findTeacherLogin(getUsers(), record) : findFamilyLogin(getUsers(), record);
  if (!login) return '';
  return login.lastSeenAt
    ? `<span class="badge badge-green" title="${esc(loginStatusText(login))}">Login active</span>`
    : '<span class="badge badge-gray" title="They have not signed in yet">Login not used yet</span>';
}

function centerName() {
  return getSession()?.centerName || getState().settings?.tutorName || '';
}

/** Opens the "Send login" flow for a teacher (`kind` 'teacher') or a student's family ('family'). */
export function openSendLoginModal(kind, id, ctx) {
  const person = personFor(kind, id);
  if (!person) return ctx.toast('Record not found', 'error');
  if (person.login) {
    // A family login found by email but not yet linked to this child: link it.
    if (kind === 'family' && !(person.login.linkedStudentIds || []).includes(person.recordId)) {
      updateUser(person.login.id, { linkedStudentIds: [...(person.login.linkedStudentIds || []), person.recordId] });
    }
    return showExistingLogin(person, ctx);
  }
  return showCreateLogin(person, ctx);
}

function showCreateLogin(person, ctx) {
  const { showModal, closeModal, toast } = ctx;
  showModal({
    title: `Create login for ${person.name}`,
    body: `
      <p class="meta" style="margin-top:0">${esc(person.who)} You never need to know their password.</p>
      <div class="form-grid">
        <div class="form-group"><label>Sign-in email</label><input id="invEmail" type="email" value="${esc(person.email)}" placeholder="name@example.com"></div>
        <div class="form-group"><label>Name</label><input id="invName" value="${esc(person.name)}"></div>
        <div class="form-group full">
          <label class="invite-choice"><input type="radio" name="invMode" value="invite" checked>
            <span><strong>Send an invite link (recommended)</strong><br><small>They choose their own password. You get a link to share on WhatsApp${isDatabaseMode() ? ', and we email it too' : ''}.</small></span></label>
          <label class="invite-choice"><input type="radio" name="invMode" value="password">
            <span><strong>Set a password myself</strong><br><small>You'll have to tell them the password.</small></span></label>
        </div>
        <div class="form-group full hidden" id="invPasswordGroup"><label>Password</label><input id="invPassword" type="password" autocomplete="new-password">${strengthMeterHtml('invPasswordMeter')}</div>
      </div>`,
    footer: '<button class="btn btn-secondary" data-modal-cancel>Cancel</button><button class="btn btn-primary" id="invCreateBtn">Create login</button>',
    onMount: () => {
      const context = () => ({ email: document.getElementById('invEmail').value, name: document.getElementById('invName').value });
      bindStrengthMeter('invPassword', 'invPasswordMeter', context);
      document.querySelectorAll('input[name="invMode"]').forEach((r) => {
        r.addEventListener('change', () => {
          const own = document.querySelector('input[name="invMode"]:checked')?.value === 'password';
          document.getElementById('invPasswordGroup').classList.toggle('hidden', !own);
          document.getElementById('invCreateBtn').textContent = own ? 'Create login' : 'Create login and get link';
        });
      });
      document.getElementById('invCreateBtn').textContent = 'Create login and get link';
      document.getElementById('invCreateBtn').onclick = async () => {
        const email = document.getElementById('invEmail').value.trim().toLowerCase();
        const name = document.getElementById('invName').value.trim();
        const invite = document.querySelector('input[name="invMode"]:checked')?.value !== 'password';
        const password = invite ? '' : document.getElementById('invPassword').value;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Enter a valid email address', 'error');
        if (!name) return toast('Name is required', 'error');
        if (!invite) {
          const weak = validatePassword(password, context());
          if (weak) return toast(weak, 'error');
        }
        const btn = document.getElementById('invCreateBtn');
        btn.disabled = true;
        try {
          const result = await createLogin(person, { email, name, invite, password });
          if (!result.ok) return toast(result.message, 'error');
          rememberEmail(person, email);
          if (!invite) {
            closeModal();
            toast(`Login created. Share the password with ${name} yourself.`, 'success');
            ctx.refresh?.();
            return;
          }
          showInviteResult({ ...person, name, email, login: result.user }, result.invite, ctx);
        } finally {
          btn.disabled = false;
        }
      };
    },
  });
}

/** Saves the email on the teacher/student record if it had none. */
function rememberEmail(person, email) {
  if (person.kind === 'teacher') {
    const t = getTeacher(person.recordId);
    if (t && !t.email) saveTeacher({ ...t, email });
  } else {
    const s = getStudent(person.recordId);
    if (s && !s.parentEmail) saveStudent({ ...s, parentEmail: email });
  }
}

const CREATE_ERRORS = {
  email_exists: 'This email already has a Tutorsala login. Use a different email.',
  invalid_body: 'Please check the email and name.',
};

async function createLogin(person, { email, name, invite, password }) {
  const fields = { email, name, role: person.role, ...person.fields };
  if (isDatabaseMode()) {
    const r = await createServerUser(invite ? { ...fields, sendInvite: true } : { ...fields, password });
    if (!r.ok) return { ok: false, message: r.message || CREATE_ERRORS[r.error] || 'Could not create the login. Please try again.' };
    return { ok: true, user: r.user, invite: r.invite };
  }
  // Browser-only demo mode.
  if (getUsers().some((u) => u.email === email)) return { ok: false, message: CREATE_ERRORS.email_exists };
  const user = createUser({
    ...fields,
    centerId: getSession()?.centerId || null,
    password: invite ? `unset-${Math.random().toString(36).slice(2)}${Date.now()}` : password,
  });
  persist();
  return { ok: true, user, invite: invite ? localInvite(user) : null };
}

function localInvite(user) {
  const entry = createPasswordResetToken(user.id, user.email, { invite: true });
  return { link: buildPasswordResetUrl(entry.token), emailed: false, email: user.email, expiresAt: entry.expiresAt };
}

async function requestInvite(user) {
  if (!isDatabaseMode()) return { ok: true, invite: localInvite(user) };
  const res = await apiFetch(`/api/users/${encodeURIComponent(user.id)}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body.message || (res.status === 403 || res.status === 404 ? "You can't send a login for this person." : 'Could not make a link. Please try again.');
    return { ok: false, message };
  }
  patchLocalUser(user.id, { lastSeenAt: body.lastSeenAt || null });
  return { ok: true, invite: body };
}

function showExistingLogin(person, ctx) {
  const { showModal, toast } = ctx;
  const login = person.login;
  // Someone who has never signed in just needs the link; for anyone else, ask first,
  // because a new link (and email) is only needed if they forgot their password.
  if (!login.lastSeenAt) return generateAndShow(person, ctx);
  showModal({
    title: `Login for ${person.name}`,
    body: `
      <p><strong>Sign-in email:</strong> ${esc(login.email)}</p>
      <p class="meta">${esc(loginStatusText(login))}</p>
      <p class="meta">If they forgot their password, send a new link. They choose a new password themselves.</p>`,
    footer: '<button class="btn btn-secondary" data-modal-cancel>Close</button><button class="btn btn-primary" id="invNewLinkBtn">Send a new link</button>',
    onMount: () => {
      document.getElementById('invNewLinkBtn').onclick = () => generateAndShow(person, ctx).catch((err) => toast(err.message, 'error'));
    },
  });
}

async function generateAndShow(person, ctx) {
  const result = await requestInvite(person.login);
  if (!result.ok) return ctx.toast(result.message, 'error');
  showInviteResult(person, result.invite, ctx);
}

function showInviteResult(person, invite, { showModal, toast, refresh }) {
  const login = getUsers().find((u) => u.id === person.login?.id) || person.login;
  const email = invite.email || login?.email || person.email;
  const message = buildInviteMessage({ name: person.name, centerName: centerName(), email, link: invite.link, days: INVITE_DAYS });
  const wa = person.phone ? waMeLink(person.phone, message, getState().settings?.defaultCountryCode) : '';
  const status = { ...login, lastSeenAt: invite.lastSeenAt ?? login?.lastSeenAt };
  showModal({
    title: `Send login to ${person.name}`,
    body: `
      <p style="margin-top:0"><strong>Sign-in email:</strong> ${esc(email)}</p>
      <p class="meta">${esc(loginStatusText(status))}</p>
      <div class="form-group full" style="margin-top:12px"><label for="invLink">Invite link</label>
        <div class="invite-link-row"><input id="invLink" readonly value="${esc(invite.link)}"><button class="btn btn-secondary" type="button" id="invCopyBtn">Copy</button></div>
        <small class="meta">Works once and expires in ${INVITE_DAYS} days. Making a new link turns off older ones.</small>
      </div>
      ${invite.emailed ? `<p class="invite-emailed">✓ Emailed to ${esc(email)}</p>` : ''}
      <div style="margin-top:14px">
        ${wa
          ? `<a class="btn btn-primary invite-wa" id="invWhatsApp" href="${safeUrl(wa)}" target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>`
          : '<p class="meta">No phone number saved, so WhatsApp isn\'t available. Copy the link and share it another way.</p>'}
      </div>`,
    footer: '<button class="btn btn-secondary" data-modal-cancel>Done</button>',
    onMount: () => {
      document.getElementById('invCopyBtn').onclick = async () => {
        const input = document.getElementById('invLink');
        try {
          await navigator.clipboard.writeText(input.value);
        } catch {
          input.select();
          document.execCommand?.('copy');
        }
        toast('Link copied', 'success');
      };
      // Refresh the page behind (login badges) when the admin is done.
      document.querySelector('[data-modal-cancel]')?.addEventListener('click', () => refresh?.());
    },
  });
}
