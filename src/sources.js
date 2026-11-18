// Zoekbronnen. Alle resultaten hebben dezelfde vorm:
// { key, source, sourceId, title, year, cover, thumb, platforms: [{ name, abbreviation? }], genres, summary }

const WP = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*';
const WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*';

export class SourceUnavailable extends Error {}

// ---------- IGDB (via Netlify Function, als de Twitch-sleutels zijn ingesteld) ----------
export async function searchIGDB(q, signal) {
  let res;
  try {
    res = await fetch('/api/search?q=' + encodeURIComponent(q), { signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new SourceUnavailable('IGDB niet bereikbaar');
  }
  // Geen function (bv. `yarn dev`) geeft HTML terug in plaats van JSON
  if (!(res.headers.get('content-type') || '').includes('application/json')) throw new SourceUnavailable('Geen IGDB-function');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SourceUnavailable(data.error || 'IGDB-fout');
  return (data.results || []).map(r => ({ ...r, key: 'igdb:' + r.id, source: 'igdb', sourceId: r.id }));
}

// ---------- Wikipedia + Wikidata (geen sleutel nodig) ----------
const platformLabels = new Map(); // Wikidata-ID -> naam, blijft bewaard tussen zoekopdrachten

const getJSON = async (url, signal) => {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Wikipedia gaf een fout');
  return res.json();
};
const words = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(w => w.length > 1);

export async function searchWikipedia(q, signal) {
  // 1. Alleen artikelen met een "Infobox video game", dus echte games
  const search = encodeURIComponent(`${q} hastemplate:"Infobox video game"`);
  const data = await getJSON(
    `${WP}&action=query&generator=search&gsrsearch=${search}&gsrlimit=20` +
    `&prop=pageprops|description|extracts&ppprop=page_image|wikibase_item` +
    `&exintro=1&explaintext=1&exsentences=3&exlimit=20`,
    signal
  );
  let pages = (data.query?.pages || []).sort((a, b) => a.index - b.index);

  // Resultaten waar een zoekwoord in de titel staat eerst; losse treffers alleen als er niks beters is
  const qWords = words(q);
  const titleHit = pages.filter(p => { const t = words(p.title); return qWords.some(w => t.some(x => x.startsWith(w))); });
  if (titleHit.length) pages = titleHit;
  if (!pages.length) return [];

  // 2. Cover-URL's en Wikidata-gegevens tegelijk ophalen
  const files = [...new Set(pages.map(p => p.pageprops?.page_image).filter(f => f && !/logo|wordmark/i.test(f)))];
  const qids = [...new Set(pages.map(p => p.pageprops?.wikibase_item).filter(Boolean))];

  const [images, claims] = await Promise.all([
    fetchImageUrls(files, signal).catch(() => new Map()),
    fetchClaims(qids, signal).catch(() => new Map()),
  ]);

  // 3. Platformnamen (alleen nog onbekende IDs opvragen)
  const unknown = [...new Set([...claims.values()].flatMap(c => c.platforms))].filter(id => !platformLabels.has(id));
  if (unknown.length) await fetchLabels(unknown, signal).catch(() => {});

  return pages.map(p => {
    const c = claims.get(p.pageprops?.wikibase_item) || { platforms: [], year: null };
    const cover = images.get(p.pageprops?.page_image?.replace(/_/g, ' ')) || null;
    const yearFromDesc = (p.description || '').match(/\b(19[7-9]\d|20\d\d)\b/);
    const title = p.title.replace(/ \((\d{4} )?video game\)$/i, '');
    const qid = p.pageprops?.wikibase_item || null;
    return {
      key: qid ? 'wd:' + qid : 'wp:' + p.pageid,
      source: 'wikipedia',
      sourceId: p.pageid,
      qid,
      wikiTitle: p.title,
      title,
      year: yearFromDesc ? Number(yearFromDesc[1]) : c.year,
      cover,
      thumb: cover,
      release: c.release,
      platforms: c.platforms.map(id => platformLabels.get(id)).filter(Boolean).map(name => ({ name })),
      genres: [],
      summary: p.extract || '',
    };
  });
}

async function fetchImageUrls(files, signal) {
  const map = new Map();
  if (!files.length) return map;
  const titles = encodeURIComponent(files.map(f => 'File:' + f).join('|'));
  const data = await getJSON(`${WP}&action=query&titles=${titles}&prop=imageinfo&iiprop=url&iiurlwidth=500`, signal);
  for (const p of data.query?.pages || []) {
    const info = p.imageinfo?.[0];
    if (info) map.set(p.title.replace(/^File:/, ''), info.thumburl || info.url);
  }
  return map;
}

async function fetchClaims(qids, signal) {
  const map = new Map();
  if (!qids.length) return map;
  const data = await getJSON(`${WD}&action=wbgetentities&ids=${qids.join('|')}&props=claims`, signal);
  const val = (c) => c.mainsnak?.datavalue?.value;
  for (const [id, e] of Object.entries(data.entities || {})) {
    const platforms = (e.claims?.P400 || []).map(c => val(c)?.id).filter(Boolean);
    const times = (e.claims?.P577 || []).map(c => val(c)).filter(v => v?.time && !v.time.startsWith('-'))
      .sort((a, b) => a.time.localeCompare(b.time));
    const t = times[0];
    const iso = t ? t.time.slice(1, 11) : null;
    const release = !t ? null : t.precision >= 11 ? iso : t.precision === 10 ? iso.slice(0, 7) : iso.slice(0, 4);
    map.set(id, { platforms, year: release ? Number(release.slice(0, 4)) : null, release });
  }
  return map;
}

async function fetchLabels(ids, signal) {
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await getJSON(`${WD}&action=wbgetentities&ids=${chunk.join('|')}&props=labels&languages=en&languagefallback=1`, signal);
    for (const [id, e] of Object.entries(data.entities || {})) {
      const name = e.labels?.en?.value;
      if (name) platformLabels.set(id, name);
    }
  }
}
