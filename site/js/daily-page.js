// Parlor Daily — one page, views switched by the URL hash:
//   #            Today            (design/daily/Main.dc.html)
//   #play        today's table
//   #solved      Solved           (design/daily/Result.dc.html) for today
//   #stats[=N]   Stats & calendar (design/daily/Calendar.dc.html), day N selected
//   #day=N       Solved screen for a past day
//   #play=N      play a past day's deal (a late solve: counts toward Solved, not the streak)
//   #replay[=N]  practice a deal ("Play again"); never changes a recorded result
//   #r=CODE      a shared replay (site/js/replay-view.js): locked until you've solved that Daily
// All text comes from copy/en.json via t().

import { boot, P } from './boot.js';
import { mountGame, toast } from './table.js';
import { read, formatTime, persist } from './store.js';
import { track } from './analytics.js';
import { t, tp, dsText } from './strings.js';
import { dailyNumber, dateOf, dealFor, formatDate, msUntilNextDaily, records, markStarted, saveResult, summary, dayStatus, shareText, shareLink, shareCaption, SHARE_FORMAT } from './daily.js';
import { copyText, canShareNatively, shareTextNatively, saveImage, qrSvg } from './share.js';
import { mountReplay, takeStartLog } from './replay-view.js';
import { read as readStore, write as writeStore } from './store.js';

/** Set to a Stripe Payment Link (or similar) to show "Tip the table". */
const TIP_URL = null;
const TODAY_KEY = 'parlor.daily.game', PAST_KEY = 'parlor.daily.past', PRACTICE_KEY = 'parlor.daily.replay';

await boot('../');

const view = document.getElementById('view');
let game = null, today = dailyNumber(), countdown = null;
const cal = { sel: null, y: null, m: null };

// ---------- helpers ----------
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
const NS = 'http://www.w3.org/2000/svg';
const svgIcon = (d, size = 20) => {
  const s = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) s.setAttribute(k, v);
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.append(p);
  return s;
};
const ICON = {
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  back: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  share: 'M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  done: 'M5 12.5l4.5 4.5L19 7.5',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5',
};
const nextIn = () => { const m = Math.ceil(msUntilNextDaily() / 60000); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const longDate = (n) => formatDate(dateOf(n));
const shortDay = (d) => d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
const stat = (label, value) => h('div', { class: 'pd-stat' }, h('div', { class: 'pa-label' }, label), h('div', { class: 'pd-stat-value' }, value));

function teardown() {
  if (game) { game.destroy(); game = null; }
  clearInterval(countdown); countdown = null;
  document.body.classList.remove('on-felt');
  view.replaceChildren();
}

function route() {
  today = dailyNumber();
  const [name, arg] = location.hash.replace('#', '').split('=');
  if (name === 'r') { teardown(); scrollTo(0, 0); game = mountReplay(view, arg, { today, backHref: backFromReplay(arg) }); return; }
  const n = parseInt(arg, 10);
  const solved = (k) => !!records().results[k]?.solved;
  teardown();
  scrollTo(0, 0);
  switch (name) {
    case 'play':
      if (n > 0 && n < today) return solved(n) ? result(n) : play(n, 'late');
      return solved(today) ? result(today) : play(today, 'today');
    case 'replay': return play(n > 0 && n <= today ? n : today, 'practice');
    case 'solved': return solved(today) ? result(today) : todayView();
    case 'day': return n > 0 && solved(n) ? result(n) : calendar(n);
    case 'stats': return calendar(n);
    default: return todayView();
  }
}

/** Where a replay's Back goes: your own result if it's your replay, else Today. */
function backFromReplay(code) {
  const r = records();
  for (const [n, rec] of Object.entries(r.results)) if (rec.code && rec.code === code) return +n === today ? '#solved' : `#day=${n}`;
  return '#';
}

// ---------- Today ----------
function todayView() {
  const s = summary(today);
  const deal = dealFor(today);
  const inProgress = (() => { const g = read(TODAY_KEY); return g && g.deal === deal && g.moves?.length && !g.won; })();
  const fan = h('div', { class: 'pd-fan', 'aria-hidden': 'true' },
    P.PlayingCard({ faceDown: true }), P.PlayingCard({ rank: 'Q', suit: 'hearts' }), P.PlayingCard({ rank: 'A', suit: 'spades' }));

  const cta = s.today
    ? h('div', { class: 'pd-done' },
        h('span', {}, t('daily.solvedLine', { time: formatTime(s.today.time), moves: s.today.moves })),
        h('a', { class: 'pa-btn pa-btn-felt', href: '#solved' }, t('daily.seeResult')))
    : h('a', { class: 'pa-btn pa-btn-primary', href: '#play' }, inProgress ? t('daily.continue') : t('daily.play'));
  const next = s.today ? h('p', { class: 'pd-next' }, t('common.nextDealIn', { time: nextIn() })) : null;

  view.append(h('main', { class: 'pa-page pd-today' },
    h('header', { class: 'pa-head' },
      h('a', { class: 'pa-brand', href: '../', 'aria-label': t('common.allGames') }, h('span', { class: 'pa-suite-title' }, t('pages.brand'))),
      h('a', { class: 'pa-icon-link', href: '#stats' }, svgIcon(ICON.stats), t('daily.stats'))),
    h('section', { class: 'pd-hero', 'aria-labelledby': 'pd-title' },
      h('div', { class: 'pd-hero-text' },
        h('div', { class: 'pa-label' }, t('daily.label', { n: today, date: longDate(today) })),
        h('h1', { id: 'pd-title' }, t('daily.title')),
        h('p', {}, t('daily.subtitle', { deal }))),
      fan, cta, next),
    h('div', { class: 'pd-stats' },
      stat(t('daily.streak'), tp('daily.days', s.streak)),
      stat(t('daily.solved'), s.played ? t('daily.solvedOf', { solved: s.solved, played: s.played }) : '—'),
      stat(t('daily.best'), s.best == null ? '—' : formatTime(s.best))),
    h('a', { class: 'pd-card pd-week-card', href: '#stats', 'aria-labelledby': 'pd-week' },
      h('h2', { id: 'pd-week' }, t('daily.thisWeek')),
      h('div', { class: 'pd-week' }, s.week.map((d) => h('div', { class: 'pd-day', 'data-state': d.state, title: `${formatDate(d.date)} — ${t('calendar.state.' + dayStatus(d.n, today))}` },
        h('i', {}), h('span', {}, shortDay(d.date)))))),
    TIP_URL ? h('footer', { class: 'pa-foot' },
      h('a', { class: 'pa-btn pa-btn-outline', href: TIP_URL, target: '_blank', rel: 'noopener', onclick: () => track('tip_start', {}) }, t('daily.tip'))) : null));

  if (next) countdown = setInterval(() => { next.textContent = t('common.nextDealIn', { time: nextIn() }); if (dailyNumber() !== today) route(); }, 30000);
}

// ---------- Play ----------
function play(n, mode) {
  document.body.classList.add('on-felt');
  const deal = dealFor(n);
  const host = h('main', { 'aria-label': t('common.freecell') });
  view.append(host);
  const back = mode === 'today' ? '' : mode === 'late' ? `stats=${n}` : n === today ? 'solved' : `day=${n}`;
  const backLabel = mode === 'today' || (mode === 'practice' && n === today) ? t('daily.backToToday') : t('daily.backToStats');
  const startLog = mode === 'practice' ? takeStartLog(n) : null;
  game = mountGame(host, {
    rulesId: 'parlor.rules.freecell',
    deal,
    daily: n,
    restartInMenu: true,
    startLog,
    title: t('common.freecell'),
    dealLabel: t(startLog ? 'replay.practiceBar' : mode === 'practice' ? 'daily.barPractice' : mode === 'late' ? 'daily.barLate' : 'daily.barDeal', { n }),
    storageKey: mode === 'today' ? TODAY_KEY : mode === 'late' ? PAST_KEY : PRACTICE_KEY,
    resume: mode !== 'practice',
    onStart: () => {
      if (mode === 'practice') return;
      markStarted(n);
      track('deal_start', { daily_no: n, deal_no: deal, late: mode === 'late' });
    },
    onWin: (res) => {
      if (mode === 'practice') { toast(t('daily.practiceSolved', { time: formatTime(res.time), moves: res.moves })); return; }
      saveResult(n, res, { late: mode === 'late' });
      persist();
      track('deal_solve', { daily_no: n, time_s: Math.round(res.time / 1000), moves: res.moves, undos: res.undos, late: mode === 'late' });
      location.hash = mode === 'today' ? 'solved' : `day=${n}`;
    },
    newGameLabel: backLabel,
    onNewGame: () => { location.hash = back; },
    menu: () => [{ label: backLabel, primary: true, onClick: () => {
      if (mode !== 'practice' && game?.inProgress) track('deal_quit', { daily_no: n, moves: game.moves, reason: 'left' });
      location.hash = back;
    } }],
  });
}

// ---------- Solved ----------
function gridRows(rec, size) {
  return ['spades', 'hearts', 'diamonds', 'clubs'].map((suit) =>
    h('div', { class: 'pd-row' }, P.Suit({ suit, size, label: dsText(suit) }), h('div', { class: 'pd-cells' }, rec.grid[suit].map((q) => h('i', { 'data-q': q })))));
}

function result(n) {
  document.body.classList.add('on-felt');
  const s = summary(today);
  const rec = records().results[n];
  const isBest = s.best != null && rec.time <= s.best && Object.keys(records().results).length > 1;
  const isToday = n === today;
  const backLabel = isToday ? t('daily.backToToday') : t('daily.backToStats');
  const note = isToday ? h('div', { class: 'pd-muted' }, t('common.nextDealIn', { time: nextIn() })) : null;
  const streakLine = isToday && s.streak > 1 ? t('daily.streakLine', { count: s.streak }) : null;
  const badge = rec.watched ? h('div', { class: 'pd-best' }, t('calendar.watchedNote'))
    : rec.late ? h('div', { class: 'pd-best' }, t('daily.lateLine'))
    : isBest || streakLine ? h('div', { class: 'pd-best' }, isBest ? h('span', { class: 'pd-chip' }, t('daily.newBest')) : null, streakLine) : null;

  view.append(h('div', { class: 'pd-result' },
    h('div', { class: 'pd-result-bar' },
      h('div', {}, h('b', {}, t('common.freecell') + ' '), h('span', {}, '· ' + t('daily.barDeal', { n }))),
      h('a', { class: 'pd-x', href: isToday ? '#' : `#stats=${n}`, 'aria-label': backLabel }, svgIcon(ICON.close))),
    h('main', { class: 'pd-result-body' },
      h('div', { class: 'pd-headline' }, h('h1', {}, t('daily.solvedTitle')), h('p', {}, t('daily.solvedSub', { deal: dealFor(n), date: longDate(n) }))),
      h('div', { class: 'pd-trio' },
        h('div', {}, h('span', { class: 'pa-label' }, t('common.time')), h('b', {}, formatTime(rec.time))),
        h('div', {}, h('span', { class: 'pa-label' }, t('common.moves')), h('b', {}, String(rec.moves))),
        h('div', {}, h('span', { class: 'pa-label' }, t('common.undos')), h('b', {}, String(rec.undos)))),
      badge,
      h('section', { class: 'pd-gridcard', 'aria-label': t('daily.gridTitle', { n }) },
        h('header', {}, h('b', {}, t('daily.gridTitle', { n })), h('span', {}, `${formatTime(rec.time)} · ${rec.moves}`)),
        h('div', { class: 'pd-rows' }, gridRows(rec, 16)),
        h('p', {}, t('daily.gridCaption'))),
      h('div', { class: 'pd-actions' },
        h('button', { class: 'pa-btn pa-btn-primary', type: 'button', onclick: () => openShare(n, rec, s.streak) }, svgIcon(ICON.share), t('daily.share')),
        rec.code ? h('a', { class: 'pa-btn pa-btn-felt', href: `#r=${rec.code}` }, t('daily.watchReplay')) : null,
        h('a', { class: 'pa-btn pa-btn-felt', href: isToday ? '#replay' : `#replay=${n}` }, t('daily.replay')),
        note))));
  if (note) countdown = setInterval(() => { note.textContent = t('common.nextDealIn', { time: nextIn() }); }, 30000);
}

// ---------- Stats & calendar (design/daily/Calendar.dc.html) ----------
const FIRST = dateOf(1);

function calendar(selN) {
  if (selN > 0 && selN <= today) cal.sel = selN;
  if (!(cal.sel > 0 && cal.sel <= today)) cal.sel = today;
  if (cal.y == null || selN > 0) { const d = dateOf(cal.sel); cal.y = d.getFullYear(); cal.m = d.getMonth(); }
  renderCalendar();
}

function renderCalendar() {
  const r = records();
  const s = summary(today);
  const { y, m } = cal;
  const last = dateOf(today);
  const atFirst = y === FIRST.getFullYear() && m === FIRST.getMonth();
  const atLast = y === last.getFullYear() && m === last.getMonth();
  const step = (d) => { const x = new Date(y, m + d, 1); cal.y = x.getFullYear(); cal.m = x.getMonth(); renderCalendar(); };
  const nOf = (d) => Math.round((Date.UTC(y, m, d) - Date.UTC(FIRST.getFullYear(), FIRST.getMonth(), FIRST.getDate())) / 86400000) + 1;

  const cells = [];
  for (let i = 0; i < new Date(y, m, 1).getDay(); i++) cells.push(h('div', { class: 'pd-cal-blank' }));
  for (let d = 1, days = new Date(y, m + 1, 0).getDate(); d <= days; d++) {
    const n = nOf(d), st = dayStatus(n, today, r);
    cells.push(h('button', {
      type: 'button', class: 'pd-cal-day', 'data-state': st,
      'aria-pressed': n === cal.sel ? 'true' : 'false', disabled: st === 'future' || st === 'before',
      'aria-label': `${new Date(y, m, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}, ${t('calendar.state.' + st)}`,
      onclick: () => { cal.sel = n; history.replaceState(null, '', `#stats=${n}`); renderCalendar(); },
    }, String(d)));
  }
  const weekdays = Array.from({ length: 7 }, (_, i) => shortDay(new Date(2026, 10, 22 + i))); // Nov 22 2026 is a Sunday

  const focused = document.activeElement?.getAttribute?.('aria-label');
  view.replaceChildren(h('main', { class: 'pa-page pd-cal' },
    h('header', { class: 'pa-head' }, h('a', { class: 'pa-icon-link pd-back', href: '#' }, svgIcon(ICON.back), t('common.today'))),
    h('h1', { class: 'pd-cal-title' }, t('calendar.title')),
    h('div', { class: 'pd-stats pd-stats-4' },
      stat(t('calendar.streak'), String(s.streak)),
      stat(t('calendar.longest'), String(s.longest)),
      stat(t('calendar.solved'), t('calendar.solvedOf', { solved: s.solved, played: s.played })),
      stat(t('calendar.fastest'), s.best == null ? '—' : formatTime(s.best))),
    h('section', { class: 'pd-card pd-month', 'aria-labelledby': 'pd-month-h' },
      h('div', { class: 'pd-month-head' },
        h('h2', { id: 'pd-month-h' }, new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })),
        h('div', { class: 'pd-month-nav' },
          h('button', { type: 'button', class: 'pd-icon-btn', 'aria-label': t('calendar.prev'), disabled: atFirst, onclick: () => step(-1) }, svgIcon(ICON.back)),
          h('button', { type: 'button', class: 'pd-icon-btn', 'aria-label': t('calendar.next'), disabled: atLast, onclick: () => step(1) }, svgIcon(ICON.next)))),
      h('div', { class: 'pd-cal-grid pd-cal-dow', 'aria-hidden': 'true' }, weekdays.map((w) => h('div', {}, w))),
      h('div', { class: 'pd-cal-grid' }, cells),
      h('div', { class: 'pd-legend' }, ['solved', 'missed', 'none', 'watched', 'today'].map((k) => h('div', {}, h('span', { 'data-state': k }), t('calendar.legend.' + k))))),
    dayDetail(cal.sel, r)));
  if (focused) view.querySelector(`[aria-label="${CSS.escape(focused)}"]`)?.focus();
}

function dayDetail(n, r) {
  const st = dayStatus(n, today, r);
  const rec = r.results[n];
  const deal = dealFor(n);
  const chip = st === 'solved' && rec.watched ? 'watched' : st === 'solved' && rec.late ? 'late' : st;
  const g = read(n === today ? TODAY_KEY : PAST_KEY);
  const inProgress = g && g.deal === deal && g.moves?.length && !g.won;
  const kids = [h('div', { class: 'pd-detail-head' },
    h('div', {},
      h('div', { class: 'pd-detail-date' }, dateOf(n).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })),
      h('div', { class: 'pd-detail-sub' }, st === 'solved'
        ? t('calendar.solvedSub', { n, time: formatTime(rec.time), moves: rec.moves, undos: rec.undos })
        : t('calendar.sub', { n, deal }))),
    h('span', { class: 'pd-detail-chip', 'data-state': chip }, t('calendar.chip.' + chip)))];
  if (st === 'solved') {
    kids.push(h('div', { class: 'pd-rows pd-rows-mini' }, gridRows(rec, 14)));
    kids.push(h('div', { class: 'pd-detail-actions' },
      h('a', { class: 'pa-btn pa-btn-outline', href: n === today ? '#solved' : `#day=${n}` }, t('calendar.seeResult')),
      h('a', { class: 'pa-btn pa-btn-outline', href: n === today ? '#replay' : `#replay=${n}` }, t('calendar.replay'))));
  } else if (st === 'today' || (st === 'watched' && n === today)) {
    kids.push(h('p', { class: 'pd-detail-note' }, t(st === 'watched' ? 'calendar.watchedNote' : 'calendar.todayNote')));
    kids.push(h('a', { class: 'pa-btn pa-btn-primary', href: '#play' }, inProgress ? t('daily.continue') : t('calendar.todayPlay')));
  } else {
    kids.push(h('p', { class: 'pd-detail-note' }, t(st === 'missed' ? 'calendar.missedNote' : st === 'watched' ? 'calendar.watchedNote' : 'calendar.noneNote')));
    kids.push(h('a', { class: 'pa-btn pa-btn-primary', href: `#play=${n}` }, inProgress ? t('calendar.continue') : t('calendar.play')));
    kids.push(h('p', { class: 'pd-detail-rule' }, t('calendar.lateRule')));
  }
  return h('section', { class: 'pd-card pd-detail', 'aria-live': 'polite' }, kids);
}

// ---------- Share sheet (design/daily/CopyShare.dc.html) ----------
const REPLAY_PREF = 'parlor.share.replay';

function openShare(n, rec, streak) {
  const link = shareLink(new URL('./?ref=share', location.href).href);
  const baseText = shareText(n, rec, link, SHARE_FORMAT);
  // The replay link is opt-in and remembered. It shows the solve, so it's locked for anyone
  // who hasn't solved that Daily (site/js/replay-view.js).
  const replayUrl = rec.code ? new URL(`./?ref=replay#r=${rec.code}`, location.href).href : null;
  let withReplay = !!replayUrl && readStore(REPLAY_PREF, false) === true;
  let text = baseText;
  const preview = h('div', { class: 'pd-share-preview', tabindex: '0', 'aria-label': t('share.previewLabel') });
  const qrBox = h('div', { class: 'pd-share-qr' });
  const setText = () => {
    text = withReplay ? baseText + '\n' + t('share.text.replayLine', { link: shareLink(replayUrl) }) : baseText;
    preview.textContent = text;
    qrBox.hidden = !withReplay;
  };
  const label = h('span', {}, t('share.copy'));
  const icon = svgIcon(ICON.copy);
  let close;

  const copyBtn = h('button', { class: 'pa-btn pa-btn-primary', type: 'button', onclick: async () => {
    if (!(await copyText(text))) { toast(t('share.copyFailed')); return; }
    track('share_tap', { daily_no: n, method: 'copy' });
    label.textContent = t('share.copied');
    icon.replaceWith(svgIcon(ICON.done));
    setTimeout(() => close(), 900);
  } }, icon, label);

  const native = canShareNatively() ? h('button', { class: 'pa-btn pa-btn-outline', type: 'button', onclick: async () => {
    if ((await shareTextNatively(text)) === 'shared') { track('share_tap', { daily_no: n, method: 'share' }); close(); }
  } }, svgIcon(ICON.share), t('share.native')) : null;

  const image = h('button', { class: 'pa-btn pa-btn-outline', type: 'button', onclick: async () => {
    const how = await saveImage({ n, rec, streak, dateLabel: longDate(n), link });
    if (how === 'shared' || how === 'downloaded') track('share_tap', { daily_no: n, method: 'image' });
    if (how === 'downloaded') toast(t('share.imageSaved'));
  } }, svgIcon(ICON.image), t('share.image'));

  let replayRow = null;
  if (replayUrl) {
    const labelId = 'pd-share-replay-label';
    replayRow = h('div', { class: 'pd-share-toggle' },
      h('div', { class: 'pd-share-toggle-text' },
        h('span', { id: labelId, class: 'pd-share-toggle-label' }, t('share.addReplay')),
        h('span', { class: 'pd-share-toggle-help' }, t('share.addReplayHelp'))),
      P.Toggle({ checked: withReplay, labelledBy: labelId, onChange: (v) => { withReplay = v; writeStore(REPLAY_PREF, v); setText(); } }));
    qrBox.append(
      h('div', { class: 'pd-share-qr-code' }),
      h('div', { class: 'pd-share-qr-text' },
        h('b', {}, t('share.inPerson')),
        h('span', {}, t('share.inPersonHelp')),
        h('a', { class: 'pa-btn pa-btn-outline', href: `#r=${rec.code}`, onclick: () => close() }, t('share.openReplay'))));
    qrSvg(replayUrl, t('share.qrLabel')).then((svg) => { if (svg) qrBox.firstChild.replaceChildren(svg); else qrBox.firstChild.remove(); });
  }
  setText();

  const caption = shareCaption();
  close = P.openSheet(P.Sheet({
    title: t('share.title'),
    className: 'pd-share',
    children: [
      preview,
      caption ? h('p', { class: 'pl-caption pd-share-caption' }, caption) : null,
      replayRow,
      copyBtn,
      h('div', { class: 'pd-share-row' + (native ? '' : ' is-single') }, native, image),
      replayUrl ? qrBox : null,
    ],
    onClose: () => close(),
  }));
}

addEventListener('hashchange', route);
addEventListener('parlor:stats-changed', () => { if (!game) route(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && dailyNumber() !== today && !game?.inProgress) route();
});
route();
