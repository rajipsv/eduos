// @ts-check
// Emails sent by the website (password reset, login invites).
// Sends through an SMTP mailbox (e.g. Hostinger) when SMTP_HOST is set, otherwise through
// Resend when RESEND_API_KEY is set. Without either, nothing is sent and the app falls back
// to links the admin copies or shares on WhatsApp. Links and passwords are never logged.
import nodemailer from 'nodemailer';

/** 'smtp', 'resend' or null when email isn't set up. */
export function emailProvider() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
  if (process.env.RESEND_API_KEY) return 'resend';
  return null;
}

/** True when emails can actually be sent. */
export function isEmailConfigured() {
  return emailProvider() !== null;
}

const fromAddress = () =>
  process.env.EMAIL_FROM || (process.env.SMTP_USER ? `Tutorsala <${process.env.SMTP_USER}>` : 'Tutorsala <no-reply@tutorsala.com>');

let transport = null;
let transportKey = '';

/** One SMTP connection setup per server instance (recreated if the settings change, e.g. in tests). */
function smtpTransport() {
  const port = Number(process.env.SMTP_PORT) || 465;
  const key = [process.env.SMTP_HOST, port, process.env.SMTP_USER, process.env.SMTP_PASS].join('|');
  if (!transport || key !== transportKey) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = SSL from the start; 587 must upgrade with STARTTLS
      requireTLS: port === 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Vercel functions stop after 15 s, so fail fast rather than hang.
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
    transportKey = key;
  }
  return transport;
}

/** @param {{ to: string, subject: string, text: string, html?: string }} payload */
async function sendWithSmtp(payload) {
  await smtpTransport().sendMail({ from: fromAddress(), ...payload });
}

/** @param {{ to: string, subject: string, text: string, html?: string }} payload */
async function sendWithResend(payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromAddress(), ...payload }),
  });
  if (!res.ok) throw new Error(`Resend returned ${res.status}`);
}

/** @param {{ to: string, subject: string, text: string, html?: string }} payload */
async function sendEmail(payload) {
  if (emailProvider() === 'smtp') return sendWithSmtp(payload);
  return sendWithResend(payload);
}

/** Escapes text placed in an HTML email. */
function escHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Sends the password-reset email when email is set up (SMTP or Resend).
 * Without it, nothing is sent and a warning is logged (the link itself is never logged).
 * @param {string} to
 * @param {string} resetUrl
 */
export async function sendPasswordResetEmail(to, resetUrl) {
  if (!isEmailConfigured()) {
    console.warn('Password reset requested but email is not set up (SMTP_* or RESEND_API_KEY); no email sent.');
    return;
  }
  await sendEmail({
    to,
    subject: 'Reset your Tutorsala password',
    text: `We received a request to reset your Tutorsala password.\n\nOpen this link to choose a new one (valid for 1 hour):\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
}

/**
 * Sends a "choose your password" invite. Returns true when it was sent, false when
 * email isn't configured. Throws if the mail server rejects it. The link is never logged.
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
  <p style="margin:24px 0"><a href="${escHtml(inviteUrl)}" style="background:#2d6a4f;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Choose my password</a></p>
  <p style="font-size:13px;color:#6b7280">The link works once and expires in ${days} days. Your sign-in email is ${escHtml(to)}.<br>If the button doesn't work, copy this link into your browser:<br><a href="${escHtml(inviteUrl)}">${escHtml(inviteUrl)}</a></p>
  <p style="font-size:13px;color:#6b7280">If you weren't expecting this, you can ignore this email.</p>
</div>`;
  await sendEmail({ to, subject: `Welcome to ${center} on Tutorsala — choose your password`, text, html });
  return true;
}
