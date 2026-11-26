import { boot, P } from './boot.js';
import { onPWAChange, promptInstall, applyUpdate } from './pwa.js';
import { openSettings } from './table.js';
import { read, write, formatTime } from './store.js';
import { dailyNumber, summary } from './daily.js';
import { t } from './strings.js';

await boot('./');

const go = (href) => () => { location.href = href; };

function renderTiles() {
  const today = dailyNumber();
  const sum = summary(today);
  const fc = read('parlor.stats.freecell', null);
  const saved = read('parlor.game.freecell', null);

  document.getElementById('today').replaceChildren(
    P.GameTile({
      game: 'freecell', title: t('launcher.dailyTitle'),
      meta: t('launcher.dailyMeta', { n: today, status: sum.today ? t('launcher.dailySolved', { time: formatTime(sum.today.time) }) : sum.streak ? t('launcher.dailyStreak', { count: sum.streak }) : t('launcher.dailyNew') }),
      badge: sum.today ? t('launcher.badgeDone') : t('launcher.badgeNew'),
      onClick: go('daily/'),
    }),
  );

  const games = [
    { game: 'freecell', meta: saved && saved.moves?.length && !saved.won ? t('launcher.freecellResume', { deal: saved.deal }) : fc?.won ? t('launcher.freecellStats', { won: fc.won, best: formatTime(fc.best) }) : t('launcher.freecellMeta'), href: 'freecell/' },
    { game: 'freecell', title: t('launcher.bakersTitle'), meta: t('launcher.bakersMeta'), href: 'freecell/?rules=parlor.rules.bakers-game' },
    { game: 'klondike', meta: t('common.comingSoon') },
    { game: 'spider', meta: t('common.comingSoon') },
    { game: 'pyramid', meta: t('common.comingSoon') },
    { game: 'tripeaks', meta: t('common.comingSoon') },
    { game: 'hearts', meta: t('common.comingSoon') },
  ];
  const grid = document.getElementById('games');
  grid.replaceChildren();
  for (const g of games) {
    const tile = P.GameTile({ game: g.game, title: g.title, meta: g.meta, onClick: g.href ? go(g.href) : undefined });
    if (!g.href) { tile.setAttribute('aria-disabled', 'true'); tile.tabIndex = -1; }
    grid.append(tile);
  }
}
renderTiles();
addEventListener('parlor:stats-changed', renderTiles);

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

fetch('version.json').then((r) => r.ok ? r.json() : null).then((v) => { if (v) document.getElementById('version').textContent = t('launcher.build', { build: v.build }); }).catch(() => {});
