// node tests/replay-code.test.mjs — replay code v1 round trips on real solves.
import assert from 'node:assert/strict';
import { P } from './node-env.mjs';
import { createEngine } from '../site/js/engine.js';
import { dealFor } from '../site/js/daily.js';
import { tableSolution } from '../tools/solver.js';
import { encode, decode, readHeader, walk } from '../site/js/replay-code.js';

const E = createEngine(P, 'parlor.rules.freecell');
const settleAll = (s, mode) => { for (let a = E.nextAuto(s, mode); a; a = E.nextAuto(s, mode)) s = E.apply(s, a); return s; };

// Turn a solution into the log a player would leave: some wrong turns undone, one restart undone.
function humanLog(deal, moves, seed) {
  const log = [];
  let s = E.initial(deal), k = 0;
  for (const m of moves) {
    k++;
    if ((k * 7 + seed) % 11 === 0) {
      const alt = E.legalMoves(s).find((x) => !(x.from === m.from && x.to === m.to && x.index === m.index));
      if (alt) { log.push({ m: [alt.from, alt.index, alt.to] }); log.push('u'); }
    }
    if (k === 20 && seed % 2 === 0) { log.push('r'); log.push('u'); }
    log.push({ m: [m.from, m.index, m.to] });
    s = settleAll(E.apply(s, m), 'safe');
  }
  return log;
}

let total = 0, bytes = 0, maxChars = 0, n = 0;
for (let day = 1; day <= 8; day++) {
  const deal = dealFor(day);
  const moves = tableSolution(P, deal, { limit: 60000 });
  if (!moves) continue;
  const log = humanLog(deal, moves, day);
  const code = encode(E, { rulesId: 'parlor.rules.freecell', deal, daily: day, timeMs: 198400, mode0: 'safe', log });
  const out = decode(E, code, deal);
  assert.equal(out.daily, day);
  assert.equal(out.rulesId, 'parlor.rules.freecell');
  assert.equal(out.timeMs, 198000);
  assert.equal(out.won, true, `daily ${day} replays to a win`);
  assert.deepEqual(out.log, log, `daily ${day} log round-trips`);
  // The clean line the table would record is the solver's moves.
  const { line, state } = walk(E, deal, out.log, 'safe');
  assert.equal(E.isWon(state), true);
  assert.deepEqual(line.map((x) => x.move), moves.map(({ from, index, to }) => ({ from, index, to })));
  total += log.length; bytes += Math.ceil(code.length * 3 / 4); maxChars = Math.max(maxChars, code.length); n++;
}
assert.ok(n >= 5, 'enough deals solved to test');

// A restart that sticks, then a mode change, on a plain deal number.
{
  const deal = 617;
  const sol = tableSolution(P, deal, { limit: 60000 });
  const log = [{ m: [sol[0].from, sol[0].index, sol[0].to] }, 'r', { a: 'always' }, ...sol.map((m) => ({ m: [m.from, m.index, m.to] }))];
  // 'always' may send cards home sooner than the solver did, so stop at the first move that no longer applies.
  const kept = [];
  try { walk(E, deal, log, 'safe', () => {}); kept.push(...log); } catch { kept.push(...log.slice(0, 3)); }
  const code = encode(E, { rulesId: 'parlor.rules.freecell', deal, timeMs: 5000, mode0: 'safe', log: kept });
  const out = decode(E, code, deal);
  assert.equal(out.deal, 617);
  assert.equal(out.daily, null);
  assert.deepEqual(out.log, kept);
}

// Damaged codes are refused, never half-played.
{
  const code = encode(E, { rulesId: 'parlor.rules.freecell', deal: dealFor(2), daily: 2, timeMs: 1000, log: [] });
  assert.doesNotThrow(() => readHeader(code));
  const flipped = code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11);
  assert.throws(() => readHeader(flipped));
  assert.throws(() => readHeader(code.slice(0, -2)));
  assert.throws(() => readHeader(''));
  assert.throws(() => readHeader('not a code!'));
}

console.log(`replay-code: ${n} daily solves round-tripped · ${(total / n).toFixed(0)} actions avg · ${(bytes / n).toFixed(0)} bytes avg · longest code ${maxChars} chars`);
