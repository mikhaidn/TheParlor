// Parlor Daily — three views in one page, switched by the URL hash:
//   #        Today   (design/daily/Main.dc.html)
//   #play    the table for today's deal
//   #solved  Solved  (design/daily/Result.dc.html), with the share card (Share.dc.html)
//   #replay  practice on today's deal; never changes the recorded result

import { boot, P } from './boot.js';
import { mountGame, toast } from './table.js';
import { read, formatTime, persist } from './store.js';
import { track } from './analytics.js';
import { dailyNumber, dateOf, dealFor, formatDate, msUntilNextDaily, records, markStarted, saveResult, summary, shareText, shareLink, SHARE_FORMAT, SHARE_CAPTION } from './daily.js';
import { copyText, canShareNatively, shareTextNatively, saveImage } from './share.js';

/** Set to a Stripe Payment Link (or similar) to show "Tip the table". */
const TIP_URL = null;

await boot('../');

const view = document.getElementById('view');
let game = null, n = dailyNumber(), deal = dealFor(n), countdown = null;

const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter((x) => x != null && x !== false));
  return e;
};
const svgIcon = (d) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '20'); s.setAttribute('height', '20'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.75'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; };
const nextIn = () => { const m = Math.ceil(msUntilNextDaily() / 60000); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const longDate = () => formatDate(dateOf(n));
const shortDay = (d) => d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
const gameKey = 'parlor.daily.game';

function teardown() {
  if (game) { game.destroy(); game = null; }
  clearInterval(countdown); countdown = null;
  document.body.classList.remove('on-felt');
  view.replaceChildren();
}

function route() {
  const rolled = dailyNumber();
  if (rolled !== n) { n = rolled; deal = dealFor(n); }
  const hash = location.hash.replace('#', '');
  teardown();
  const solved = records().results[n]?.solved;
  if (hash === 'play' && !solved) return play(false);
  if (hash === 'replay') return play(true);
  if ((hash === 'solved' || hash === 'play') && solved) return result();
  return today();
}

// ---------- Today ----------
function today() {
  const s = summary(n);
  const inProgress = (() => { const g = read(gameKey); return g && g.deal === deal && g.moves?.length && !g.won; })();
  const label = `Daily #${n} · ${formatDate(dateOf(n), { weekday: 'long', month: 'short', day: 'numeric' })}`;
  const fan = h('div', { class: 'pd-fan', 'aria-hidden': 'true' },
    P.PlayingCard({ faceDown: true }), P.PlayingCard({ rank: 'Q', suit: 'hearts' }), P.PlayingCard({ rank: 'A', suit: 'spades' }));

  const cta = s.today
    ? h('div', { class: 'pd-done' },
        h('span', {}, `Solved in ${formatTime(s.today.time)} · ${s.today.moves} moves`),
        h('a', { class: 'pa-btn pa-btn-felt', href: '#solved' }, 'See result'))
    : h('a', { class: 'pa-btn pa-btn-primary', href: '#play' }, inProgress ? 'Continue today’s deal' : 'Play today’s deal');

  const next = s.today ? h('p', { class: 'pd-next' }, `Next deal in ${nextIn()}`) : null;

  view.append(h('main', { class: 'pa-page pd-today' },
    h('header', { class: 'pa-head' },
      h('a', { class: 'pa-brand', href: '../', 'aria-label': 'Parlor — all games' }, h('span', { class: 'pa-suite-title' }, 'Parlor')),
      h('a', { class: 'pa-icon-link', href: '../' }, 'All games')),
    h('section', { class: 'pd-hero', 'aria-labelledby': 'pd-title' },
      h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
        h('div', { class: 'pa-label' }, label),
        h('h1', { id: 'pd-title' }, 'Today’s deal'),
        h('p', {}, `FreeCell · Deal #${deal}`)),
      fan, cta, next),
    h('div', { class: 'pd-stats' },
      stat('Streak', s.streak === 1 ? '1 day' : `${s.streak} days`),
      stat('Solved', s.played ? `${s.solved} of ${s.played}` : '—'),
      stat('Best', s.best == null ? '—' : formatTime(s.best))),
    h('section', { class: 'pd-card', 'aria-labelledby': 'pd-week' },
      h('h2', { id: 'pd-week' }, 'This week'),
      h('div', { class: 'pd-week' }, s.week.map((d) => h('div', { class: 'pd-day', 'data-state': d.state, title: `${formatDate(d.date)} — ${d.state === 'today' ? 'today' : d.state}` },
        h('i', {}), h('span', {}, shortDay(d.date)))))),
    TIP_URL ? h('footer', { class: 'pa-foot' },
      h('a', { class: 'pa-btn pa-btn-outline', href: TIP_URL, target: '_blank', rel: 'noopener', onclick: () => track('tip_start', {}) }, 'Tip the table')) : null));

  if (next) countdown = setInterval(() => { next.textContent = `Next deal in ${nextIn()}`; if (dailyNumber() !== n) route(); }, 30000);
}

function stat(label, value) {
  return h('div', { class: 'pd-stat' }, h('div', { class: 'pa-label' }, label), h('div', { class: 'pd-stat-value' }, value));
}

// ---------- Play ----------
function play(practice) {
  document.body.classList.add('on-felt');
  const host = h('main', { 'aria-label': 'FreeCell table' });
  view.append(host);
  game = mountGame(host, {
    rulesId: 'parlor.rules.freecell',
    deal,
    title: 'FreeCell',
    dealLabel: practice ? `Daily #${n} · practice` : `Daily #${n}`,
    storageKey: practice ? 'parlor.daily.replay' : gameKey,
    resume: !practice,
    onStart: () => {
      if (practice) return;
      markStarted(n);
      track('deal_start', { daily_no: n, deal_no: deal });
    },
    onWin: (res) => {
      if (practice) { toast(`Solved in ${formatTime(res.time)} · ${res.moves} moves. Today’s result stays as it was.`); return; }
      saveResult(n, res);
      persist();
      track('deal_solve', { daily_no: n, time_s: Math.round(res.time / 1000), moves: res.moves, undos: res.undos });
      location.hash = 'solved';
    },
    newGameLabel: 'Back to today',
    onNewGame: () => { location.hash = ''; },
    menu: () => [{ label: 'Back to today', primary: true, onClick: () => {
      if (!practice && game?.inProgress) track('deal_quit', { daily_no: n, moves: game.moves, reason: 'left' });
      location.hash = '';
    } }],
  });
}

// ---------- Solved ----------
function result() {
  document.body.classList.add('on-felt');
  const s = summary(n);
  const rec = s.today;
  const isBest = s.best != null && rec.time <= s.best && Object.keys(records().results).length > 1;

  const rows = ['spades', 'hearts', 'diamonds', 'clubs'].map((suit) =>
    h('div', { class: 'pd-row' }, P.Suit({ suit, size: 16, label: suit }), h('div', { class: 'pd-cells' }, rec.grid[suit].map((q) => h('i', { 'data-q': q })))));

  const note = h('div', { class: 'pd-muted' }, `Next deal in ${nextIn()}`);
  const shareBtn = h('button', { class: 'pa-btn pa-btn-primary', type: 'button', onclick: () => openShare(rec, s.streak) },
    svgIcon('M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'), 'Share result');

  view.append(h('div', { class: 'pd-result' },
    h('div', { class: 'pd-result-bar' },
      h('div', {}, h('b', {}, 'FreeCell '), h('span', {}, `· Daily #${n}`)),
      h('a', { class: 'pd-x', href: '#', 'aria-label': 'Back to today' }, svgIcon('M6 6l12 12M18 6L6 18'))),
    h('main', { class: 'pd-result-body' },
      h('div', { class: 'pd-headline' }, h('h1', {}, 'Solved!'), h('p', {}, `Deal #${deal} · ${longDate()}`)),
      h('div', { class: 'pd-trio' },
        h('div', {}, h('span', { class: 'pa-label' }, 'Time'), h('b', {}, formatTime(rec.time))),
        h('div', {}, h('span', { class: 'pa-label' }, 'Moves'), h('b', {}, String(rec.moves))),
        h('div', {}, h('span', { class: 'pa-label' }, 'Undos'), h('b', {}, String(rec.undos)))),
      isBest || s.streak > 1 ? h('div', { class: 'pd-best' },
        isBest ? h('span', { class: 'pd-chip' }, 'New best') : null,
        s.streak > 1 ? `${s.streak}-day streak` : null) : null,
      h('section', { class: 'pd-gridcard', 'aria-label': 'Share grid' },
        h('header', {}, h('b', {}, `Parlor Daily #${n}`), h('span', {}, `${formatTime(rec.time)} · ${rec.moves} moves`)),
        h('div', { class: 'pd-rows' }, rows),
        h('p', {}, 'Ace to king, shaded by when each card went home.')),
      h('div', { class: 'pd-actions' },
        shareBtn,
        h('a', { class: 'pa-btn pa-btn-felt', href: '#replay' }, 'Replay this deal'),
        note))));
  countdown = setInterval(() => { note.textContent = `Next deal in ${nextIn()}`; }, 30000);
}

// ---------- Share sheet (design/daily/CopyShare.dc.html) ----------
function openShare(rec, streak) {
  const link = shareLink(new URL('./?ref=share', location.href).href);
  const text = shareText(n, rec, link, SHARE_FORMAT);
  const ICON_COPY = 'M9 9h10v10H9zM5 15V5h10', ICON_DONE = 'M5 12.5l4.5 4.5L19 7.5';
  const label = h('span', {}, 'Copy text');
  const icon = svgIcon(ICON_COPY);
  let close;

  const copyBtn = h('button', { class: 'pa-btn pa-btn-primary', type: 'button', onclick: async () => {
    const ok = await copyText(text);
    if (!ok) { toast('Couldn’t copy here. Select the text and copy it.'); return; }
    track('share_tap', { daily_no: n, method: 'copy' });
    label.textContent = 'Copied';
    icon.replaceWith(svgIcon(ICON_DONE));
    setTimeout(() => close(), 900);
  } }, icon, label);

  const native = canShareNatively() ? h('button', { class: 'pa-btn pa-btn-outline', type: 'button', onclick: async () => {
    const how = await shareTextNatively(text);
    if (how === 'shared') { track('share_tap', { daily_no: n, method: 'share' }); close(); }
  } }, svgIcon('M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'), 'Share…') : null;

  const image = h('button', { class: 'pa-btn pa-btn-outline', type: 'button', onclick: async () => {
    const how = await saveImage({ n, rec, streak, dateLabel: longDate(), link });
    if (how === 'shared' || how === 'downloaded') track('share_tap', { daily_no: n, method: 'image' });
    if (how === 'downloaded') toast('Share card saved.');
  } }, svgIcon('M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5'), 'Save image');

  const preview = h('div', { class: 'pd-share-preview', tabindex: '0', 'aria-label': 'Text that will be copied' }, text);
  const sheet = P.Sheet({
    title: 'Share result',
    className: 'pd-share',
    children: [preview, SHARE_CAPTION[SHARE_FORMAT] ? h('p', { class: 'pl-caption pd-share-caption' }, SHARE_CAPTION[SHARE_FORMAT]) : null, copyBtn,
      h('div', { class: 'pd-share-row' + (native ? '' : ' is-single') }, native, image)],
    onClose: () => close(),
  });
  close = P.openSheet(sheet);
}

addEventListener('hashchange', route);
addEventListener('parlor:stats-changed', () => { if (!game) route(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && dailyNumber() !== n && !game?.inProgress) route();
});
route();
