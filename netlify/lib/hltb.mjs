// HowLongToBeat: speeltijden (hoofdverhaal / verhaal + extra / 100%) zoeken via de zoekfunctie van de site.
// Er is geen officiële API: dit gebruikt wat howlongtobeat.com zelf aanroept (eerst een token via
// /api/search/site/init, dan POST /api/search/site met dat token). Verandert HLTB dat, dan geeft
// hltbSearch een fout en blijft de vorige data staan.

const BASE = 'https://howlongtobeat.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
  Referer: `${BASE}/`,
  Origin: BASE,
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let token = null;

async function getToken() {
  const res = await fetch(`${BASE}/api/search/site/init?t=${Date.now()}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`HLTB init mislukt (${res.status})`);
  token = (await res.json()).token;
  if (!token) throw new Error('HLTB gaf geen token');
  return token;
}

const body = (terms) => JSON.stringify({
  searchType: 'games', searchTerms: terms, searchPage: 1, size: 20,
  searchOptions: {
    games: {
      userId: 0, platform: { mode: 'include', values: [] }, sortCategory: 'popular', rangeCategory: 'main',
      rangeTime: { min: null, max: null },
      gameplay: { perspective: { mode: 'include', values: [] }, flow: { mode: 'include', values: [] }, genre: { mode: 'include', values: [] } },
      year: { mode: 'include', values: [] }, modifier: '',
    },
    users: { sortCategory: 'postcount' }, lists: { sortCategory: 'follows' }, filter: '', sort: 0, randomizer: 0,
  },
  useCache: true,
});

/** Zoekt op HLTB; geeft de ruwe resultaten (game_id, game_name, game_alias, release_world, comp_main, …). */
export async function hltbSearch(title, tries = 4) {
  const terms = normalize(title).replace(/ version\b/g, '').split(' ').filter(Boolean); // HLTB zegt geen "Version"
  if (!terms.length) return [];
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${BASE}/api/search/site`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json', 'x-auth-token': token || await getToken() },
      body: body(terms),
    });
    if (res.ok) return (await res.json()).data || [];
    if (res.status === 403) { token = null; continue; }              // token verlopen
    if (res.status === 429 || res.status >= 500) { await sleep(20000 * (i + 1)); continue; } // te veel verzoeken: wachten
    throw new Error(`HLTB-fout (${res.status})`);
  }
  throw new Error('HLTB niet bereikbaar');
}

// Kleine letters, zonder accenten, ™/®, leestekens en dubbele spaties
export function normalize(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[™®©]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}
// Voor het vergelijken: zonder "the" vooraan en zonder het woord "version" (HLTB: "Pokémon Platinum")
const bare = (s) => normalize(s).replace(/^the /, '').replace(/ version\b/g, '').replace(/ and /g, ' ');

// Namen van een HLTB-resultaat (naam + aliassen)
const namesOf = (r) => [r.game_name, ...String(r.game_alias || '').split(',')].filter(Boolean);

// HLTB voegt paren samen ("Pokémon X and Y", "Pokémon FireRed and LeafGreen"): elke helft als eigen naam,
// met het begin van de eerste helft ervoor ("pokemon y", "pokemon leafgreen", "pokemon white 2")
function pairNames(name) {
  const n = normalize(name).replace(/ version\b/g, '');
  const parts = n.split(' and ');
  if (parts.length !== 2) return [];
  const [a, b] = parts, words = a.split(' ');
  const out = [a, b];
  for (let i = 1; i < words.length; i++) out.push(`${words.slice(0, i).join(' ')} ${b}`);
  return out.map(x => x.replace(/^the /, ''));
}

/**
 * Kiest het HLTB-resultaat dat bij de game hoort: dezelfde naam (of alias), anders een helft van een
 * samengevoegd paar ("Pokémon Scarlet" -> "Pokémon Scarlet and Violet"). Bij meerdere het origineel dat
 * niet ná onze release uitkwam (onze datum is vaak die van de Switch-port) en daarbinnen het spel met de
 * meeste spelers. Geeft null als niets echt overeenkomt.
 */
export function pickMatch(results, title, year) {
  const want = bare(title);
  const best = (list) => {
    if (!list.length) return null;
    const before = list.filter(r => !year || !r.release_world || r.release_world <= year + 1);
    return (before.length ? before : list).sort((a, b) => (b.comp_all_count || 0) - (a.comp_all_count || 0))[0];
  };
  const pairWant = normalize(title).replace(/ version\b/g, '').replace(/^the /, '');
  return best(results.filter(r => namesOf(r).map(bare).includes(want)))
    || best(results.filter(r => namesOf(r).some(n => pairNames(n).includes(pairWant))));
}

/** Andere titel om te proberen als de eigen titel niks oplevert ("… Nintendo Switch 2 Edition + …" -> basisgame) */
export function altTitle(title) {
  const t = String(title).replace(/\s*[-:–]?\s*(nintendo )?switch( 2)? edition\b.*$/i, '').trim();
  return t && t !== title ? t : null;
}

const hours = (sec) => (sec ? Math.round(sec / 360) / 10 : 0);
/** [hltbId, hoofdverhaal, verhaal + extra, 100%, aantal spelers] met uren op één decimaal */
export const hltbRow = (r) => [r.game_id, hours(r.comp_main), hours(r.comp_plus), hours(r.comp_100), r.comp_all_count || 0];
