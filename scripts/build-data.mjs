// Bouwt de gamedatabase uit IGDB: alle (hoofd)games op Nintendo-platforms met titel, releasedatum,
// platforms, cover, franchise, genres en populariteit.
//
// Draaien:  yarn data              -> uploadt naar Netlify Blobs (als NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID er zijn),
//                                     anders schrijft het public/data/games.json
//           yarn data --write-file -> schrijft (ook) public/data/games.json (de reservekopie in de app)
// Nodig:    TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET   (lokaal in .env, in GitHub als secrets)
//
// Elke maandag automatisch via .github/workflows/update-data.yml, of handmatig via de knop in de app.

import { writeFile } from 'node:fs/promises';
import { getStore } from '@netlify/blobs';
import { igdb, igdbConfigured, NINTENDO_PLATFORMS } from '../netlify/lib/igdb.mjs';

const FILE = new URL('../public/data/games.json', import.meta.url);
const { NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID } = process.env;
const upload = Boolean(NETLIFY_AUTH_TOKEN && NETLIFY_SITE_ID);
const writeFileToo = process.argv.includes('--write-file') || !upload;

if (!igdbConfigured()) {
  console.error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET ontbreken.');
  process.exit(1);
}
if (process.env.CI && !upload) {
  console.error('NETLIFY_AUTH_TOKEN / NETLIFY_SITE_ID ontbreken: kan de data niet uploaden.');
  process.exit(1);
}

const PLATFORM_IDS = Object.keys(NINTENDO_PLATFORMS).map(Number);
// Hoofdgame, standalone uitbreiding, remake, remaster, uitgebreide game, port (geen DLC, bundels, updates)
const GAME_TYPES = [0, 4, 8, 9, 10, 11];
// Onofficiële games (fangames, bootlegs, ROM-hacks) weglaten: IGDB-trefwoorden
const KW_UNOFFICIAL = new Set([2004 /* unofficial */, 1603 /* bootleg */, 16696 /* rom hack */]);
const KW_FANGAME = 24124; // fangame: alleen houden als hij bekend genoeg is (bv. Touhou-games op Switch)
// Laatste jaar met officiële releases per oud platform; latere games zijn vrijwel altijd homebrew
const RETRO_END = {
  NES: 1995, FDS: 1991, SNES: 2000, N64: 2002, 'Game Boy': 2001, GBC: 2003, GBA: 2008,
  'Virtual Boy': 1996, 'Game & Watch': 1992, 'Pokémon mini': 2002, GameCube: 2007,
};
const POPULAR = 10; // populariteit waarboven we een game altijd houden

function unofficial(g, plats, release, pop) {
  const kw = g.keywords || [];
  if (kw.some(k => KW_UNOFFICIAL.has(k))) return true;
  if (pop >= POPULAR) return false;
  const retroOnly = plats.length > 0 && plats.every(p => RETRO_END[p]);
  // Fangame op een oud platform; op Switch e.d. zijn het officiële uitgaves (Touhou e.d.)
  if (kw.includes(KW_FANGAME) && retroOnly) return true;
  // Alleen op oude platforms en jaren na het einde ervan uitgekomen: homebrew.
  // Uitzondering: games uit een bekende reeks (bv. Shantae Advance in 2025)
  const year = parseInt(release, 10);
  const series = g.franchise || g.franchises?.length;
  if (year && retroOnly && !series && plats.every(p => year > RETRO_END[p] + 1)) return true;
  return false;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const iso = (unix) => new Date(unix * 1000).toISOString().slice(0, 10);

// Releasedatum op een Nintendo-platform, met de juiste precisie (IGDB zet "2027" op 31-12-2027)
function releaseOf(g) {
  const dates = (g.release_dates || [])
    .filter(d => NINTENDO_PLATFORMS[d.platform] && d.date && d.date_format !== 7)
    .sort((a, b) => a.date - b.date || (a.date_format ?? 0) - (b.date_format ?? 0));
  const d = dates[0];
  if (!d) return g.first_release_date ? iso(g.first_release_date) : null;
  const full = iso(d.date);
  if (d.date_format === 0 || d.date_format == null) return full;
  if (d.date_format === 1) return full.slice(0, 7);
  return full.slice(0, 4); // jaar of kwartaal
}

// ---------- 1. Ophalen ----------
const started = Date.now();
const raw = [];
let lastId = 0;
process.stdout.write('IGDB ophalen');
for (;;) {
  const page = await igdb('games', `fields name, first_release_date, platforms, cover.image_id,
  release_dates.date, release_dates.date_format, release_dates.platform,
  franchise.name, franchises.name, collections.name, genres.name, total_rating_count, hypes, keywords;
where platforms = (${PLATFORM_IDS.join(',')}) & version_parent = null & game_type = (${GAME_TYPES.join(',')})
  & (cover != null | first_release_date != null) & id > ${lastId};
sort id asc;
limit 500;`);
  if (!page.length) break;
  raw.push(...page);
  lastId = page[page.length - 1].id;
  process.stdout.write('.');
  await sleep(260); // IGDB: max 4 verzoeken per seconde
}
console.log(` ${raw.length} games in ${Math.round((Date.now() - started) / 1000)} s`);

// ---------- 2. Compact formaat ----------
// games: [igdbId, titel, release|0, [platform-index], coverId|0, franchise-index|-1, [genre-index], populariteit]
const platforms = [], franchises = [], genres = [];
const idx = (list, v) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };

let skipped = 0;
const games = raw.map(g => {
  const plats = [...new Set((g.platforms || []).map(p => NINTENDO_PLATFORMS[p]).filter(Boolean))];
  const pop = (g.total_rating_count || 0) + (g.hypes || 0);
  if (unofficial(g, plats, releaseOf(g), pop)) { skipped++; return null; }
  const franchise = g.franchise?.name || g.franchises?.[0]?.name || g.collections?.[0]?.name || null;
  return [
    g.id,
    g.name,
    releaseOf(g) || 0,
    plats.map(p => idx(platforms, p)),
    g.cover?.image_id || 0,
    franchise ? idx(franchises, franchise) : -1,
    (g.genres || []).map(x => idx(genres, x.name)),
    pop,
  ];
}).filter(g => g && g[3].length);
console.log(`${skipped} onofficiële games / homebrew overgeslagen`);

const data = { version: 3, source: 'igdb', generated: new Date().toISOString(), platforms, franchises, genres, games };
const text = JSON.stringify(data);
console.log(`${games.length} games, ${(text.length / 1024 / 1024).toFixed(1)} MB`);

// ---------- 3. Opslaan ----------
if (upload) {
  const store = getStore({ name: 'gamedata', siteID: NETLIFY_SITE_ID, token: NETLIFY_AUTH_TOKEN });
  // Veiligheid: niet overschrijven als IGDB opeens veel minder games teruggeeft (storing)
  const prev = await store.get('meta', { type: 'json' }).catch(() => null);
  if (prev?.count && games.length < prev.count * 0.8 && !process.argv.includes('--force')) {
    console.error(`Gestopt: ${games.length} games is veel minder dan de vorige keer (${prev.count}). Oude data blijft staan.`);
    process.exit(1);
  }
  await store.set('games', text);
  await store.setJSON('meta', { generated: data.generated, count: games.length, source: 'igdb' });
  console.log('Geüpload naar Netlify Blobs (store "gamedata").');
}
if (writeFileToo) {
  await writeFile(FILE, text);
  console.log('Geschreven naar public/data/games.json');
}
