// Bouwt de gamedatabase uit IGDB: alle (hoofd)games op Nintendo-platforms met titel, releasedatum,
// platforms, cover, franchise, genres en populariteit.
//
// Draaien:  yarn data           -> bijwerken: alleen gewijzigde, aangekondigde en recente games ophalen en
//                                  verwerken in public/data/games.json (+ games-meta.json)
//           yarn data --full    -> alles opnieuw (gebeurt ook vanzelf als de laatste volledige keer > 85 dagen is)
//           yarn data --force   -> ook als er opeens veel minder games zijn dan de vorige keer
// Nodig:    TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET   (lokaal in .env, in GitHub als secrets)
//
// Elke maand via .github/workflows/update-data.yml (of de knop in de app): die commit de bestanden naar
// GitHub als er iets veranderd is, waarna Netlify de site opnieuw deployt.

import { readFile, writeFile } from 'node:fs/promises';
import { igdb, igdbConfigured, NINTENDO_PLATFORMS } from '../netlify/lib/igdb.mjs';

const FILE = new URL('../public/data/games.json', import.meta.url);
const META_FILE = new URL('../public/data/games-meta.json', import.meta.url);

if (!igdbConfigured()) {
  console.error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET ontbreken.');
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

// ---------- 0. Volledig of bijwerken? ----------
const FULL_EVERY_DAYS = 85; // ± elk kwartaal alles opnieuw (opruimen, populariteit, filterwijzigingen)
const prev = await readFile(FILE, 'utf8').then(t => JSON.parse(t)).catch(() => null);
const lastFull = prev?.lastFull || prev?.generated || null;
const full = process.argv.includes('--full') || !prev?.games?.length
  || !lastFull || Date.now() - Date.parse(lastFull) > FULL_EVERY_DAYS * 864e5;
// Bijwerken: wat sinds de vorige keer in IGDB is gewijzigd (2 dagen marge), plus alles wat nog moet komen of
// net uit is (releasedatums en covers van zulke games veranderen vaak). Krijgt een game zonder datum er een,
// dan telt dat in IGDB als wijziging van de game zelf.
const unix = (d) => Math.floor(Date.parse(d) / 1000);
const recentFrom = Math.floor(Date.now() / 1000) - 120 * 86400;
const extra = full ? '' : ` & (updated_at > ${unix(prev.generated) - 2 * 86400} | first_release_date > ${recentFrom})`;
console.log(full ? `Volledig ophalen${lastFull ? ` (vorige keer volledig: ${lastFull.slice(0, 10)})` : ''}` : `Bijwerken sinds ${prev.generated.slice(0, 10)}`);

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
  & (cover != null | first_release_date != null)${extra} & id > ${lastId};
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
// Bijwerken: de bestaande lijsten (platforms/franchises/genres) houden, zodat de indexen blijven kloppen
const platforms = full ? [] : [...prev.platforms], franchises = full ? [] : [...prev.franchises], genres = full ? [] : [...prev.genres];
const idx = (list, v) => { let i = list.indexOf(v); if (i < 0) i = list.push(v) - 1; return i; };

let skipped = 0;
const removeIds = new Set(); // bij bijwerken: games die nu (alsnog) wegvallen
const fresh = raw.map(g => {
  const plats = [...new Set((g.platforms || []).map(p => NINTENDO_PLATFORMS[p]).filter(Boolean))];
  const pop = (g.total_rating_count || 0) + (g.hypes || 0);
  if (unofficial(g, plats, releaseOf(g), pop)) { skipped++; removeIds.add(g.id); return null; }
  if (!plats.length) { removeIds.add(g.id); return null; }
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
}).filter(Boolean);
console.log(`${skipped} onofficiële games / homebrew overgeslagen`);

// Bijwerken: verwerken in de bestaande lijst (vervangen, toevoegen, weghalen); volledig: de nieuwe lijst
let games = fresh, added = 0, changed = 0;
if (!full) {
  const byId = new Map(prev.games.map(r => [r[0], r]));
  for (const id of removeIds) byId.delete(id);
  for (const r of fresh) {
    const old = byId.get(r[0]);
    if (!old) added++; else if (JSON.stringify(old) !== JSON.stringify(r)) changed++;
    byId.set(r[0], r);
  }
  games = [...byId.values()].sort((a, b) => a[0] - b[0]);
  const removed = prev.games.length + added - games.length;
  console.log(`${added} nieuw, ${changed} gewijzigd, ${removed} weggehaald`);
  if (!added && !changed && !removed) { console.log('Niets veranderd: bestanden blijven zoals ze zijn.'); process.exit(0); }
}

const now = new Date().toISOString();
const data = { version: 3, source: 'igdb', generated: now, lastFull: full ? now : lastFull, platforms, franchises, genres, games };
const text = JSON.stringify(data);
console.log(`${games.length} games, ${(text.length / 1024 / 1024).toFixed(1)} MB`);

// ---------- 3. Opslaan ----------
// Veiligheid: niet overschrijven als IGDB opeens veel minder games teruggeeft (storing)
const prevCount = prev?.games?.length || 0;
if (prevCount && games.length < prevCount * 0.8 && !process.argv.includes('--force')) {
  console.error(`Gestopt: ${games.length} games is veel minder dan de vorige keer (${prevCount}). Oude data blijft staan.`);
  process.exit(1);
}
await writeFile(FILE, text);
// Klein bestand waarmee de app goedkoop ziet of er een nieuwere versie is
await writeFile(META_FILE, JSON.stringify({ generated: data.generated, count: games.length, source: 'igdb' }));
console.log('Geschreven naar public/data/games.json en games-meta.json');
