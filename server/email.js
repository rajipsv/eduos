// @ts-check

/** True when emails can actually be sent (Resend is configured). */
export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

const fromAddress = () => process.env.EMAIL_FROM || 'Tutorsala <no-reply@tutorsala.com>';

/** @param {{ to: string, subject: string, text: string, html?: string }} payload */
async function sendWithResend(payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddress(), ...payload }),
  });
  if (!res.ok) throw new Error(`Resend returned ${res.status}`);
}

/** Escapes text placed in an HTML email. */
function escHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Sends the password-reset email through Resend (https://resend.com) when RESEND_API_KEY is set.
 * Without it, nothing is sent and a warning is logged (the link itself is never logged).
 * @param {string} to
 * @param {string} resetUrl
 */
export async function sendPasswordResetEmail(to, resetUrl) {
  if (!isEmailConfigured()) {
    console.warn('Password reset requested but RESEND_API_KEY is not set; no email sent.');
    return;
  }
  await sendWithResend({
    to,
    subject: 'Reset your Tutorsala password',
    text: `We received a request to reset your Tutorsala password.\n\nOpen this link to choose a new one (valid for 1 hour):\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
}

/**
 * Sends a "choose your password" invite. Returns true when Resend accepted it, false when
 * email isn't configured. Throws if Resend rejects it. The link is never logged.
 * @param {{ to: string, name?: string, centerName?: string, inviteUrl: string, days: number }} invite
 */
export async function sendInviteEmail({ to, name, centerName, inviteUrl, days }) {
  if (!isEmailConfigured()) return false;
  const center = centerName || 'your tuition center';
  const hello = name ? `Hello ${name},` : 'Hello,';
  const text = `${hello}

${center} has set up your Tutorsala account. Open this link to choose your password and sign in:
${inviteUrl}

The link works once and expires in ${days} days. Your sign-in email is ${to}.

If you weren't expecting this, you can ignore this email.

— ${center} on Tutorsala`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;max-width:520px">
  <p>${escHtml(hello)}</p>
  <p><strong>${escHtml(center)}</strong> has set up your Tutorsala account. Choose your password to sign in.</p>
  <p style="margin:24px 0"><a href="${escHtml(inviteUrl)}" style="background:#4f46e5;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Choose my password</a></p>
  <p style="font-size:13px;color:#6b7280">The link works once and expires in ${days} days. Your sign-in email is ${escHtml(to)}.<br>If the button doesn't work, copy this link into your browser:<br><a href="${escHtml(inviteUrl)}">${escHtml(inviteUrl)}</a></p>
  <p style="font-size:13px;color:#6b7280">If you weren't expecting this, you can ignore this email.</p>
</div>`;
  await sendWithResend({ to, subject: `Welcome to ${center} on Tutorsala — choose your password`, text, html });
  return true;
}
