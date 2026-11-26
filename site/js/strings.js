// All user-facing copy lives in site/copy/en.json. This loads it and fills placeholders.
//   t('daily.title')                          → "Today’s deal"
//   t('common.nextDealIn', { time: '1:32' })  → "Next deal in 1:32"
//   tp('daily.days', 3)                        → uses daily.days.one / daily.days.other, {count} filled
// HTML elements with data-copy="key" get their text from the same file at start-up.

let copy = {};

export async function loadCopy(root) {
  try {
    const res = await fetch(root + 'copy/en.json');
    if (res.ok) copy = await res.json();
  } catch { /* offline before first cache: keys show instead of text */ }
  document.querySelectorAll('[data-copy]').forEach((el) => { el.textContent = t(el.dataset.copy); });
  return copy;
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
