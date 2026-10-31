// "Send login": helpers that find a person's login, the WhatsApp message, and the invite email.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findTeacherLogin,
  findFamilyLogin,
  loginStatusText,
  buildInviteMessage,
  INVITE_DAYS,
} from '../js/invite-rules.js';
import { sendInviteEmail } from '../server/email.js';
import { INVITE_TTL_DAYS, isInviteToken } from '../server/auth/password-reset.js';

const users = [
  { id: 'u1', role: 'teacher', email: 'anita@x.com', linkedTeacherId: 't1' },
  { id: 'u2', role: 'teacher', email: 'vik@x.com', linkedTeacherId: null },
  { id: 'u3', role: 'family', email: 'sharma@x.com', linkedStudentIds: ['s1'] },
  { id: 'u4', role: 'family', email: 'Rao@X.com', linkedStudentIds: [] },
  { id: 'u5', role: 'center_admin', email: 'boss@x.com' },
];

test('finds a teacher login by link, then by email', () => {
  assert.equal(findTeacherLogin(users, { id: 't1', email: '' })?.id, 'u1');
  assert.equal(findTeacherLogin(users, { id: 't2', email: 'VIK@x.com ' })?.id, 'u2');
  assert.equal(findTeacherLogin(users, { id: 't3', email: 'boss@x.com' }), null, 'only teacher logins match by email');
  assert.equal(findTeacherLogin(users, { id: 't4', email: '' }), null);
});

test("finds a family login by linked child, then by the parent's email", () => {
  assert.equal(findFamilyLogin(users, { id: 's1' })?.id, 'u3');
  assert.equal(findFamilyLogin(users, { id: 's2', parentEmail: 'rao@x.com' })?.id, 'u4');
  assert.equal(findFamilyLogin(users, { id: 's3', parentEmail: 'anita@x.com' }), null);
  assert.equal(findFamilyLogin(users, { id: 's4' }), null);
});

test('login status says whether the person has signed in', () => {
  assert.equal(loginStatusText(null), 'No login yet');
  assert.equal(loginStatusText({ lastSeenAt: null }), "Hasn't signed in yet");
  assert.match(loginStatusText({ lastSeenAt: '2026-11-03T10:00:00Z' }), /^Has signed in · last seen 3 Nov 2026$/);
});

test('the WhatsApp message has the center, email, link and expiry', () => {
  const msg = buildInviteMessage({ name: 'Anita', centerName: 'Bright Minds', email: 'a@x.com', link: 'https://t/#reset-password/inv_1' });
  assert.match(msg, /Hello Anita/);
  assert.match(msg, /Bright Minds has set up your Tutorsala login/);
  assert.match(msg, /a@x\.com/);
  assert.match(msg, /https:\/\/t\/#reset-password\/inv_1/);
  assert.match(msg, /expires in 7 days/);
  assert.equal(INVITE_DAYS, INVITE_TTL_DAYS, 'client and server agree on the expiry');
});

test('invite tokens are told apart from reset tokens by prefix', () => {
  assert.equal(isInviteToken('inv_abc'), true);
  assert.equal(isInviteToken('rst_abc'), false);
  assert.equal(isInviteToken(undefined), false);
});

test('invite email: not sent without Resend, escaped HTML and text when it is', async () => {
  const saved = { key: process.env.RESEND_API_KEY, fetch: globalThis.fetch };
  try {
    delete process.env.RESEND_API_KEY;
    assert.equal(await sendInviteEmail({ to: 'a@x.com', inviteUrl: 'https://t/x', days: 7 }), false);

    process.env.RESEND_API_KEY = 're_test';
    let sent;
    globalThis.fetch = async (url, init) => {
      sent = { url, body: JSON.parse(init.body) };
      return new Response('{}', { status: 200 });
    };
    const ok = await sendInviteEmail({
      to: 'a@x.com',
      name: 'Anita <b>',
      centerName: 'Bright & Minds',
      inviteUrl: 'https://t/#reset-password/inv_1',
      days: 7,
    });
    assert.equal(ok, true);
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.equal(sent.body.to, 'a@x.com');
    assert.match(sent.body.subject, /Welcome to Bright & Minds on Tutorsala/);
    assert.match(sent.body.text, /https:\/\/t\/#reset-password\/inv_1/);
    assert.match(sent.body.text, /expires in 7 days/);
    assert.match(sent.body.html, /Anita &lt;b&gt;/);
    assert.match(sent.body.html, /Bright &amp; Minds/);
    assert.ok(sent.body.from);

    globalThis.fetch = async () => new Response('{}', { status: 500 });
    await assert.rejects(sendInviteEmail({ to: 'a@x.com', inviteUrl: 'https://t/x', days: 7 }), /Resend returned 500/);
  } finally {
    if (saved.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = saved.key;
    globalThis.fetch = saved.fetch;
  }
});
