// Sync van je lijst met Netlify Blobs via /api/sync, met een herstelcode.
// De app blijft offline gewoon werken: wijzigingen gaan mee bij de volgende sync.
import { mergeDocs, sameDoc } from './sync-merge.js';

const CODE_KEY = 'gl.syncCode';
const LAST_KEY = 'gl.syncLast';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // zonder 0/O en 1/I

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

export const normalizeCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const formatCode = (s) => normalizeCode(s).match(/.{1,4}/g)?.join('-') || '';
export const validCode = (s) => normalizeCode(s).length === 16;

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map(b => ALPHABET[b % 32]).join('').match(/.{4}/g).join('-');
}

export const syncCode = () => read(CODE_KEY);
export const lastSync = () => Number(read(LAST_KEY)) || 0;

let hooks = null;   // { getLocal, applyMerged, onStatus }
let timer = null;
let running = null;
let again = false;
let status = { state: 'idle', error: null };

const setStatus = (s) => { status = { ...status, ...s }; hooks?.onStatus?.(status); };
export const syncStatus = () => status;

async function post(code, doc, { create = false, keepalive = false } = {}) {
  const res = await fetch('/api/sync', {
    method: 'POST',
    keepalive,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + code },
    body: JSON.stringify({ ...doc, create }),
  });
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) throw Object.assign(new Error('Sync niet bereikbaar'), { status: res.status });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Sync mislukt'), { status: res.status });
  return data;
}

/** Eén sync-ronde: lokaal opsturen, samengevoegd resultaat terugkrijgen en lokaal toepassen. */
export function syncNow({ keepalive = false } = {}) {
  const code = syncCode();
  if (!code || !hooks || !navigator.onLine) return Promise.resolve(false);
  if (running) { again = true; return running; }
  clearTimeout(timer);
  setStatus({ state: 'syncing', error: null });
  running = (async () => {
    try {
      const sent = hooks.getLocal();
      const remote = await post(code, sent, { keepalive });
      // Intussen lokaal iets veranderd? Dat ook meenemen (en daarna nog een ronde)
      const local = hooks.getLocal();
      const merged = mergeDocs(local, mergeDocs({}, remote));
      if (!sameDoc(merged, local)) hooks.applyMerged(merged);
      if (!sameDoc(local, sent)) again = true;
      write(LAST_KEY, String(Date.now()));
      setStatus({ state: 'ok', error: null });
      return true;
    } catch (e) {
      setStatus({ state: 'error', error: e.status === 404 ? 'Herstelcode niet gevonden op de server' : e.message });
      return false;
    } finally {
      running = null;
      if (again) { again = false; schedule(500); }
    }
  })();
  return running;
}

/** Na een wijziging: even wachten (meerdere wijzigingen in één keer) en dan syncen. */
export function schedule(ms = 1500) {
  if (!syncCode()) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), ms);
}

/** Sync aanzetten met een nieuwe code: je huidige lijst wordt de eerste versie op de server. */
export async function enableSync() {
  const code = newCode();
  await post(code, hooks.getLocal(), { create: true });
  write(CODE_KEY, code);
  write(LAST_KEY, String(Date.now()));
  setStatus({ state: 'ok', error: null });
  return code;
}

/** Herstellen/koppelen met een bestaande code: samenvoegen met wat er op dit toestel staat. */
export async function restoreSync(input) {
  const code = formatCode(input);
  if (!validCode(code)) throw new Error('Een herstelcode heeft 16 tekens');
  const remote = await post(code, hooks.getLocal()).catch((e) => {
    throw e.status === 404 ? new Error('Deze herstelcode is onbekend') : e;
  });
  write(CODE_KEY, code);
  write(LAST_KEY, String(Date.now()));
  const merged = mergeDocs(hooks.getLocal(), mergeDocs({}, remote));
  hooks.applyMerged(merged);
  setStatus({ state: 'ok', error: null });
  return merged.games.length;
}

/** Sync uitzetten op dit toestel (de lijst op de server blijft bestaan). */
export function disableSync() {
  clearTimeout(timer);
  write(CODE_KEY, null);
  write(LAST_KEY, null);
  setStatus({ state: 'idle', error: null });
}

export function initSync(h) {
  hooks = h;
  syncNow();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
    else if (timer) syncNow({ keepalive: true }); // openstaande wijzigingen nog snel versturen
  });
  window.addEventListener('online', () => syncNow());
}
