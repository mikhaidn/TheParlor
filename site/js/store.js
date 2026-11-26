// Tiny localStorage helpers. Every read is defensive: storage can be full,
// disabled (private mode), or cleared by the browser at any time.

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/** Ask the browser not to evict our data. Called after the first finished game. */
export function persist() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* ignore */ }
}

export function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? h + ':' : '') + mm + ':' + String(sec).padStart(2, '0');
}

/** Per-game stats: { played, won, best (ms), streak, bestStreak, last } */
export function recordStats(key, { won, time }) {
  const s = read(key, { played: 0, won: 0, best: null, streak: 0, bestStreak: 0 });
  if (won) {
    s.won++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    const newBest = s.best == null || time < s.best;
    if (newBest) s.best = time;
    write(key, s);
    return { ...s, newBest };
  }
  s.streak = 0;
  write(key, s);
  return { ...s, newBest: false };
}

export function markPlayed(key) {
  const s = read(key, { played: 0, won: 0, best: null, streak: 0, bestStreak: 0 });
  s.played++;
  write(key, s);
}
