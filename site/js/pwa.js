// Install + offline plumbing (design/system/pwa.md §3, §7).
import { track } from './analytics.js';

let deferredPrompt = null;
let waiting = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn(status()));

export function status() {
  return {
    standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    canInstall: !!deferredPrompt,
    iosHint: isIOSSafari() && !navigator.standalone,
    updateReady: !!waiting,
  };
}

export function onPWAChange(fn) { listeners.add(fn); fn(status()); return () => listeners.delete(fn); }

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null; notify();
  return outcome;
}

/** Only call between games: the page reloads. */
export function applyUpdate() {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

let started = false;
export function initPWA(root) {
  if (started) return; started = true;

  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; notify(); });
  addEventListener('appinstalled', () => { deferredPrompt = null; notify(); track('app_installed', { platform: navigator.userAgentData?.platform || navigator.platform }); });

  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(root + 'sw.js', { scope: root }).then((reg) => {
    const watch = (w) => w && w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) { waiting = w; notify(); }
    });
    if (reg.waiting && navigator.serviceWorker.controller) { waiting = reg.waiting; notify(); }
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    // Check for a new version whenever the app comes back to the front.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch((err) => console.warn('Service worker not registered', err));
}
