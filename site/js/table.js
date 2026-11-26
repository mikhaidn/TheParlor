// The playable table: renders Parlor.FreeCellTable from engine state and turns
// pointer (mouse / touch / pen) and keyboard input into moves.
//
// Input model (design/system/pwa.md §6):
//  - tap a card to select it (brass ring), tap a destination to move it
//  - drag a card or run and drop it anywhere over a pile
//  - double-tap / double-click sends a card to its foundation
//  - keyboard: arrows move between piles, Enter/Space picks up and drops,
//    U undo, H hint, Esc clears the selection

import { createEngine } from './engine.js';
import { read, write, remove, formatTime } from './store.js';
import { P, getSettings, setSettings } from './boot.js';
import { statsGroup } from './stats-file.js';
import { t } from './strings.js';

const DRAG_THRESHOLD = 6;
const DOUBLE_TAP_MS = 400;

let toastEl, toastTimer;
export function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'pa-toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}

function btn(label, onClick, variant = 'quiet') { return P.Button({ label, variant, onClick }); }
function para(text) { const p = document.createElement('p'); p.className = 'pl-p'; p.textContent = text; return p; }

export function menuSheet(title, items) {
  let close;
  const list = document.createElement('div');
  list.className = 'pa-menu';
  items.filter(Boolean).forEach((it) => list.appendChild(btn(it.label, () => { close(); it.onClick(); }, it.primary ? 'primary' : 'quiet')));
  const sheet = P.Sheet({ title, children: [list], onClose: () => close() });
  close = P.openSheet(sheet);
  return close;
}

export function openSettings(onChange) {
  let close;
  const panel = P.SettingsPanel({
    settings: getSettings(),
    onChange: (next) => { setSettings(next); onChange && onChange(); },
    onClose: () => close(),
  });
  // The design system's own help text, overridden from copy/en.json.
  const help = panel.querySelector('.pl-set-file .pl-set-help');
  if (help) help.textContent = t('designSystem.settingsFileHelp');
  panel.querySelector('.pl-sheet-body')?.appendChild(statsGroup(P));
  close = P.openSheet(panel);
}

export function openRules(game = 'freecell') {
  let close;
  close = P.openSheet(P.RulesSheet({ game, onClose: () => close() }));
}

/**
 * @param {HTMLElement} host
 * @param {object} o
 *   rulesId, deal, title, dealLabel, storageKey, resume,
 *   onStart(), onWin(result), onLeave(), menu(ctl) → [{label,onClick}], onNewGame()
 */
export function mountGame(host, o) {
  let engine = createEngine(P, o.rulesId);
  let deal = o.deal;
  let moves = [], undos = 0, elapsed = 0, runningSince = null, won = false;
  let state, selection = null, hint = null, hintTimer = null;
  let press = null, lastTap = { t: 0, pid: null };
  let timeEl = null, tick = null, focusPid = null;

  host.classList.add('pa-game');

  // ---------- persistence ----------
  function now() { return elapsed + (runningSince ? performance.now() - runningSince : 0); }
  function save() {
    if (!o.storageKey) return;
    write(o.storageKey, { v: 1, rulesId: engine.rulesId, deal, moves, undos, elapsed: now(), won });
  }
  function load() {
    const saved = o.resume !== false && o.storageKey ? read(o.storageKey) : null;
    if (saved && saved.v === 1 && saved.deal === deal && saved.rulesId === engine.rulesId && !saved.won) {
      moves = saved.moves || []; undos = saved.undos || 0; elapsed = saved.elapsed || 0;
    }
    state = engine.replay(deal, moves).state;
    if (moves.length && document.visibilityState === 'visible') startClock();
  }

  // ---------- clock ----------
  function startClock() {
    if (runningSince || won) return;
    runningSince = performance.now();
    clearInterval(tick);
    tick = setInterval(() => { if (timeEl) timeEl.textContent = formatTime(now()); }, 500);
  }
  function stopClock() {
    if (runningSince) { elapsed += performance.now() - runningSince; runningSince = null; }
    clearInterval(tick); tick = null;
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden') { stopClock(); save(); }
    else if (moves.length && !won) startClock();
  }
  document.addEventListener('visibilitychange', onVisibility);
  addEventListener('pagehide', save);

  // ---------- rendering ----------
  function displayState() {
    const s = {};
    for (const k of Object.keys(state)) s[k] = state[k].map((p) => p.slice());
    // Foundations show their top card only.
    s[engine.zones.foundation] = s[engine.zones.foundation].map((p) => (p.length ? [p[p.length - 1]] : []));
    if (hint) {
      const src = s[hint.from.split('.')[0]][+hint.from.split('.')[1]];
      if (hint.from.startsWith(engine.zones.foundation)) { /* never a source */ }
      else for (let i = hint.index; i < src.length; i++) src[i] = { ...src[i], hint: true };
      const dst = s[hint.to.split('.')[0]][+hint.to.split('.')[1]];
      if (dst.length) dst[dst.length - 1] = { ...dst[dst.length - 1], hint: true };
    }
    return s;
  }

  function snapshotRects() {
    const rects = new Map();
    host.querySelectorAll('.pl-card[aria-label]').forEach((el) => {
      if (el.style.visibility === 'hidden') return;
      rects.set(el.getAttribute('aria-label'), el.getBoundingClientRect());
    });
    return rects;
  }

  function animateFrom(rects) {
    if (!rects || document.documentElement.classList.contains('pl-reduce-motion')) return;
    host.querySelectorAll('.pl-board .pl-card[aria-label]').forEach((el) => {
      const before = rects.get(el.getAttribute('aria-label'));
      if (!before) return;
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left, dy = before.top - after.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 5 }, { transform: 'none', zIndex: 5 }],
        { duration: 180, easing: 'ease-out' });
    });
  }

  function render(rects) {
    const s = getSettings();
    const stats = [];
    if (s.play.showTimer) stats.push({ label: t('common.time'), value: formatTime(now()) });
    if (s.play.showMoves) stats.push({ label: t('common.moves'), value: moves.length });
    const actions = [
      { label: t('common.undo'), onClick: undo, disabled: !moves.length || won },
      s.play.hints ? { label: t('common.hint'), onClick: showHint, disabled: won } : null,
      { label: t('common.menu'), onClick: openMenu },
    ].filter(Boolean);

    const table = P.FreeCellTable({
      layout: engine.rules.layout,
      state: displayState(),
      selection: selection ? { pile: selection.pile, index: selection.index } : null,
      hint: hint ? hint.to : null,
      leftHanded: s.play.leftHanded,
      cardSize: s.appearance.cardSize,
      bar: { game: o.title || engine.name, deal: o.dealLabel || t('table.dealLabel', { deal }), stats, actions },
    });
    host.replaceChildren(table);
    timeEl = null;
    table.querySelectorAll('.pl-stat').forEach((st) => {
      if (st.querySelector('.pl-stat-label')?.textContent === t('common.time')) timeEl = st.querySelector('.pl-stat-value');
    });
    table.querySelectorAll('[data-pile]').forEach((el) => {
      el.tabIndex = 0;
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.dataset.pile.replace('.', ' ').replace(/(\d+)$/, (n) => +n + 1));
    });
    if (focusPid) host.querySelector(`[data-pile="${focusPid}"]`)?.focus({ preventScroll: true });
    animateFrom(rects);
  }

  // ---------- moves ----------
  function commit(m, preRects) {
    const rects = preRects || snapshotRects();
    if (!moves.length) { startClock(); o.onStart && o.onStart(); }
    moves.push({ from: m.from, index: m.index, to: m.to });
    state = engine.apply(state, m);
    const mode = getSettings().play.autoMove;
    for (let a = engine.nextAuto(state, mode); a; a = engine.nextAuto(state, mode)) {
      moves.push(a); state = engine.apply(state, a);
    }
    selection = null; clearHint();
    if (navigator.vibrate && !document.documentElement.classList.contains('pl-reduce-motion')) try { navigator.vibrate(8); } catch { /* ignore */ }
    if (engine.isWon(state)) return finish(rects);
    save();
    render(rects);
    if (!engine.legalMoves(state).length) stuck();
  }

  function tryMove(from, index, to, flexible) {
    // Keyboard selections pick up "as much of the run as fits" at the destination.
    if (flexible) {
      const p = engine.pile(state, from);
      let last;
      for (let i = index; i < p.length; i++) { last = engine.check(state, from, i, to); if (last.ok) { commit({ from, index: i, to: last.to }); return last; } }
      return last || { ok: false, reason: 'Nothing to move.' };
    }
    const r = engine.check(state, from, index, to);
    if (r.ok) commit({ from, index, to: r.to });
    return r;
  }

  function sendHome(pid) {
    const p = engine.pile(state, pid);
    if (!p.length) return false;
    const r = engine.check(state, pid, p.length - 1, engine.zones.foundation + '.0');
    if (r.ok) { commit({ from: pid, index: p.length - 1, to: r.to }); return true; }
    return false;
  }

  function undo() {
    if (!moves.length || won) return;
    while (moves.length && moves[moves.length - 1].auto) moves.pop();
    moves.pop();
    undos++;
    const rects = snapshotRects();
    state = engine.replay(deal, moves).state;
    selection = null; clearHint();
    save(); render(rects);
  }

  function clearHint() { hint = null; clearTimeout(hintTimer); }
  function showHint() {
    if (won) return;
    const list = engine.legalMoves(state);
    if (!list.length) return stuck();
    // Rotate through hints on repeated presses.
    const i = hint ? (list.findIndex((m) => m.from === hint.from && m.to === hint.to && m.index === hint.index) + 1) % list.length : 0;
    hint = list[i]; selection = null;
    render();
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hint = null; render(); }, 3000);
  }

  function stuck() {
    let close;
    const sheet = P.Sheet({
      title: t('table.stuckTitle'),
      children: [para(t('table.stuckBody'))],
      footer: [btn(t('common.undo'), () => { close(); undo(); }, 'primary'), btn(o.newGameLabel || t('common.newGame'), () => { close(); o.onNewGame ? o.onNewGame() : newDeal(); })],
      onClose: () => close(),
    });
    close = P.openSheet(sheet);
  }

  function finish(rects) {
    stopClock();
    won = true; selection = null;
    const { arrivals } = engine.replay(deal, moves);
    const result = { deal, rulesId: engine.rulesId, time: Math.round(elapsed), moves: moves.length, undos, arrivals };
    save();
    render(rects);
    setTimeout(() => o.onWin && o.onWin(result), rects ? 450 : 0);
  }

  function newDeal(n, rulesId) {
    if (rulesId && rulesId !== engine.rulesId) engine = createEngine(P, rulesId);
    stopClock();
    deal = n; moves = []; undos = 0; elapsed = 0; won = false; selection = null; clearHint();
    state = engine.initial(deal);
    save(); render();
  }

  function openMenu() {
    const items = o.menu ? o.menu(ctl) : [];
    menuSheet(t('table.menuTitle'), items.concat([
      { label: t('common.howToPlay'), onClick: () => openRules('freecell') },
      { label: t('common.settings'), onClick: () => openSettings(() => render()) },
    ]));
  }

  // ---------- input: pointer ----------
  function locate(target) {
    const pe = target.closest && target.closest('[data-pile]');
    if (!pe || !host.contains(pe)) return null;
    const pid = pe.dataset.pile;
    const real = engine.pile(state, pid);
    const cardEl = target.closest('.pl-card');
    if (!cardEl || !real.length) return { pid, index: -1, el: pe };
    if (pid.startsWith(engine.zones.foundation) || pe === cardEl) return { pid, index: real.length - 1, el: pe };
    const cards = [...pe.querySelectorAll(':scope > .pl-card')];
    const i = cards.indexOf(cardEl);
    return { pid, index: i < 0 ? real.length - 1 : i, el: pe };
  }

  function tap(loc) {
    const t = performance.now();
    const dbl = t - lastTap.t < DOUBLE_TAP_MS && lastTap.pid === loc.pid;
    lastTap = { t, pid: loc.pid };
    clearHint();
    if (dbl && loc.index >= 0) {
      if (sendHome(loc.pid)) { lastTap = { t: 0, pid: null }; return; }
    }
    if (selection) {
      if (selection.pile === loc.pid) { selection = null; render(); return; }
      const r = tryMove(selection.pile, selection.index, loc.pid, selection.flex);
      if (r.ok) { lastTap = { t: 0, pid: null }; return; }
      if (loc.index >= 0 && engine.canPickUp(state, loc.pid, loc.index)) { selection = { pile: loc.pid, index: loc.index }; render(); }
      toast(r.reason || t('table.cantMove'));
      return;
    }
    if (loc.index < 0) return;
    if (engine.canPickUp(state, loc.pid, loc.index)) { selection = { pile: loc.pid, index: loc.index }; render(); }
    else toast(loc.pid.startsWith(engine.zones.foundation) ? t('table.foundationLocked') : t('table.notARun'));
  }

  function startDrag(e) {
    const board = host.querySelector('.pl-board');
    const src = press.loc.el;
    const cards = src.classList.contains('pl-card') ? [src] : [...src.querySelectorAll(':scope > .pl-card')].slice(press.loc.index);
    if (!board || !cards.length) return false;
    const br = board.getBoundingClientRect(), cr = cards[0].getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'pl-pile pa-ghost';
    ghost.style.left = cr.left - br.left + 'px';
    ghost.style.top = cr.top - br.top + 'px';
    cards.forEach((c) => { const k = c.cloneNode(true); k.classList.remove('is-selected', 'is-run', 'is-hint'); k.classList.add('is-lifted'); ghost.appendChild(k); c.style.visibility = 'hidden'; });
    board.appendChild(ghost);
    press.drag = { ghost, cards, board };
    selection = null;
    return true;
  }

  function moveDrag(e) {
    press.drag.ghost.style.transform = `translate(${e.clientX - press.x}px, ${e.clientY - press.y}px)`;
  }

  function dropTarget() {
    const g = press.drag.ghost.firstElementChild.getBoundingClientRect();
    let best = null, bestArea = 0;
    host.querySelectorAll('.pl-board > [data-pile]').forEach((el) => {
      if (el.dataset.pile === press.loc.pid) return;
      const r = el.getBoundingClientRect();
      const w = Math.min(g.right, r.right) - Math.max(g.left, r.left);
      const h = Math.min(g.bottom, r.bottom) - Math.max(g.top, r.top);
      const area = w > 0 && h > 0 ? w * h : 0;
      if (area > bestArea) { bestArea = area; best = el.dataset.pile; }
    });
    return best;
  }

  function endDrag() {
    const to = dropTarget();
    const rects = snapshotRects();
    press.drag.ghost.querySelectorAll('.pl-card[aria-label]').forEach((el) => rects.set(el.getAttribute('aria-label'), el.getBoundingClientRect()));
    const from = press.loc.pid, index = press.loc.index;
    press.drag.ghost.remove();
    if (to) {
      const r = engine.check(state, from, index, to);
      if (r.ok) {
        // Hand commit() the ghost positions so cards glide from where they were dropped.
        commit({ from, index, to: r.to }, rects);
        return;
      }
      toast(r.reason || t('table.cantMove'));
    }
    render(rects);
  }

  function onDown(e) {
    if (e.button > 0 || won || press) return;
    const loc = locate(e.target);
    if (!loc) return;
    focusPid = null;
    const input = getSettings().play.input;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, loc, drag: null,
      canDrag: input !== 'tap' && loc.index >= 0 && engine.canPickUp(state, loc.pid, loc.index) };
    try { host.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onMove(e) {
    if (!press || e.pointerId !== press.id) return;
    if (!press.drag) {
      if (!press.canDrag || Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_THRESHOLD) return;
      if (!startDrag(e)) { press.canDrag = false; return; }
    }
    e.preventDefault();
    moveDrag(e);
  }
  function onUp(e) {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    try {
      if (p.drag) endDrag();
      else if (getSettings().play.input !== 'drag' || p.loc.index < 0 || selection) tap(p.loc);
      else if (performance.now() - lastTap.t < DOUBLE_TAP_MS && lastTap.pid === p.loc.pid) { sendHome(p.loc.pid); lastTap = { t: 0, pid: null }; }
      else lastTap = { t: performance.now(), pid: p.loc.pid };
    } finally { press = null; }
  }
  function onCancel(e) {
    if (!press || e.pointerId !== press.id) return;
    if (press.drag) { press.drag.ghost.remove(); render(); }
    press = null;
  }

  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onCancel);
  host.addEventListener('contextmenu', (e) => { if (e.target.closest('.pl-card')) e.preventDefault(); });

  // ---------- input: keyboard ----------
  function piles() { return [...host.querySelectorAll('.pl-board > [data-pile]')]; }
  function onKey(e) {
    if (document.querySelector('.pl-scrim')) return; // a sheet is open
    if (e.metaKey || e.altKey) return;
    const k = e.key;
    if ((k === 'z' || k === 'Z') && e.ctrlKey) { e.preventDefault(); undo(); return; }
    if (e.ctrlKey) return;
    if (k === 'u' || k === 'U') { undo(); return; }
    if (k === 'h' || k === 'H') { showHint(); return; }
    if (k === 'Escape' && selection) { selection = null; render(); return; }
    const list = piles();
    const cur = e.target.closest && e.target.closest('[data-pile]');
    const i = cur ? list.indexOf(cur) : -1;
    const top = list.filter((el) => !el.dataset.pile.startsWith(engine.zones.tableau));
    const tab = list.filter((el) => el.dataset.pile.startsWith(engine.zones.tableau));
    const go = (el) => { if (el) { e.preventDefault(); focusPid = el.dataset.pile; el.focus(); } };
    if (k === 'ArrowRight') return go(list[(i + 1) % list.length]);
    if (k === 'ArrowLeft') return go(list[(i - 1 + list.length) % list.length]);
    if (k === 'ArrowDown' && cur) { const j = top.indexOf(cur); if (j >= 0) return go(tab[Math.min(j, tab.length - 1)]); }
    if (k === 'ArrowUp' && cur) { const j = tab.indexOf(cur); if (j >= 0) return go(top[Math.min(j, top.length - 1)]); }
    if ((k === 'Enter' || k === ' ') && cur) {
      e.preventDefault();
      const pid = cur.dataset.pile; focusPid = pid;
      const p = engine.pile(state, pid);
      if (selection) {
        if (selection.pile === pid) { selection = null; render(); return; }
        const r = tryMove(selection.pile, selection.index, pid, selection.flex);
        if (!r.ok) toast(r.reason || t('table.cantMove'));
        return;
      }
      if (!p.length) return;
      const idx = pid.startsWith(engine.zones.tableau) ? engine.runStart(p) : p.length - 1;
      if (engine.canPickUp(state, pid, idx)) { selection = { pile: pid, index: idx, flex: true }; render(); }
    }
  }
  host.addEventListener('keydown', onKey);
  host.addEventListener('focusin', (e) => { const el = e.target.closest && e.target.closest('[data-pile]'); if (el) focusPid = el.dataset.pile; });

  // ---------- go ----------
  load();
  render();

  const ctl = {
    newDeal, undo, hint: showHint, render,
    restart: () => newDeal(deal, engine.rulesId),
    get deal() { return deal; },
    get rulesId() { return engine.rulesId; },
    get inProgress() { return moves.length > 0 && !won; },
    get won() { return won; },
    get moves() { return moves.length; },
    clearSave: () => o.storageKey && remove(o.storageKey),
    destroy() {
      stopClock(); save();
      document.removeEventListener('visibilitychange', onVisibility);
      removeEventListener('pagehide', save);
      host.replaceChildren();
    },
  };
  return ctl;
}
