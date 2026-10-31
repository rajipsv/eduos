// Progressive Web App: manifest, icons, service worker rules and the headers they need.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CSP } from '../server/security-headers.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

test('manifest is installable: name, start URL, standalone, 192 and 512 icons that exist', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'Tutorsala');
  assert.ok(m.short_name);
  assert.equal(m.display, 'standalone');
  assert.ok(m.start_url.startsWith('/'));
  assert.equal(m.scope, '/');
  for (const size of ['192x192', '512x512']) {
    assert.ok(m.icons.some((i) => i.sizes === size && (i.purpose || 'any') === 'any'), `any ${size}`);
    assert.ok(m.icons.some((i) => i.sizes === size && i.purpose === 'maskable'), `maskable ${size}`);
  }
  for (const icon of m.icons) assert.ok(exists(icon.src.slice(1)), `${icon.src} exists`);
});

test('every public page links the manifest', () => {
  for (const page of ['index.html', 'start-page.html', 'privacy.html', 'terms.html', 'contact.html']) {
    assert.match(read(page), /<link rel="manifest" href="\/manifest.webmanifest">/, page);
  }
});

test('service worker never caches API calls and skips cross-origin and non-GET requests', () => {
  const sw = read('sw.js');
  assert.match(sw, /CACHE_VERSION/);
  assert.match(sw, /\/api\//);
  assert.match(sw, /GET/);
  assert.match(sw, /origin/);
  // Updates wait for the user's "Refresh" click, so a form in progress is never lost.
  const install = sw.split("addEventListener('install'")[1].split("addEventListener('activate'")[0];
  assert.ok(!install.includes('skipWaiting()'), 'install must not call skipWaiting');
  assert.ok(exists('offline.html'));
});

test('Vercel and the local server use the same security policy', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const all = vercel.headers.find((h) => h.source === '/(.*)').headers;
  assert.equal(all.find((h) => h.key === 'Content-Security-Policy').value, CSP);
  assert.match(CSP, /worker-src 'self'/);
  assert.match(CSP, /manifest-src 'self'/);
});

test('Vercel never lets browsers keep a stale service worker', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const sw = vercel.headers.find((h) => h.source === '/sw.js').headers;
  assert.equal(sw.find((h) => h.key === 'Cache-Control').value, 'no-cache');
  const manifest = vercel.headers.find((h) => h.source === '/manifest.webmanifest').headers;
  assert.equal(manifest.find((h) => h.key === 'Content-Type').value, 'application/manifest+json');
});
