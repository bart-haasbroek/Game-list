// Gedeelde IGDB-toegang voor de Netlify Functions en scripts/build-data.mjs.
// Nodig: TWITCH_CLIENT_ID en TWITCH_CLIENT_SECRET.

let token = null;
let tokenExpires = 0;

export const igdbConfigured = () => Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);

async function getToken() {
  if (token && Date.now() < tokenExpires) return token;
  const { TWITCH_CLIENT_ID: id, TWITCH_CLIENT_SECRET: secret } = process.env;
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Voert een IGDB-query uit (Apicalypse-syntax). Probeert opnieuw bij 401 (token verlopen), 429 en 5xx. */
export async function igdb(endpoint, body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${await getToken()}`,
        'Content-Type': 'text/plain',
      },
      body,
    });
    if (res.ok) return res.json();
    if (res.status === 401) { token = null; continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(1000 * (i + 1)); continue; }
    throw new Error(`IGDB-fout (${res.status})`);
  }
  throw new Error('IGDB niet bereikbaar');
}

export const coverUrl = (imageId, size = 't_cover_big_2x') =>
  imageId ? `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg` : null;

// Beste liggende afbeelding van een game (query met artworks.image_id/width/height/artwork_type en
// screenshots.image_id): key art zonder logo > artwork > key art met logo > screenshot. Geen logo's/covers.
export function pickArtwork(g, size = 't_1080p') {
  const rank = { 2: 0, 1: 1, 15: 1, 3: 2, 4: 3 };
  const arts = (g.artworks || [])
    .filter(a => a.image_id && (a.artwork_type == null || a.artwork_type in rank))
    .map(a => {
      const ratio = a.width && a.height ? a.width / a.height : 1.5;
      // Liggend (breder dan ~4:3) gaat voor, maar geen panorama's (die worden in de kop enorm uitvergroot
      // en dus wazig); daarbinnen zo dicht mogelijk bij 16:9, het type, dan de grootte
      const score = (ratio >= 1.25 ? 0 : 10) + (ratio > 2.4 ? 5 : 0) + Math.abs(ratio - 16 / 9)
        + (rank[a.artwork_type] ?? 1) + ((a.width || 0) < 1000 ? 2 : 0) - Math.min(a.width || 0, 3840) / 10000;
      return { a, score };
    })
    .sort((x, y) => x.score - y.score);
  const best = arts.find(x => x.score < 10)?.a || g.screenshots?.[0] || arts[0]?.a;
  return best ? `https://images.igdb.com/igdb/image/upload/${size}/${best.image_id}.jpg` : null;
}

// IGDB-platform-id -> korte naam zoals in de app
export const NINTENDO_PLATFORMS = {
  130: 'Switch', 508: 'Switch 2', 41: 'Wii U', 5: 'Wii',
  20: 'DS', 159: 'DSi', 37: '3DS', 137: 'New 3DS',
  24: 'GBA', 22: 'GBC', 33: 'Game Boy',
  19: 'SNES', 58: 'SNES', 306: 'SNES', 18: 'NES', 99: 'NES', 51: 'FDS',
  4: 'N64', 416: 'N64', 21: 'GameCube', 87: 'Virtual Boy', 307: 'Game & Watch', 166: 'Pokémon mini',
};

export const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extra } });
