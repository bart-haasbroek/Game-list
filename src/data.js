// Offline dataset (public/data/games.json): laden, zoeken, franchises en releasedatums.

// Eigen franchiselijst: volgorde = volgorde in Ontdek. `re` herkent de franchise aan de titel,
// `alias` koppelt namen uit Wikidata aan deze franchise.
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
const aliasMap = new Map(CURATED_FRANCHISES.flatMap(f => f.alias.map(a => [a.toLowerCase(), f.name])));

export const normalize = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

let entries = null;
let byKey = null;
let byFranchise = new Map();
let meta = null;
let loading = null;

export function loadDataset() {
  if (entries) return Promise.resolve(entries);
  if (loading) return loading;
  loading = fetch('/data/games.json')
    .then(r => { if (!r.ok) throw new Error('Dataset niet gevonden'); return r.json(); })
    .then(data => {
      meta = { generated: data.generated, count: data.games.length };
      entries = data.games.map(([qid, title, release, plats, en, image, fr, nl, youtube]) => {
        const wdFranchise = fr >= 0 ? data.franchises[fr] : null;
        const curated = CURATED_FRANCHISES.find(f => f.re.test(title));
        const franchise = curated?.name || (wdFranchise && (aliasMap.get(wdFranchise.toLowerCase()) || wdFranchise)) || null;
        return {
          key: 'wd:Q' + qid,
          source: 'wikidata',
          qid: 'Q' + qid,
          title,
          release: release || null,
          year: release ? Number(String(release).slice(0, 4)) : null,
          platforms: plats.map(i => data.platforms[i]),
          wikiTitle: en === 1 ? title : en || null,
          nlTitle: nl === 1 ? title : nl || null,
          coverFile: image || null,
          franchise,
          youtube: youtube || null,
          _n: normalize(title),
        };
      });
      for (const e of entries) e._w = e._n.split(' ');
      byKey = new Map(entries.map(e => [e.key, e]));
      byFranchise = new Map();
      for (const e of entries) if (e.franchise) (byFranchise.get(e.franchise) || byFranchise.set(e.franchise, []).get(e.franchise)).push(e);
      for (const list of byFranchise.values()) list.sort((a, b) => String(b.release || '0').localeCompare(String(a.release || '0')));
      return entries;
    })
    .catch(e => { loading = null; throw e; });
  return loading;
}

export const datasetInfo = () => meta;
export const getEntry = (key) => byKey?.get(key) || null;

// ---------- Zoeken ----------
export function searchDataset(q, limit = 60) {
  if (!entries) return [];
  const nq = normalize(q);
  const tokens = nq.split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const out = [];
  for (const e of entries) {
    const words = e._w;
    if (!tokens.every(t => words.some(w => w.startsWith(t)))) continue;
    let score = 0;
    if (e._n === nq) score += 100;
    else if (e._n.startsWith(nq)) score += 50;
    else if (e._n.includes(nq)) score += 25;
    score += tokens.filter(t => words.includes(t)).length * 5;
    if (e.wikiTitle) score += 10;
    if (e.coverFile) score += 5;
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

export function franchiseCover(name) {
  // Nieuwste game met een cover als voorkant van de map
  const list = franchiseGames(name);
  return list.find(e => e.coverFile && !isFuture(e.release)) || list.find(e => e.coverFile) || null;
}

// Aankomende games. `notable`: alleen bekendere titels (met Wikipedia-pagina of uit een franchise)
export function upcoming(limit = 20, { notable = true } = {}) {
  if (!entries) return [];
  const all = entries.filter(e => isFuture(e.release)).sort((a, b) => String(a.release).localeCompare(String(b.release)));
  const known = all.filter(e => e.wikiTitle || e.franchise);
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
