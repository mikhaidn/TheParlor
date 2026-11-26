// Stats file: export / import Daily results and per-game stats as one JSON file,
// so streaks survive a new phone, a cleared browser, or a move to a new domain.
// Importing merges: it never removes or overwrites a result already on this device.

import { read, write } from './store.js';

const DAILY_KEY = 'parlor.daily.v1';
const GAME_PREFIX = 'parlor.stats.';
const FILE_NAME = 'parlor-stats.json';

export function collect() {
  const games = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(GAME_PREFIX)) games[k.slice(GAME_PREFIX.length)] = read(k);
    }
  } catch { /* storage unavailable */ }
  return { app: 'parlor', kind: 'stats', version: 1, exportedAt: new Date().toISOString(), daily: read(DAILY_KEY, { results: {}, started: {} }), games };
}

/** Returns 'shared' | 'downloaded' | 'cancelled' */
export async function exportStats() {
  const blob = new Blob([JSON.stringify(collect(), null, 2)], { type: 'application/json' });
  let file = null;
  try { file = new File([blob], FILE_NAME, { type: 'application/json' }); } catch { /* old Safari */ }
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    try { await navigator.share({ files: [file], title: 'Parlor stats' }); return 'shared'; } catch { return 'cancelled'; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = FILE_NAME;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  return 'downloaded';
}

const isNum = (x) => typeof x === 'number' && isFinite(x) && x >= 0;
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
function validResult(r) {
  return r && r.solved === true && isNum(r.time) && isNum(r.moves) && (r.undos == null || isNum(r.undos))
    && r.grid && SUITS.every((s) => Array.isArray(r.grid[s]) && r.grid[s].length === 13 && r.grid[s].every((q) => q === 0 || q === 1 || q === 2 || q === 3));
}

/** Merge an imported stats object into this device. Returns a summary message. */
export function merge(data) {
  if (!data || data.app !== 'parlor') return { ok: false, message: 'That isn’t a Parlor file.' };
  if (data.kind !== 'stats') return { ok: false, message: data.appearance ? 'That’s a settings file. Use Import under Settings file.' : 'That isn’t a Parlor stats file.' };

  const local = read(DAILY_KEY, { results: {}, started: {} });
  local.results = local.results || {}; local.started = local.started || {};
  let added = 0, skipped = 0;
  for (const [k, r] of Object.entries((data.daily && data.daily.results) || {})) {
    const n = parseInt(k, 10);
    if (!(n > 0) || !validResult(r)) { skipped++; continue; }
    if (local.results[n]?.solved) continue; // the first solve on record stays
    local.results[n] = { solved: true, time: r.time, moves: r.moves, undos: r.undos || 0, grid: r.grid, at: r.at || null };
    added++;
  }
  for (const k of Object.keys((data.daily && data.daily.started) || {})) if (parseInt(k, 10) > 0) local.started[k] = true;
  write(DAILY_KEY, local);

  let games = 0;
  for (const [id, g] of Object.entries(data.games || {})) {
    if (!/^[a-z0-9.\-]+$/i.test(id) || !g || !isNum(g.played) || !isNum(g.won)) continue;
    const key = GAME_PREFIX + id;
    const cur = read(key, { played: 0, won: 0, best: null, streak: 0, bestStreak: 0 });
    const best = [cur.best, g.best].filter(isNum);
    write(key, {
      played: Math.max(cur.played, g.played), won: Math.max(cur.won, g.won),
      best: best.length ? Math.min(...best) : null,
      streak: Math.max(cur.streak || 0, isNum(g.streak) ? g.streak : 0),
      bestStreak: Math.max(cur.bestStreak || 0, isNum(g.bestStreak) ? g.bestStreak : 0),
    });
    games++;
  }

  const parts = [];
  parts.push(added ? `Added ${added} daily result${added === 1 ? '' : 's'}` : 'No new daily results');
  if (games) parts.push(`merged stats for ${games} game${games === 1 ? '' : 's'}`);
  let message = parts.join(', ') + '.';
  if (skipped) message += ` Skipped ${skipped} that didn’t look right.`;
  dispatchEvent(new CustomEvent('parlor:stats-changed'));
  return { ok: true, added, games, message };
}

export async function importStatsFile(file) {
  if (!file) return { ok: false, message: 'Nothing imported.' };
  try { return merge(JSON.parse(await file.text())); } catch { return { ok: false, message: 'Couldn’t read that file.' }; }
}

/** The "Stats file" group for the Settings sheet, built from the same pieces as its "Settings file" group. */
export function statsGroup(P) {
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const group = el('div', 'pl-set-group pl-set-file');
  group.appendChild(el('h3', 'pl-h3', 'Stats file'));
  group.appendChild(el('p', 'pl-set-help', 'Daily results, streaks and game stats. Importing adds to what’s here.'));
  const status = el('p', 'pl-set-status'); status.setAttribute('role', 'status');
  const input = Object.assign(el('input'), { type: 'file', accept: 'application/json,.json', hidden: true });
  input.addEventListener('change', async () => {
    const res = await importStatsFile(input.files && input.files[0]);
    status.textContent = res.message;
    input.value = '';
  });
  const acts = el('div', 'pl-set-actions');
  acts.appendChild(P.Button({ label: 'Export', onClick: async () => {
    const how = await exportStats();
    if (how !== 'cancelled') status.textContent = how === 'shared' ? 'Stats shared.' : `Saved ${FILE_NAME}.`;
  } }));
  acts.appendChild(P.Button({ label: 'Import…', onClick: () => input.click() }));
  group.append(acts, input, status);
  return group;
}
