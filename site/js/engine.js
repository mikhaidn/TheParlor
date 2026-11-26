// FreeCell-family game engine: pure state + move logic on top of Parlor.rules.
// No DOM here, so it can be unit-tested in Node with a stubbed `rules`.
//
// A game is { rulesId, deal, moves: [{ from, index, to, auto }] }.
// State is always rebuilt by replaying moves from the deal, so saves are tiny
// and undo is "drop the last user move (plus its auto-moves) and replay".

export const FOUNDATION_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const UNSOLVABLE_DEALS = new Set([11982]); // the one unsolvable deal in 1–32000
const RANK_N = { A: 1, J: 11, Q: 12, K: 13 };
const RED = new Set(['hearts', 'diamonds']);

export const rankN = (r) => RANK_N[r] || parseInt(r, 10);
export const isRed = (s) => RED.has(s);
export const cardId = (c) => c.rank + c.suit[0].toUpperCase();
const zoneOf = (pid) => pid.split('.')[0];
const idxOf = (pid) => +pid.split('.')[1];

export function pile(state, pid) {
  return (state[zoneOf(pid)] || [])[idxOf(pid)] || [];
}

export function cloneState(s) {
  const out = {};
  for (const k of Object.keys(s)) out[k] = s[k].map((p) => p.slice());
  return out;
}

export function follows(under, over, build) {
  const a = rankN(under.rank), b = rankN(over.rank);
  switch (build) {
    case 'any': return true;
    case 'down-alternate': return b === a - 1 && isRed(under.suit) !== isRed(over.suit);
    case 'down-same-suit': return b === a - 1 && under.suit === over.suit;
    case 'down-any-suit': return b === a - 1;
    case 'up-same-suit': return b === a + 1 && under.suit === over.suit;
    default: return false;
  }
}

export function createEngine(P, rulesId = 'parlor.rules.freecell') {
  const rs = P.defs.get(rulesId) || P.defs.get('parlor.rules.freecell');
  const zones = rs.zones;
  const pileIds = (state, zone) => (state[zone] || []).map((_, i) => `${zone}.${i}`);
  const allPiles = (state) => Object.keys(zones).flatMap((z) => pileIds(state, z));
  const foundationZone = Object.keys(zones).find((z) => zones[z].build === 'up-same-suit') || 'foundation';
  const cellZone = Object.keys(zones).find((z) => zones[z].capacity === 1) || 'cell';
  const tableauZone = Object.keys(zones).find((z) => zones[z].pickUp === 'run') || 'tableau';

  function initial(deal) {
    return P.rules.deal(rs, deal);
  }

  /** Redirect "drop anywhere on the foundation row / cell row" to the right slot. */
  function resolveTarget(state, from, index, to) {
    const moving = pile(state, from).slice(index);
    const z = zoneOf(to);
    if (z === foundationZone && moving.length === 1) {
      const i = FOUNDATION_SUITS.indexOf(moving[0].suit);
      if (i >= 0 && i < state[foundationZone].length) return `${foundationZone}.${i}`;
    }
    if (z === cellZone && pile(state, to).length) {
      const free = pileIds(state, cellZone).find((p) => !pile(state, p).length);
      if (free) return free;
    }
    return to;
  }

  function check(state, from, index, to) {
    const target = resolveTarget(state, from, index, to);
    const res = P.rules.canMove(rs, state, from, index, target);
    return { ...res, to: target };
  }

  function apply(state, m) {
    const s = cloneState(state);
    const src = s[zoneOf(m.from)][idxOf(m.from)];
    const moving = src.splice(m.index);
    s[zoneOf(m.to)][idxOf(m.to)].push(...moving);
    return s;
  }

  /** Can a single card go to its foundation right now? */
  function toFoundation(state, from) {
    const p = pile(state, from);
    if (!p.length) return null;
    const r = check(state, from, p.length - 1, `${foundationZone}.0`);
    return r.ok ? { from, index: p.length - 1, to: r.to } : null;
  }

  function foundationRank(state, suit) {
    const i = FOUNDATION_SUITS.indexOf(suit);
    const p = state[foundationZone][i] || [];
    return p.length ? rankN(p[p.length - 1].rank) : 0;
  }

  /** Safe to auto-play: nothing still on the table could need this card as a parent. */
  function isSafe(state, card) {
    const r = rankN(card.rank);
    if (r <= 2) return true;
    const opp = FOUNDATION_SUITS.filter((s) => isRed(s) !== isRed(card.suit));
    const same = FOUNDATION_SUITS.filter((s) => isRed(s) === isRed(card.suit) && s !== card.suit);
    return opp.every((s) => foundationRank(state, s) >= r - 1) && same.every((s) => foundationRank(state, s) >= r - 2);
  }

  /** Next automatic move after a player move, or null. mode: 'off' | 'safe' | 'always'. */
  function nextAuto(state, mode) {
    if (mode === 'off') return null;
    for (const from of [...pileIds(state, cellZone), ...pileIds(state, tableauZone)]) {
      const m = toFoundation(state, from);
      if (!m) continue;
      const card = pile(state, from)[m.index];
      if (mode === 'always' || isSafe(state, card)) return { ...m, auto: true };
    }
    return null;
  }

  /** Lowest index of the longest movable run at the bottom of a tableau pile. */
  function runStart(p) {
    const build = zones[tableauZone].run || zones[tableauZone].build;
    let i = p.length - 1;
    while (i > 0 && follows(p[i - 1], p[i], build)) i--;
    return i;
  }

  /** All legal moves, ordered most-useful first. Used for hints and stuck detection. */
  function legalMoves(state) {
    const out = [];
    const seen = new Set();
    const push = (m, kind) => { const k = m.from + m.index + m.to; if (!seen.has(k)) { seen.add(k); out.push({ ...m, kind }); } };
    const tabs = pileIds(state, tableauZone), cells = pileIds(state, cellZone);
    const build = zones[tableauZone].run || zones[tableauZone].build;

    for (const from of [...cells, ...tabs]) { const m = toFoundation(state, from); if (m) push(m, 'foundation'); }

    for (const from of tabs) {
      const p = pile(state, from); if (!p.length) continue;
      for (let i = runStart(p); i < p.length; i++) {
        // Moving a run off a card it already sits on correctly only shuffles cards around.
        if (i > 0 && follows(p[i - 1], p[i], build)) continue;
        for (const to of tabs) {
          if (to === from || !pile(state, to).length) continue;
          if (P.rules.canMove(rs, state, from, i, to).ok) push({ from, index: i, to }, 'build');
        }
      }
    }
    for (const from of cells) {
      const p = pile(state, from); if (!p.length) continue;
      for (const to of tabs) if (pile(state, to).length && P.rules.canMove(rs, state, from, 0, to).ok) push({ from, index: 0, to }, 'from-cell');
    }
    const emptyTab = tabs.find((t) => !pile(state, t).length);
    if (emptyTab) {
      for (const from of cells) if (pile(state, from).length) push({ from, index: 0, to: emptyTab }, 'cell-to-empty');
      for (const from of tabs) {
        const p = pile(state, from); if (p.length < 2) continue;
        for (let i = Math.max(1, runStart(p)); i < p.length; i++) {
          if (P.rules.canMove(rs, state, from, i, emptyTab).ok) { push({ from, index: i, to: emptyTab }, 'to-empty'); break; }
        }
      }
    }
    const emptyCell = cells.find((c) => !pile(state, c).length);
    if (emptyCell) for (const from of tabs) {
      const p = pile(state, from); if (!p.length) continue;
      push({ from, index: p.length - 1, to: emptyCell }, 'to-cell');
    }
    return out;
  }

  /** Replay a move list from a deal. Also records when each card reached a foundation. */
  function replay(deal, moves) {
    let state = initial(deal);
    const arrivals = {};
    moves.forEach((m, n) => {
      state = apply(state, m);
      if (zoneOf(m.to) === foundationZone) {
        const p = pile(state, m.to);
        arrivals[cardId(p[p.length - 1])] = n + 1;
      }
    });
    return { state, arrivals };
  }

  return {
    rules: rs, rulesId: rs.id, name: rs.name, zones: { foundation: foundationZone, cell: cellZone, tableau: tableauZone },
    initial, check, apply, nextAuto, legalMoves, replay, runStart, allPiles, pile,
    canPickUp(state, from, index) {
      const z = zones[zoneOf(from)]; const p = pile(state, from);
      if (!z || z.pickUp === 'none' || index < 0 || index >= p.length) return false;
      if (z.pickUp === 'top') return index === p.length - 1;
      return index >= runStart(p);
    },
    isWon: (state) => P.rules.isWon(rs, state),
  };
}

/** Deal numbers players can't be stuck on: 1–32000 minus the known unsolvable one. */
export function randomDeal() {
  let n;
  do { n = 1 + Math.floor(Math.random() * 32000); } while (UNSOLVABLE_DEALS.has(n));
  return n;
}
