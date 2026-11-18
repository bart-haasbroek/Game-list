// Online aanvullen: cover-links, Nederlandse omschrijving, ontwikkelaar, uitgever, genre, trailer.
const WP = (lang) => `https://${lang}.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*`;
const WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*';

const getJSON = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};

// ---------- Cover-links (bestandsnaam -> thumbnail-URL), bewaard in localStorage ----------
const COVER_KEY = 'gl.coverUrls';
let coverUrls;
try { coverUrls = new Map(Object.entries(JSON.parse(localStorage.getItem(COVER_KEY)) || {})); } catch { coverUrls = new Map(); }
const saveCoverUrls = () => { try { localStorage.setItem(COVER_KEY, JSON.stringify(Object.fromEntries(coverUrls))); } catch {} };
const pending = new Map();

export const knownCoverUrl = (file) => (file ? coverUrls.get(file) || null : null);

export async function resolveCovers(files) {
  const todo = [...new Set(files.filter(f => f && !coverUrls.has(f) && !pending.has(f)))];
  const waits = files.filter(f => pending.has(f)).map(f => pending.get(f));
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const p = getJSON(`${WP('en')}&action=query&prop=imageinfo&iiprop=url&iiurlwidth=300&titles=${encodeURIComponent(batch.map(f => 'File:' + f).join('|'))}`)
      .then(data => {
        const norm = new Map((data.query?.normalized || []).map(n => [n.to, n.from]));
        for (const pg of data.query?.pages || []) {
          const info = pg.imageinfo?.[0];
          const from = (norm.get(pg.title) || pg.title).replace(/^File:/, '');
          const file = batch.find(f => f === from || f.replace(/_/g, ' ') === from.replace(/_/g, ' '));
          if (file) coverUrls.set(file, info ? info.thumburl || info.url : '');
        }
        saveCoverUrls();
      })
      .catch(() => {})
      .finally(() => batch.forEach(f => pending.delete(f)));
    batch.forEach(f => pending.set(f, p));
    waits.push(p);
  }
  await Promise.all(waits);
  return files.map(f => coverUrls.get(f) || null);
}

// ---------- Vertalen (MyMemory, gratis, max ~500 tekens per verzoek) ----------
async function translateToDutch(text) {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|.+$/g) || [text];
  const chunks = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > 450 && cur) { chunks.push(cur); cur = ''; }
    cur += s;
  }
  if (cur) chunks.push(cur);
  const out = [];
  for (const c of chunks.slice(0, 3)) {
    const data = await getJSON(`https://api.mymemory.translated.net/get?langpair=en|nl&q=${encodeURIComponent(c.trim())}`);
    if (data.responseStatus !== 200 || data.quotaFinished) throw new Error('Vertaallimiet bereikt');
    out.push(data.responseData.translatedText);
  }
  return out.join(' ');
}

async function extract(lang, title, sentences = 4) {
  const data = await getJSON(`${WP(lang)}&action=query&redirects=1&prop=extracts&exintro=1&explaintext=1&exsentences=${sentences}&titles=${encodeURIComponent(title)}`);
  const text = data.query?.pages?.[0]?.extract || '';
  return text.replace(/\s*\([^()]*\)\s*/, ' ').replace(/\s+/g, ' ').trim(); // eerste (uitspraak/japans) tussen haakjes weg
}

// ---------- Wikidata-details ----------
const labelsCache = new Map();
async function labels(ids) {
  const todo = ids.filter(id => !labelsCache.has(id));
  for (let i = 0; i < todo.length; i += 50) {
    const data = await getJSON(`${WD}&action=wbgetentities&props=labels&languages=nl|en&languagefallback=1&ids=${todo.slice(i, i + 50).join('|')}`);
    for (const [id, e] of Object.entries(data.entities || {})) labelsCache.set(id, e.labels?.nl?.value || e.labels?.en?.value || null);
  }
  return ids.map(id => labelsCache.get(id)).filter(Boolean);
}

// Nederlandse Wikipedia-titel via de taallinks van het Engelse artikel
async function dutchTitle(enTitle) {
  const data = await getJSON(`${WP('en')}&action=query&redirects=1&prop=langlinks&lllang=nl&titles=${encodeURIComponent(enTitle)}`);
  return data.query?.pages?.[0]?.langlinks?.[0]?.title || null;
}

/**
 * Haalt extra info op voor een game. `g` heeft (een deel van): igdbId, qid, wikiTitle, nlTitle, summary (Engels).
 * Bron: IGDB (via /api/game). Wikipedia voor een Nederlandse omschrijving, Wikidata als reserve voor oude games.
 * Geeft terug: { summary, summaryLang, developers, publishers, genres, youtube, nlTitle, wikiTitle }
 */
export async function fetchDetails(g) {
  const info = {};
  let igdbSummary = '';
  if (g.igdbId) {
    try {
      const res = await fetch('/api/game?id=' + encodeURIComponent(g.igdbId));
      if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
        const d = await res.json();
        Object.assign(info, { developers: d.developers, publishers: d.publishers, genres: d.genres });
        if (d.youtube) info.youtube = d.youtube;
        if (d.wikiTitle) info.wikiTitle = d.wikiTitle;
        if (d.nlTitle) info.nlTitle = d.nlTitle;
        igdbSummary = d.summary || '';
      }
    } catch {}
  }
  if (!info.developers && g.qid) {
    try {
      const data = await getJSON(`${WD}&action=wbgetentities&props=claims|sitelinks&sitefilter=enwiki|nlwiki&ids=${g.qid}`);
      const e = data.entities?.[g.qid];
      if (e) {
        const ids = (p) => (e.claims?.[p] || []).filter(c => c.rank !== 'deprecated').map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
        const [developers, publishers, genres] = await Promise.all([labels(ids('P178')), labels(ids('P123')), labels(ids('P136'))]);
        Object.assign(info, { developers, publishers, genres: genres.map(x => x.charAt(0).toUpperCase() + x.slice(1)) });
        const yt = (e.claims?.P1651 || []).map(c => c.mainsnak?.datavalue?.value).find(Boolean);
        if (yt && !info.youtube) info.youtube = yt;
        info.nlTitle = info.nlTitle || e.sitelinks?.nlwiki?.title || null;
        info.wikiTitle = info.wikiTitle || e.sitelinks?.enwiki?.title || null;
      }
    } catch {}
  }
  const enTitle = info.wikiTitle || g.wikiTitle || null;
  let nlTitle = info.nlTitle || g.nlTitle || null;
  if (!nlTitle && enTitle) {
    try { nlTitle = await dutchTitle(enTitle); if (nlTitle) info.nlTitle = nlTitle; } catch {}
  }
  if (enTitle) info.wikiTitle = enTitle;
  try {
    // 1. Nederlandse Wikipedia  2. IGDB-omschrijving vertaald  3. Engelse Wikipedia vertaald
    if (nlTitle) {
      info.summary = await extract('nl', nlTitle);
      if (info.summary) info.summaryLang = 'nl';
    }
    if (!info.summary) {
      const en = igdbSummary || g.summary || (enTitle ? await extract('en', enTitle) : '');
      if (en) {
        try { info.summary = await translateToDutch(en); info.summaryLang = 'nl-vertaald'; }
        catch { info.summary = en; info.summaryLang = 'en'; }
      }
    }
  } catch {}
  return info;
}

// ---------- YouTube ----------
export function youtubeId(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
