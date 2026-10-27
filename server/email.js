// @ts-check

/**
 * Sends the password-reset email through Resend (https://resend.com) when RESEND_API_KEY is set.
 * Without it, nothing is sent and a warning is logged (the link itself is never logged).
 * @param {string} to
 * @param {string} resetUrl
 */
export async function sendPasswordResetEmail(to, resetUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('Password reset requested but RESEND_API_KEY is not set; no email sent.');
    return;
  }
  const from = process.env.EMAIL_FROM || 'Tutorsala <no-reply@tutorsala.com>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: 'Reset your Tutorsala password',
      text: `We received a request to reset your Tutorsala password.\n\nOpen this link to choose a new one (valid for 1 hour):\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`Resend returned ${res.status}`);
}
