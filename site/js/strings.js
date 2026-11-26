// All user-facing copy lives in site/copy/en.json. This loads it and fills placeholders.
//   t('daily.title')                          → "Today’s deal"
//   t('common.nextDealIn', { time: '1:32' })  → "Next deal in 1:32"
//   tp('daily.days', 3)                        → uses daily.days.one / daily.days.other, {count} filled
// HTML: data-copy="key" sets an element's text; data-copy-<attr>="key" sets that attribute
// (data-copy-aria-label, data-copy-content, data-copy-alt…).
//
// Text drawn by the Parlor design system's own components (card names, the rules sheet,
// settings labels, rule messages) is translated by its English wording, gettext-style:
// designSystem.text maps exact strings, designSystem.patterns maps strings with {holes}.
// localize(root) rewrites a rendered subtree; dsText(s) translates one string.

let copy = {};
let patterns = [];

export async function loadCopy(root) {
  try {
    const res = await fetch(root + 'copy/en.json');
    if (res.ok) copy = await res.json();
  } catch { /* offline before first cache: keys show instead of text */ }
  patterns = compilePatterns(copy.designSystem?.patterns || {});
  applyCopyAttributes(document);
  return copy;
}

export function applyCopyAttributes(root) {
  root.querySelectorAll('[data-copy]').forEach((el) => { el.textContent = t(el.dataset.copy); });
  root.querySelectorAll('*').forEach((el) => {
    for (const a of el.attributes) {
      if (a.name.startsWith('data-copy-')) el.setAttribute(a.name.slice(10), t(a.value));
    }
  });
}

function lookup(key) {
  return key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), copy);
}

export function t(key, vars) {
  const s = lookup(key);
  if (typeof s !== 'string') return key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k]))) : s;
}

export function tp(key, count, vars = {}) {
  return t(`${key}.${count === 1 ? 'one' : 'other'}`, { count, ...vars });
}

// ---------- design-system text ----------

function compilePatterns(map) {
  return Object.entries(map).map(([src, out]) => {
    const names = [];
    const re = new RegExp('^' + src.split(/(\{\w+\})/).map((part) => {
      const m = part.match(/^\{(\w+)\}$/);
      if (m) { names.push(m[1]); return '(.+?)'; }
      return part.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    }).join('') + '$');
    return { re, names, out };
  });
}

function exact(s) {
  const map = copy.designSystem?.text;
  return map && Object.prototype.hasOwnProperty.call(map, s) ? map[s] : null;
}

function translateOne(s) {
  const hit = exact(s);
  if (hit != null) return hit;
  for (const p of patterns) {
    const m = s.match(p.re);
    if (!m) continue;
    const vals = {};
    p.names.forEach((n, i) => { vals[n] = exact(m[i + 1]) ?? m[i + 1]; });
    return p.out.replace(/\{(\w+)\}/g, (x, k) => (vals[k] == null ? x : vals[k]));
  }
  return null;
}

/** Translate one string the design system produced. Unknown text comes back unchanged. */
export function dsText(s) {
  if (typeof s !== 'string' || !s.trim()) return s;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim();
  let out = translateOne(core);
  // Composed messages: "Deal #617 · in 3:18 · 92 moves", or several sentences in a row.
  if (out == null && core.includes(' · ')) {
    const parts = core.split(' · ').map((x) => translateOne(x));
    if (parts.some((x) => x != null)) out = core.split(' · ').map((x, i) => parts[i] ?? x).join(' · ');
  }
  if (out == null) {
    const sentences = core.match(/[^.!?…]+[.!?…]+(\s+|$)|[^.!?…]+$/g) || [];
    if (sentences.length > 1) {
      const parts = sentences.map((x) => translateOne(x.trim()));
      if (parts.some((x) => x != null)) out = sentences.map((x, i) => parts[i] ?? x.trim()).join(' ');
    }
  }
  return out == null ? s : lead + out + trail;
}

const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];

/** Rewrite design-system text inside a rendered element: text nodes and label attributes. */
export function localize(root) {
  if (!root || !copy.designSystem) return root;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const v = dsText(n.nodeValue);
    if (v !== n.nodeValue) n.nodeValue = v;
  }
  const els = root.querySelectorAll ? [root, ...root.querySelectorAll('*')] : [];
  for (const el of els) {
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) { const x = dsText(v); if (x !== v) el.setAttribute(a, x); }
    }
  }
  return root;
}

/**
 * Translate everything the design system opens: wraps Parlor.openSheet so every sheet
 * (rules, settings, win dialog) is localized when it opens and again when its text
 * changes (settings import / export messages).
 */
export function localizeDesignSystem(P) {
  if (!P || P.__localized) return;
  P.__localized = true;
  const open = P.openSheet;
  P.openSheet = (sheet, onClose) => {
    localize(sheet);
    let busy = false;
    const obs = new MutationObserver(() => { if (busy) return; busy = true; localize(sheet); obs.takeRecords(); busy = false; });
    obs.observe(sheet, { subtree: true, childList: true, characterData: true });
    return open.call(P, sheet, () => { obs.disconnect(); if (onClose) onClose(); });
  };
}
