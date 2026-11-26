import { boot, P } from './boot.js';
import { onPWAChange, promptInstall, applyUpdate } from './pwa.js';
import { openSettings } from './table.js';
import { read, write, formatTime } from './store.js';
import { dailyNumber, summary } from './daily.js';

await boot('./');

const today = dailyNumber();
const sum = summary(today);
const fc = read('parlor.stats.freecell', null);
const saved = read('parlor.game.freecell', null);

const go = (href) => () => { location.href = href; };

document.getElementById('today').append(
  P.GameTile({
    game: 'freecell', title: 'Daily',
    meta: `Daily #${today} · ` + (sum.today ? `Solved in ${formatTime(sum.today.time)}` : sum.streak ? `${sum.streak}-day streak` : 'One deal a day'),
    badge: sum.today ? 'Done' : 'New',
    onClick: go('daily/'),
  }),
);

const games = [
  { game: 'freecell', meta: saved && saved.moves?.length && !saved.won ? `Resume Deal #${saved.deal}` : fc?.won ? `${fc.won} won · best ${formatTime(fc.best)}` : 'Classic numbered deals', href: 'freecell/' },
  { game: 'freecell', title: 'Baker’s Game', meta: 'FreeCell, built by suit', href: 'freecell/?rules=parlor.rules.bakers-game' },
  { game: 'klondike', meta: 'Coming soon' },
  { game: 'spider', meta: 'Coming soon' },
  { game: 'pyramid', meta: 'Coming soon' },
  { game: 'tripeaks', meta: 'Coming soon' },
  { game: 'hearts', meta: 'Coming soon' },
];
const grid = document.getElementById('games');
for (const g of games) {
  const tile = P.GameTile({ game: g.game, title: g.title, meta: g.meta, onClick: g.href ? go(g.href) : undefined });
  if (!g.href) { tile.setAttribute('aria-disabled', 'true'); tile.tabIndex = -1; }
  grid.append(tile);
}

document.getElementById('settings').addEventListener('click', () => openSettings());

// Install / update / iOS hint (design/system/pwa.md §3, §7) — only ever here in the launcher, never mid-game.
const install = document.getElementById('install');
install.addEventListener('click', () => promptInstall());
document.getElementById('update-btn').addEventListener('click', applyUpdate);
document.getElementById('ios-dismiss').addEventListener('click', () => { write('parlor.iosHintSeen', true); document.getElementById('ios-hint').hidden = true; });
onPWAChange((s) => {
  install.hidden = !s.canInstall || s.standalone;
  document.getElementById('update').hidden = !s.updateReady;
  document.getElementById('ios-hint').hidden = !s.iosHint || s.standalone || read('parlor.iosHintSeen', false);
});

fetch('version.json').then((r) => r.ok ? r.json() : null).then((v) => { if (v) document.getElementById('version').textContent = 'Build ' + v.build; }).catch(() => {});
