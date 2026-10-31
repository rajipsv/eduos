// Bulk student import: CSV/TSV parsing and row checks. Pure functions (no DOM, no store),
// so they can be unit-tested in Node. The screen lives in student-import-view.js.

export const MAX_IMPORT_ROWS = 1000;

/** Columns of the import, in template order. `aliases` are matched after normalising headers. */
export const IMPORT_COLUMNS = [
  { key: 'name', label: 'Student name', example: 'Aarav Sharma', aliases: ['student name', 'name', 'student', 'full name', 'student full name', 'child name', 'child'] },
  { key: 'grade', label: 'Class/grade', example: '10', aliases: ['class/grade', 'class', 'grade', 'standard', 'std', 'class grade', 'grade/class', 'year'] },
  { key: 'parentName', label: 'Parent name', example: 'Rajesh Sharma', aliases: ['parent name', 'parent', 'father name', 'mother name', 'guardian', 'guardian name', 'father', 'mother', "parent's name"] },
  { key: 'parentPhone', label: 'Parent phone', example: '98765 43210', aliases: ['parent phone', 'parent mobile', 'parent whatsapp', 'phone', 'mobile', 'whatsapp', 'mobile number', 'phone number', 'contact', 'contact number', 'whatsapp number', 'parent contact', 'guardian phone', 'father phone', 'mother phone'] },
  { key: 'parentEmail', label: 'Parent email', example: 'rajesh@example.com', aliases: ['parent email', 'email', 'e-mail', 'mail', 'email id', 'parent email id', 'guardian email'] },
  { key: 'batch', label: 'Batch', example: '', aliases: ['batch', 'batch name', 'group', 'section'] },
  { key: 'phone', label: 'Student phone', example: '', aliases: ['student phone', 'student mobile', 'student whatsapp', 'student contact'] },
  { key: 'email', label: 'Student email', example: '', aliases: ['student email', 'student e-mail', 'student mail'] },
  { key: 'notes', label: 'Notes', example: '', aliases: ['notes', 'note', 'remarks', 'comments', 'comment'] },
];

function normHeader(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[_\-.*:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALIAS_TO_KEY = new Map();
for (const col of IMPORT_COLUMNS) {
  for (const a of [col.label, ...col.aliases]) {
    const n = normHeader(a);
    if (!ALIAS_TO_KEY.has(n)) ALIAS_TO_KEY.set(n, col.key);
  }
}

/** Picks the separator from the first line (outside quotes): tab, semicolon or comma. */
export function detectDelimiter(text) {
  const counts = { '\t': 0, ';': 0, ',': 0 };
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  if (counts['\t'] > 0) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

/**
 * Parses CSV/TSV text into rows of trimmed strings. Handles quoted fields, separators and
 * line breaks inside quotes, "" escapes, CRLF/LF/CR, a UTF-8 BOM and blank lines.
 */
export function parseDelimited(text, delimiter) {
  let src = String(text ?? '');
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const sep = delimiter || detectDelimiter(src);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field.trim() === '') {
      field = '';
      inQuotes = true;
    } else if (ch === sep) endField();
    else if (ch === '\r') {
      endRow();
      if (src[i + 1] === '\n') i += 1;
    } else if (ch === '\n') endRow();
    else field += ch;
    i += 1;
  }
  if (field !== '' || row.length) endRow();
  return rows
    .map((r) => r.map((f) => f.trim()))
    .filter((r) => r.some((f) => f !== ''));
}

/** Maps a header row to column keys. Returns null if it doesn't look like a header. */
export function matchHeaders(headerRow) {
  const keys = headerRow.map((h) => ALIAS_TO_KEY.get(normHeader(h)) || null);
  // A later duplicate of the same column is ignored.
  const seen = new Set();
  const unique = keys.map((k) => {
    if (!k || seen.has(k)) return null;
    seen.add(k);
    return k;
  });
  return unique.includes('name') ? unique : null;
}

/**
 * Indian mobile numbers: 10 digits starting 6-9, with optional +91 / 91 / 0 prefix,
 * spaces, dashes, dots or brackets. Returns { phone } (10 digits, as the add-student
 * form and the demo data store them), { phone: '' } when blank, or { error }.
 */
export function normalizeIndianPhone(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { phone: '' };
  if (/[^\d\s\-+().]/.test(text)) return { error: 'invalid phone' };
  let digits = text.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  else if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3);
  if (!/^[6-9]\d{9}$/.test(digits)) return { error: 'invalid phone' };
  return { phone: digits };
}

export function isValidEmail(email) {
  return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/.test(String(email || '').trim());
}

function nameKey(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function phoneKey(phone) {
  const n = normalizeIndianPhone(phone);
  return n.phone ?? String(phone || '').replace(/\D/g, '');
}

/** Same student: same name (ignoring case/spacing) and same parent phone. */
export function duplicateKey(name, parentPhone) {
  return `${nameKey(name)}|${phoneKey(parentPhone)}`;
}

/**
 * Turns pasted/loaded text into a preview.
 * @param {string} text
 * @param {{ existingStudents?: Array<{name:string,parentPhone?:string}>, batches?: Array<{id:string,name:string}> }} ctx
 * @returns {{ error?: string, rows: Array, counts: {ok:number, warning:number, skip:number, error:number}, headerFound: boolean, columns: string[] }}
 */
export function buildImportPreview(text, { existingStudents = [], batches = [] } = {}) {
  const empty = { rows: [], counts: { ok: 0, warning: 0, skip: 0, error: 0 }, headerFound: false, columns: [] };
  const table = parseDelimited(text);
  if (!table.length) return { ...empty, error: 'No rows found. Check that the file has data.' };

  let columns = matchHeaders(table[0]);
  const headerFound = Boolean(columns);
  if (!columns) columns = IMPORT_COLUMNS.map((c) => c.key);
  const dataRows = headerFound ? table.slice(1) : table;
  if (!dataRows.length) return { ...empty, headerFound, columns, error: 'Only a header row was found. Add one student per row below it.' };
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      ...empty,
      headerFound,
      columns,
      error: `This file has ${dataRows.length} students. You can import up to ${MAX_IMPORT_ROWS} at a time — please split it into smaller files.`,
    };
  }

  const existing = new Set(existingStudents.map((s) => duplicateKey(s.name, s.parentPhone)));
  const batchByName = new Map(batches.map((b) => [nameKey(b.name), b]));
  const inFile = new Map();
  const counts = { ok: 0, warning: 0, skip: 0, error: 0 };

  const rows = dataRows.map((cells, idx) => {
    const raw = {};
    columns.forEach((key, c) => {
      if (key) raw[key] = cells[c] ?? '';
    });
    const line = idx + (headerFound ? 2 : 1);
    const errors = [];
    const notes = [];

    const name = String(raw.name || '').replace(/\s+/g, ' ').trim();
    if (!name) errors.push('student name is missing');

    const parentPhone = normalizeIndianPhone(raw.parentPhone);
    if (parentPhone.error) errors.push(`parent phone "${raw.parentPhone}" is not a valid 10-digit mobile number`);
    const phone = normalizeIndianPhone(raw.phone);
    if (phone.error) errors.push(`student phone "${raw.phone}" is not a valid 10-digit mobile number`);

    const parentEmail = String(raw.parentEmail || '').trim().toLowerCase();
    if (parentEmail && !isValidEmail(parentEmail)) errors.push(`parent email "${raw.parentEmail}" is not valid`);
    const email = String(raw.email || '').trim().toLowerCase();
    if (email && !isValidEmail(email)) errors.push(`student email "${raw.email}" is not valid`);

    let batchId = '';
    const batchName = String(raw.batch || '').trim();
    if (batchName) {
      const batch = batchByName.get(nameKey(batchName));
      if (batch) batchId = batch.id;
      else notes.push(`batch "${batchName}" not found, will import without batch`);
    }

    const student = {
      name,
      grade: String(raw.grade || '').trim(),
      batchId,
      phone: phone.phone || '',
      email,
      parentName: String(raw.parentName || '').trim(),
      parentPhone: parentPhone.phone || '',
      parentEmail,
      notes: String(raw.notes || '').trim(),
    };

    let status = 'ok';
    if (errors.length) status = 'error';
    else {
      const key = duplicateKey(student.name, student.parentPhone);
      if (existing.has(key)) {
        status = 'skip';
        notes.unshift('already a student with this name and parent phone');
      } else if (inFile.has(key)) {
        status = 'skip';
        notes.unshift(`same as row ${inFile.get(key)} in this file`);
      } else {
        inFile.set(key, line);
        if (notes.length) status = 'warning';
      }
    }
    counts[status] += 1;
    return { line, status, student, messages: [...errors, ...notes], batchName };
  });

  return { rows, counts, headerFound, columns };
}

/** Rows that will be imported (OK and OK-with-warning). */
export function importableRows(preview) {
  return (preview?.rows || []).filter((r) => r.status === 'ok' || r.status === 'warning');
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Template CSV: header row plus one example row. `batchName` fills the example's batch. */
export function templateCsv(batchName = '') {
  const header = IMPORT_COLUMNS.map((c) => csvCell(c.label)).join(',');
  const example = IMPORT_COLUMNS.map((c) => csvCell(c.key === 'batch' ? batchName : c.example)).join(',');
  return `${header}\r\n${example}\r\n`;
}

/** Plain-words reason for a record the server refused. */
export function describeRejection(r) {
  const text = `${r?.error || ''} ${r?.code || ''}`.toLowerCase();
  if (text.includes('limit') || text.includes('plan')) return "your plan's student limit has been reached";
  if (r?.status === 'forbidden') return 'not allowed for your account';
  if (r?.error) return String(r.error);
  return 'the server did not accept it';
}
