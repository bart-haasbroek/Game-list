// Critici-score en speeltijd per IGDB-game uit public/data/extras.json (gemaakt met `yarn extras`).
// Reserve voor als /api/game niet bereikbaar is (offline, of `yarn dev` zonder Netlify Functions).

let extras = null;
let loading = null;

export function loadExtras() {
  if (extras) return Promise.resolve(extras);
  return (loading ??= fetch('/data/extras.json')
    .then(r => (r.ok ? r.json() : { games: {} }))
    .then(d => (extras = d.games || {}))
    .catch(() => { loading = null; return {}; }));
}

/** { critic: {score, count} | null, playtime: {hastily, normally, completely} | null } of null */
export function extrasFor(igdbId) {
  const r = igdbId && extras?.[igdbId];
  if (!r) return null;
  const [score, count, hastily, normally, completely] = r;
  return {
    critic: score ? { score, count } : null,
    playtime: hastily || normally || completely ? { hastily, normally, completely } : null,
  };
}
