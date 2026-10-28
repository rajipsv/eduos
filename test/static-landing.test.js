// index.html carries the public landing page as plain HTML, so it can be read without JavaScript.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildIndexHtml, INDEX_PATH } from '../scripts/build-landing.mjs';

const html = readFileSync(INDEX_PATH, 'utf8');

test('index.html contains the landing page before any script runs', () => {
  assert.match(html, /<h1 class="landing-headline">Run your entire tuition center/);
  assert.match(html, /Book free demo/);
  assert.match(html, /₹18,000/);
  assert.match(html, /href="\/privacy"/);
});

test('index.html landing matches js/home-landing.js (run `npm run build:landing` if this fails)', () => {
  assert.equal(html, buildIndexHtml(html));
});

test('index.html has no developer notes or local addresses', () => {
  for (const s of ['start.bat', '127.0.0.1', 'rponnuru', 'tutor-hub', 'Export Data']) {
    assert.ok(!html.includes(s), `index.html should not contain ${s}`);
  }
});
