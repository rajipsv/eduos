import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDelimited,
  detectDelimiter,
  matchHeaders,
  normalizeIndianPhone,
  isValidEmail,
  buildImportPreview,
  importableRows,
  templateCsv,
  describeRejection,
  MAX_IMPORT_ROWS,
} from '../js/student-import.js';

test('parses quoted fields, commas and line breaks inside quotes, escaped quotes', () => {
  const rows = parseDelimited('a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n');
  assert.deepEqual(rows, [
    ['a', 'b', 'c'],
    ['x, y', 'say "hi"', 'line1\nline2'],
  ]);
});

test('strips BOM, handles LF/CR endings, blank and trailing lines', () => {
  const rows = parseDelimited('﻿Name,Grade\n\nAarav,10\rRiya,9\n\n\n');
  assert.deepEqual(rows, [['Name', 'Grade'], ['Aarav', '10'], ['Riya', '9']]);
});

test('keeps empty cells in the middle and end of a row', () => {
  assert.deepEqual(parseDelimited('a,,c,\n'), [['a', '', 'c', '']]);
});

test('detects semicolon and tab separators', () => {
  assert.equal(detectDelimiter('Name;Grade;Phone\nA;1;2'), ';');
  assert.equal(detectDelimiter('Name\tGrade\nA\t1'), '\t');
  assert.equal(detectDelimiter('"a;b",c\n'), ',');
  assert.deepEqual(parseDelimited('Name;Grade\n"Shah; R";10'), [['Name', 'Grade'], ['Shah; R', '10']]);
  assert.deepEqual(parseDelimited('Name\tGrade\nAarav\t10\n'), [['Name', 'Grade'], ['Aarav', '10']]);
});

test('header matching is case-insensitive and understands synonyms', () => {
  assert.deepEqual(matchHeaders(['STUDENT', 'Standard', 'Father Name', 'WhatsApp', 'E-mail', 'Batch Name']), [
    'name', 'grade', 'parentName', 'parentPhone', 'parentEmail', 'batch',
  ]);
  assert.deepEqual(matchHeaders(['Mobile', 'Name', 'Class', 'Unknown']), ['parentPhone', 'name', 'grade', null]);
  assert.equal(matchHeaders(['Aarav', '10']), null);
});

test('Indian phone numbers are normalised to 10 digits', () => {
  for (const raw of ['9876543210', '+91 98765 43210', '91-98765-43210', '098765 43210', '(+91) 98765-43210', '+91-987.654.3210']) {
    assert.deepEqual(normalizeIndianPhone(raw), { phone: '9876543210' }, raw);
  }
  assert.deepEqual(normalizeIndianPhone(''), { phone: '' });
  for (const bad of ['12345', '1234567890', '98765432101', 'abc9876543210', '+1 9876543210']) {
    assert.ok(normalizeIndianPhone(bad).error, bad);
  }
});

test('email check', () => {
  assert.ok(isValidEmail('a.b@example.co.in'));
  assert.ok(!isValidEmail('a@b'));
  assert.ok(!isValidEmail('not an email'));
});

const batches = [{ id: 'b1', name: 'Class 10 Maths' }];
const existingStudents = [{ name: 'Aarav Sharma', parentPhone: '9876500011' }];

test('preview marks OK, duplicates, errors and unknown batches', () => {
  const csv = [
    'Student name,Class,Parent name,Parent phone,Parent email,Batch',
    'Riya Patel,10,Mehul Patel,+91 98765 11111,mehul@example.com,class 10 maths',
    'aarav  sharma,10,Rajesh,09876500011,,',
    'Kabir,9,Sunita,98765 22222,,Morning Batch',
    'Riya Patel,10,Mehul,9876511111,,',
    ',8,Someone,9876533333,,',
    'Meera,8,Anil,12345,,',
    'Tara,8,Anil,9876544444,bad-email,',
  ].join('\n');
  const p = buildImportPreview(csv, { existingStudents, batches });
  assert.equal(p.headerFound, true);
  assert.deepEqual(p.rows.map((r) => r.status), ['ok', 'skip', 'warning', 'skip', 'error', 'error', 'error']);
  assert.deepEqual(p.counts, { ok: 1, warning: 1, skip: 2, error: 3 });
  assert.equal(p.rows[0].student.batchId, 'b1');
  assert.equal(p.rows[0].student.parentPhone, '9876511111');
  assert.match(p.rows[2].messages.join(), /batch "Morning Batch" not found, will import without batch/);
  assert.equal(p.rows[2].student.batchId, '');
  assert.match(p.rows[3].messages.join(), /same as row 2/);
  assert.equal(p.rows[0].line, 2);
  assert.deepEqual(importableRows(p).map((r) => r.student.name), ['Riya Patel', 'Kabir']);
});

test('pasted rows without a header use the template column order', () => {
  const p = buildImportPreview('Riya\t10\tMehul\t9876511111\tmehul@example.com\n', { batches });
  assert.equal(p.headerFound, false);
  assert.equal(p.rows[0].status, 'ok');
  assert.equal(p.rows[0].student.parentEmail, 'mehul@example.com');
});

test('too many rows and empty input give a clear message', () => {
  const many = ['Name', ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `S${i}`)].join('\n');
  assert.match(buildImportPreview(many).error, /up to 1000/);
  assert.equal(buildImportPreview(['Name', ...Array.from({ length: MAX_IMPORT_ROWS }, (_, i) => `S${i}`)].join('\n')).rows.length, MAX_IMPORT_ROWS);
  assert.match(buildImportPreview('\n\n').error, /No rows/);
  assert.match(buildImportPreview('Name,Grade\n').error, /header/);
});

test('template round-trips through the parser', () => {
  const p = buildImportPreview(templateCsv('Class 10 Maths'), { batches });
  assert.equal(p.headerFound, true);
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].status, 'ok');
  assert.equal(p.rows[0].student.batchId, 'b1');
});

test('rejection reasons in plain words', () => {
  assert.match(describeRejection({ status: 'forbidden', error: 'student_limit_reached' }), /student limit/);
  assert.match(describeRejection({ status: 'forbidden' }), /not allowed/);
  assert.match(describeRejection(undefined), /did not accept/);
});
