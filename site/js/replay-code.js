// Replay code v1 (design: Parlor Daily canvas → "Replay code v1 · encoding").
//
// A finished game becomes a short base64url string: a header, then one byte per player
// action, then a CRC-8. Positions are one hex digit each:
//   0–3 free cells a–d · 4–7 foundations ♠♥♦♣ · 8–F columns 1–8   (standard FreeCell notation)
// A move is [from][to]. Only a column → empty column move needs a depth nibble (cards − 1);
// every other count is fixed by the rules. Foundations are never a source, so bytes that
// start with 4–7 are control tokens:
//   40 undo · 41–43 auto-move setting changed to off / safe / always · 44 hint (reserved)
//   45 restart · 46–7F reserved. A lone trailing 4 pads an odd number of nibbles.
// Auto-moves aren't stored: the header holds the auto-move setting and the replayer re-runs
// the engine after each move, exactly as the table does.
//
// Header: [version][game<<4 | auto<<2 | daily<<1][number: 3 bytes][seconds: 2 bytes]
//   number = Daily # when the daily bit is set, else the deal number.

export const VERSION = 1;
const GAMES = ['parlor.rules.freecell', 'parlor.rules.bakers-game'];
const MODES = ['off', 'safe', 'always'];
const ZONE_BASE = { cell: 0, foundation: 4, tableau: 8 };
const UNDO = 0x40, RESTART = 0x45, MODE0 = 0x41, HINT = 0x44;

const posOf = (pid) => { const [z, i] = pid.split('.'); return ZONE_BASE[z] + +i; };
const pidOf = (n, zones) => n < 4 ? `${zones.cell}.${n}` : n < 8 ? `${zones.foundation}.${n - 4}` : `${zones.tableau}.${n - 8}`;
const zoneOf = (n) => (n < 4 ? 'cell' : n < 8 ? 'foundation' : 'tableau');

export const rulesIdOf = (game) => GAMES[game] || null;

function crc8(bytes) {
  let c = 0;
  for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 255 : (c << 1) & 255; }
  return c;
}

function toBase64Url(bytes) {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Array.from(bin, (ch) => ch.charCodeAt(0));
}

/**
 * Walk an action log the way the table plays it. Calls visit(step) for each action with the
 * state before it. Returns the final { state, line } where line is the clean line:
 * [{ move, mode }] for every move still on the board.
 *   log: [{ m: [from, index, to] } | 'u' | 'r' | { a: mode } | 'h']
 */
export function walk(engine, deal, log, mode0, visit) {
  let mode = mode0, line = [];
  const restarts = [];
  const rebuild = () => {
    let s = engine.initial(deal);
    for (const { move, mode: md } of line) s = settle(engine, engine.apply(s, move), md);
    return s;
  };
  let state = engine.initial(deal);
  for (const a of log) {
    if (a === 'u') {
      if (line.length) line = line.slice(0, -1);
      else if (restarts.length) line = restarts.pop();
      else continue;
      const before = state; state = rebuild();
      visit && visit({ kind: 'undo', before, state });
    } else if (a === 'r') {
      if (!line.length) continue;
      restarts.push(line); line = [];
      const before = state; state = engine.initial(deal);
      visit && visit({ kind: 'restart', before, state });
    } else if (a === 'h') {
      visit && visit({ kind: 'hint', before: state, state });
    } else if (a && a.a) {
      mode = a.a;
      visit && visit({ kind: 'mode', mode, before: state, state });
    } else if (a && a.m) {
      const [from, index, to] = a.m, move = { from, index, to };
      const before = state;
      const ok = engine.check(before, from, index, to);
      if (!ok.ok) throw new Error('illegal move in log');
      const moved = engine.pile(before, from).slice(index);
      const after = engine.apply(before, move);
      state = settle(engine, after, mode);
      line = [...line, { move, mode }];
      const home = (s) => s[engine.zones.foundation].reduce((n, p) => n + p.length, 0);
      visit && visit({ kind: 'move', move, moved, before, state, autoHome: home(state) - home(after), emptyTo: !engine.pile(before, to).length });
    }
  }
  return { state, line };
}

function settle(engine, s, mode) {
  for (let a = engine.nextAuto(s, mode); a; a = engine.nextAuto(s, mode)) s = engine.apply(s, a);
  return s;
}

/** Encode a finished (or unfinished) game. */
export function encode(engine, { rulesId, deal, daily = null, timeMs = 0, mode0 = 'safe', log }) {
  const game = Math.max(0, GAMES.indexOf(rulesId));
  const nib = [];
  walk(engine, deal, log, mode0, (st) => {
    if (st.kind === 'undo') nib.push(4, 0);
    else if (st.kind === 'restart') nib.push(4, 5);
    else if (st.kind === 'hint') nib.push(4, 4);
    else if (st.kind === 'mode') nib.push(4, 1 + MODES.indexOf(st.mode));
    else if (st.kind === 'move') {
      const f = posOf(st.move.from), t = posOf(st.move.to);
      nib.push(f, t);
      if (f >= 8 && t >= 8 && st.emptyTo) nib.push(Math.min(15, st.moved.length - 1));
    }
  });
  if (nib.length % 2) nib.push(4);
  const number = daily != null ? daily : deal;
  const secs = Math.min(65535, Math.round(timeMs / 1000));
  const bytes = [VERSION, (game << 4) | (Math.max(0, MODES.indexOf(mode0)) << 2) | (daily != null ? 2 : 0),
    (number >> 16) & 255, (number >> 8) & 255, number & 255, secs >> 8, secs & 255];
  for (let i = 0; i < nib.length; i += 2) bytes.push((nib[i] << 4) | nib[i + 1]);
  bytes.push(crc8(bytes));
  return toBase64Url(bytes);
}

/** Read a code's header. Throws on anything damaged or from a newer version. */
export function readHeader(code) {
  let bytes;
  try { bytes = fromBase64Url(String(code || '').trim()); } catch { throw new Error('bad code'); }
  if (bytes.length < 8) throw new Error('bad code');
  if (crc8(bytes.slice(0, -1)) !== bytes[bytes.length - 1]) throw new Error('bad check');
  if (bytes[0] !== VERSION) throw new Error('newer version');
  const g = bytes[1] >> 4, rulesId = rulesIdOf(g);
  if (!rulesId) throw new Error('unknown game');
  const number = (bytes[2] << 16) | (bytes[3] << 8) | bytes[4];
  const daily = bytes[1] & 2 ? number : null;
  return {
    version: bytes[0], rulesId, mode0: MODES[(bytes[1] >> 2) & 3] || 'safe',
    daily, deal: daily == null ? number : null, timeMs: ((bytes[5] << 8) | bytes[6]) * 1000,
    body: bytes.slice(7, -1),
  };
}

/** Turn a code back into an action log, using the engine to fill in implied depths. */
export function decode(engine, code, deal) {
  const h = readHeader(code);
  const nib = []; h.body.forEach((b) => nib.push(b >> 4, b & 15));
  const log = [];
  let mode = h.mode0, line = [];
  const restarts = [];
  const rebuild = () => { let s = engine.initial(deal); for (const x of line) s = settle(engine, engine.apply(s, x.move), x.mode); return s; };
  let state = engine.initial(deal);
  let i = 0;
  while (i + 1 < nib.length) {
    const f = nib[i], t = nib[i + 1]; i += 2;
    if (f >= 4 && f < 8) {
      const tok = (f << 4) | t;
      if (tok === UNDO) { log.push('u'); if (line.length) line = line.slice(0, -1); else if (restarts.length) line = restarts.pop(); state = rebuild(); }
      else if (tok === RESTART) { log.push('r'); if (line.length) { restarts.push(line); line = []; state = engine.initial(deal); } }
      else if (tok === HINT) log.push('h');
      else if (tok >= MODE0 && tok < MODE0 + 3) { mode = MODES[tok - MODE0]; log.push({ a: mode }); }
      continue;
    }
    const from = pidOf(f, engine.zones), to = pidOf(t, engine.zones);
    const p = engine.pile(state, from);
    let index;
    if (zoneOf(f) === 'cell' || zoneOf(t) !== 'tableau') index = p.length - 1;
    else if (!engine.pile(state, to).length) { if (i >= nib.length) throw new Error('bad code'); index = p.length - 1 - nib[i++]; }
    else {
      index = -1;
      for (let k = p.length - 1; k >= 0; k--) { if (engine.check(state, from, k, to).ok) { index = k; break; } }
    }
    if (index < 0 || !engine.check(state, from, index, to).ok) throw new Error('mismatch');
    const move = { from, index, to };
    log.push({ m: [from, index, to] });
    state = settle(engine, engine.apply(state, move), mode);
    line = [...line, { move, mode }];
  }
  return { ...h, log, won: engine.isWon(state) };
}

/** Standard notation for one position: a–d, h, 1–8. */
export function noteOf(pid) {
  const n = posOf(pid);
  return n < 4 ? 'abcd'[n] : n < 8 ? 'h' : String(n - 7);
}
