// Shared by the browser and the server: a center's Tutorsala subscription (the platform fee
// the center pays Tutorsala — not the tuition fees centers charge students, see js/billing.js).
//
// Stored on the center as `center.subscription` (inside centers.data) and mirrored in the
// `plan` column:
//   { plan: 'pilot'|'starter'|'custom', pilotEndsAt: 'YYYY-MM-DD', paidUntil: 'YYYY-MM-DD'|null,
//     extraBranches: 0, studentLimit: number|null (null = 100 per paid branch),
//     payments: [{ id, date, amount, method, reference, note, recordedAt, recordedBy }] }
// Centers saved before this existed have no `subscription`: they count as a pilot that ends
// 30 days after the center was created.

export const PLANS = ['pilot', 'starter', 'custom'];
export const PLAN_LABELS = { pilot: 'Free pilot', starter: 'Starter', custom: 'Custom' };
export const PAYMENT_METHODS = ['UPI', 'NEFT', 'cash'];
export const PILOT_DAYS = 30;
export const STUDENTS_PER_BRANCH = 100;
export const DEMO_CENTER_ID = 'center_brightminds_demo';
export const STUDENT_LIMIT_ERROR = 'student_limit_reached';
const MAX_PAYMENTS = 200;
const INACTIVE_STUDENT_STATUSES = ['inactive', 'archived', 'left'];
const SALES_WHATSAPP = '919553371972';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// --- Dates (plain 'YYYY-MM-DD' strings, calendar days, no time zones) ---------------------

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' for a date-like value, or null. Accepts Date objects and ISO timestamps. */
export function isoDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value !== 'string') return null;
  const m = DAY_RE.exec(value.slice(0, 10));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? value.slice(0, 10) : null;
}

const toUtc = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Today in the local calendar of whoever runs this (the browser shows the user's own today). */
export function todayIso(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addDays(day, n) {
  return fromUtc(toUtc(day) + n * 86400000);
}

/** Same day next year; 29 Feb becomes 28 Feb. */
export function addYears(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const last = new Date(Date.UTC(y + n, m, 0)).getUTCDate();
  return fromUtc(Date.UTC(y + n, m - 1, Math.min(d, last)));
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a, b) {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

/** '31 Mar 2027' */
export function formatDay(day) {
  const d = isoDate(day);
  if (!d) return '—';
  const [y, m, dd] = d.split('-').map(Number);
  return `${dd} ${MONTHS[m - 1]} ${y}`;
}

export function formatRupees(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

// --- Subscription -------------------------------------------------------------------------

const wholeNumber = (v, min) => (Number.isInteger(v) && v >= min ? v : null);

/** The center's subscription with defaults filled in. Never throws, whatever is stored. */
export function getSubscription(center) {
  const s = center?.subscription && typeof center.subscription === 'object' ? center.subscription : {};
  const createdAt = isoDate(center?.createdAt);
  const plan = PLANS.includes(s.plan) ? s.plan : PLANS.includes(center?.plan) ? center.plan : 'pilot';
  const extraBranches = wholeNumber(s.extraBranches, 0) ?? 0;
  const studentLimitOverride = wholeNumber(s.studentLimit, 1);
  return {
    plan,
    explicit: PLANS.includes(s.plan),
    pilotEndsAt: isoDate(s.pilotEndsAt) || (createdAt ? addDays(createdAt, PILOT_DAYS) : null),
    paidUntil: isoDate(s.paidUntil),
    extraBranches,
    studentLimitOverride,
    studentLimit: studentLimitOverride ?? STUDENTS_PER_BRANCH * (1 + extraBranches),
    payments: Array.isArray(s.payments) ? s.payments.filter((p) => p && typeof p === 'object') : [],
  };
}

export function studentLimitFor(center) {
  return getSubscription(center).studentLimit;
}

/**
 * Where the center stands today.
 * kind: 'demo' | 'pilot' | 'pilot_ended' | 'paid' | 'overdue'
 * tone: badge colour ('green' | 'orange' | 'red' | 'gray')
 */
export function subscriptionStatus(center, today = todayIso()) {
  const sub = getSubscription(center);
  if (center?.id === DEMO_CENTER_ID && !sub.explicit) {
    return { kind: 'demo', label: 'Demo center', tone: 'gray', daysLeft: null, endsAt: null, plan: sub.plan };
  }
  if (sub.plan !== 'pilot') {
    if (!sub.paidUntil) return { kind: 'overdue', label: 'Payment due', tone: 'red', daysLeft: null, endsAt: null, plan: sub.plan };
    const daysLeft = daysBetween(today, sub.paidUntil);
    if (daysLeft >= 0) {
      return {
        kind: 'paid',
        label: `Paid until ${formatDay(sub.paidUntil)}`,
        tone: daysLeft <= 7 ? 'orange' : 'green',
        daysLeft,
        endsAt: sub.paidUntil,
        plan: sub.plan,
      };
    }
    return { kind: 'overdue', label: 'Payment overdue', tone: 'red', daysLeft, endsAt: sub.paidUntil, plan: sub.plan };
  }
  if (!sub.pilotEndsAt) return { kind: 'pilot', label: 'Pilot', tone: 'green', daysLeft: null, endsAt: null, plan: 'pilot' };
  const daysLeft = daysBetween(today, sub.pilotEndsAt);
  if (daysLeft < 0) {
    return { kind: 'pilot_ended', label: 'Pilot ended', tone: 'red', daysLeft, endsAt: sub.pilotEndsAt, plan: 'pilot' };
  }
  const label = daysLeft === 0 ? 'Pilot · ends today' : `Pilot · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
  return { kind: 'pilot', label, tone: daysLeft <= 7 ? 'orange' : 'green', daysLeft, endsAt: sub.pilotEndsAt, plan: 'pilot' };
}

export function subscriptionWhatsAppUrl(centerName) {
  const text = `Hi Tutorsala, I'd like to continue using Tutorsala for ${centerName || 'my tuition center'}.`;
  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

/**
 * The reminder a center admin sees at the top of the app, or null.
 * Before the end date it can be dismissed; once the pilot or paid period has ended it stays.
 * Nothing is ever locked: this is only a reminder.
 */
export function subscriptionBanner(center, today = todayIso()) {
  const st = subscriptionStatus(center, today);
  const days = (n) => `${n} day${n === 1 ? '' : 's'}`;
  if (st.kind === 'pilot' && st.daysLeft != null && st.daysLeft <= 7) {
    const when = st.daysLeft === 0 ? 'today' : `in ${days(st.daysLeft)}`;
    return { level: 'warning', dismissable: true, key: `${st.kind}:${st.endsAt}`, message: `Your free pilot ends ${when} — contact us on WhatsApp to continue.` };
  }
  if (st.kind === 'pilot_ended') {
    return {
      level: 'danger',
      dismissable: false,
      key: `${st.kind}:${st.endsAt}`,
      message: `Your free pilot ended on ${formatDay(st.endsAt)}. Everything still works — contact us on WhatsApp to continue with Tutorsala.`,
    };
  }
  if (st.kind === 'paid' && st.daysLeft <= 7) {
    const when = st.daysLeft === 0 ? 'today' : `in ${days(st.daysLeft)}`;
    return { level: 'warning', dismissable: true, key: `${st.kind}:${st.endsAt}`, message: `Your Tutorsala plan ends ${when} (${formatDay(st.endsAt)}) — contact us on WhatsApp to renew.` };
  }
  if (st.kind === 'overdue') {
    const since = st.endsAt ? ` Your plan ended on ${formatDay(st.endsAt)}.` : '';
    return {
      level: 'danger',
      dismissable: false,
      key: `${st.kind}:${st.endsAt}`,
      message: `Your Tutorsala payment is overdue.${since} Everything still works — contact us on WhatsApp to renew.`,
    };
  }
  return null;
}

// --- Student limit ------------------------------------------------------------------------

export function isActiveStudent(student) {
  return Boolean(student) && !student.deleted && !INACTIVE_STUDENT_STATUSES.includes(student.status);
}

export function countActiveStudents(students) {
  return (students || []).filter(isActiveStudent).length;
}

export function studentLimitMessage(limit) {
  return `Your plan includes ${limit} students. Contact us to add more.`;
}

// --- Changes made by the platform owner --------------------------------------------------

/** When a payment made on `paymentDate` should run until: a year after the current period, or after the payment if that has lapsed. */
export function nextPaidUntil(center, paymentDate) {
  const { paidUntil } = getSubscription(center);
  const from = paidUntil && paidUntil >= paymentDate ? paidUntil : paymentDate;
  return addYears(from, 1);
}

/**
 * The center's new subscription after a platform-owner change (already validated).
 * update: { plan?, pilotEndsAt?, paidUntil?, extraBranches?, studentLimit?, payment? }
 * A payment is added to the log and moves paidUntil (to update.paidUntil, or a year on).
 * A payment on a pilot center also moves it to the Starter plan unless a plan is given.
 */
export function applySubscriptionUpdate(center, update) {
  const cur = getSubscription(center);
  const next = {
    plan: cur.plan,
    pilotEndsAt: cur.pilotEndsAt,
    paidUntil: cur.paidUntil,
    extraBranches: cur.extraBranches,
    studentLimit: cur.studentLimitOverride,
    payments: [...cur.payments],
  };
  if (update.plan) next.plan = update.plan;
  if (update.pilotEndsAt !== undefined) next.pilotEndsAt = update.pilotEndsAt;
  if (update.extraBranches !== undefined) next.extraBranches = update.extraBranches;
  if (update.studentLimit !== undefined) next.studentLimit = update.studentLimit;
  if (update.paidUntil !== undefined) next.paidUntil = update.paidUntil;
  if (update.payment) {
    next.payments = [...next.payments, update.payment].slice(-MAX_PAYMENTS);
    if (update.paidUntil == null) next.paidUntil = nextPaidUntil(center, update.payment.date);
    if (!update.plan && next.plan === 'pilot') next.plan = 'starter';
  }
  return next;
}

/** What a viewer of the center may see: admins don't get internal notes; others get nothing. */
export function subscriptionForViewer(subscription, role) {
  if (!subscription || typeof subscription !== 'object') return undefined;
  if (role === 'platform_owner') return subscription;
  if (role !== 'center_admin') return undefined;
  return {
    ...subscription,
    payments: (Array.isArray(subscription.payments) ? subscription.payments : []).map((p) => ({
      id: p?.id,
      date: p?.date,
      amount: p?.amount,
      method: p?.method,
      reference: p?.reference,
    })),
  };
}
