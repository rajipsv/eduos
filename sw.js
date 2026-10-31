/* Tutorsala service worker.
 *
 * What it does:
 *  - Keeps a small copy of the app shell so the site opens quickly and shows a
 *    friendly offline page when there is no connection.
 *  - Always tries the network first, so a new deploy is picked up right away.
 *  - Never touches /api/ requests (user data and sign-in stay network-only).
 *
 * To force every browser to drop old cached files, bump CACHE_VERSION.
 */
/* global self, caches, fetch, URL, Response */

const CACHE_VERSION = 'tutorsala-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Files stored at install time. Install still succeeds if any of these fail.
const CORE_URLS = [
  '/',
  '/offline.html',
  '/css/app.css',
  '/js/app.js',
  '/js/app-shell.js',
  '/js/pwa.js',
  '/img/tutorsala-logo.webp',
  '/img/icons/icon-192.png',
  '/manifest.webmanifest',
];

// Public pages whose HTML we keep a copy of for offline use.
const PUBLIC_PAGES = ['/', '/index.html', '/start-page.html', '/privacy', '/terms', '/contact'];

// Same-origin static files handled network-first with a cache fallback.
const STATIC_PREFIXES = ['/css/', '/js/', '/img/'];
const STATIC_FILES = ['/manifest.webmanifest', '/favicon.ico'];

// ── Install: precache the core files (one by one, ignoring failures) ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        try {
          await cache.addAll(CORE_URLS);
        } catch {
          // One file failed, so addAll stored nothing. Add them individually instead.
          await Promise.all(CORE_URLS.map((url) => cache.add(url).catch(() => {})));
        }
      } catch {
        // Cache storage unavailable: install anyway, the site still works online.
      }
    })(),
  );
  // No skipWaiting here: the page asks the user first, then sends SKIP_WAITING.
});

// ── Activate: remove caches from older versions, then take control of open tabs ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((key) => key.startsWith('tutorsala-') && key !== STATIC_CACHE).map((key) => caches.delete(key)),
        );
      } catch {
        // Ignore: stale caches are harmless.
      }
      await self.clients.claim();
    })(),
  );
});

// ── The page sends this when the user clicks "Refresh" on the update banner ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Save a copy of a good response. Errors are swallowed so a cache problem never breaks a page.
async function putInCache(key, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  try {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(key, response);
  } catch {
    // ignore
  }
}

async function fromCache(key, options) {
  try {
    return await caches.match(key, options);
  } catch {
    return undefined;
  }
}

// Pages: network first; offline → saved copy of this page, then '/', then the offline page.
async function handleNavigation(request, url) {
  const path = url.pathname;
  const isPublic = PUBLIC_PAGES.includes(path);
  try {
    const response = await fetch(request);
    if (isPublic) putInCache(path, response.clone());
    return response;
  } catch {
    const cached = isPublic ? await fromCache(path) : await fromCache('/');
    if (cached) return cached;
    const offline = await fromCache('/offline.html');
    if (offline) return offline;
    return new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

// CSS / JS / images: network first so deploys show up immediately; offline → cached copy.
// Stored without the ?v= query so "app.js" and "app.js?v=123" share one entry.
async function handleStatic(request, url) {
  const key = url.origin + url.pathname;
  try {
    const response = await fetch(request);
    putInCache(key, response.clone());
    return response;
  } catch (err) {
    const cached = await fromCache(key, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only same-origin GETs. Everything else (POST, Google Fonts, CDNs) goes straight to the browser.
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Never intercept API calls (user data, auth) or the service worker file itself.
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  const isStatic =
    STATIC_FILES.includes(url.pathname) || STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  if (isStatic) event.respondWith(handleStatic(request, url));
});
