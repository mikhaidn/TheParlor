/* Parlor service worker: pre-caches the whole app so it plays fully offline.
   The asset list and BUILD below are written by tools/build.mjs — run it after changing files. */

// <build>
const BUILD = "dev";
const ASSETS = [
  "./",
  "./daily/",
  "./freecell/",
  "./content/packs/bakers-game.pack.json",
  "./content/packs/gilded.pack.json",
  "./content/packs/midnight.pack.json",
  "./content/packs/parchment.pack.json",
  "./content/settings/parlor-settings.default.json",
  "./content/settings/preset-big-cards-phone.json",
  "./copy/en.json",
  "./css/app.css",
  "./daily/index.html",
  "./fonts/fraunces-latin-500-normal.woff2",
  "./fonts/fraunces-latin-600-normal.woff2",
  "./fonts/instrument-sans-latin-400-normal.woff2",
  "./fonts/instrument-sans-latin-600-normal.woff2",
  "./freecell/index.html",
  "./icons/apple-touch-icon-180.png",
  "./icons/parlor-192.png",
  "./icons/parlor-512.png",
  "./icons/parlor-mark.svg",
  "./icons/parlor-maskable-512.png",
  "./icons/suits/club.svg",
  "./icons/suits/diamond.svg",
  "./icons/suits/heart.svg",
  "./icons/suits/spade.svg",
  "./index.html",
  "./js/analytics.js",
  "./js/boot.js",
  "./js/daily-page.js",
  "./js/daily.js",
  "./js/engine.js",
  "./js/freecell-page.js",
  "./js/launcher.js",
  "./js/pwa.js",
  "./js/share.js",
  "./js/stats-file.js",
  "./js/store.js",
  "./js/strings.js",
  "./js/table.js",
  "./manifest.webmanifest",
  "./parlor/bundle.css",
  "./parlor/bundle.js",
  "./parlor/tokens.css"
];
// </build>

const CACHE = 'parlor-' + BUILD;
const scope = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new URL(a, scope).href)))
  );
  // First install takes over immediately; updates wait for the app to ask (between games).
  if (!self.registration.active) self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('parlor-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Pages are cached without their query (?deal=617, ?ref=share …).
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const shell = await cache.match(new URL('./', scope).href);
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
