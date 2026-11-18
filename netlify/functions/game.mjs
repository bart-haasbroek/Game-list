// Details van één game uit IGDB: omschrijving, genres, ontwikkelaar, uitgever, trailer, Wikipedia-links,
// critici-score en speeltijd (time-to-beat).
import { igdb, igdbConfigured, json } from '../lib/igdb.mjs';

const hours = (sec) => (sec ? Math.round(sec / 360) / 10 : 0);

const wikiTitle = (urls, lang) => {
  const m = urls.map(u => u.match(new RegExp(`^https?://${lang}\\.(?:m\\.)?wikipedia\\.org/wiki/([^?#]+)`))).find(Boolean);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).replace(/_/g, ' '); } catch { return m[1].replace(/_/g, ' '); }
};

export default async (req) => {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Ongeldig id' }, 400);
  if (!igdbConfigured()) return json({ error: 'IGDB is nog niet ingesteld' }, 500);
  try {
    const [[g], [ttb]] = await Promise.all([
      igdb('games', `fields summary, genres.name, involved_companies.developer, involved_companies.publisher,
  involved_companies.company.name, videos.video_id, videos.name, websites.url, aggregated_rating, aggregated_rating_count;
where id = ${id};`),
      igdb('game_time_to_beats', `fields hastily, normally, completely; where game_id = ${id};`).catch(() => []),
    ]);
    if (!g) return json({ error: 'Niet gevonden' }, 404);
    const companies = g.involved_companies || [];
    const urls = (g.websites || []).map(w => w.url || '');
    const trailer = (g.videos || []).find(v => /trailer/i.test(v.name || '')) || g.videos?.[0];
    return json({
      summary: g.summary || '',
      genres: (g.genres || []).map(x => x.name),
      developers: companies.filter(c => c.developer).map(c => c.company?.name).filter(Boolean),
      publishers: companies.filter(c => c.publisher).map(c => c.company?.name).filter(Boolean),
      youtube: trailer?.video_id || null,
      wikiTitle: wikiTitle(urls, 'en'),
      nlTitle: wikiTitle(urls, 'nl'),
      critic: g.aggregated_rating ? { score: Math.round(g.aggregated_rating), count: g.aggregated_rating_count || 0 } : null,
      playtime: ttb && (ttb.hastily || ttb.normally || ttb.completely)
        ? { hastily: hours(ttb.hastily), normally: hours(ttb.normally), completely: hours(ttb.completely) } : null,
    }, 200, { 'cache-control': 'public, max-age=86400' });
  } catch (e) {
    return json({ error: e.message || 'Ophalen mislukt' }, 502);
  }
};

export const config = { path: '/api/game' };
