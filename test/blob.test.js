// Converting the old single-document state into per-center rows (no database).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blobToCenterRows } from '../server/db/blob.js';
import { toRecordMap, fromRecords } from '../js/sync-rules.js';

const blob = {
  centers: [
    { id: 'c1', name: 'One' },
    { id: 'c2', name: 'Two' },
  ],
  batches: [
    { id: 'b1', centerId: 'c1' },
    { id: 'b2', centerId: 'c2' },
  ],
  students: [{ id: 's1', centerId: 'c1', batchId: 'b1' }],
  teachers: [{ id: 't2', centerId: 'c2' }],
  // No centerId: placed by the batch, student or teacher they refer to.
  assignments: [{ id: 'a1', batchId: 'b2' }],
  feedback: [{ id: 'f1', studentId: 's1' }],
  skills: [{ studentId: 's1', subject: 'Physics', progress: 50 }],
  tutorAvailability: { t2: { slots: [] } },
  // Shared by every center in the old document.
  commTemplates: [{ id: 'tpl', body: 'x' }],
  publicSite: { headline: 'Hi' },
  centerSettings: { c1: { tutorName: 'One' }, gone: { tutorName: 'Deleted center' } },
};

const { rows } = blobToCenterRows(blob);
const where = (collection, id) =>
  rows
    .filter((r) => r.collection === collection && r.id === id)
    .map((r) => r.centerId)
    .sort();

test('records land in the center they belong to', () => {
  assert.deepEqual(where('assignments', 'a1'), ['c2']);
  assert.deepEqual(where('feedback', 'f1'), ['c1']);
  assert.deepEqual(where('tutorAvailability', 't2'), ['c2']);
  assert.equal(rows.find((r) => r.id === 'a1').data.centerId, 'c2');
});

test('shared collections are copied to every center', () => {
  assert.deepEqual(where('commTemplates', 'tpl'), ['c1', 'c2']);
  assert.deepEqual(where('publicSite', 'default'), ['c1', 'c2']);
});

test('records without an id get a stable key; settings for unknown centers are dropped', () => {
  assert.deepEqual(where('skills', 's1|Physics'), ['c1']);
  assert.deepEqual(where('centerSettings', 'c1'), ['c1']);
  assert.deepEqual(where('centerSettings', 'gone'), []);
});

test('record maps round-trip for each shape', () => {
  const list = [{ id: 'x', n: 1 }];
  assert.deepEqual(
    fromRecords(
      'students',
      [...toRecordMap('students', list)].map(([id, data]) => ({ id, data })),
    ),
    list,
  );
  const map = { t1: { slots: [1] } };
  assert.deepEqual(
    fromRecords(
      'tutorAvailability',
      [...toRecordMap('tutorAvailability', map)].map(([id, data]) => ({ id, data })),
    ),
    map,
  );
  const single = { headline: 'x' };
  assert.deepEqual(
    fromRecords(
      'publicSite',
      [...toRecordMap('publicSite', single)].map(([id, data]) => ({ id, data })),
    ),
    single,
  );
});
