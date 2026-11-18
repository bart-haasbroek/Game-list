// Samenvoegen van twee versies van je lijst (gebruikt door de app én door /api/sync).
// Document: { games: [...], deleted: { [gameId]: tijdstip }, swipedNo: [sleutel, ...] }
// Per game wint de laatst aangepaste versie; een verwijdering wint als die later is dan de laatste wijziging.

export const stampOf = (g) => g?.updatedAt ?? g?.addedAt ?? 0;
const TOMBSTONE_DAYS = 400; // verwijderingen zo lang onthouden

export function mergeDocs(a = {}, b = {}) {
  const games = new Map();
  for (const g of [...(a.games || []), ...(b.games || [])]) {
    if (!g || g.id == null) continue;
    const cur = games.get(g.id);
    if (!cur || stampOf(g) >= stampOf(cur)) games.set(g.id, g); // gelijk: b (de nieuwste inzending) wint
  }
  const deleted = { ...(a.deleted || {}) };
  for (const [id, t] of Object.entries(b.deleted || {})) deleted[id] = Math.max(deleted[id] || 0, t);
  for (const [id, t] of Object.entries(deleted)) {
    const g = games.get(id);
    if (g && t >= stampOf(g)) games.delete(id);
    else if (g) delete deleted[id]; // later opnieuw toegevoegd
  }
  const cutoff = Date.now() - TOMBSTONE_DAYS * 864e5;
  for (const [id, t] of Object.entries(deleted)) if (t < cutoff) delete deleted[id];

  // Volgorde: die van a aanhouden, nieuwe games achteraan (zoals games.push)
  const order = [...(a.games || []), ...(b.games || [])].map(g => g?.id);
  const list = [...new Set(order)].filter(id => games.has(id)).map(id => games.get(id));
  const swipedNo = [...new Set([...(a.swipedNo || []), ...(b.swipedNo || [])])];
  return { games: list, deleted, swipedNo };
}

/** Zelfde inhoud? (om onnodig opslaan/opnieuw tekenen te voorkomen) */
export const sameDoc = (x, y) => JSON.stringify(x) === JSON.stringify(y);
