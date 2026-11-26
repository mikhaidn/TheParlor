// Best-first FreeCell solver for tests and tooling (e.g. checking that a daily
// deal is solvable before launch). Runs in the browser or Node, given Parlor.
import { createEngine, cardId } from '../site/js/engine.js';

export function solve(P, deal, { rulesId = 'parlor.rules.freecell', limit = 200000 } = {}) {
  const E = createEngine(P, rulesId);
  const key = (s) => {
    const cols = s.tableau.map((p) => p.map(cardId).join(',')).sort().join('|');
    const cells = s.cell.map((p) => (p[0] ? cardId(p[0]) : '')).sort().join(',');
    const f = s.foundation.map((p) => p.length).join(',');
    return cols + '#' + cells + '#' + f;
  };
  const score = (s) => {
    let h = 0;
    const home = s.foundation.reduce((n, p) => n + p.length, 0);
    h += (52 - home) * 10;
    h += s.cell.filter((p) => p.length).length * 3;
    h -= s.tableau.filter((p) => !p.length).length * 4;
    // cards sitting above lower cards of the same suit
    for (const p of s.tableau) for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j].suit === p[i].suit && rankOf(p[j]) > rankOf(p[i])) { h += 1; break; }
    return h;
  };
  const rankOf = (c) => ({ A: 1, J: 11, Q: 12, K: 13 }[c.rank] || +c.rank);
  const settle = (s, moves) => { for (let a = E.nextAuto(s, 'safe'); a; a = E.nextAuto(s, 'safe')) { s = E.apply(s, a); moves.push(a); } return s; };

  const start = settle(E.initial(deal), []);
  const open = [{ s: start, moves: [], f: score(start) }];
  const seen = new Set([key(start)]);
  let n = 0;
  while (open.length && n++ < limit) {
    // pop lowest f (small open lists; linear scan is fine for tests)
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (E.isWon(cur.s)) return { moves: cur.moves, nodes: n };
    for (const m of E.legalMoves(cur.s)) {
      const mv = [...cur.moves, { from: m.from, index: m.index, to: m.to }];
      const s = settle(E.apply(cur.s, m), mv);
      const k = key(s);
      if (seen.has(k)) continue;
      seen.add(k);
      open.push({ s, moves: mv, f: score(s) + mv.length * 0.05 });
    }
  }
  return null;
}

/**
 * A solution as a player makes it at the table. The solver sends cards home before its first
 * move; the table waits for the first move. So this taps those cards home first, then makes each
 * solver move by the card it moves (indices can differ while those cards are still out).
 * Returns [{ from, index, to }] player moves (no auto-moves), or null if there's no solution.
 */
export function tableSolution(P, deal, opts = {}) {
  const rulesId = opts.rulesId || 'parlor.rules.freecell';
  const sol = solve(P, deal, opts);
  if (!sol) return null;
  const E = createEngine(P, rulesId);
  const settle = (s) => { for (let a = E.nextAuto(s, 'safe'); a; a = E.nextAuto(s, 'safe')) s = E.apply(s, a); return s; };
  let sv = settle(E.initial(deal)), tb = E.initial(deal);
  const out = [];
  for (let a = E.nextAuto(tb, 'safe'); a; a = E.nextAuto(tb, 'safe')) {
    const mv = { from: a.from, index: a.index, to: a.to };
    out.push(mv); tb = settle(E.apply(tb, mv));
  }
  for (const m of sol.moves.filter((x) => !x.auto)) {
    const id = cardId(E.pile(sv, m.from)[m.index]);
    const index = E.pile(tb, m.from).findIndex((c) => cardId(c) === id);
    const r = E.check(tb, m.from, index, m.to);
    if (index < 0 || !r.ok) return null;
    const mv = { from: m.from, index, to: r.to };
    out.push(mv); tb = settle(E.apply(tb, mv));
    sv = settle(E.apply(sv, m));
  }
  return E.isWon(tb) ? out : null;
}
