import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, safeUrl } from '../js/html.js';

test('esc neutralises HTML and attribute breakouts', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(esc('" onmouseover="x'), '&quot; onmouseover=&quot;x');
  assert.equal(esc("O'Brien & Sons"), 'O&#39;Brien &amp; Sons');
  assert.equal(esc('</textarea><script>'), '&lt;/textarea&gt;&lt;script&gt;');
});

test('esc keeps numbers and turns null/undefined into empty text', () => {
  assert.equal(esc(42), '42');
  assert.equal(esc(0), '0');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
});

test('safeUrl allows web, mail, phone and relative links only', () => {
  assert.equal(safeUrl('https://meet.google.com/abc-defg'), 'https://meet.google.com/abc-defg');
  assert.equal(safeUrl('mailto:a@b.com'), 'mailto:a@b.com');
  assert.equal(safeUrl('/#reset-password/x'), '/#reset-password/x');
  assert.equal(safeUrl('zoom.us/j/123'), 'zoom.us/j/123');
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl(' JavaScript:alert(1)'), '#');
  assert.equal(safeUrl('data:text/html,<script>'), '#');
  assert.equal(safeUrl('https://x.com/?a="b"'), 'https://x.com/?a=&quot;b&quot;');
});
