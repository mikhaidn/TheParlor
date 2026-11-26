// Parlor Daily: one FreeCell deal per calendar day, the same for everyone,
// worked out from the date alone so it needs no server and works offline.

import { UNSOLVABLE_DEALS, FOUNDATION_SUITS, rankN } from './engine.js';
import { read, write } from './store.js';
import { t } from './strings.js';

/** Daily #1 is launch day. Change before launch if needed — it renumbers every daily. */
export const EPOCH = { y: 2026, m: 11, d: 25 };
const DAY = 86400000;
const RECORDS_KEY = 'parlor.daily.v1';

const dayIndex = (date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
const EPOCH_INDEX = Math.floor(Date.UTC(EPOCH.y, EPOCH.m - 1, EPOCH.d) / DAY);

/** Today's daily number in the player's local calendar. */
export function dailyNumber(date = new Date()) {
  return dayIndex(date) - EPOCH_INDEX + 1;
}

export function dateOf(n) {
  const d = new Date((EPOCH_INDEX + n - 1) * DAY);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function formatDate(date, opts = { weekday: 'long', month: 'short', day: 'numeric' }) {
  return date.toLocaleDateString(undefined, opts);
}

/** Map a daily number to a classic FreeCell deal (1–32000), skipping unsolvable ones. */
export function dealFor(n) {
  let x = Math.imul(n, 0x9e3779b1) >>> 0;  // golden-ratio hash spreads consecutive days apart
  x = (x ^ (x >>> 16)) >>> 0; x = Math.imul(x, 0x85ebca6b) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0; x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  let deal = 1 + (x % 32000);
  while (UNSOLVABLE_DEALS.has(deal)) deal = (deal % 32000) + 1;
  return deal;
}

export function msUntilNextDaily(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return next - date;
}

// ---------- records ----------
// { results: { [n]: { solved, time, moves, undos, grid, at } }, started: { [n]: true } }

export function records() {
  return read(RECORDS_KEY, { results: {}, started: {} });
}

export function markStarted(n) {
  const r = records();
  r.started[n] = true;
  write(RECORDS_KEY, r);
}

/** Save a solve. Late solves (a past day) count toward Solved, never toward the streak. */
export function saveResult(n, result, { late = false } = {}) {
  const r = records();
  if (r.results[n]?.solved) return { saved: false, record: r.results[n] }; // replays never overwrite
  const best = bestTime(r);
  r.results[n] = { solved: true, late, time: result.time, moves: result.moves, undos: result.undos, grid: shareGrid(result), at: new Date().toISOString() };
  write(RECORDS_KEY, r);
  return { saved: true, record: r.results[n], newBest: best == null || result.time < best };
}

export function bestTime(r = records()) {
  const times = Object.values(r.results).filter((x) => x.solved).map((x) => x.time);
  return times.length ? Math.min(...times) : null;
}

const onTime = (r, n) => !!(r.results[n]?.solved && !r.results[n].late);

/** 'solved' | 'missed' (started, not solved) | 'none' (not played) | 'today' | 'future' | 'before' */
export function dayStatus(n, today = dailyNumber(), r = records()) {
  if (n < 1) return 'before';
  if (n > today) return 'future';
  if (r.results[n]?.solved) return 'solved';
  if (n === today) return 'today';
  return r.started[n] ? 'missed' : 'none';
}

export function summary(today = dailyNumber()) {
  const r = records();
  const played = new Set([...Object.keys(r.started), ...Object.keys(r.results)].map(Number));
  const solved = Object.keys(r.results).map(Number).filter((n) => r.results[n].solved);
  // Streak: consecutive on-time solves ending today (or yesterday, if today isn't done yet).
  let streak = 0;
  let n = onTime(r, today) ? today : today - 1;
  while (onTime(r, n)) { streak++; n--; }
  let longest = 0, run = 0;
  for (let k = 1; k <= today; k++) { if (onTime(r, k)) { run++; longest = Math.max(longest, run); } else if (k < today) run = 0; }
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const k = today - i;
    const st = dayStatus(k, today, r);
    week.push({ n: k, date: dateOf(k), state: st === 'solved' ? 'solved' : st === 'today' ? 'today' : st === 'before' ? 'none' : 'missed' });
  }
  return { streak, longest, solved: solved.length, played: played.size, best: bestTime(r), week, today: r.results[today] || null };
}

/**
 * Spoiler-free grid: per suit, 13 cells ace→king, each the quarter of the game
 * (0 = first quarter … 3 = last) in which that card reached its foundation.
 */
export function shareGrid(result) {
  const total = Math.max(1, result.moves);
  const out = {};
  for (const suit of FOUNDATION_SUITS) {
    out[suit] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map((rank) => {
      const at = result.arrivals[rank + suit[0].toUpperCase()] || total;
      return Math.min(3, Math.floor((4 * (at - 1)) / total));
    });
  }
  return out;
}

const SQUARES = ['🟩', '🟨', '🟧', '🟥'];
const BARS = ['▁', '▃', '▅', '▇'];
const SUIT_EMOJI = { spades: '♠️', hearts: '♥️', diamonds: '♦️', clubs: '♣️' };
const SUIT_CHAR = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

/** Share text formats from design/daily/CopyShare.dc.html. */
export const SHARE_FORMAT = 'squares'; // 'squares' | 'bars' | 'short'

/** The link shown in shares: no scheme (chat apps still link it), keeps ?ref=share for the metrics. */
export function shareLink(href) {
  return href.replace(/^https?:\/\//, '');
}

export function shareText(n, rec, link, format = SHARE_FORMAT) {
  const vars = { n, time: fmt(rec.time), moves: rec.moves };
  const tail = t('share.text.tail', { link });
  if (format === 'short') return t('share.text.short', { ...vars, tail });
  const squares = format !== 'bars';
  const lines = [t('share.text.header', vars), t(squares ? 'share.text.squaresLine' : 'share.text.barsLine', vars)];
  for (const s of FOUNDATION_SUITS) {
    const marks = rec.grid[s].map((q) => (squares ? SQUARES : BARS)[q]).join('');
    lines.push(`${squares ? SUIT_EMOJI[s] : SUIT_CHAR[s]} ${marks}`);
  }
  lines.push(tail);
  return lines.join('\n');
}

export const shareCaption = (format = SHARE_FORMAT) => t('share.caption.' + format);

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export { rankN };
