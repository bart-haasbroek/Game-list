// Levert de gamedatabase uit Netlify Blobs (gevuld door scripts/build-data.mjs via GitHub Actions).
//   /api/games       -> de hele database (±2,8 MB, ±1 MB gecomprimeerd)
//   /api/games-meta  -> { generated, count, source }: klein, zodat de app goedkoop kan zien of er iets nieuws is
import { getStore } from '@netlify/blobs';
import { json } from '../lib/igdb.mjs';

export default async (req) => {
  const store = getStore('gamedata');
  const noCache = { 'cache-control': 'no-cache' };
  if (new URL(req.url).pathname.endsWith('-meta')) {
    const meta = await store.get('meta', { type: 'json' });
    return meta ? json(meta, 200, noCache) : json({ error: 'Nog geen data' }, 404, noCache);
  }
  const text = await store.get('games');
  if (!text) return json({ error: 'Nog geen data' }, 404, noCache);
  return new Response(text, { headers: { 'content-type': 'application/json', ...noCache } });
};

export const config = { path: ['/api/games', '/api/games-meta'] };
