// Gamedatabase (IGDB, via Netlify Blobs): laden, zoeken, franchises en releasedatums.

// Eigen franchiselijst: volgorde = volgorde in Ontdek. `re` herkent de franchise aan de titel,
// `alias` koppelt franchise-namen uit IGDB aan deze franchise.
export const CURATED_FRANCHISES = [
  { name: 'Mario', re: /\bmario\b|\bluigi\b|\bpeach\b|\bbowser\b/i, alias: ['Mario', 'Super Mario', 'Mario Kart', 'Mario Party', 'Paper Mario', 'Mario & Luigi', 'Luigi', 'Mario Tennis', 'Mario Golf', 'Mario Sports'] },
  { name: 'Zelda', re: /zelda|hyrule/i, alias: ['The Legend of Zelda'] },
  { name: 'Pokémon', re: /pok[eé]mon|pikachu/i, alias: ['Pokémon'] },
  { name: 'Kirby', re: /\bkirby/i, alias: ['Kirby'] },
  { name: 'Donkey Kong', re: /donkey kong|diddy kong/i, alias: ['Donkey Kong'] },
  { name: 'Metroid', re: /metroid/i, alias: ['Metroid'] },
  { name: 'Star Fox', re: /star ?fox|lylat/i, alias: ['Star Fox'] },
  { name: 'Yoshi', re: /\byoshi/i, alias: ['Yoshi'] },
  { name: 'Wario', re: /\bwario/i, alias: ['Wario', 'WarioWare'] },
  { name: 'Fire Emblem', re: /fire emblem/i, alias: ['Fire Emblem'] },
  { name: 'Animal Crossing', re: /animal crossing/i, alias: ['Animal Crossing'] },
  { name: 'Splatoon', re: /splatoon/i, alias: ['Splatoon'] },
  { name: 'Pikmin', re: /pikmin/i, alias: ['Pikmin'] },
  { name: 'Super Smash Bros.', re: /smash bros/i, alias: ['Super Smash Bros.'] },
  { name: 'Xenoblade', re: /xenoblade/i, alias: ['Xenoblade Chronicles', 'Xeno'] },
  { name: 'F-Zero', re: /f-zero/i, alias: ['F-Zero'] },
  { name: 'Kid Icarus', re: /kid icarus/i, alias: ['Kid Icarus'] },
  { name: 'EarthBound', re: /earthbound|\bmother [123]\b/i, alias: ['Mother', 'EarthBound'] },
  { name: 'Professor Layton', re: /professor layton|layton/i, alias: ['Professor Layton'] },
  { name: 'Golden Sun', re: /golden sun/i, alias: ['Golden Sun'] },
  { name: 'Advance Wars', re: /advance wars|famicom wars/i, alias: ['Wars'] },
  { name: 'Punch-Out!!', re: /punch-out/i, alias: ['Punch-Out!!'] },
  { name: 'Bayonetta', re: /bayonetta/i, alias: ['Bayonetta'] },
  { name: 'Sonic', re: /\bsonic\b/i, alias: ['Sonic the Hedgehog'] },
  { name: 'Bomberman', re: /bomberman/i, alias: ['Bomberman'] },
  { name: 'Mega Man', re: /mega ?man|rockman/i, alias: ['Mega Man'] },
  { name: 'Pac-Man', re: /pac-?man/i, alias: ['Pac-Man'] },
  { name: 'Rayman & Rabbids', re: /rayman|rabbids/i, alias: ['Rayman', 'Raving Rabbids'] },
  { name: 'Crash Bandicoot', re: /crash bandicoot|crash team|crash nitro/i, alias: ['Crash Bandicoot'] },
  { name: 'Spyro', re: /\bspyro/i, alias: ['Spyro the Dragon', 'Spyro'] },
  { name: 'Final Fantasy', re: /final fantasy/i, alias: ['Final Fantasy'] },
  { name: 'Dragon Quest', re: /dragon quest|dragon warrior/i, alias: ['Dragon Quest'] },
  { name: 'Monster Hunter', re: /monster hunter/i, alias: ['Monster Hunter'] },
  { name: 'Shin Megami Tensei & Persona', re: /megami tensei|\bpersona\b/i, alias: ['Megami Tensei', 'Persona'] },
  { name: 'Castlevania', re: /castlevania/i, alias: ['Castlevania'] },
  { name: 'Story of Seasons', re: /story of seasons|harvest moon|rune factory/i, alias: ['Story of Seasons', 'Harvest Moon', 'Rune Factory'] },
  { name: 'Tetris', re: /tetris/i, alias: ['Tetris'] },
  { name: 'Street Fighter', re: /street fighter/i, alias: ['Street Fighter'] },
  { name: 'Mortal Kombat', re: /mortal kombat/i, alias: ['Mortal Kombat'] },
  { name: 'LEGO', re: /^lego\b/i, alias: ['Lego video games', 'LEGO'] },
  { name: 'Just Dance', re: /just dance/i, alias: ['Just Dance'] },
  { name: 'Minecraft', re: /minecraft/i, alias: ['Minecraft'] },
];
// Vlaggenschip per franchise: de afbeelding van de map komt van deze game (populairste match).
// Een getal = IGDB-id. Zonder vlaggenschip: de populairste uitgekomen game van de reeks.
const FRANCHISE_HEROES = {
  'Mario': /^super mario odyssey$/i,
  'Zelda': /^the legend of zelda: breath of the wild$/i,
  'Pokémon': /^pok[eé]mon legends: arceus$/i,
  'Kirby': /^kirby and the forgotten land$/i,
  'Donkey Kong': /^donkey kong bananza$/i,
  'Metroid': /^metroid dread$/i,
  'Star Fox': /^star fox zero$/i,
  'Yoshi': /^yoshi's crafted world$/i,
  'Wario': /^warioware: get it together!?$/i,
  'Fire Emblem': /^fire emblem: three houses$/i,
  'Animal Crossing': /^animal crossing: new horizons$/i,
  'Splatoon': /^splatoon 3$/i,
  'Pikmin': /^pikmin 4$/i,
  'Super Smash Bros.': /^super smash bros\. ultimate$/i,
  'Xenoblade': /^xenoblade chronicles 3$/i,
  'F-Zero': /^f-zero gx$/i,
  'Kid Icarus': /^kid icarus: uprising$/i,
  'Professor Layton': /^professor layton and the miracle mask$/i,
  'Advance Wars': /^advance wars 1\+2/i,
  'Punch-Out!!': 2194, // Punch-Out!! (Wii); er zijn meer games met precies die naam
  'Bayonetta': /^bayonetta 3$/i,
  'Sonic': /^sonic (frontiers|mania)$/i,
  'Bomberman': /^super bomberman r$/i,
  'Mega Man': /^mega man 11$/i,
  'Pac-Man': /^pac-man world re-pac$/i,
  'Rayman & Rabbids': /^rayman legends/i,
  'Crash Bandicoot': /^crash bandicoot 4/i,
  'Spyro': 1582, // The Legend of Spyro: A New Beginning
  'Final Fantasy': /^final fantasy vii remake/i,
  'Dragon Quest': /^dragon quest xi s/i,
  'Monster Hunter': /^monster hunter rise$/i,
  'Shin Megami Tensei & Persona': /^persona 5 royal$/i,
  'Story of Seasons': /^story of seasons: a wonderful life$/i,
  'Tetris': /^tetris effect/i,
  'Street Fighter': /^street fighter 6$/i,
  'Mortal Kombat': /^mortal kombat 11$/i,
  'LEGO': /^lego star wars: the skywalker saga$/i,
  'Minecraft': /^minecraft$/i,
};
const curatedNames = new Set(CURATED_FRANCHISES.map(f => f.name));
const aliasMap = new Map(CURATED_FRANCHISES.flatMap(f => f.alias.map(a => [a.toLowerCase(), f.name])));

export const normalize = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

let entries = null;
let byKey = null;
let byFranchise = new Map();
let meta = null;
let loading = null;

// ---------- Laden ----------
// Bron: /api/games (Netlify Blobs, wekelijks bijgewerkt uit IGDB). Een kopie staat in Cache Storage,
// zodat de app offline werkt en direct start; daarna kijkt de app via /api/games-meta of er nieuwe data is.
// Reserve: /data/games.json in de app zelf (bv. met `yarn dev`, of als Blobs nog leeg is).
const DATA_URL = '/api/games';
const META_URL = '/api/games-meta';
const FALLBACK_URL = '/data/games.json';
const DATA_CACHE = 'gamedata-v1';
const IGDB_IMG = (id) => `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${id}.jpg`;

const listeners = new Set();
export const onDatasetUpdate = (cb) => listeners.add(cb);

async function getJSONResponse(url) {
  const res = await fetch(url, { cache: 'no-store' });
  // Zonder Netlify Functions (yarn dev) komt index.html terug in plaats van JSON
  if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) throw new Error('Niet beschikbaar: ' + url);
  return res;
}

async function readCache() {
  try {
    const res = await (await caches.open(DATA_CACHE)).match(DATA_URL);
    const data = res ? await res.json() : null;
    return data?.version === 3 ? data : null;
  } catch { return null; }
}

async function writeCache(text) {
  try { await (await caches.open(DATA_CACHE)).put(DATA_URL, new Response(text, { headers: { 'content-type': 'application/json' } })); } catch {}
}

async function download() {
  for (const url of [DATA_URL, FALLBACK_URL]) {
    try {
      const text = await (await getJSONResponse(url)).text();
      const data = JSON.parse(text);
      if (data.version === 3) return { data, text };
    } catch {}
  }
  throw new Error('Gamedatabase niet beschikbaar');
}

function apply(data) {
  meta = { generated: data.generated, count: data.games.length, source: data.source || 'igdb' };
  entries = data.games.map(([id, title, release, plats, cover, fr, gen, pop]) => {
    const igdbFranchise = fr >= 0 ? data.franchises[fr] : null;
    const curated = CURATED_FRANCHISES.find(f => f.re.test(title));
    const franchise = curated?.name || (igdbFranchise && (aliasMap.get(igdbFranchise.toLowerCase()) || igdbFranchise)) || null;
    return {
      key: 'igdb:' + id,
      source: 'igdb',
      sourceId: id,
      igdbId: id,
      title,
      release: release || null,
      year: release ? Number(String(release).slice(0, 4)) : null,
      platforms: plats.map(i => data.platforms[i]),
      cover: cover ? IGDB_IMG(cover) : null,
      coverFile: null,
      genres: (gen || []).map(i => data.genres[i]),
      franchise,
      pop: pop || 0,
      _n: normalize(title),
    };
  });
  for (const e of entries) e._w = e._n.split(' ');
  byKey = new Map(entries.map(e => [e.key, e]));
  byFranchise = new Map();
  for (const e of entries) if (e.franchise) (byFranchise.get(e.franchise) || byFranchise.set(e.franchise, []).get(e.franchise)).push(e);
  for (const list of byFranchise.values()) list.sort((a, b) => String(b.release || '0').localeCompare(String(a.release || '0')));
  heroCache.clear();
}

export function loadDataset() {
  if (entries) return Promise.resolve(entries);
  if (loading) return loading;
  loading = (async () => {
    let data = await readCache();
    if (!data) {
      const fresh = await download();
      data = fresh.data;
      await writeCache(fresh.text);
    }
    apply(data);
    checkForUpdate().catch(() => {});
    return entries;
  })().catch(e => { loading = null; throw e; });
  return loading;
}

/** Kijkt of er een nieuwere database is en laadt die. Geeft true terug als er iets veranderd is. */
export async function checkForUpdate() {
  if (!navigator.onLine) return false;
  const remote = await (await getJSONResponse(META_URL)).json();
  if (remote.generated === meta?.generated) return false;
  const text = await (await getJSONResponse(DATA_URL)).text();
  const data = JSON.parse(text);
  if (data.version !== 3 || data.generated === meta?.generated) return false;
  await writeCache(text);
  apply(data);
  listeners.forEach(cb => cb());
  return true;
}

/** Zoekt een game op titel (voor eigen games uit een oudere versie van de app, zonder IGDB-id). */
export function findEntry(title, year, platforms = []) {
  if (!entries || !title) return null;
  const n = normalize(title);
  const hits = entries.filter(e => e._n === n);
  if (!hits.length) return null;
  const score = (e) => (platforms.some(p => e.platforms.includes(p)) ? 10 : 0) - (year && e.year ? Math.abs(year - e.year) * 2 : 1) + Math.min(e.pop, 50) / 50;
  const best = hits.sort((a, b) => score(b) - score(a))[0];
  return year && best.year && Math.abs(year - best.year) > 2 ? null : best;
}

export const datasetInfo = () => meta;
export const getEntry = (key) => byKey?.get(key) || null;

// ---------- Zoeken ----------
// Kleinste aantal tikfouten tussen `t` en het begin van woord `w` (Levenshtein, prefix mag eindigen waar het wil)
function prefixDistance(t, w, max) {
  if (w.length < t.length - max) return max + 1;
  let prev2 = null, prev = Array.from({ length: w.length + 1 }, (_, j) => j);
  for (let i = 1; i <= t.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= w.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (t[i - 1] === w[j - 1] ? 0 : 1));
      // Twee letters omgewisseld ("kriby") telt als één fout
      if (prev2 && i > 1 && j > 1 && t[i - 1] === w[j - 2] && t[i - 2] === w[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return Math.min(...prev);
}
// Toegestane tikfouten per zoekwoord: korte woorden moeten kloppen
const typoBudget = (t) => (t.length >= 8 ? 2 : t.length >= 4 ? 1 : 0);

export function searchDataset(q, limit = 60) {
  if (!entries) return [];
  const nq = normalize(q);
  const tokens = nq.split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const out = [];
  const budgets = tokens.map(typoBudget);
  for (const e of entries) {
    const words = e._w;
    // Elk zoekwoord moet het begin van een woord in de titel zijn, met een paar tikfouten speling
    let typos = 0, ok = true;
    for (let i = 0; i < tokens.length && ok; i++) {
      const t = tokens[i];
      if (words.some(w => w.startsWith(t))) continue;
      if (!budgets[i]) { ok = false; break; }
      let best = budgets[i] + 1;
      for (const w of words) { best = Math.min(best, prefixDistance(t, w, budgets[i])); if (best === 1) break; }
      if (best > budgets[i]) ok = false; else typos += best;
    }
    if (!ok) continue;
    let score = -typos * 30;
    if (e._n === nq) score += 100;
    else if (e._n.startsWith(nq)) score += 50;
    else if (e._n.includes(nq)) score += 25;
    score += tokens.filter(t => words.includes(t)).length * 5;
    score += Math.min(e.pop, 100) / 10; // bekendere games hoger
    if (curatedNames.has(e.franchise)) score += 8; // bekende reeksen iets hoger
    if (e.coverFile || e.cover) score += 5;
    score -= e._n.length / 20;
    if (e.year) score += Math.max(0, e.year - 1980) / 20; // bij gelijke treffers: nieuwere games iets hoger
    out.push([score, e]);
  }
  return out.sort((a, b) => b[0] - a[0] || (b[1].year || 0) - (a[1].year || 0)).slice(0, limit).map(x => x[1]);
}

// ---------- Franchises ----------
export function franchiseList() {
  if (!entries) return [];
  const counts = new Map([...byFranchise].map(([n, list]) => [n, list.length]));
  const curated = CURATED_FRANCHISES.map(f => f.name).filter(n => counts.get(n) >= 1);
  const others = [...counts].filter(([n, c]) => !curated.includes(n) && c >= 6).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  return [...curated, ...others].map(name => ({ name, count: counts.get(name), curated: curated.includes(name) }));
}

export const franchiseGames = (name) => byFranchise.get(name) || [];

/** Populairste games (IGDB: aantal beoordelingen + hype) */
export const popularGames = (limit = 300) => (entries ? entries.slice().sort((a, b) => b.pop - a.pop).slice(0, limit) : []);

const heroCache = new Map();
export function franchiseCover(name) {
  // Voorkant van de map: het vlaggenschip, anders de populairste uitgekomen game met een cover
  if (heroCache.has(name)) return heroCache.get(name);
  const withCover = franchiseGames(name).filter(e => e.coverFile || e.cover);
  const byPop = (list) => list.slice().sort((a, b) => b.pop - a.pop)[0];
  const re = FRANCHISE_HEROES[name];
  const hero = (re && byPop(withCover.filter(e => typeof re === 'number' ? e.igdbId === re : re.test(e.title))))
    || byPop(withCover.filter(e => !isFuture(e.release))) || withCover[0] || null;
  if (entries) heroCache.set(name, hero);
  return hero;
}

// Aankomende games. `notable`: alleen bekendere titels (met hype/beoordelingen in IGDB of uit een franchise)
export function upcoming(limit = 20, { notable = true } = {}) {
  if (!entries) return [];
  const all = entries.filter(e => isFuture(e.release)).sort((a, b) => String(a.release).localeCompare(String(b.release)));
  const known = all.filter(e => e.pop >= 3 || e.franchise);
  return (notable && known.length >= 5 ? known : all).slice(0, limit);
}

// ---------- Datums ----------
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const todayISO = () => new Date().toISOString().slice(0, 10);

export function isFuture(release) {
  if (!release) return false;
  const r = String(release), t = todayISO();
  if (r.length === 10) return r > t;
  if (r.length === 7) return r > t.slice(0, 7);
  return r > t.slice(0, 4);
}

export function formatRelease(release) {
  if (!release) return null;
  const [y, m, d] = String(release).split('-').map(Number);
  if (d) return `${d} ${MONTHS[m - 1]} ${y}`;
  if (m) return `${MONTHS[m - 1]} ${y}`;
  return String(y);
}

// Afteller: { big, small } of null als de game al uit is
export function countdown(release) {
  const r = String(release || '');
  if (r === todayISO()) return { big: 'Vandaag!', small: 'nu verkrijgbaar', days: 0 };
  if (!isFuture(release)) return null;
  if (r.length === 10) {
    const days = Math.round((new Date(r + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
    if (days === 1) return { big: 'Morgen', small: formatRelease(r), days };
    return { big: `${days}`, unit: days === 1 ? 'dag' : 'dagen', small: formatRelease(r), days };
  }
  return { big: formatRelease(r), small: 'datum nog niet precies bekend', days: Infinity };
}
