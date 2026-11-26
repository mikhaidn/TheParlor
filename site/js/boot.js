// Shared start-up for every page: settings, content packs, theme, service worker.
import { initPWA } from './pwa.js';
import { track } from './analytics.js';

export const P = window.Parlor;

// Packs anyone can use. Paid and earned packs need an ownership check (store or
// achievements) before they're registered — see design/system/content-model.md.
const FREE_PACKS = ['parchment.pack.json', 'bakers-game.pack.json'];

let settings = P.settings.load();

export function getSettings() { return settings; }

export function setSettings(next) {
  settings = P.settings.validate(next).settings;
  P.settings.save(settings);
  P.settings.apply(settings);
  return settings;
}

/**
 * @param {string} root relative path from the page to the site root, e.g. './' or '../'
 */
export async function boot(root) {
  P.settings.apply(settings);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => P.settings.apply(settings));

  await Promise.all(FREE_PACKS.map(async (f) => {
    try {
      const res = await fetch(root + 'content/packs/' + f);
      if (res.ok) P.defs.register(await res.json());
    } catch { /* offline before first cache: built-ins still work */ }
  }));
  P.settings.apply(settings); // again, now that pack decks/tables exist

  initPWA(root);
  track('page_view', {
    ref: new URLSearchParams(location.search).get('ref') || new URLSearchParams(location.search).get('source') || null,
    display_mode: matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
  });
  return settings;
}
