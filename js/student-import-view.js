// "Import from Excel" on the Students screen. Parsing and checks are in student-import.js;
// students are saved with the same saveStudent() the Add Student form uses.
import { esc } from './html.js';
import { getBatches, getStudents, getRawState, saveStudent, flushSync, isDatabaseMode } from './store.js';
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  buildImportPreview,
  importableRows,
  templateCsv,
  describeRejection,
} from './student-import.js';

const STATUS_BADGE = {
  ok: '<span class="badge badge-green">OK</span>',
  warning: '<span class="badge badge-orange">OK, note</span>',
  skip: '<span class="badge badge-gray">Will skip</span>',
  error: '<span class="badge badge-red">Error</span>',
};

function downloadTemplate() {
  const firstBatch = getBatches()[0]?.name || '';
  // BOM so Excel opens it as UTF-8.
  const blob = new Blob(['﻿' + templateCsv(firstBatch)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tutorsala-students-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a file as UTF-8; falls back to Windows-1252 (Excel's plain "CSV" on Windows). */
async function readFileText(file) {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('�')) return utf8;
  try {
    return new TextDecoder('windows-1252').decode(buf);
  } catch {
    return utf8;
  }
}

function previewHtml(preview) {
  if (preview.error) return `<div class="empty-state" style="color:var(--danger)">${esc(preview.error)}</div>`;
  const { counts, rows } = preview;
  const n = counts.ok + counts.warning;
  return `
    <p style="margin:12px 0 8px"><strong>${esc(n)}</strong> ready to import
      · ${esc(counts.warning)} with a note
      · ${esc(counts.skip)} will be skipped (duplicates)
      · ${esc(counts.error)} with errors (not imported)
      ${preview.headerFound ? '' : '<br><small>No header row found, so columns were read in the template order.</small>'}</p>
    <div class="table-wrap" style="max-height:320px;overflow:auto">
      <table>
        <thead><tr><th>Row</th><th>Status</th><th>Student</th><th>Class</th><th>Parent</th><th>Batch</th><th>Notes</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td>${esc(r.line)}</td>
          <td>${STATUS_BADGE[r.status]}</td>
          <td>${esc(r.student.name || '—')}</td>
          <td>${esc(r.student.grade)}</td>
          <td>${esc(r.student.parentName)}<br><small>${esc(r.student.parentPhone)} ${esc(r.student.parentEmail)}</small></td>
          <td>${esc(r.batchName)}</td>
          <td><small>${esc(r.messages.join('; '))}</small></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

/** Opens the import modal. `ctx` is the usual { showModal, closeModal, toast, refresh }. */
export function openStudentImport({ showModal, toast, refresh }) {
  const batches = getBatches();
  const columnNames = IMPORT_COLUMNS.map((c) => c.label).join(', ');
  let preview = null;

  showModal({
    title: 'Import students from Excel',
    wide: true,
    body: `
      <p style="margin-top:0">In Excel, choose <strong>File → Save As → CSV</strong> and pick the file below.
        Or copy the rows in Excel / Google Sheets and paste them in the box.</p>
      <p><small>Columns: ${esc(columnNames)}. Only the student name is required. The first row can be the
        column names (any order). Phone numbers: 10-digit mobile, +91 or 0 in front is fine.
        Up to ${esc(MAX_IMPORT_ROWS)} students at a time.</small></p>
      <p><a href="#" id="impTemplate">Download template (CSV)</a></p>
      <div class="form-grid">
        <div class="form-group"><label>CSV file</label><input type="file" id="impFile" accept=".csv,.tsv,.txt,text/csv"></div>
        <div class="form-group"><label>Students with no batch go to</label>
          <select id="impDefaultBatch"><option value="">No batch</option>${batches.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}</select>
        </div>
        <div class="form-group full"><label>…or paste rows here</label>
          <textarea id="impPaste" rows="4" placeholder="Paste rows copied from Excel or Google Sheets"></textarea>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" id="impCheck">Check rows</button>
      <div id="impPreview"></div>`,
    footer: `<button class="btn btn-secondary" data-modal-cancel>Cancel</button>
      <button class="btn btn-primary" id="impRun" disabled>Import students</button>`,
    onMount: () => {
      const runBtn = document.getElementById('impRun');
      const show = (text) => {
        preview = buildImportPreview(text, { existingStudents: getStudents(), batches });
        // eslint-disable-next-line no-unsanitized/property -- every file value is escaped with esc() in previewHtml
        document.getElementById('impPreview').innerHTML = previewHtml(preview);
        const n = importableRows(preview).length;
        runBtn.disabled = n === 0;
        runBtn.textContent = n ? `Import ${n} student${n === 1 ? '' : 's'}` : 'Import students';
      };
      document.getElementById('impTemplate').addEventListener('click', (e) => {
        e.preventDefault();
        downloadTemplate();
      });
      document.getElementById('impFile').addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          toast('That file is too big. Please keep it under 5 MB.', 'error');
          return;
        }
        if (/\.xlsx?$/i.test(file.name)) {
          toast('Please save the sheet as CSV first (File → Save As → CSV).', 'error');
          return;
        }
        document.getElementById('impPaste').value = '';
        show(await readFileText(file));
      });
      document.getElementById('impCheck').addEventListener('click', () => {
        const text = document.getElementById('impPaste').value;
        if (!text.trim()) return toast('Pick a CSV file or paste rows first', 'error');
        show(text);
      });
      runBtn.addEventListener('click', async () => {
        const rows = importableRows(preview);
        if (!rows.length) return;
        runBtn.disabled = true;
        runBtn.textContent = 'Importing…';
        const defaultBatchId = document.getElementById('impDefaultBatch').value;
        const result = await importStudents(rows, defaultBatchId);
        showResult(result, preview, { showModal });
        refresh();
        if (result.saved) toast(`${result.saved} student${result.saved === 1 ? '' : 's'} imported`, 'success');
      });
    },
  });
}

/** Saves the rows and waits for the server. Returns { saved, notSaved: [{ name, reason }], pending }. */
async function importStudents(rows, defaultBatchId) {
  const before = new Set((getRawState().students || []).map((s) => s.id));
  const today = new Date().toISOString().slice(0, 10);
  const refusedHere = [];
  for (const row of rows) {
    // Same fields as the Add Student form; saveStudent fills fee defaults and center/branch.
    const refused = saveStudent({
      ...row.student,
      // No batch is stored as null (the server refuses an empty id).
      batchId: row.student.batchId || defaultBatchId || null,
      joinDate: today,
      feeStatus: 'active',
      feeStartDate: today,
      monthlyFeeOverride: null,
      perClassFeeOverride: null,
      address: '',
    });
    // Refused before saving (the plan's student limit): reported like a server refusal.
    if (refused?.error) refusedHere.push({ name: row.student.name, reason: describeRejection(refused) });
  }
  // saveStudent appends new records in order, so they line up with `rows`.
  const created = (getRawState().students || []).filter((s) => !before.has(s.id)).map((s) => ({ id: s.id, name: s.name }));

  if (!isDatabaseMode()) return { saved: created.length, notSaved: refusedHere, pending: false };

  const rejections = new Map();
  let failed = false;
  const onIssue = (e) => {
    if (e.detail?.failed) failed = true;
    for (const r of e.detail?.rejections || []) {
      if (r.collection === 'students') rejections.set(String(r.id), r);
    }
  };
  window.addEventListener('tutorsala:sync-issue', onIssue);
  try {
    // Changes go to the server in batches of up to 500 records per request.
    await flushSync();
  } finally {
    window.removeEventListener('tutorsala:sync-issue', onIssue);
  }

  const stillHere = new Set((getRawState().students || []).map((s) => s.id));
  const notSaved = created
    .filter((c) => !stillHere.has(c.id))
    .map((c) => ({ name: c.name, reason: describeRejection(rejections.get(String(c.id))) }));
  return { saved: created.length - notSaved.length, notSaved: [...refusedHere, ...notSaved], pending: failed };
}

function showResult(result, preview, { showModal }) {
  const { counts } = preview;
  const reasons = new Map();
  for (const r of result.notSaved) reasons.set(r.reason, (reasons.get(r.reason) || 0) + 1);
  showModal({
    title: 'Import finished',
    body: `
      <p><strong>${esc(result.saved)}</strong> student${result.saved === 1 ? '' : 's'} imported.</p>
      ${result.pending ? '<p style="color:var(--danger)">Could not reach the server just now. The students are kept on this device and will be saved automatically — please keep this tab open for a minute.</p>' : ''}
      ${result.notSaved.length ? `<p style="color:var(--danger)"><strong>${esc(result.notSaved.length)}</strong> could not be saved:</p>
        <ul>${[...reasons].map(([reason, n]) => `<li>${esc(n)} — ${esc(reason)}</li>`).join('')}</ul>
        <p><small>Not saved: ${esc(result.notSaved.slice(0, 20).map((r) => r.name).join(', '))}${result.notSaved.length > 20 ? '…' : ''}</small></p>` : ''}
      ${counts.skip ? `<p>${esc(counts.skip)} skipped as duplicates.</p>` : ''}
      ${counts.error ? `<p>${esc(counts.error)} not imported because of errors — fix them in the sheet and import those rows again.</p>` : ''}`,
    // showModal wires data-modal-cancel to closeModal.
    footer: '<button class="btn btn-primary" data-modal-cancel>Done</button>',
  });
}
