// node tests/copy.test.mjs — every word the app shows comes from site/copy/en.json.
//  1. every t('key') / tp('key') used in site/js exists in en.json
//  2. no hard-coded prose in site/js (mark a line `// copy-ok: why` if a literal really isn't UI text)
//  3. every visible text and label in site/**/*.html has a data-copy / data-copy-<attr> key
//  4. every string the Parlor design system can show in this app has a designSystem entry
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const site = join(root, 'site');
const copy = JSON.parse(readFileSync(join(site, 'copy', 'en.json'), 'utf8'));
const get = (key) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), copy);
const problems = [];

const files = (dir, ext) => readdirSync(dir).flatMap((n) => {
  const f = join(dir, n);
  return statSync(f).isDirectory() ? (n === 'vendor' || n === 'parlor' ? [] : files(f, ext)) : f.endsWith(ext) ? [f] : [];
});

// ---------- 1 & 2: site/js ----------
const PROSE = /[A-Za-z]{2,}[ ,.!?’'…][A-Za-z]|^[A-Z][a-z]+[.!?…]?$/;
const NOT_UI = /^[\w./?=-]+$|^[a-z][\w-]*( [a-z][\w-]*)+$|px|rgba|#[0-9a-f]{3}|serif|sans-serif|\$\{|^\.|\[|:scope|application\/|image\/|text\/|utf|https?:|^\w+=|^M\d/;
for (const f of files(join(site, 'js'), '.js')) {
  const rel = relative(root, f);
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/\btp?\(\s*'([\w.]+)'(\s*\+)?/g)) {
      const [, key, dynamic] = m;
      const isTp = m[0].startsWith('tp');
      if (dynamic) { if (typeof get(key.replace(/\.$/, '')) !== 'object') problems.push(`${rel}:${i + 1} t('${key}' + …): no group ${key}`); continue; }
      const ok = isTp ? typeof get(key + '.one') === 'string' && typeof get(key + '.other') === 'string' : typeof get(key) === 'string';
      if (!ok) problems.push(`${rel}:${i + 1} missing copy key ${key}`);
    }
    const code = line.trim();
    if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*') || code.startsWith('import ') || /copy-ok/.test(line) || /console\.\w+\(/.test(line)) return;
    for (const m of line.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
      const v = m[2];
      if (PROSE.test(v) && !NOT_UI.test(v)) problems.push(`${rel}:${i + 1} hard-coded text "${v.slice(0, 60)}" — put it in en.json`);
    }
  });
}

// ---------- 3: HTML ----------
for (const f of files(site, '.html')) {
  const rel = relative(root, f);
  const src = readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  for (const m of src.matchAll(/<(\w+)([^>]*)>([^<]*[A-Za-z][^<]*)</g)) {
    const [, tag, attrs, text] = m;
    if (!text.trim() || /data-copy="/.test(attrs)) continue;
    problems.push(`${rel}: <${tag}> text "${text.trim().slice(0, 50)}" has no data-copy key`);
  }
  for (const m of src.matchAll(/<(\w+)([^>]*?)\s(aria-label|alt|title|content)="([^"]*[A-Za-z][^"]*)"/g)) {
    const [, tag, attrs, attr, val] = m;
    if (tag === 'meta' && !/name="description"/.test(attrs + m[0])) continue;
    if (attr === 'alt' && !val) continue;
    if (!new RegExp(`data-copy-${attr}="`).test(m[0] + src.slice(m.index + m[0].length, src.indexOf('>', m.index)))) problems.push(`${rel}: <${tag} ${attr}="${val.slice(0, 40)}"> has no data-copy-${attr} key`);
  }
}
for (const k of Object.keys(copy.app || {})) assert.equal(typeof copy.app[k], 'string');

// ---------- 4: design system ----------
// Components this app mounts (site/js) and the bundle functions behind them.
const USED = ['PlayingCard', 'CardSlot', 'Pile', 'GameBar', 'FreeCellTable', 'Sheet', 'RulesSheet', 'WinDialog', 'SettingsPanel',
  'settingsValidate', 'settingsExport', 'settingsImportFile'];
const bundle = readFileSync(join(site, 'parlor', 'bundle.js'), 'utf8');
const chunks = [];
for (const name of USED) {
  const start = bundle.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `design system still has ${name}`);
  const end = bundle.slice(start + 10).search(/\n  (function |\/\*|var )/);
  chunks.push(bundle.slice(start, start + 10 + end));
}
for (const v of ['RANK_NAMES', 'GAME_NAMES', 'RULES', 'SETTINGS_SCHEMA']) {
  const start = bundle.indexOf(`var ${v} =`);
  assert.ok(start >= 0, `design system still has ${v}`);
  chunks.push(bundle.slice(start, start + bundle.slice(start).search(/\n  \};?\n|\n  \];?\n|;\n/) + 4));
}
for (const m of bundle.matchAll(/reason: '([^']+)'/g)) chunks.push(`'${m[1]}'`);
const text = copy.designSystem?.text || {}, patterns = copy.designSystem?.patterns || {};
const fragments = [...Object.keys(text), ...Object.keys(patterns)];
const DS_SKIP = /^(pl-|parlor\.|aria-|data-|currentColor|Escape|Arrow\w+|application\/json|cardSize|cardStyle|fourColor|reduceMotion|autoMove|showTimer|showMoves|confirmNewGame|leftHanded|freeCells|feltDeep|feltLine|onFelt|onFeltMuted|cell\.|tableau\.|my\.deck\.)/;
for (const chunk of chunks) {
  for (const m of chunk.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) {
    const v = m[1];
    if (!/[A-Za-z]/.test(v) || DS_SKIP.test(v.trim()) || /^[a-z][\w-]*$/.test(v) || /^[A-Z]$|^\d/.test(v) && v.length < 3) continue;
    if (!/[A-Z]|\s|[.…?!’]/.test(v)) continue;
    const covered = Object.prototype.hasOwnProperty.call(text, v) || fragments.some((k) => k.includes(v.trim()) || k.replace(/\{\w+\}/g, '').includes(v.trim()));
    if (!covered) problems.push(`design system text "${v.slice(0, 60)}" has no entry in designSystem.text / patterns`);
  }
}
for (const [k, v] of Object.entries(patterns)) {
  const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  assert.equal(holes(k), holes(v), `designSystem.patterns "${k}" keeps the same {holes}`);
}

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`copy: ok · ${Object.keys(text).length} design-system strings, ${Object.keys(patterns).length} patterns`);
