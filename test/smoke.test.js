import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSchedule } from '../js/scheduler.js';

test('shared browser/server module loads in Node', () => {
  assert.equal(typeof generateSchedule, 'function');
});
