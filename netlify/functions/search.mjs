// Zoekt games in IGDB (online zoeken in Ontdek).
// Nodig in Netlify > Site configuration > Environment variables: TWITCH_CLIENT_ID en TWITCH_CLIENT_SECRET.
import { igdb, igdbConfigured, coverUrl, json } from '../lib/igdb.mjs';

export default async (req) => {
  const q = (new URL(req.url).searchParams.get('q') || '').replace(/["\;]/g, ' ').trim().slice(0, 100);
  if (q.length < 2) return json({ error: 'Zoekterm te kort' }, 400);
  if (!igdbConfigured()) return json({ error: 'IGDB is nog niet ingesteld' }, 500);

  try {
    const raw = await igdb('games', `search "${q}";
fields name, first_release_date, cover.image_id, platforms.id, platforms.name, platforms.abbreviation, genres.name, summary;
where version_parent = null;
limit 50;`);
    const results = raw.map(g => ({
      id: g.id,
      title: g.name,
      year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
      cover: coverUrl(g.cover?.image_id),
      thumb: coverUrl(g.cover?.image_id, 't_cover_small_2x'),
      platforms: (g.platforms || []).map(p => ({ id: p.id, name: p.name, abbreviation: p.abbreviation })),
      genres: (g.genres || []).map(x => x.name),
      summary: g.summary || '',
    }));
    return json({ results }, 200, { 'cache-control': 'public, max-age=3600' });
  } catch (e) {
    return json({ error: e.message || 'Zoeken mislukt' }, 502);
  }
};

export const config = { path: '/api/search' };
