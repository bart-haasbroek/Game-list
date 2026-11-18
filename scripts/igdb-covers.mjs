// Vult ontbrekende covers in public/data/games.json aan met covers uit IGDB.
// Draait na build-data.mjs (zie `yarn data`), of los: `yarn covers`.
// Nodig: TWITCH_CLIENT_ID en TWITCH_CLIENT_SECRET (in .env of de omgeving).
//
// Koppelt op genormaliseerde titel (+ alternatieve namen), en controleert platform en jaar,
// zodat een game met dezelfde naam op een ander platform of uit een ander jaar niet wordt gekozen.
// Het image_id komt als 10e veld in de game-array (index 9).

import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../public/data/games.json', import.meta.url);
const id = process.env.TWITCH_CLIENT_ID;
const secret = process.env.TWITCH_CLIENT_SECRET;
if (!id || !secret) {
  console.log('IGDB-covers overgeslagen: TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET ontbreken.');
  process.exit(0);
}

// Platformnamen in games.json -> IGDB-platform-id's
const PLATFORMS = {
  'Switch': [130], 'Switch 2': [508], 'Wii U': [41], 'Wii': [5],
  'DS': [20, 159], 'DSi': [159, 20], '3DS': [37, 137], 'New 3DS': [137, 37],
  'GBA': [24], 'GBC': [22], 'Game Boy': [33], 'SNES': [19, 58, 306], 'NES': [18, 99],
  'FDS': [51, 99], 'N64': [4, 416], 'GameCube': [21], 'Virtual Boy': [87],
  'Game & Watch': [307], 'Pokémon mini': [166],
};
const ALL_IDS = [...new Set(Object.values(PLATFORMS).flat())];

const norm = (s) => String(s)
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[™®©]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/^the /, '')
  .trim();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function token() {
  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`, { method: 'POST' });
  if (!res.ok) throw new Error('Inloggen bij Twitch mislukt (' + res.status + ')');
  return (await res.json()).access_token;
}

async function igdb(accessToken, body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': id, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain' },
      body,
    });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * (i + 1)); continue; }
    throw new Error('IGDB-fout ' + res.status + ': ' + (await res.text()).slice(0, 200));
  }
  throw new Error('IGDB blijft weigeren (rate limit)');
}

// ---------- 1. Alle Nintendo-games met cover uit IGDB ophalen ----------
const accessToken = await token();
const igdbGames = [];
let lastId = 0;
process.stdout.write('IGDB ophalen');
for (;;) {
  const page = await igdb(accessToken, `fields name, alternative_names.name, first_release_date, cover.image_id, platforms, version_parent;
where platforms = (${ALL_IDS.join(',')}) & cover != null & id > ${lastId};
sort id asc;
limit 500;`);
  if (!page.length) break;
  igdbGames.push(...page);
  lastId = page[page.length - 1].id;
  process.stdout.write('.');
  await sleep(260); // max 4 verzoeken per seconde
}
console.log(` ${igdbGames.length} games`);

// Index op genormaliseerde naam
const byName = new Map();
for (const g of igdbGames) {
  if (!g.cover?.image_id) continue;
  const names = new Set([g.name, ...(g.alternative_names || []).map(a => a.name)].filter(Boolean).map(norm));
  for (const n of names) {
    if (!n) continue;
    (byName.get(n) || byName.set(n, []).get(n)).push(g);
  }
}

// ---------- 2. Koppelen aan games zonder cover ----------
const data = JSON.parse(await readFile(FILE, 'utf8'));
let missing = 0, matched = 0;
for (const entry of data.games) {
  const [, title, release, plats, , image] = entry;
  if (image || entry[9]) continue;
  missing++;
  const candidates = byName.get(norm(title));
  if (!candidates) continue;

  const wantIds = new Set(plats.flatMap(i => PLATFORMS[data.platforms[i]] || []));
  const year = release ? Number(String(release).slice(0, 4)) : null;
  let best = null, bestScore = -Infinity;
  for (const c of candidates) {
    const cYear = c.first_release_date ? new Date(c.first_release_date * 1000).getUTCFullYear() : null;
    const platformMatch = (c.platforms || []).some(p => wantIds.has(p));
    const diff = year && cYear ? Math.abs(year - cYear) : null;
    // Zonder platform-overlap alleen bij exact hetzelfde jaar; met overlap max 2 jaar verschil (regio's)
    if (!platformMatch && diff !== 0) continue;
    if (diff != null && diff > 2) continue;
    const score = (platformMatch ? 10 : 0) - (diff ?? 1) * 2 + (c.version_parent ? 0 : 1);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  if (best) {
    while (entry.length < 9) entry.push(0);
    entry[9] = best.cover.image_id;
    matched++;
  }
}

data.igdbCovers = new Date().toISOString().slice(0, 10);
await writeFile(FILE, JSON.stringify(data));
console.log(`Covers aangevuld: ${matched} van ${missing} games zonder cover (${missing - matched} nog zonder).`);
