// Speeltijden van HowLongToBeat per IGDB-game (maandelijks opgehaald door scripts/build-hltb.mjs).
// Bron: /data/hltb.json (door de GitHub Action gecommit), met een kopie in Cache Storage voor offline.

const URL_API = '/data/hltb.json';
const URL_FILE = URL_API;
const CACHE = 'gamedata-v1';
const MIN_PLAYERS = 3; // minder spelers: te weinig om op te vertrouwen

let table = null;
let loading = null;

async function fromCache() {
  try { const r = await (await caches.open(CACHE)).match(URL_API); return r ? (await r.json()).games : null; } catch { return null; }
}
async function fromNetwork() {
  const r = await fetch(URL_API, { cache: 'no-cache' });
  if (!r.ok) throw new Error(r.status);
  const copy = r.clone();
  const d = await r.json();
  try { await (await caches.open(CACHE)).put(URL_API, copy); } catch { /* geen opslag: niet erg */ }
  return d.games;
}
const fromFile = () => fetch(URL_FILE).then(r => (r.ok ? r.json() : { games: {} })).then(d => d.games || {});

/** Laadt de tabel (eerst uit de cache, dan vers van het netwerk). `onUpdate` als er nieuwere data binnenkomt. */
export function loadHltb(onUpdate) {
  if (table) return Promise.resolve(table);
  return (loading ??= (async () => {
    const cached = await fromCache();
    if (cached) {
      table = cached;
      fromNetwork().then(g => { table = g; onUpdate?.(); }).catch(() => {});
      return table;
    }
    table = await fromNetwork().catch(fromFile).catch(() => ({}));
    return table;
  })().finally(() => { loading = null; }));
}

/** { id, main, plus, complete, players } in uren, of null als HLTB (nog) niks betrouwbaars heeft */
export function hltbFor(igdbId) {
  const r = igdbId && table?.[igdbId];
  if (!r) return null;
  const [id, main, plus, complete, players] = r;
  if (players < MIN_PLAYERS || !(main || plus || complete)) return null;
  return { id, main, plus, complete, players };
}
