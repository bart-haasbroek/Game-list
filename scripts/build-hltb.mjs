// Haalt speeltijden op bij HowLongToBeat voor de bekendere games uit de gamedatabase
// (uitgebracht en populariteit >= MIN_POP) en bewaart ze per IGDB-id.
//
// Draaien:  yarn hltb              -> uploadt naar Netlify Blobs (als NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID er zijn),
//                                     anders schrijft het public/data/hltb.json
//           yarn hltb --write-file -> schrijft (ook) public/data/hltb.json (de reservekopie in de app)
//           yarn hltb --limit 50   -> alleen de 50 populairste (om te testen)
//           yarn hltb --match "mario|zelda" -> alleen games waarvan titel of franchise hierop past (regex)
//           Een gedeeltelijke run (--limit/--match) vult de bestaande data aan in plaats van die te vervangen.
//
// Eén keer per maand via .github/workflows/update-hltb.yml. Duurt een paar uur: rustig aan (1 zoekopdracht
// per seconde) zodat HLTB er geen last van heeft.
//
// hltb.json: { version, source, generated, fields, games: { igdbId: [hltbId, hoofdverhaal, verhaal+extra, 100%, spelers] } }

import { readFile, writeFile } from 'node:fs/promises';
import { getStore } from '@netlify/blobs';
import { hltbSearch, pickMatch, altTitle, hltbRow } from '../netlify/lib/hltb.mjs';

const MIN_POP = 5;
const DELAY = 1000;
const FILE = new URL('../public/data/hltb.json', import.meta.url);
const GAMES_FILE = new URL('../public/data/games.json', import.meta.url);
const { NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID } = process.env;
const upload = Boolean(NETLIFY_AUTH_TOKEN && NETLIFY_SITE_ID);
const writeFileToo = process.argv.includes('--write-file') || !upload;
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
const matchArg = process.argv.indexOf('--match');
const match = matchArg > 0 ? new RegExp(process.argv[matchArg + 1], 'i') : null;
const partial = Boolean(match) || limit !== Infinity;

if (process.env.CI && !upload) {
  console.error('NETLIFY_AUTH_TOKEN / NETLIFY_SITE_ID ontbreken: kan de data niet uploaden.');
  process.exit(1);
}
const store = upload ? getStore({ name: 'gamedata', siteID: NETLIFY_SITE_ID, token: NETLIFY_AUTH_TOKEN }) : null;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- 1. Welke games? ----------
const data = store ? await store.get('games', { type: 'json' }) : JSON.parse(await readFile(GAMES_FILE, 'utf8'));
if (!data?.games?.length) { console.error('Geen gamedatabase gevonden; draai eerst yarn data.'); process.exit(1); }
const today = new Date().toISOString().slice(0, 10);
const wanted = data.games
  .filter(g => g[2] && String(g[2]) <= today && (match || g[7] >= MIN_POP)) // met --match ook de minder bekende
  .filter(g => !match || match.test(g[1]) || match.test(data.franchises[g[5]] || ''))
  .sort((a, b) => b[7] - a[7])
  .slice(0, limit);

// Vorige resultaten: blijven staan voor games waarbij het zoeken nu mislukt
const prevText = store ? await store.get('hltb').catch(() => null) : await readFile(FILE, 'utf8').catch(() => null);
const prev = prevText ? JSON.parse(prevText).games || {} : {};

// ---------- 2. Zoeken ----------
console.log(`HowLongToBeat: ${wanted.length} games (populariteit >= ${MIN_POP}), ±${Math.round(wanted.length * DELAY / 60000)} min`);
const started = Date.now();
// Gedeeltelijke run: alles wat al bekend was blijft staan, alleen de gezochte games worden vernieuwd
// Games die niet (meer) in de database staan (bv. weggefilterde fangames/homebrew) vallen weg
const known = new Set(data.games.map(g => String(g[0])));
const games = partial ? Object.fromEntries(Object.entries(prev).filter(([id]) => known.has(id))) : {};
let found = 0, errors = 0;
for (const [i, g] of wanted.entries()) {
  const [id, title, release] = g;
  const year = Number(String(release).slice(0, 4)) || null;
  try {
    let m = pickMatch(await hltbSearch(title), title, year);
    const alt = !m && altTitle(title);
    if (alt) { await sleep(DELAY); m = pickMatch(await hltbSearch(alt), alt, null); }
    if (m && (m.comp_main || m.comp_plus || m.comp_100)) { games[id] = hltbRow(m); found++; }
    else delete games[id];
  } catch (e) {
    errors++;
    if (prev[id]) games[id] = prev[id];
    if (errors <= 5) console.warn(`  ${title}: ${e.message}`);
    // Werkt het zoeken helemaal niet meer (HLTB veranderd/geblokkeerd)? Dan stoppen, oude data blijft staan.
    if (errors >= 25 && errors > (i + 1) * 0.5) { console.error('Te veel fouten, gestopt. Oude data blijft staan.'); process.exit(1); }
  }
  if ((i + 1) % 250 === 0) console.log(`  ${i + 1}/${wanted.length} · ${found} gevonden · ${errors} fouten · ${Math.round((Date.now() - started) / 60000)} min`);
  await sleep(DELAY);
}
console.log(`${found} van ${wanted.length} gevonden (${errors} fouten) in ${Math.round((Date.now() - started) / 60000)} min`);

// ---------- 3. Opslaan ----------
const out = {
  version: 1, source: 'howlongtobeat', generated: new Date().toISOString(),
  fields: ['hltbId', 'main', 'plus', 'complete', 'players'], games,
};
const text = JSON.stringify(out);
if (upload) {
  const before = Object.keys(prev).length;
  if (!partial && before && Object.keys(games).length < before * 0.8 && !process.argv.includes('--force')) {
    console.error(`Gestopt: ${Object.keys(games).length} is veel minder dan de vorige keer (${before}). Oude data blijft staan.`);
    process.exit(1);
  }
  await store.set('hltb', text);
  console.log('Geüpload naar Netlify Blobs (store "gamedata", key "hltb").');
}
if (writeFileToo) {
  await writeFile(FILE, text);
  console.log(`Geschreven naar public/data/hltb.json (${Math.round(text.length / 1024)} KB)`);
}
