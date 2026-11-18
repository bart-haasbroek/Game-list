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
