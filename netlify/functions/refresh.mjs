// Handmatig bijwerken van de gamedatabase: start de GitHub Action "update-data.yml".
//   GET  /api/refresh -> { meta, run }  (laatste update + status van de laatste run)
//   POST /api/refresh -> start een nieuwe run
// Nodig in Netlify: GITHUB_TOKEN (fine-grained token, alleen deze repo, "Actions: Read and write").
// Optioneel: GITHUB_REPO (standaard bart-haasbroek/Game-list), GITHUB_BRANCH (standaard main).
import { getStore } from '@netlify/blobs';
import { json } from '../lib/igdb.mjs';

const REPO = process.env.GITHUB_REPO || 'bart-haasbroek/Game-list';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const WORKFLOW = 'update-data.yml';
const MIN_INTERVAL = 10 * 60 * 1000; // niet vaker dan eens per 10 minuten

const gh = (path, init = {}) => fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}${path}`, {
  ...init,
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'game-list-app',
    ...(init.headers || {}),
  },
});

async function latestRun() {
  const res = await gh('/runs?per_page=1');
  if (!res.ok) throw new Error(`GitHub gaf een fout (${res.status})`);
  const r = (await res.json()).workflow_runs?.[0];
  return r ? { status: r.status, conclusion: r.conclusion, createdAt: r.created_at, url: r.html_url } : null;
}

export default async (req) => {
  const meta = await (async () => getStore('gamedata').get('meta', { type: 'json' }))().catch(() => null);
  const noCache = { 'cache-control': 'no-store' };
  if (!process.env.GITHUB_TOKEN) {
    return json({ meta, run: null, error: 'Handmatig bijwerken is nog niet ingesteld (GITHUB_TOKEN ontbreekt in Netlify)' }, req.method === 'POST' ? 501 : 200, noCache);
  }
  try {
    const run = await latestRun();
    if (req.method !== 'POST') return json({ meta, run }, 200, noCache);

    if (run && run.status !== 'completed') return json({ meta, run, started: false, message: 'Er loopt al een update' }, 202, noCache);
    if (run && Date.now() - new Date(run.createdAt).getTime() < MIN_INTERVAL) {
      return json({ meta, run, error: 'Net al bijgewerkt, probeer het over een paar minuten opnieuw' }, 429, noCache);
    }
    const res = await gh('/dispatches', { method: 'POST', body: JSON.stringify({ ref: BRANCH }) });
    if (!res.ok) return json({ error: `Starten mislukt (GitHub ${res.status})` }, 502, noCache);
    return json({ meta, started: true, startedAt: new Date().toISOString() }, 202, noCache);
  } catch (e) {
    return json({ meta, error: e.message }, 502, noCache);
  }
};

export const config = { path: '/api/refresh' };
