// Liggende afbeeldingen (artwork) voor meerdere games tegelijk, voor de franchise-tegels in Ontdek.
//   GET /api/artworks?ids=1,2,3  -> { "1": "https://images.igdb.com/...", "2": null, ... }
import { igdb, igdbConfigured, json, pickArtwork } from '../lib/igdb.mjs';

export default async (req) => {
  const ids = [...new Set((new URL(req.url).searchParams.get('ids') || '').split(',').map(Number))]
    .filter(n => Number.isInteger(n) && n > 0).slice(0, 100);
  if (!ids.length) return json({ error: 'Geen ids' }, 400);
  if (!igdbConfigured()) return json({ error: 'IGDB is nog niet ingesteld' }, 500);
  try {
    const games = await igdb('games', `fields artworks.image_id, artworks.width, artworks.height, artworks.artwork_type,
  screenshots.image_id; where id = (${ids.join(',')}); limit ${ids.length};`);
    const out = Object.fromEntries(ids.map(id => [id, null]));
    for (const g of games) out[g.id] = pickArtwork(g, 't_screenshot_big');
    return json(out, 200, { 'cache-control': 'public, max-age=604800' });
  } catch (e) {
    return json({ error: e.message || 'Ophalen mislukt' }, 502);
  }
};

export const config = { path: '/api/artworks' };
