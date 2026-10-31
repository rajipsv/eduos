// Progressive Web App support: service worker registration, the "new version"
// banner, and the "Install app" buttons ([data-pwa-install]).

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000; // check for a new version at most every 30 min

let deps = { toast: null, showModal: null };
let initialized = false;
let deferredPrompt = null; // the saved beforeinstallprompt event
let installed = false;
let reloadRequested = false; // set only when the user clicks "Refresh"
let lastUpdateCheck = 0;
let updateBanner = null;

/** True when the app is running as an installed app (home screen / desktop window). */
export function isStandalone() {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    if (window.matchMedia?.('(display-mode: window-controls-overlay)').matches) return true;
  } catch {
    // ignore
  }
  return window.navigator.standalone === true; // iOS Safari
}

/** True on iPhone / iPad (including iPadOS, which reports itself as a Mac). */
export function isIos() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

// iOS Safari never fires beforeinstallprompt; users install via Share → Add to Home Screen.
// Other iOS browsers (Chrome, Firefox, Edge) can't add web apps in older iOS versions.
function isIosSafari() {
  const ua = navigator.userAgent || '';
  return isIos() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function canInstall() {
  if (installed || isStandalone()) return false;
  return Boolean(deferredPrompt) || isIosSafari();
}

/** Show or hide every [data-pwa-install] element depending on whether install is possible. */
export function syncInstallButtons() {
  const show = canInstall();
  document.querySelectorAll('[data-pwa-install]').forEach((el) => {
    el.classList.toggle('hidden', !show);
  });
}

function showIosInstructions() {
  const text = 'To install Tutorsala, tap the Share button in Safari, then choose "Add to Home Screen".';
  if (typeof deps.showModal === 'function') {
    deps.showModal({
      title: 'Install Tutorsala',
      body:
        '<p>Install Tutorsala on your iPhone or iPad for quick access:</p>' +
        '<ol><li>Tap the <strong>Share</strong> button (the square with an arrow) in Safari.</li>' +
        '<li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>' +
        '<li>Tap <strong>Add</strong>.</li></ol>',
      footer: '<button type="button" class="btn btn-primary" data-modal-cancel>OK</button>',
    });
  } else {
    window.alert(text);
  }
}

async function onInstallClick(event) {
  const btn = event.target.closest?.('[data-pwa-install]');
  if (!btn) return;
  event.preventDefault();
  if (deferredPrompt) {
    const promptEvent = deferredPrompt;
    deferredPrompt = null; // a prompt can only be used once
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === 'accepted') installed = true;
    } catch {
      // ignore: the browser refused to show the prompt
    }
    syncInstallButtons();
    return;
  }
  if (isIosSafari() && !isStandalone()) showIosInstructions();
}

// ── Install events: listen as soon as this module loads so an early prompt isn't missed ──
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep the browser's mini-infobar away; we show our own button
    deferredPrompt = event;
    syncInstallButtons();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    syncInstallButtons();
    if (typeof deps.toast === 'function') deps.toast('Tutorsala was installed.', 'success');
  });
}

// ── Update banner ──
function hideUpdateBanner() {
  updateBanner?.remove();
  updateBanner = null;
}

function showUpdateBanner(worker) {
  if (!worker) return;
  hideUpdateBanner();

  const banner = document.createElement('div');
  banner.className = 'pwa-update-banner';
  banner.setAttribute('role', 'status');

  const msg = document.createElement('span');
  msg.className = 'pwa-update-text';
  msg.textContent = 'A new version of Tutorsala is ready.';

  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.className = 'btn btn-primary btn-sm';
  refresh.textContent = 'Refresh';
  refresh.addEventListener('click', () => {
    reloadRequested = true;
    refresh.disabled = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  });

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'pwa-update-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '×';
  dismiss.addEventListener('click', hideUpdateBanner);

  banner.append(msg, refresh, dismiss);
  document.body.appendChild(banner);
  updateBanner = banner;
}

function watchForUpdates(registration) {
  // A new version finished downloading before this page loaded.
  if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration.waiting);

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      // "installed" + an existing controller = an update (not the very first install).
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(worker);
    });
  });

  // Re-check when the user comes back to the tab (throttled).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - lastUpdateCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastUpdateCheck = now;
    registration.update().catch(() => {});
  });
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    lastUpdateCheck = Date.now();
    watchForUpdates(registration);
  } catch (err) {
    console.warn('Service worker registration failed:', err);
  }
}

/**
 * Set up the PWA features. Safe to call more than once (later calls only update deps).
 * @param {{ toast?: Function, showModal?: Function }} [options]
 */
export function initPwa({ toast, showModal } = {}) {
  deps = { toast: toast || deps.toast, showModal: showModal || deps.showModal };
  if (initialized) return;
  initialized = true;

  if (isStandalone()) document.documentElement.classList.add('pwa-standalone');

  // Install buttons: one delegated click handler covers buttons added by later re-renders.
  document.addEventListener('click', onInstallClick);
  syncInstallButtons();
  let syncTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncInstallButtons, 150);
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });

  // Service worker: only over http(s), and after page load so it doesn't slow the first paint.
  const supported = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
  if (!supported) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload when the user asked for the update, and only once.
    if (!reloadRequested) return;
    reloadRequested = false;
    window.location.reload();
  });

  if (document.readyState === 'complete') registerServiceWorker();
  else window.addEventListener('load', registerServiceWorker, { once: true });
}
