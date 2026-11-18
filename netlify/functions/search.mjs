// Zoekt games in IGDB (de database achter o.a. GameTrack).
// Nodig in Netlify > Site configuration > Environment variables:
//   TWITCH_CLIENT_ID en TWITCH_CLIENT_SECRET
// Die blijven op de server, zodat je geheime sleutel niet in de app staat.

let token = null;
let tokenExpires = 0;

async function getToken(id, secret) {
  if (token && Date.now() < tokenExpires) return token;
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Inloggen bij Twitch/IGDB mislukt');
  const data = await res.json();
  token = data.access_token;
  tokenExpires = Date.now() + (data.expires_in - 300) * 1000;
  return token;
}

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  });

const coverUrl = (imageId, size) =>
  imageId ? `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg` : null;

export default async (req) => {
  const q = (new URL(req.url).searchParams.get('q') || '').replace(/["\\;]/g, ' ').trim().slice(0, 100);
  if (q.length < 2) return json({ error: 'Zoekterm te kort' }, 400);

  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return json({ error: 'IGDB is nog niet ingesteld' }, 500);

  try {
    const body = `search "${q}";
fields name, first_release_date, cover.image_id, platforms.id, platforms.name, platforms.abbreviation, genres.name, summary;
where version_parent = null;
limit 50;`;

    let accessToken = await getToken(id, secret);
    let res = await igdb(id, accessToken, body);
    if (res.status === 401) {
      token = null;
      accessToken = await getToken(id, secret);
      res = await igdb(id, accessToken, body);
    }
    if (!res.ok) return json({ error: `IGDB-fout (${res.status})` }, 502);

    const raw = await res.json();
    const results = raw.map(g => ({
      id: g.id,
      title: g.name,
      year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
      cover: coverUrl(g.cover?.image_id, 't_cover_big_2x'),
      thumb: coverUrl(g.cover?.image_id, 't_cover_small_2x'),
      platforms: (g.platforms || []).map(p => ({ id: p.id, name: p.name, abbreviation: p.abbreviation })),
      genres: (g.genres || []).map(x => x.name),
      summary: g.summary || '',
    }));
    return json({ results }, 200, { 'cache-control': 'public, max-age=3600' });
  } catch (e) {
    return json({ error: e.message || 'Zoeken mislukt' }, 500);
  }
};

function igdb(id, accessToken, body) {
  return fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': id, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain' },
    body,
  });
}

export const config = { path: '/api/search' };
