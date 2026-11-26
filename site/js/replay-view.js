// Shared replays (design: Parlor Daily canvas → "Opening a replay", "Replay viewer").
//   daily/#r=<code>
// A replay of a Daily you haven't solved is locked: you see their result with the cards face
// down. Solve it first, or watch anyway, which means that day can't count toward your streak
// (a later solve shows as "Watched first"). Once you've solved the deal it opens straight away.

import { P, getSettings } from './boot.js';
import { createEngine, cardId } from './engine.js';
import { readHeader, decode, walk, noteOf } from './replay-code.js';
import { dailyNumber, dealFor, dateOf, formatDate, records, markWatched, summary, shareGrid } from './daily.js';
import { formatTime } from './store.js';
import { t, tp, dsText, localize } from './strings.js';

const START_KEY = 'parlor.replay.start';
const SUIT_CHAR = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const FOUNDATION_ORDER = ['spades', 'hearts', 'diamonds', 'clubs'];

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
const icon = (d, size = 22, fill = false) => {
  const s = document.createElementNS(NS, 'svg');
  const a = { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' };
  Object.assign(a, fill ? { fill: 'currentColor' } : { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  for (const [k, v] of Object.entries(a)) s.setAttribute(k, v);
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.append(p);
  return s;
};
const ICON = {
  back: 'M15 6l-6 6 6 6', next: 'M9 6l6 6-6 6', first: 'M6 5v14M18 6l-8 6 8 6z',
  play: 'M8 5l11 7-11 7z', pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', arrow: 'M5 12h14M13 6l6 6-6 6',
};

/** The log a "Play from here" practice game should start from, once. */
export function takeStartLog(n) {
  try {
    const raw = sessionStorage.getItem(START_KEY);
    sessionStorage.removeItem(START_KEY);
    const x = raw ? JSON.parse(raw) : null;
    return x && x.n === n && Array.isArray(x.log) ? x.log : null;
  } catch { return null; }
}

/** Everything the screens need from a code. Throws Error('broken' | 'mismatch'). */
export function readReplay(code, today = dailyNumber()) {
  let head;
  try { head = readHeader(code); } catch { throw new Error('broken'); }
  if (head.daily != null && (head.daily < 1 || head.daily > today)) throw new Error('broken');
  const deal = head.daily != null ? dealFor(head.daily) : head.deal;
  const engine = createEngine(P, head.rulesId);
  let out;
  try { out = decode(engine, code, deal); } catch { throw new Error('mismatch'); }
  if (!out.won) throw new Error('mismatch');

  // As played: every action. Clean line: only the moves that stuck.
  const asPlayed = [{ kind: 'start', state: engine.initial(deal) }];
  walk(engine, deal, out.log, head.mode0, (st) => {
    if (st.kind === 'mode' || st.kind === 'hint') return;
    asPlayed.push(st);
  });
  const { line } = walk(engine, deal, out.log, head.mode0);
  const clean = [{ kind: 'start', state: engine.initial(deal) }];
  const boardMoves = [];
  let s = engine.initial(deal);
  for (const { move, mode } of line) {
    const before = s, moved = engine.pile(before, move.from).slice(move.index);
    const after = engine.apply(before, move);
    boardMoves.push(move);
    s = after;
    let homes = 0;
    for (let a = engine.nextAuto(s, mode); a; a = engine.nextAuto(s, mode)) { s = engine.apply(s, a); boardMoves.push(a); homes++; }
    clean.push({ kind: 'move', move, moved, before, state: s, autoHome: homes });
  }
  const { arrivals } = engine.replay(deal, boardMoves);
  const moves = boardMoves.length;
  return { head, deal, engine, log: out.log, asPlayed, clean, moves, grid: shareGrid({ moves, arrivals }), n: head.daily };
}

/**
 * Mount the replay route into view. ctx: { today, onPlayFirst(n), backHref }
 * Returns { destroy() }.
 */
export function mountReplay(view, code, ctx) {
  const today = ctx.today;
  let data;
  try { data = readReplay(code, today); } catch (e) { return brokenView(view, e.message); }
  const n = data.n;
  const r = records();
  const mine = n != null ? r.results[n] : null;
  const solvedIt = !!mine?.solved;
  const own = solvedIt && mine.code === code;
  if (n == null || solvedIt || r.watched[n] || own) return viewer(view, data, code, ctx);
  return gate(view, data, code, ctx);
}

function squares(grid) {
  return h('div', { class: 'pr-squares', 'aria-hidden': 'true' }, FOUNDATION_ORDER.map((suit) =>
    h('div', {}, grid[suit].map((q) => h('i', { 'data-q': q })))));
}

function brokenView(view, why) {
  document.body.classList.add('on-felt');
  view.replaceChildren(h('main', { class: 'pr-gate' },
    h('a', { class: 'pr-back', href: '#' }, icon(ICON.back, 20), t('common.today')),
    h('h1', {}, t(why === 'mismatch' ? 'replay.notThisDeal' : 'replay.broken')),
    h('p', {}, t('replay.brokenHelp'))));
  return { destroy() {} };
}

// ---------- the gate ----------
function gate(view, data, code, ctx) {
  document.body.classList.add('on-felt');
  const { n } = data, isToday = n === ctx.today;
  const cols = [7, 7, 7, 7, 6, 6, 6, 6].map((k) => P.Pile({ cards: Array.from({ length: k }, () => ({ faceDown: true })), size: 34 }));
  view.replaceChildren(h('main', { class: 'pr-gate' },
    h('a', { class: 'pr-back', href: '#' }, icon(ICON.back, 20), t('common.today')),
    h('div', { class: 'pr-head' },
      h('div', { class: 'pa-label' }, isToday ? t('replay.eyebrowToday', { n }) : t('replay.eyebrowPast', { n, date: formatDate(dateOf(n), { weekday: 'short', month: 'short', day: 'numeric' }) })),
      h('h1', {}, isToday ? t('replay.headlineToday') : t('replay.headlinePast', { n })),
      h('p', {}, t('replay.theirSolve', { time: formatTime(data.head.timeMs), moves: data.moves }))),
    squares(data.grid),
    h('div', { class: 'pr-facedown', 'aria-hidden': 'true' }, cols),
    h('p', { class: 'pr-body' }, t('replay.lockedBody')),
    h('div', { class: 'pr-actions' },
      h('a', { class: 'pa-btn pa-btn-primary', href: isToday ? '#play' : `#play=${n}` }, isToday ? t('replay.solveFirst') : t('replay.playFirst', { n })),
      h('button', { class: 'pa-btn pa-btn-felt', type: 'button', onclick: () => confirmWatch(view, data, code, ctx) }, t('replay.watchWithout')),
      h('p', { class: 'pr-note' }, t('replay.linkKeeps')))));
  return { destroy() {} };
}

function confirmWatch(view, data, code, ctx) {
  const { n } = data, isToday = n === ctx.today;
  const streak = summary(ctx.today).streak;
  let close;
  const watch = () => { close(); markWatched(n); viewer(view, data, code, ctx); };
  const kids = [];
  if (isToday) {
    kids.push(h('div', { class: 'pr-stakes' },
      h('div', {}, h('span', { class: 'pa-label' }, t('replay.yourStreak')), h('b', {}, tp('daily.days', streak))),
      icon(ICON.arrow, 20),
      h('div', { class: 'is-after' }, h('span', { class: 'pa-label' }, t('replay.afterWatching')), h('b', {}, '0'))));
  }
  kids.push(h('p', { class: 'pl-p' }, isToday ? t('replay.confirmToday') : t('replay.confirmPast')));
  close = P.openSheet(P.Sheet({
    title: t('replay.confirmTitle'),
    className: 'pr-confirm',
    children: kids,
    footer: [
      P.Button({ label: isToday ? t('replay.keepStreak') : t('replay.playItFirst'), variant: 'primary', onClick: () => close() }),
      P.Button({ label: t('replay.watchAnyway'), onClick: watch }),
    ],
    onClose: () => close(),
  }));
}

// ---------- the viewer ----------
function cardName(c) { return (c.rank) + SUIT_CHAR[c.suit]; }
function whereOf(pid) {
  const [z, i] = pid.split('.');
  return z === 'cell' ? t('replay.whereCell') : z === 'foundation' ? t('replay.whereHome') : t('replay.whereColumn', { n: +i + 1 });
}
function describe(step, prevNote) {
  if (step.kind === 'start') return { note: '', text: t('replay.start') };
  if (step.kind === 'undo') return { note: 'undo', text: t('replay.undoStep', { move: prevNote || '' }) };
  if (step.kind === 'restart') return { note: 'restart', text: t('replay.restartStep') };
  const { move, moved, autoHome } = step;
  const note = noteOf(move.from) + noteOf(move.to);
  let text = moved.length > 1
    ? t('replay.runStep', { card: cardName(moved[0]), more: moved.length - 1, where: whereOf(move.to) })
    : t('replay.moveStep', { card: cardName(moved[0]), where: whereOf(move.to) });
  if (autoHome) text += ' · ' + tp('replay.autoHome', autoHome);
  return { note, text };
}

function viewer(view, data, code, ctx) {
  document.body.classList.add('on-felt');
  const { engine, n } = data;
  const settings = getSettings();
  const ui = { mode: 'played', step: 0, playing: false, speed: 1, timer: null };
  const lines = {
    played: data.asPlayed.map((st, i, all) => {
      // An undo describes the move it took back: the last move still on the board before it.
      let prev = '';
      if (st.kind === 'undo') {
        const stack = [];
        for (let k = 1; k < i; k++) {
          const x = all[k];
          if (x.kind === 'move') stack.push(noteOf(x.move.from) + noteOf(x.move.to));
          else if (x.kind === 'undo') stack.pop();
          else if (x.kind === 'restart') stack.length = 0;
        }
        prev = stack[stack.length - 1] || '';
      }
      return { ...st, ...describe(st, prev) };
    }),
    clean: data.clean.map((st) => ({ ...st, ...describe(st) })),
  };
  const undos = data.asPlayed.filter((x) => x.kind === 'undo').length;

  const boardHost = h('div', { class: 'pr-board' });
  const stepEl = h('div', { class: 'pr-step' });
  const noteEl = h('span', { class: 'pr-note-chip' });
  const descEl = h('div', { class: 'pr-desc' });
  const ticks = h('div', { class: 'pr-ticks', 'aria-hidden': 'true' });
  const range = h('input', { type: 'range', min: '0', step: '1', 'aria-label': t('replay.scrub'), class: 'pr-range' });
  const playBtn = h('button', { type: 'button', class: 'pr-play' });
  const speedBtn = h('button', { type: 'button', class: 'pr-speed' });
  const modeBtns = {
    played: h('button', { type: 'button', class: 'pr-seg', onclick: () => setMode('played') }),
    clean: h('button', { type: 'button', class: 'pr-seg', onclick: () => setMode('clean') }),
  };

  const steps = () => lines[ui.mode];
  function display(st) {
    const s = {};
    for (const k of Object.keys(st.state)) s[k] = st.state[k].map((p) => p.slice());
    const fz = engine.zones.foundation;
    s[fz] = s[fz].map((p) => (p.length ? [p[p.length - 1]] : []));
    if (st.kind === 'move') {
      const [z, i] = st.move.to.split('.');
      const dst = s[z][+i];
      const ids = new Set(st.moved.map(cardId));
      for (let k = 0; k < dst.length; k++) if (ids.has(cardId(dst[k]))) dst[k] = { ...dst[k], hint: true };
    }
    return s;
  }
  function render() {
    const L = steps(), max = L.length - 1;
    ui.step = Math.max(0, Math.min(max, ui.step));
    const st = L[ui.step];
    const table = P.FreeCellTable({
      layout: engine.rules.layout,
      state: display(st),
      hint: st.kind === 'move' ? st.move.to : null,
      leftHanded: settings.play.leftHanded,
      cardSize: settings.appearance.cardSize,
      bar: {
        game: n != null ? t('replay.title') : dsText(engine.name),
        deal: n != null ? t('replay.barLabel', { n }) : t('table.dealLabel', { deal: data.deal }),
        stats: [{ label: t('common.time'), value: formatTime(data.head.timeMs) }, { label: t('common.moves'), value: data.moves }],
        actions: [],
      },
    });
    boardHost.replaceChildren(table);
    localize(table);
    stepEl.textContent = t('replay.step', { n: ui.step, total: max });
    noteEl.textContent = st.note || t('replay.start');
    noteEl.dataset.kind = st.kind;
    descEl.textContent = st.text + (ui.mode === 'played' && ui.step === 0 && undos ? ' · ' + tp('replay.undosAlong', undos) : '');
    range.max = String(max); range.value = String(ui.step);
    ticks.replaceChildren(...L.slice(1).map((x, i) => h('i', {
      'data-kind': x.kind === 'move' && (x.move.to.startsWith(engine.zones.foundation) || x.autoHome) ? 'home' : x.kind,
      'data-at': i + 1 === ui.step ? 'now' : i + 1 < ui.step ? 'done' : 'todo',
    })));
    playBtn.replaceChildren(icon(ui.playing ? ICON.pause : ICON.play, 24, true));
    playBtn.setAttribute('aria-label', ui.playing ? t('replay.pause') : t('replay.play'));
    speedBtn.textContent = ui.speed + '×';
    speedBtn.setAttribute('aria-label', t('replay.speed', { speed: ui.speed }));
    modeBtns.played.textContent = t('replay.asPlayed', { count: lines.played.length - 1 });
    modeBtns.clean.textContent = t('replay.cleanLine', { count: lines.clean.length - 1 });
    for (const [k, b] of Object.entries(modeBtns)) b.setAttribute('aria-pressed', String(ui.mode === k));
  }
  function go(k) { ui.step = k; render(); }
  function stop() { clearInterval(ui.timer); ui.timer = null; ui.playing = false; }
  function start() {
    clearInterval(ui.timer);
    ui.playing = true;
    ui.timer = setInterval(() => {
      if (ui.step >= steps().length - 1) { stop(); render(); return; }
      ui.step++; render();
    }, 700 / ui.speed);
  }
  function setMode(m) {
    if (m === ui.mode) return;
    const frac = ui.step / Math.max(1, steps().length - 1);
    ui.mode = m;
    ui.step = Math.round(frac * (steps().length - 1));
    render();
  }
  playBtn.addEventListener('click', () => {
    if (ui.playing) stop(); else { if (ui.step >= steps().length - 1) ui.step = 0; start(); }
    render();
  });
  speedBtn.addEventListener('click', () => { ui.speed = ui.speed === 4 ? 1 : ui.speed * 2; if (ui.playing) start(); render(); });
  range.addEventListener('input', () => { stop(); go(+range.value); });
  const onKey = (e) => {
    if (document.querySelector('.pl-scrim') || e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowRight') { stop(); go(ui.step + 1); }
    else if (e.key === 'ArrowLeft') { stop(); go(ui.step - 1); }
    else if (e.key === ' ') { e.preventDefault(); playBtn.click(); }
  };
  document.addEventListener('keydown', onKey);

  const playFrom = () => {
    // Practice from this point: the moves up to here, as played.
    const L = steps();
    let count = 0;
    for (let i = 1; i <= ui.step; i++) if (L[i].kind !== 'start') count++;
    const log = ui.mode === 'played' ? data.log.filter((a) => !(a && a.a) && a !== 'h').slice(0, count) : L.slice(1, ui.step + 1).map((x) => ({ m: [x.move.from, x.move.index, x.move.to] }));
    try { sessionStorage.setItem(START_KEY, JSON.stringify({ n, log })); } catch { /* practice starts from the deal */ }
    location.hash = `replay=${n}`;
  };

  view.replaceChildren(h('div', { class: 'pr-viewer' },
    h('a', { class: 'pr-back pr-back-felt', href: ctx.backHref || '#' }, icon(ICON.back, 20), t('replay.back')),
    boardHost,
    h('section', { class: 'pr-panel', 'aria-label': t('replay.title') },
      h('div', { class: 'pr-segs', role: 'group', 'aria-label': t('replay.modesLabel') }, modeBtns.played, modeBtns.clean),
      h('div', { class: 'pr-now', 'aria-live': 'polite' }, stepEl, noteEl, descEl),
      h('div', { class: 'pr-track' }, ticks, range,
        h('div', { class: 'pr-legend' },
          h('span', { 'data-kind': 'move' }, t('replay.legendMove')),
          h('span', { 'data-kind': 'home' }, t('replay.legendHome')),
          h('span', { 'data-kind': 'undo' }, t('replay.legendUndo')))),
      h('div', { class: 'pr-controls' },
        h('button', { type: 'button', class: 'pr-icon', 'aria-label': t('replay.first'), onclick: () => { stop(); go(0); } }, icon(ICON.first)),
        h('button', { type: 'button', class: 'pr-icon', 'aria-label': t('replay.prev'), onclick: () => { stop(); go(ui.step - 1); } }, icon(ICON.back)),
        playBtn,
        h('button', { type: 'button', class: 'pr-icon', 'aria-label': t('replay.next'), onclick: () => { stop(); go(ui.step + 1); } }, icon(ICON.next)),
        speedBtn),
      n != null ? h('div', { class: 'pr-takeover' },
        h('p', {}, t('replay.takeOver')),
        h('button', { type: 'button', class: 'pa-btn pa-btn-outline', onclick: playFrom }, t('replay.playFromHere'))) : null)));
  render();
  return { destroy() { stop(); document.removeEventListener('keydown', onKey); } };
}
