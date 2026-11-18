// Sync van je eigen lijst via Netlify Blobs (store "usersync").
// Sleutel = SHA-256 van je herstelcode (de code zelf wordt nergens bewaard), waarde = JSON-string van je lijst.
//   GET  /api/sync                       -> je lijst, of 404 als de code onbekend is
//   POST /api/sync  { games, deleted, swipedNo, create? }
//                                        -> voegt samen met wat er staat, slaat op en geeft het resultaat terug.
//                                           Zonder `create` en zonder bestaande lijst: 404 (bv. typfout in de code).
// Herstelcode in de header:  Authorization: Bearer XXXX-XXXX-XXXX-XXXX
import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { json } from '../lib/igdb.mjs';
import { mergeDocs, sameDoc } from '../../src/sync-merge.js';

const MAX_BYTES = 8 * 1024 * 1024;
const noStore = { 'cache-control': 'no-store' };

const codeFrom = (req) => {
  const raw = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === 16 ? code : null;
};
const keyFor = (code) => 'u/' + createHash('sha256').update('game-list-sync:' + code).digest('hex');

export default (req) => handleSync(req, getStore({ name: 'usersync', consistency: 'strong' }));

// Los van Netlify Blobs te testen met een eigen `store` (get, getWithMetadata, set)
export async function handleSync(req, store) {
  const code = codeFrom(req);
  if (!code) return json({ error: 'Ongeldige herstelcode' }, 401, noStore);
  const key = keyFor(code);

  try {
    if (req.method === 'GET') {
      const cur = await store.get(key, { type: 'json' });
      return cur ? json(cur, 200, noStore) : json({ error: 'Onbekende herstelcode' }, 404, noStore);
    }
    if (req.method !== 'POST') return json({ error: 'Niet toegestaan' }, 405, noStore);

    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: 'Te groot' }, 413, noStore);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'Ongeldige data' }, 400, noStore); }
    if (!Array.isArray(body.games)) return json({ error: 'Ongeldige data' }, 400, noStore);
    const incoming = { games: body.games, deleted: body.deleted || {}, swipedNo: body.swipedNo || [] };

    // Optimistisch schrijven: is de lijst intussen door een ander toestel aangepast, dan opnieuw samenvoegen
    for (let i = 0; i < 5; i++) {
      const cur = await store.getWithMetadata(key, { type: 'json' });
      if (!cur && !body.create) return json({ error: 'Onbekende herstelcode' }, 404, noStore);
      const merged = mergeDocs(cur?.data || {}, incoming);
      const doc = { v: 1, updatedAt: Date.now(), ...merged };
      if (cur && sameDoc(merged, mergeDocs({}, cur.data))) return json(cur.data, 200, noStore);
      const res = cur
        ? await store.set(key, JSON.stringify(doc), { onlyIfMatch: cur.etag })
        : await store.set(key, JSON.stringify(doc), { onlyIfNew: true });
      if (res.modified !== false) return json(doc, 200, noStore);
    }
    return json({ error: 'Even druk, probeer het zo opnieuw' }, 409, noStore);
  } catch (e) {
    return json({ error: e.message || 'Sync mislukt' }, 502, noStore);
  }
}

export const config = { path: '/api/sync' };
