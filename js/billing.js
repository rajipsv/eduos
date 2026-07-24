import {
  getState,
  getBatches,
  getBatch,
  getStudents,
  getStudent,
  getInvoices,
  getInvoice,
  saveInvoice,
  getBillingSettings,
  saveBillingSettings,
  persist,
  addMessage,
  getCenter,
} from './store.js';
import { sendWhatsApp } from './whatsapp.js';

export { getBillingSettings } from './store.js';

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function periodLabel(year, month) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function computeDueDate(year, month, dueDay) {
  const day = Math.min(dueDay || 5, lastDayOfMonth(year, month));
  return `${periodKey(year, month)}-${String(day).padStart(2, '0')}`;
}

export function getStudentBatchFee(student, batch) {
  if (student?.monthlyFeeOverride != null && student.monthlyFeeOverride !== '') {
    return Number(student.monthlyFeeOverride) || 0;
  }
  return Number(batch?.monthlyFee) || 0;
}

export function findInvoiceForPeriod(studentId, batchId, periodStart) {
  return getInvoices().find(
    (inv) => inv.studentId === studentId && inv.batchId === batchId && inv.periodStart === periodStart
  );
}

export function nextInvoiceNumber(year, month) {
  const settings = getBillingSettings();
  const prefix = settings.invoicePrefix || 'INV';
  const key = periodKey(year, month).replace('-', '');
  const existing = getInvoices().filter((inv) => inv.invoiceNumber?.startsWith(`${prefix}-${key}`));
  const seq = String(existing.length + 1).padStart(3, '0');
  return `${prefix}-${key}-${seq}`;
}

export function syncInvoiceStatuses() {
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;
  for (const inv of getInvoices()) {
    if (inv.status === 'paid' || inv.status === 'void' || inv.status === 'payment_reported') continue;
    if (inv.status === 'sent' && inv.dueDate < today) {
      inv.status = 'overdue';
      changed = true;
    }
  }
  if (changed) persist();
}

export function generateMonthlyInvoices(year, month) {
  syncInvoiceStatuses();
  const periodStart = `${periodKey(year, month)}-01`;
  const periodEnd = `${periodKey(year, month)}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`;
  const settings = getBillingSettings();
  const created = [];
  const skipped = [];

  for (const student of getStudents()) {
    if (student.feeStatus === 'paused') {
      skipped.push({ student, reason: 'Billing paused' });
      continue;
    }
    if (!student.batchId) {
      skipped.push({ student, reason: 'No batch' });
      continue;
    }
    const batch = getBatch(student.batchId);
    if (!batch) {
      skipped.push({ student, reason: 'Batch missing' });
      continue;
    }
    const amount = getStudentBatchFee(student, batch);
    if (amount <= 0) {
      skipped.push({ student, batch, reason: 'No fee on batch' });
      continue;
    }
    if (findInvoiceForPeriod(student.id, batch.id, periodStart)) {
      skipped.push({ student, batch, reason: 'Already invoiced' });
      continue;
    }
    const feeStart = student.feeStartDate || student.joinDate;
    if (feeStart && feeStart > periodEnd) {
      skipped.push({ student, batch, reason: 'Not enrolled yet' });
      continue;
    }

    const dueDay = batch.feeDueDay ?? settings.defaultDueDay ?? 5;
    const invoice = {
      id: uid('inv'),
      studentId: student.id,
      batchId: batch.id,
      studentName: student.name,
      batchName: batch.name,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      parentEmail: student.parentEmail,
      periodStart,
      periodEnd,
      periodLabel: periodLabel(year, month),
      amount,
      currency: 'INR',
      dueDate: computeDueDate(year, month, dueDay),
      status: 'draft',
      invoiceNumber: nextInvoiceNumber(year, month),
      lineItems: [{
        label: `Tuition — ${batch.name} (${periodLabel(year, month)})`,
        qty: 1,
        unitAmount: amount,
        amount,
      }],
      remindersSent: [],
      createdAt: new Date().toISOString(),
      sentAt: null,
      paidAt: null,
      paidAmount: null,
      paymentMethod: null,
      paymentRef: null,
    };
    saveInvoice(invoice);
    created.push(invoice);
  }

  return { created, skipped, periodLabel: periodLabel(year, month) };
}

export function buildFeeMessage(invoice, type = 'fee_due') {
  const settings = getBillingSettings();
  const academy = getState().settings.tutorName;
  const upi = settings.upiId ? `\nUPI: ${settings.upiId}` : '';
  const bank = settings.bankDetails ? `\n${settings.bankDetails}` : '';

  if (type === 'fee_overdue') {
    return `Dear ${invoice.parentName || 'Parent'},

Fee OVERDUE for ${invoice.studentName} (${invoice.batchName}):

Invoice: ${invoice.invoiceNumber}
Amount: ₹${invoice.amount.toLocaleString('en-IN')}
Was due: ${invoice.dueDate}
Period: ${invoice.periodLabel}${upi}${bank}

Please pay at your earliest convenience.
— ${academy}`;
  }

  return `Dear ${invoice.parentName || 'Parent'},

Fee reminder for ${invoice.studentName} (${invoice.batchName}):

Invoice: ${invoice.invoiceNumber}
Amount: ₹${invoice.amount.toLocaleString('en-IN')}
Due date: ${invoice.dueDate}
Period: ${invoice.periodLabel}${upi}${bank}

Reply if you need assistance.
— ${academy}`;
}

export async function sendInvoiceReminder(invoiceId, { type = 'fee_due' } = {}) {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return { ok: false, error: 'Invoice not found' };
  if (invoice.status === 'paid' || invoice.status === 'void') {
    return { ok: false, error: 'Invoice is closed' };
  }
  if (invoice.status === 'payment_reported') {
    return { ok: false, error: 'Parent already reported payment — confirm instead' };
  }
  if (!invoice.parentPhone) return { ok: false, error: 'No parent phone on file' };

  const message = buildFeeMessage(invoice, type);
  await sendWhatsApp({
    to: invoice.parentPhone,
    message,
    type,
    meta: { invoiceId: invoice.id, studentId: invoice.studentId, batchId: invoice.batchId },
  });

  if (invoice.status === 'draft') invoice.status = 'sent';
  invoice.sentAt = invoice.sentAt || new Date().toISOString();
  invoice.remindersSent = invoice.remindersSent || [];
  invoice.remindersSent.push({ at: new Date().toISOString(), channel: 'whatsapp', type });
  saveInvoice(invoice);
  return { ok: true, invoice };
}

export async function sendBulkFeeReminders({ status = 'overdue' } = {}) {
  syncInvoiceStatuses();
  const targets = getInvoices().filter((inv) => {
    if (inv.status === 'paid' || inv.status === 'void') return false;
    if (status === 'overdue') return inv.status === 'overdue';
    if (status === 'due') return inv.status === 'sent' || inv.status === 'draft';
    return inv.status === 'sent' || inv.status === 'overdue' || inv.status === 'draft';
  });

  const results = [];
  for (const inv of targets) {
    const type = inv.status === 'overdue' ? 'fee_overdue' : 'fee_due';
    results.push(await sendInvoiceReminder(inv.id, { type }));
  }
  return results;
}

export function canParentReportPayment(invoice) {
  return invoice
    && invoice.status !== 'paid'
    && invoice.status !== 'void'
    && invoice.status !== 'payment_reported';
}

export async function reportParentPayment(invoiceId, { paymentMethod = 'upi', paymentRef = '', note = '' } = {}) {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return { ok: false, error: 'Invoice not found' };
  if (invoice.status === 'paid' || invoice.status === 'void') {
    return { ok: false, error: 'Invoice is already closed' };
  }
  if (invoice.status === 'payment_reported') {
    return { ok: false, error: 'Already reported — waiting for center to confirm' };
  }

  invoice.status = 'payment_reported';
  invoice.parentReportedAt = new Date().toISOString();
  invoice.parentPaymentMethod = paymentMethod;
  invoice.parentPaymentRef = paymentRef.trim();
  invoice.parentPaymentNote = note.trim();
  saveInvoice(invoice);

  const academy = getState().settings.tutorName;
  const refLine = paymentRef ? `\nReference: ${paymentRef}` : '';
  const noteLine = note ? `\nNote: ${note}` : '';
  const adminMsg = `Parent reported OFFLINE payment for ${invoice.studentName} (${invoice.batchName}):

Invoice: ${invoice.invoiceNumber}
Amount: ₹${invoice.amount.toLocaleString('en-IN')}
Method: ${paymentMethod}${refLine}${noteLine}

Open Fees & Invoices in EduOS to verify and confirm.`;

  addMessage({
    to: 'Center admin',
    message: adminMsg,
    type: 'fee_payment_reported',
    channel: 'in_app',
    status: 'sent',
    meta: { invoiceId: invoice.id, studentId: invoice.studentId, batchId: invoice.batchId },
  });

  const center = invoice.centerId ? getCenter(invoice.centerId) : null;
  if (center?.phone) {
    await sendWhatsApp({
      to: center.phone,
      message: adminMsg,
      type: 'fee_payment_reported',
      meta: { invoiceId: invoice.id, studentId: invoice.studentId },
    });
  }

  return { ok: true, invoice };
}

export function markInvoicePaid(invoiceId, { paymentMethod = 'cash', paymentRef = '', paidAmount = null } = {}) {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return { ok: false, error: 'Invoice not found' };
  invoice.status = 'paid';
  invoice.paidAt = new Date().toISOString();
  invoice.paidAmount = paidAmount != null ? Number(paidAmount) : invoice.amount;
  invoice.paymentMethod = paymentMethod || invoice.parentPaymentMethod || 'cash';
  invoice.paymentRef = paymentRef.trim() || invoice.parentPaymentRef || '';
  saveInvoice(invoice);
  return { ok: true, invoice };
}

export function voidInvoice(invoiceId) {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return { ok: false, error: 'Invoice not found' };
  if (invoice.status === 'paid') return { ok: false, error: 'Paid invoices cannot be voided' };
  invoice.status = 'void';
  saveInvoice(invoice);
  return { ok: true, invoice };
}

export function getBillingStats(invoices = getInvoices()) {
  syncInvoiceStatuses();
  const list = invoices;
  const expected = list.filter((i) => i.status !== 'void').reduce((s, i) => s + i.amount, 0);
  const collected = list.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.paidAmount ?? i.amount), 0);
  const overdue = list.filter((i) => i.status === 'overdue').length;
  const draft = list.filter((i) => i.status === 'draft').length;
  const paid = list.filter((i) => i.status === 'paid').length;
  const reported = list.filter((i) => i.status === 'payment_reported').length;
  return { expected, collected, overdue, draft, paid, reported, total: list.length };
}

export function getStudentFeeSummary(studentId) {
  syncInvoiceStatuses();
  const invoices = getInvoices().filter((inv) => inv.studentId === studentId && inv.status !== 'void');
  const open = invoices.filter((i) => i.status !== 'paid');
  const outstanding = open.reduce((sum, i) => sum + i.amount, 0);
  const overdue = open.filter((i) => i.status === 'overdue');
  const nextDue = [...open].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] || null;
  return { invoices, open, outstanding, overdue, nextDue };
}

export function invoiceStatusBadge(status) {
  const map = {
    draft: 'badge-gray',
    sent: 'badge-orange',
    paid: 'badge-green',
    overdue: 'badge-red',
    payment_reported: 'badge-orange',
    void: 'badge-gray',
  };
  const labels = {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
    overdue: 'Overdue',
    payment_reported: 'Parent reported paid',
    void: 'Void',
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${labels[status] || status}</span>`;
}

export function parentInvoiceStatusLabel(status) {
  const labels = {
    draft: 'Pending',
    sent: 'Due',
    paid: 'Paid',
    overdue: 'Overdue',
    payment_reported: 'Awaiting confirmation',
    void: 'Cancelled',
  };
  const map = {
    draft: 'badge-orange',
    sent: 'badge-orange',
    paid: 'badge-green',
    overdue: 'badge-red',
    payment_reported: 'badge-gray',
    void: 'badge-gray',
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${labels[status] || status}</span>`;
}
