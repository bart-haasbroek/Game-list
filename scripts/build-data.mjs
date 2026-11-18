// Bouwt public/data/games.json: alle games op Nintendo-platforms uit Wikidata,
// met releasedatum, platforms, franchise, Wikipedia-titels (EN/NL), trailer-ID en coverbestand.
// Draaien met: yarn data
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'game-list-data-script/1.0 (personal, non-commercial)';
const OUT = new URL('../public/data/games.json', import.meta.url);

// Wikidata-platformnaam -> korte naam in de app (null = overslaan)
const PLATFORM_MAP = [
  [/switch 2/i, 'Switch 2'], [/switch/i, 'Switch'], [/wii u/i, 'Wii U'], [/^wii$/i, 'Wii'],
  [/new nintendo 3ds/i, 'New 3DS'], [/3ds|2ds/i, '3DS'], [/dsi/i, 'DSi'], [/nintendo ds/i, 'DS'],
  [/game boy advance|e-reader/i, 'GBA'], [/game boy color/i, 'GBC'], [/game boy/i, 'Game Boy'],
  [/gamecube/i, 'GameCube'], [/64dd|nintendo 64/i, 'N64'], [/classic edition/i, null],
  [/super nintendo|super famicom|satellaview/i, 'SNES'], [/famicom disk/i, 'FDS'],
  [/nintendo entertainment system|family computer/i, 'NES'], [/virtual boy/i, 'Virtual Boy'],
  [/game & watch/i, 'Game & Watch'], [/pokémon mini/i, 'Pokémon mini'],
];
const shortName = (label) => {
  for (const [re, s] of PLATFORM_MAP) if (re.test(label)) return s;
  return label;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function getJSON(url, init = {}, tries = 8) {
  for (let i = 0; ; i++) {
    let wait = 2000 * (i + 1);
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
      if (res.status === 429 || res.status >= 500) {
        wait = Math.max(wait, Number(res.headers.get('retry-after')) * 1000 || 0);
        throw new Error('HTTP ' + res.status);
      }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      console.log(`  (${e.message}, opnieuw over ${Math.round(wait / 1000)}s)`);
      await sleep(wait);
    }
  }
}

const BASE = '?platform wdt:P176 wd:Q8093 . ?game wdt:P31 wd:Q7889 ; wdt:P400 ?platform .';
async function sparql(query) {
  const data = await getJSON('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
    body: 'query=' + encodeURIComponent(query),
  });
  return data.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}
const qidOf = (uri) => uri.split('/').pop();

// ---------- 1. Wikidata ----------
console.log('Wikidata: games en platforms…');
const main = await sparql(`
SELECT ?game (SAMPLE(?label) AS ?title) (GROUP_CONCAT(DISTINCT ?platformLabel; separator="|") AS ?platforms)
       (SAMPLE(?wtitle) AS ?article) WHERE {
  ${BASE}
  OPTIONAL { ?platform rdfs:label ?pEn . FILTER(LANG(?pEn) = "en") }
  OPTIONAL { ?platform rdfs:label ?pMul . FILTER(LANG(?pMul) = "mul") }
  BIND(COALESCE(?pEn, ?pMul) AS ?platformLabel)
  FILTER(BOUND(?platformLabel))
  OPTIONAL { ?game rdfs:label ?en . FILTER(LANG(?en) = "en") }
  OPTIONAL { ?game rdfs:label ?mul . FILTER(LANG(?mul) = "mul") }
  BIND(COALESCE(?en, ?mul) AS ?label)
  FILTER(BOUND(?label))
  OPTIONAL { ?art schema:about ?game ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?wtitle }
}
GROUP BY ?game`);

const games = new Map();
for (const b of main) {
  const platforms = [...new Set(b.platforms.split('|').map(shortName).filter(Boolean))];
  if (!platforms.length) continue;
  games.set(qidOf(b.game), {
    qid: qidOf(b.game), title: b.title, platforms, article: b.article || null,
    release: null, franchise: null, nl: null, youtube: null, image: null,
  });
}
console.log(`  ${games.size} games`);

console.log('Wikidata: releasedatums…');
const dates = new Map();
for (const b of await sparql(`SELECT DISTINCT ?game ?d ?p WHERE { ${BASE} ?game p:P577/psv:P577 [ wikibase:timeValue ?d ; wikibase:timePrecision ?p ] }`)) {
  const q = qidOf(b.game);
  if (!games.has(q) || b.d.startsWith('-')) continue;
  const p = Number(b.p);
  const iso = b.d.slice(0, 10);
  const str = p >= 11 ? iso : p === 10 ? iso.slice(0, 7) : p === 9 ? iso.slice(0, 4) : null;
  if (str) (dates.get(q) || dates.set(q, []).get(q)).push({ str, iso, p });
}
for (const [q, list] of dates) {
  list.sort((a, b) => a.iso.localeCompare(b.iso) || b.p - a.p);
  let best = list[0];
  // Een preciezere datum in dezelfde periode heeft de voorkeur ("2023" -> "2023-05-12")
  const better = list.find(x => x.p > best.p && x.str.startsWith(best.str));
  if (better) best = better;
  games.get(q).release = best.str;
}

console.log('Wikidata: franchises…');
const franchiseRows = await sparql(`
SELECT DISTINCT ?game ?topLabel WHERE {
  ${BASE}
  { ?game wdt:P8345 ?top } UNION
  { ?game wdt:P179 ?s . ?s wdt:P8345 ?top } UNION
  { ?game wdt:P179 ?s . FILTER NOT EXISTS { ?s wdt:P8345 [] } BIND(?s AS ?top) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
}`);
const franchiseCount = new Map();
const gameFranchises = new Map();
for (const b of franchiseRows) {
  const q = qidOf(b.game);
  if (!games.has(q) || /^Q\d+$/.test(b.topLabel)) continue;
  (gameFranchises.get(q) || gameFranchises.set(q, new Set()).get(q)).add(b.topLabel);
}
for (const set of gameFranchises.values()) for (const f of set) franchiseCount.set(f, (franchiseCount.get(f) || 0) + 1);
for (const [q, set] of gameFranchises) {
  // Kies de grootste franchise (bv. "Mario" boven "Mario Kart")
  const best = [...set].sort((a, b) => franchiseCount.get(b) - franchiseCount.get(a))[0];
  if (franchiseCount.get(best) >= 3) games.get(q).franchise = best;
}

console.log('Wikidata: Nederlandse Wikipedia en trailers…');
for (const b of await sparql(`SELECT DISTINCT ?game ?nl WHERE { ${BASE} ?a schema:about ?game ; schema:isPartOf <https://nl.wikipedia.org/> ; schema:name ?nl }`)) {
  const g = games.get(qidOf(b.game)); if (g) g.nl = b.nl;
}
for (const b of await sparql(`SELECT DISTINCT ?game ?y WHERE { ${BASE} ?game wdt:P1651 ?y }`)) {
  const g = games.get(qidOf(b.game)); if (g && !g.youtube) g.youtube = b.y;
}

// ---------- 2. Cover-bestandsnamen van Wikipedia ----------
const byArticle = new Map([...games.values()].filter(g => g.article).map(g => [g.article, g]));
const titles = [...byArticle.keys()];
console.log(`Wikipedia: covers voor ${titles.length} artikelen…`);
for (let i = 0; i < titles.length; i += 50) {
  const batch = titles.slice(i, i + 50);
  const data = await getJSON('https://en.wikipedia.org/w/api.php?format=json&formatversion=2&action=query&redirects=1' +
    '&prop=pageprops&ppprop=page_image&titles=' + encodeURIComponent(batch.join('|')));
  const alias = new Map();
  for (const n of [...(data.query?.normalized || []), ...(data.query?.redirects || [])]) alias.set(n.to, alias.get(n.from) || n.from);
  for (const p of data.query?.pages || []) {
    const img = p.pageprops?.page_image;
    if (!img || /logo|wordmark/i.test(img)) continue;
    const g = byArticle.get(p.title) || byArticle.get(alias.get(p.title));
    if (g) g.image = img;
  }
  if (i % 1000 === 0) console.log(`  ${i}/${titles.length}`);
  await sleep(300);
}

// ---------- 3. Compact wegschrijven ----------
const all = [...games.values()].sort((a, b) => a.title.localeCompare(b.title));
const platformList = [...new Set(all.flatMap(g => g.platforms))].sort();
const franchiseList = [...new Set(all.map(g => g.franchise).filter(Boolean))].sort();
const pIdx = new Map(platformList.map((p, i) => [p, i]));
const fIdx = new Map(franchiseList.map((f, i) => [f, i]));
const same = (t, title) => (t ? (t === title ? 1 : t) : 0);

const out = {
  version: 2,
  generated: new Date().toISOString().slice(0, 10),
  platforms: platformList,
  franchises: franchiseList,
  // [qid, titel, release|0, platforms[], en-wiki (1=titel), cover|0, franchise|-1, nl-wiki (1=titel), youtube|0]
  games: all.map(g => [
    Number(g.qid.slice(1)), g.title, g.release || 0, g.platforms.map(p => pIdx.get(p)),
    same(g.article, g.title), g.image || 0, g.franchise ? fIdx.get(g.franchise) : -1,
    same(g.nl, g.title), g.youtube || 0,
  ]),
};

await mkdir(new URL('.', OUT), { recursive: true });
const json = JSON.stringify(out);
await writeFile(OUT, json);
const count = (fn) => all.filter(fn).length;
console.log(`Klaar: ${all.length} games · ${count(g => g.image)} covers · ${count(g => g.release)} datums · ` +
  `${count(g => g.franchise)} in ${franchiseList.length} franchises · ${count(g => g.nl)} NL · ${count(g => g.youtube)} trailers · ` +
  `${(json.length / 1024).toFixed(0)} KB`);
