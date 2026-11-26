// Share card (design/daily/Share.dc.html) drawn to a canvas, plus the share flow:
// image + text where the platform supports files, text otherwise, clipboard last.

import { FOUNDATION_SUITS } from './engine.js';
import { formatTime } from './store.js';
import { t } from './strings.js';

const SUIT_PATHS = {
  spades: 'M12 1.8c.7.6 9.8 7.1 9.8 12.6 0 2.9-2.2 5-4.9 5-1.9 0-3.3-.9-4.1-2.2.1 1.9.8 3.4 2.4 4.9H8.8c1.6-1.5 2.3-3 2.4-4.9-.8 1.3-2.2 2.2-4.1 2.2-2.7 0-4.9-2.1-4.9-5C2.2 8.9 11.3 2.4 12 1.8z',
  hearts: 'M12 21.2C11.3 20.6 2.2 14.3 2.2 8.4 2.2 5.3 4.5 3 7.4 3c2 0 3.6 1.1 4.6 2.8C13 4.1 14.6 3 16.6 3c2.9 0 5.2 2.3 5.2 5.4 0 5.9-9.1 12.2-9.8 12.8z',
  diamonds: 'M12 1.8 19.6 12 12 22.2 4.4 12z',
  clubs: 'M12 1.8a4.6 4.6 0 0 1 3.9 7 4.6 4.6 0 1 1-2.6 8.1c.1 2 .8 3.6 2.4 5.3H8.3c1.6-1.7 2.3-3.3 2.4-5.3a4.6 4.6 0 1 1-2.6-8.1A4.6 4.6 0 0 1 12 1.8z',
};
const INK = { spades: '#1d1f1e', clubs: '#1d1f1e', hearts: '#b3261e', diamonds: '#b3261e' };
const SHADE = ['#f4efe3', '#bcd2c5', '#6f9a85', '#2f6b52'];
const DISPLAY = 'Fraunces, Georgia, serif';
const UI = '"Instrument Sans", system-ui, sans-serif';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

export async function drawShareCard({ n, rec, streak, dateLabel, linkLabel }) {
  try { await Promise.all([document.fonts.load(`600 40px ${DISPLAY}`), document.fonts.load(`400 17px ${UI}`), document.fonts.load(`600 26px ${UI}`)]); } catch { /* fall back */ }
  const S = 2, W = 540, H = 540;
  const c = document.createElement('canvas');
  c.width = W * S; c.height = H * S;
  const ctx = c.getContext('2d');
  ctx.scale(S, S);
  ctx.fillStyle = '#1f5b43'; ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#f4efe3'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 40px ${DISPLAY}`; ctx.fillText(t('share.card.title', { n }), 44, 40 + 34);
  ctx.fillStyle = '#bcd2c5'; ctx.font = `400 17px ${UI}`; ctx.fillText(t('share.card.subtitle', { date: dateLabel }), 44, 40 + 44 + 4 + 16);

  // Card back
  const bx = W - 44 - 44, by = 40;
  ctx.fillStyle = '#fbf7ec'; rr(ctx, bx, by, 44, 60, 5); ctx.fill();
  ctx.save(); rr(ctx, bx + 4, by + 4, 36, 52, 3); ctx.fillStyle = '#7d1f2c'; ctx.fill(); ctx.clip();
  ctx.strokeStyle = '#a84353'; ctx.lineWidth = 1;
  for (let k = -60; k < 60; k += 6) {
    ctx.beginPath(); ctx.moveTo(bx + k, by); ctx.lineTo(bx + k + 60, by + 60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + k + 60, by); ctx.lineTo(bx + k, by + 60); ctx.stroke();
  }
  ctx.restore();

  // Grid panel
  const gx = 44, gy = 148, gw = W - 88, rowH = 26, gap = 8, pad = 18;
  const gh = pad * 2 + rowH * 4 + gap * 3;
  ctx.fillStyle = '#17462f'; rr(ctx, gx, gy, gw, gh, 12); ctx.fill();
  FOUNDATION_SUITS.forEach((suit, i) => {
    const y = gy + pad + i * (rowH + gap);
    ctx.fillStyle = '#fbf7ec'; rr(ctx, gx + pad, y, 26, 26, 6); ctx.fill();
    ctx.save(); ctx.translate(gx + pad + 4, y + 4); ctx.scale(18 / 24, 18 / 24);
    ctx.fillStyle = INK[suit]; ctx.fill(new Path2D(SUIT_PATHS[suit])); ctx.restore();
    const x0 = gx + pad + 26 + 10, cw = (gw - pad * 2 - 36 - 4 * 12) / 13;
    rec.grid[suit].forEach((q, j) => { ctx.fillStyle = SHADE[q]; rr(ctx, x0 + j * (cw + 4), y, cw, 26, 4); ctx.fill(); });
  });

  // Stats
  const sy = gy + gh + 20;
  [[t('share.card.time'), formatTime(rec.time)], [t('share.card.moves'), String(rec.moves)], [t('share.card.streak'), String(streak)]].forEach(([label, value], i) => {
    const x = 44 + i * 120;
    ctx.fillStyle = '#bcd2c5'; ctx.font = `600 12px ${UI}`;
    ctx.letterSpacing = '0.72px'; ctx.fillText(label, x, sy + 12); ctx.letterSpacing = '0px';
    ctx.fillStyle = '#f4efe3'; ctx.font = `600 26px ${UI}`; ctx.fillText(value, x, sy + 18 + 26);
  });

  // Footer
  const fy = H - 40 - 34;
  ctx.fillStyle = '#8fb9a3'; ctx.fillRect(44, fy, W - 88, 1);
  ctx.font = `600 15px ${UI}`; ctx.fillStyle = '#f4efe3'; ctx.fillText(t('share.card.tail'), 44, fy + 14 + 15);
  ctx.font = `400 15px ${UI}`; ctx.fillStyle = '#bcd2c5'; ctx.textAlign = 'right'; ctx.fillText(linkLabel, W - 44, fy + 14 + 15);

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  // Older Safari / insecure contexts: a hidden textarea + execCommand.
  const ta = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
  Object.assign(ta.style, { position: 'fixed', opacity: '0', inset: '0' });
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

export const canShareNatively = () => typeof navigator.share === 'function';

/** Returns 'shared' | 'cancelled' | 'failed' */
export async function shareTextNatively(text) {
  try { await navigator.share({ text }); return 'shared'; } catch (e) { return e && e.name === 'AbortError' ? 'cancelled' : 'failed'; }
}

/** The share card as a PNG: through the share sheet where files are supported (phones), else a download. */
export async function saveImage({ n, rec, streak, dateLabel, link }) {
  const blob = await drawShareCard({ n, rec, streak, dateLabel, linkLabel: link.replace(/\?.*$/, '') });
  if (!blob) return 'failed';
  const file = new File([blob], `parlor-daily-${n}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  return 'downloaded';
}

// ---------- QR code for the replay link ----------
// qrcode-generator (MIT, site/vendor/qrcode.js) is loaded the first time it's needed,
// and the service worker caches it like everything else, so it works offline.
let qrLib = null;
function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!qrLib) {
    qrLib = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/qrcode.js', import.meta.url).href;
      s.onload = () => resolve(window.qrcode || null);
      s.onerror = () => { qrLib = null; resolve(null); };
      document.head.appendChild(s);
    });
  }
  return qrLib;
}

/** An <svg> QR code for url (medium error correction), or null if it can't be drawn here. */
export async function qrSvg(url, label) {
  const qrcode = await loadQr();
  if (!qrcode) return null;
  let qr;
  try { qr = qrcode(0, 'M'); qr.addData(url); qr.make(); } catch { return null; }
  const n = qr.getModuleCount(), quiet = 2, size = n + quiet * 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': label, 'shape-rendering': 'crispEdges', class: 'pd-qr' })) svg.setAttribute(k, v);
  const bg = document.createElementNS(NS, 'rect');
  for (const [k, v] of Object.entries({ width: size, height: size, fill: '#ffffff' })) bg.setAttribute(k, v);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d); path.setAttribute('fill', '#1d1f1e');
  svg.append(bg, path);
  return svg;
}
