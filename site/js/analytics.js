// Launch metrics events (see design/daily/Metrics.dc.html).
//
// For now events are only queued on this device — nothing leaves the browser.
// When a backend exists (Supabase/Firestore table), set ENDPOINT and flush()
// will POST the queue. Events carry only the fields listed in the design:
// a random anon id, never an account, no fingerprinting, no third parties.

const ENDPOINT = null; // e.g. 'https://<project>.supabase.co/rest/v1/events'
const QUEUE_KEY = 'parlor.events.v1';
const ID_KEY = 'parlor.anon_id';
const MAX_QUEUE = 500;

function anonId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2); localStorage.setItem(ID_KEY, id); }
    return id;
  } catch { return 'anon'; }
}

export function track(name, props = {}) {
  const ev = { name, at: new Date().toISOString(), anon_id: anonId(), ...props };
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    q.push(ev);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
  } catch { /* storage unavailable */ }
  if (location.hostname === 'localhost' || location.search.includes('debug')) console.debug('[parlor]', ev);
  flush();
}

export async function flush() {
  if (!ENDPOINT || !navigator.onLine) return;
  let q;
  try { q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return; }
  if (!q.length) return;
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(q), keepalive: true });
    if (res.ok) localStorage.setItem(QUEUE_KEY, '[]');
  } catch { /* try again next time */ }
}
