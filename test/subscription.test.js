// Tutorsala subscription rules (js/subscription.js), shared by the browser and the server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isoDate,
  addDays,
  addYears,
  daysBetween,
  formatDay,
  getSubscription,
  subscriptionStatus,
  subscriptionBanner,
  nextPaidUntil,
  applySubscriptionUpdate,
  countActiveStudents,
  subscriptionForViewer,
  studentLimitMessage,
  DEMO_CENTER_ID,
} from '../js/subscription.js';

test('date helpers', () => {
  assert.equal(isoDate('2026-10-31T18:30:00.000Z'), '2026-10-31');
  assert.equal(isoDate('2026-02-30'), null);
  assert.equal(isoDate('garbage'), null);
  assert.equal(isoDate(undefined), null);
  assert.equal(addDays('2026-10-15', 30), '2026-11-14');
  assert.equal(addDays('2026-12-20', 30), '2027-01-19');
  assert.equal(addYears('2026-03-31', 1), '2027-03-31');
  assert.equal(addYears('2028-02-29', 1), '2029-02-28');
  assert.equal(daysBetween('2026-10-31', '2026-11-05'), 5);
  assert.equal(daysBetween('2026-11-05', '2026-10-31'), -5);
  assert.equal(formatDay('2027-03-31'), '31 Mar 2027');
  assert.equal(formatDay(null), '—');
});

test('old centers without a subscription are a 30-day pilot from creation', () => {
  const sub = getSubscription({ id: 'c1', plan: 'trial', createdAt: '2026-10-10' });
  assert.equal(sub.plan, 'pilot');
  assert.equal(sub.pilotEndsAt, '2026-11-09');
  assert.equal(sub.paidUntil, null);
  assert.equal(sub.studentLimit, 100);
  assert.deepEqual(sub.payments, []);
  // Nothing stored at all, or junk stored: still no crash.
  assert.equal(getSubscription({}).plan, 'pilot');
  assert.equal(getSubscription(null).pilotEndsAt, null);
  const junk = getSubscription({ createdAt: '2026-10-10', subscription: { plan: 'gold', extraBranches: -3, studentLimit: 'x', payments: 'no' } });
  assert.equal(junk.plan, 'pilot');
  assert.equal(junk.extraBranches, 0);
  assert.equal(junk.studentLimit, 100);
  assert.deepEqual(junk.payments, []);
  assert.equal(subscriptionStatus({ subscription: { plan: 'pilot' } }, '2026-10-31').kind, 'pilot');
});

test('student limit: 100 per paid branch unless set', () => {
  assert.equal(getSubscription({ subscription: { plan: 'starter', extraBranches: 2 } }).studentLimit, 300);
  assert.equal(getSubscription({ subscription: { plan: 'custom', extraBranches: 2, studentLimit: 450 } }).studentLimit, 450);
  assert.equal(studentLimitMessage(100), 'Your plan includes 100 students. Contact us to add more.');
  assert.equal(countActiveStudents([{ id: 1 }, { id: 2, status: 'inactive' }, { id: 3, status: 'archived' }, null, { id: 4 }]), 2);
});

test('status chips', () => {
  const pilot = (pilotEndsAt) => ({ id: 'c', subscription: { plan: 'pilot', pilotEndsAt } });
  const today = '2026-10-31';
  assert.deepEqual(
    (({ kind, label, daysLeft }) => ({ kind, label, daysLeft }))(subscriptionStatus(pilot('2026-11-12'), today)),
    { kind: 'pilot', label: 'Pilot · 12 days left', daysLeft: 12 },
  );
  assert.equal(subscriptionStatus(pilot('2026-11-01'), today).label, 'Pilot · 1 day left');
  assert.equal(subscriptionStatus(pilot('2026-10-31'), today).label, 'Pilot · ends today');
  assert.equal(subscriptionStatus(pilot('2026-10-30'), today).kind, 'pilot_ended');
  assert.equal(subscriptionStatus(pilot('2026-10-30'), today).label, 'Pilot ended');

  const paid = { subscription: { plan: 'starter', paidUntil: '2027-03-31' } };
  assert.equal(subscriptionStatus(paid, today).label, 'Paid until 31 Mar 2027');
  assert.equal(subscriptionStatus(paid, today).tone, 'green');
  assert.equal(subscriptionStatus(paid, '2027-04-01').label, 'Payment overdue');
  assert.equal(subscriptionStatus({ subscription: { plan: 'starter' } }, today).kind, 'overdue');

  // The demo center stays quiet until the platform owner sets a plan for it.
  assert.equal(subscriptionStatus({ id: DEMO_CENTER_ID, plan: 'trial', createdAt: '2025-06-01' }, today).kind, 'demo');
  assert.equal(subscriptionBanner({ id: DEMO_CENTER_ID, plan: 'trial', createdAt: '2025-06-01' }, today), null);
});

test('admin banner: within 7 days, ended, overdue', () => {
  const pilot = (pilotEndsAt) => ({ subscription: { plan: 'pilot', pilotEndsAt } });
  const today = '2026-10-31';
  assert.equal(subscriptionBanner(pilot('2026-11-20'), today), null);
  const soon = subscriptionBanner(pilot('2026-11-05'), today);
  assert.equal(soon.message, 'Your free pilot ends in 5 days — contact us on WhatsApp to continue.');
  assert.equal(soon.dismissable, true);
  const ended = subscriptionBanner(pilot('2026-10-20'), today);
  assert.equal(ended.dismissable, false);
  assert.match(ended.message, /ended on 20 Oct 2026/);
  const overdue = subscriptionBanner({ subscription: { plan: 'starter', paidUntil: '2026-10-01' } }, today);
  assert.equal(overdue.dismissable, false);
  assert.match(overdue.message, /overdue/);
  assert.equal(subscriptionBanner({ subscription: { plan: 'starter', paidUntil: '2027-10-01' } }, today), null);
  assert.equal(subscriptionBanner({ subscription: { plan: 'starter', paidUntil: '2026-11-03' } }, today).dismissable, true);
});

test('recording a payment extends paid-until by a year and ends the pilot', () => {
  const center = { createdAt: '2026-10-01', subscription: { plan: 'pilot', pilotEndsAt: '2026-10-31' } };
  assert.equal(nextPaidUntil(center, '2026-11-02'), '2027-11-02');
  const payment = { id: 'p1', date: '2026-11-02', amount: 18000, method: 'UPI', reference: 'UTR1', note: '' };
  const next = applySubscriptionUpdate(center, { payment });
  assert.equal(next.plan, 'starter');
  assert.equal(next.paidUntil, '2027-11-02');
  assert.equal(next.payments.length, 1);

  // Renewing early runs on from the current paid-until date.
  const renewed = applySubscriptionUpdate({ subscription: next }, { payment: { ...payment, id: 'p2', date: '2027-10-20' } });
  assert.equal(renewed.paidUntil, '2028-11-02');
  assert.equal(renewed.payments.length, 2);
  // An explicit paid-until wins.
  assert.equal(applySubscriptionUpdate(center, { payment, paidUntil: '2027-03-31' }).paidUntil, '2027-03-31');
  // Limits and plan change without touching payments.
  const custom = applySubscriptionUpdate({ subscription: next }, { plan: 'custom', extraBranches: 1, studentLimit: null });
  assert.equal(custom.plan, 'custom');
  assert.equal(custom.studentLimit, null);
  assert.equal(getSubscription({ subscription: custom }).studentLimit, 200);
  assert.equal(custom.payments.length, 1);
});

test('who sees the subscription', () => {
  const sub = { plan: 'starter', payments: [{ id: 'p', date: '2026-11-01', amount: 1, method: 'UPI', reference: 'r', note: 'secret', recordedBy: 'u' }] };
  assert.equal(subscriptionForViewer(sub, 'platform_owner'), sub);
  assert.deepEqual(subscriptionForViewer(sub, 'center_admin').payments[0], { id: 'p', date: '2026-11-01', amount: 1, method: 'UPI', reference: 'r' });
  assert.equal(subscriptionForViewer(sub, 'teacher'), undefined);
  assert.equal(subscriptionForViewer(sub, 'family'), undefined);
});
