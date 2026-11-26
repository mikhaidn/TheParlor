import { boot, P, getSettings } from './boot.js';
import { mountGame } from './table.js';
import { randomDeal } from './engine.js';
import { read, write, formatTime, recordStats, markPlayed, persist } from './store.js';

await boot('../');

const params = new URLSearchParams(location.search);
if (params.get('deal') === 'daily') location.replace('../daily/#play');

const rulesId = P.defs.get(params.get('rules') || '') ? params.get('rules') : 'parlor.rules.freecell';
const isClassic = rulesId === 'parlor.rules.freecell';
const storageKey = isClassic ? 'parlor.game.freecell' : 'parlor.game.' + rulesId;
const statsKey = 'parlor.stats.' + (isClassic ? 'freecell' : rulesId);
const lastKey = 'parlor.lastDeal.' + rulesId;
const name = P.defs.get(rulesId).name;

function pickDeal() {
  const mode = getSettings().freecell.deal;
  if (mode === 'ascending') return Math.min(32000, (read(lastKey, 0) || 0) + 1);
  return randomDeal();
}

const asked = parseInt(params.get('deal'), 10);
const saved = read(storageKey);
const firstDeal = asked > 0 ? asked : (saved && saved.moves?.length && !saved.won ? saved.deal : pickDeal());

function setUrl(deal) {
  const u = new URL(location.href);
  u.searchParams.set('deal', deal);
  history.replaceState(null, '', u);
}

const host = document.getElementById('game');
const ctl = mountGame(host, {
  rulesId, deal: firstDeal, title: name, storageKey,
  onStart: () => markPlayed(statsKey),
  onWin: showWin,
  onNewGame: () => newGame(true),
  menu: () => [
    { label: 'New game', onClick: () => newGame(), primary: true },
    { label: 'Restart this deal', onClick: () => confirmLeave(() => ctl.restart()) },
    { label: 'Choose deal number…', onClick: chooseDeal },
    { label: 'All games', onClick: () => confirmLeave(() => { location.href = '../'; }, true) },
  ],
});
write(lastKey, firstDeal);
setUrl(firstDeal);

function start(deal) {
  write(lastKey, deal);
  ctl.newDeal(deal);
  setUrl(deal);
}

function confirmLeave(then, keep) {
  // Leaving to the launcher keeps the game saved, so no confirmation is needed.
  if (keep || !ctl.inProgress || !getSettings().play.confirmNewGame) return then();
  let close;
  close = P.openSheet(P.Sheet({
    title: 'Leave this game?',
    children: [Object.assign(document.createElement('p'), { className: 'pl-p', textContent: 'This deal will count as a loss.' })],
    footer: [
      P.Button({ label: 'Leave', variant: 'primary', onClick: () => { close(); recordStats(statsKey, { won: false }); then(); } }),
      P.Button({ label: 'Keep playing', onClick: () => close() }),
    ],
    onClose: () => close(),
  }));
}

function newGame(skipConfirm) {
  if (skipConfirm) { if (ctl.inProgress) recordStats(statsKey, { won: false }); return start(pickDeal()); }
  confirmLeave(() => start(pickDeal()));
}

function chooseDeal() {
  let close;
  const input = Object.assign(document.createElement('input'), { type: 'number', min: 1, max: 1000000, inputMode: 'numeric', value: ctl.deal, className: 'pa-input' });
  input.setAttribute('aria-label', 'Deal number');
  Object.assign(input.style, { width: '100%', minHeight: '44px', font: '600 18px var(--font-ui)', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' });
  const go = () => { const n = parseInt(input.value, 10); if (n > 0) { close(); confirmLeave(() => start(n)); } };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  close = P.openSheet(P.Sheet({
    title: 'Choose a deal',
    children: [Object.assign(document.createElement('p'), { className: 'pl-p', textContent: 'Classic FreeCell numbering: Deal #617 is the same layout everywhere.' }), input],
    footer: [P.Button({ label: 'Deal', variant: 'primary', onClick: go })],
    onClose: () => close(),
  }));
  input.select();
}

function showWin(result) {
  const s = recordStats(statsKey, { won: true, time: result.time });
  persist();
  let close;
  close = P.openSheet(P.WinDialog({
    deal: result.deal,
    time: formatTime(result.time),
    moves: result.moves,
    newBest: s.newBest && s.won > 1,
    best: formatTime(s.best),
    streak: s.streak,
    winRate: Math.round((100 * s.won) / Math.max(s.played, s.won)) + '%',
    onDealAgain: () => { close(); start(pickDeal()); },
    onReplay: () => { close(); ctl.restart(); },
    onHome: () => { location.href = '../'; },
  }));
}
