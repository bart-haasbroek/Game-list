// Haalt per game uit public/data/games.json de speeltijd (HowLongToBeat-achtig) en critici-score op bij IGDB
// en schrijft public/data/extras.json.
//
// Draaien:  yarn extras   (offline reserve; de app haalt verse waarden live op via /api/game)
// Nodig:    TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
//
// extras.json: { version, generated, fields, games: { igdbId: [critici, aantal recensies, snel, normaal, 100%] } }
// Scores 0–100 (0 = onbekend), speeltijden in uren met één decimaal (0 = onbekend).

import { readFile, writeFile } from 'node:fs/promises';
import { igdb, igdbConfigured } from '../netlify/lib/igdb.mjs';

const GAMES = new URL('../public/data/games.json', import.meta.url);
const OUT = new URL('../public/data/extras.json', import.meta.url);

if (!igdbConfigured()) {
  console.error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET ontbreken (node --env-file=.env …).');
  process.exit(1);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const hours = (sec) => (sec ? Math.round(sec / 360) / 10 : 0);

const data = JSON.parse(await readFile(GAMES, 'utf8'));
if (data.source !== 'igdb') {
  console.error('games.json komt niet uit IGDB; draai eerst yarn data.');
  process.exit(1);
}
const ids = data.games.map(g => g[0]);
const wanted = new Set(ids);
const extras = new Map(); // id -> [critic, count, hastily, normally, completely]
const row = (id) => extras.get(id) || extras.set(id, [0, 0, 0, 0, 0]).get(id);
const started = Date.now();

// ---------- 1. Critici-score (gemiddelde van recensies, vergelijkbaar met Metacritic) ----------
process.stdout.write(`Critici-scores voor ${ids.length} games`);
for (let i = 0; i < ids.length; i += 500) {
  const chunk = ids.slice(i, i + 500);
  const page = await igdb('games', `fields aggregated_rating, aggregated_rating_count;
where id = (${chunk.join(',')}) & aggregated_rating != null; limit 500;`);
  for (const g of page) {
    const r = row(g.id);
    r[0] = Math.round(g.aggregated_rating);
    r[1] = g.aggregated_rating_count || 0;
  }
  if ((i / 500) % 5 === 0) process.stdout.write('.');
  await sleep(260); // IGDB: max 4 verzoeken per seconde
}
console.log(` ${[...extras.values()].filter(r => r[0]).length} gevonden`);

// ---------- 2. Speeltijd (IGDB time-to-beat: snel / normaal / alles) ----------
process.stdout.write('Speeltijden');
let lastId = 0, ttb = 0;
for (;;) {
  const page = await igdb('game_time_to_beats', `fields game_id, hastily, normally, completely;
where id > ${lastId}; sort id asc; limit 500;`);
  if (!page.length) break;
  for (const t of page) {
    if (!wanted.has(t.game_id)) continue;
    const r = row(t.game_id);
    r[2] = hours(t.hastily); r[3] = hours(t.normally); r[4] = hours(t.completely);
    if (r[2] || r[3] || r[4]) ttb++;
  }
  lastId = page[page.length - 1].id;
  if (lastId % 5 === 0 || page.length < 500) process.stdout.write('.');
  await sleep(260);
}
console.log(` ${ttb} gevonden`);

// ---------- 3. Wegschrijven ----------
const games = {};
for (const [id, r] of extras) if (r.some(Boolean)) games[id] = r;
const out = { version: 1, source: 'igdb', generated: new Date().toISOString(), fields: ['critic', 'criticCount', 'hastily', 'normally', 'completely'], games };
const text = JSON.stringify(out);
await writeFile(OUT, text);
console.log(`Klaar: ${Object.keys(games).length} games met extra's · ${Math.round(text.length / 1024)} KB · ${Math.round((Date.now() - started) / 1000)} s`);
