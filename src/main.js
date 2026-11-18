import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { initSync, syncNow, schedule as scheduleSync, syncCode, lastSync, syncStatus, enableSync, restoreSync, disableSync, formatCode } from './sync.js';
import { searchIGDB, searchWikipedia, SourceUnavailable } from './sources.js';
import {
  loadDataset, datasetInfo, getEntry, searchDataset, franchiseList, franchiseGames, franchiseCover, popularGames,
  upcoming, isFuture, formatRelease, countdown, normalize, findEntry, checkForUpdate, onDatasetUpdate,
} from './data.js';
import { resolveCovers, knownCoverUrl, fetchDetails, youtubeId } from './info.js';
import { loadExtras, extrasFor } from './extras.js';
import { mountNotes, detachNotes, destroyNotes } from './notes.js';

const APP_VERSION = '3.0.0';
const COVER_CACHE = 'covers-v2';

// ---------- Iconen ----------
const svg = (d, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}">${d}</svg>`;
const ICONS = {
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  playing: svg('<path d="M6 11h4M8 9v4"/><path d="M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.6C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4A2 2 0 0 1 9.8 16h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.3A4 4 0 0 0 17.3 5z"/>'),
  finished: svg('<circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 5-5"/>'),
  backlog: svg('<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  wishlist: svg('<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>'),
  interested: svg('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
  library: svg('<rect x="4" y="8" width="16" height="13" rx="2.5"/><path d="M6.5 5h11M9 2h6"/>'),
  discover: svg('<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="M10 16a2 2 0 0 1 4 0"/><path d="M2.3 14.5 5 6a2 2 0 0 1 3.8.4L10 13M21.7 14.5 19 6a2 2 0 0 0-3.8.4L14 13"/>'),
  stopped: svg('<circle cx="12" cy="12" r="10"/><path d="M9 9h6v6H9z"/>'),
  all: svg('<rect x="7" y="7" width="13" height="14" rx="2"/><path d="M4 17V6a2 2 0 0 1 2-2h10"/>'),
  platforms: svg('<path d="M6 11h4M8 9v4"/><path d="M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.6C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4A2 2 0 0 1 9.8 16h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.3A4 4 0 0 0 17.3 5z"/>'),
  series: svg('<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M6 6h12M8 3h8"/>'),
  genres: svg('<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/>'),
  more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  star: svg('<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>', 'fill-gold stroke-none'),
  play: svg('<path d="M7 4v16l13-8z"/>', 'fill-current stroke-none'),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  chevron: svg('<path d="m9 18 6-6-6-6"/>', 'size-[18px]! text-muted'),
  clock: svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};

const LISTS = [
  { id: 'playing',    label: 'Speel ik',    short: 'Speel ik',   empty: 'Je speelt nu niks. Tijd voor iets nieuws?' },
  { id: 'backlog',    label: 'Nog spelen',  short: 'Nog spelen', empty: 'Games die je hebt maar nog niet gespeeld hebt komen hier.' },
  { id: 'wishlist',   label: 'Wishlist',    short: 'Wishlist',   empty: 'Je wishlist is leeg. Aangekondigde games krijgen hier een afteller.' },
  { id: 'finished',   label: 'Uitgespeeld', short: 'Klaar',      empty: 'Nog niks uitgespeeld.' },
  { id: 'interested', label: 'Interessant', short: 'Interesse',  empty: 'Games die je leuk lijken komen hier.' },
  { id: 'stopped',    label: 'Gestopt',     short: 'Gestopt',    empty: 'Games waar je mee gestopt bent komen hier.' },
];
// Kleur per lijst (tegels in de Bibliotheek)
const LIST_COLORS = { playing: '#5b8cff', backlog: '#e9edf5', wishlist: '#ff5c9a', finished: '#4fd18b', interested: '#f5b84a', stopped: '#b5776b' };
const LIBRARY_ORDER = ['playing', 'backlog', 'wishlist', 'finished', 'interested', 'stopped'];
const listById = Object.fromEntries(LISTS.map(l => [l.id, l]));
// Lijsten die alleen kunnen als de game al uit is
const NEEDS_RELEASE = ['playing', 'finished', 'stopped'];
const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'library', label: 'Bibliotheek' },
  { id: 'discover', label: 'Ontdek' },
  { id: 'more', label: 'Meer' },
];

const PLATFORM_SHORT = [
  [/switch 2/i, 'Switch 2'], [/switch/i, 'Switch'], [/wii u/i, 'Wii U'], [/^wii$/i, 'Wii'],
  [/new nintendo 3ds/i, 'New 3DS'], [/3ds/i, '3DS'], [/nintendo dsi/i, 'DSi'], [/nintendo ds/i, 'DS'],
  [/game boy advance/i, 'GBA'], [/game boy color/i, 'GBC'], [/game boy/i, 'Game Boy'],
  [/gamecube/i, 'GameCube'], [/nintendo 64/i, 'N64'], [/super nintendo|super famicom/i, 'SNES'],
  [/nintendo entertainment|family computer/i, 'NES'], [/virtual boy/i, 'Virtual Boy'],
];
const NINTENDO_RE = /nintendo|wii|game ?boy|gamecube|virtual boy|famicom|^(switch( 2)?|snes|nes|n64|gba|gbc|3ds|ds|dsi)$/i;
const ALL_PLATFORMS = ['Switch 2', 'Switch', 'Wii U', 'Wii', '3DS', 'DS', 'GameCube', 'N64', 'SNES', 'NES', 'GBA', 'GBC', 'Game Boy', 'Virtual Boy', 'Anders'];
const shortPlatform = (p) => {
  const name = typeof p === 'string' ? p : p.name;
  for (const [re, s] of PLATFORM_SHORT) if (re.test(name)) return s;
  return (typeof p === 'object' && p.abbreviation) || name;
};

// ---------- Opslag ----------
const store = {
  load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { toast('Opslaan mislukt'); } },
};
let games = store.load('gl.games', []);
const prefs = Object.assign({ tab: 'home', sort: 'added' }, store.load('gl.prefs', {}));
if (!TABS.some(t => t.id === prefs.tab)) prefs.tab = ['playing', 'backlog', 'wishlist'].includes(prefs.tab) ? 'library' : 'home';
// Elke wijziging krijgt een tijdstip (updatedAt) en verwijderde games worden onthouden (gl.deleted),
// zodat de sync per game de nieuwste versie kan kiezen. `silent`: automatisch aangevulde gegevens
// (covers, info) tellen niet als wijziging.
let deleted = store.load('gl.deleted', {});
const bare = (g) => JSON.stringify({ ...g, updatedAt: undefined });
let snapshot = new Map(games.map(g => [g.id, bare(g)]));
function saveGames({ silent = false } = {}) {
  const now = Date.now();
  const next = new Map();
  let changed = false;
  for (const g of games) {
    const b = bare(g);
    const prev = snapshot.get(g.id);
    if (prev !== b) {
      changed = true;
      if (!silent || prev === undefined) g.updatedAt = now;
      if (deleted[g.id]) delete deleted[g.id];
    }
    next.set(g.id, b);
  }
  for (const id of snapshot.keys()) if (!next.has(id)) { deleted[id] = now; changed = true; }
  snapshot = next;
  store.save('gl.games', games);
  store.save('gl.deleted', deleted);
  if (changed && !silent) scheduleSync();
}
const savePrefs = () => store.save('gl.prefs', prefs);

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const online = () => navigator.onLine;
const average = (list) => {
  const rated = list.filter(g => g.rating != null);
  return rated.length ? (rated.reduce((s, g) => s + g.rating, 0) / rated.length).toFixed(1) : null;
};
const ownedBy = (key) => (key ? games.find(g => g.sourceKey === key || g.id === key || (g.igdbId != null && key === 'igdb:' + g.igdbId)) : null);
const label = (t) => `<div class="mb-2 text-xs font-bold uppercase tracking-wider text-muted">${t}</div>`;
const sectionHead = (t, action = '') => `<div class="mb-2 mt-6 flex items-center justify-between"><div class="text-xs font-bold uppercase tracking-wider text-muted">${t}</div>${action}</div>`;

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
}

// ---------- Covers ----------
const coverSrc = (g) => g.cover || knownCoverUrl(g.coverFile) || null;

// Covers via Netlify Image CDN: verkleind + WebP (zoals Nuxt Image). Werkt op de live site
// en met `netlify dev` (poort 8888); met gewoon `yarn dev` gebruiken we de originele link.
const IMAGE_CDN = !import.meta.env.DEV || location.port === '8888';
const COVER_W = 360;  // kaarten + detail (±120px breed × 3 voor retina)
const THUMB_W = 144;  // kleine icoontjes in lijsten
function imgUrl(src, w = COVER_W) {
  if (!src || !IMAGE_CDN || !/^https?:\/\//i.test(src)) return src;
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=${w}&fm=webp&q=70`;
}
// Lukt de CDN-versie niet (bv. cover van een site die niet is toegestaan), dan het origineel
const IMG_ERROR = "if(this.dataset.orig&&this.src!==this.dataset.orig){this.src=this.dataset.orig}else{this.remove()}";

function coverHTML(g, { cls = '', extra = '', placeholder = true, w = COVER_W } = {}) {
  const src = coverSrc(g);
  const imgCls = 'relative z-[1] block size-full object-cover opacity-0 transition-opacity duration-300';
  const onload = `onload="this.style.opacity=1" onerror="${IMG_ERROR}"`;
  const img = src ? `<img src="${esc(imgUrl(src, w))}" data-orig="${esc(src)}" alt="" loading="lazy" ${onload} class="${imgCls}">`
    : g.coverFile ? `<img data-file="${esc(g.coverFile)}" data-w="${w}" alt="" ${onload} class="${imgCls}">` : '';
  return `<div class="relative aspect-[3/4.25] overflow-hidden rounded-[10px] bg-surface-2 shadow-lg shadow-black/35 transition-transform ${cls}">
    ${placeholder ? `<div class="absolute inset-0 grid place-items-center bg-linear-to-br from-[#2a2f3b] to-surface p-2 text-center text-[11px] font-semibold text-muted">${esc(g.title)}</div>` : ''}
    ${img}${extra}
  </div>`;
}

// Covers zonder bekende link ophalen zodra ze in beeld zijn (per 50 tegelijk)
async function hydrate(root) {
  if (!online()) return;
  const imgs = [...root.querySelectorAll('img[data-file]:not([src])')];
  if (!imgs.length) return;
  const urls = await resolveCovers(imgs.map(i => i.dataset.file));
  imgs.forEach((img, i) => {
    if (!urls[i]) { img.remove(); return; }
    img.dataset.orig = urls[i];
    img.src = imgUrl(urls[i], Number(img.dataset.w) || COVER_W);
  });
}

// Covers van je eigen games offline bewaren (de gecomprimeerde versies, beide formaten)
function cacheCover(url) {
  if (!url || !('caches' in window)) return;
  caches.open(COVER_CACHE).then(async (c) => {
    for (const w of [COVER_W, THUMB_W]) {
      const u = imgUrl(url, w);
      if (await c.match(u)) continue;
      try { await c.add(u); continue; } catch {}
      // CDN niet beschikbaar of niet toegestaan: origineel bewaren
      if (await c.match(url)) return;
      try { await c.add(url); } catch { try { await c.put(url, await fetch(url, { mode: 'no-cors' })); } catch {} }
      return;
    }
  });
}

// Oude cache (originele, ongecomprimeerde covers) opruimen en eigen covers opnieuw bewaren
async function migrateCoverCache() {
  if (!('caches' in window)) return;
  try { await caches.delete('covers-v1'); } catch {}
  if (online()) games.forEach(g => cacheCover(g.cover));
}

// ---------- Permanente opslag ----------
// Vraagt de browser om localStorage + covers niet zomaar te wissen (bv. iOS na weken niet gebruiken)
async function requestPersist() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}

async function storageInfoText() {
  const parts = [];
  try {
    const persisted = await navigator.storage?.persisted?.();
    if (persisted === true) parts.push('Opslag: permanent ✓');
    else if (persisted === false) parts.push('Opslag: kan door het systeem gewist worden — zet de app op je beginscherm');
  } catch {}
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.usage) parts.push(`${(est.usage / 1024 / 1024).toFixed(1).replace('.', ',')} MB in gebruik`);
  } catch {}
  return parts.join(' · ');
}

// ---------- Kaarten ----------
function badgeHTML(g) {
  const cd = countdown(g.release);
  if (cd && cd.days !== Infinity) {
    return `<span class="absolute bottom-1.5 right-1.5 z-[2] rounded-lg bg-accent px-1.5 py-0.5 text-[11px] font-bold text-white">${cd.days === 0 ? 'Vandaag' : cd.days === 1 ? 'Morgen' : `${cd.days} d`}</span>`;
  }
  if (cd) return `<span class="absolute bottom-1.5 right-1.5 z-[2] rounded-lg bg-black/75 px-1.5 py-0.5 text-[10px] font-bold">${esc(cd.big)}</span>`;
  if (g.rating != null) return `<span class="absolute bottom-1.5 right-1.5 z-[2] flex items-center gap-0.5 rounded-lg bg-black/75 px-1.5 py-0.5 text-xs font-bold [&_svg]:size-[11px]">${ICONS.star}${g.rating}</span>`;
  return '';
}

function cardHTML(g, { ref, sub } = {}) {
  const owned = ref ? null : g;
  const mine = owned || ownedBy(g.key);
  const subline = sub ?? [g.myPlatform || g.platforms?.[0], g.year].filter(Boolean).join(' · ');
  const ownedTag = !owned && mine ? `<span class="absolute left-1.5 top-1.5 z-[2] rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">${esc(listById[mine.status].short)}</span>` : '';
  return `<button data-open="${esc(ref || g.id)}" class="group min-w-0 text-left">
    ${coverHTML(mine && !owned ? { ...g, cover: mine.cover || g.cover } : g, { cls: 'group-active:scale-95', extra: badgeHTML(mine || g) + ownedTag })}
    <div class="mt-1.5 line-clamp-2 text-[12.5px] font-semibold">${esc(g.title)}</div>
    <div class="truncate text-[11px] text-muted">${esc(subline)}</div>
  </button>`;
}

const rowScroller = (items) => `<div class="row-scroller no-scrollbar -mx-4 flex items-start gap-2.5 overflow-x-auto px-4 pb-1 [&>*]:w-[104px] [&>*]:flex-none">${items}</div>`;

// ---------- Schermen openen/sluiten (app-gevoel) ----------
function showScreen(el) {
  el.classList.remove('screen-out', 'sheet-out');
  el.style.transform = '';
  el.style.transition = '';
  el.hidden = false;
}

function hideScreen(el, { animate = true, after } = {}) {
  if (el.hidden) return;
  if (!animate) { el.hidden = true; after?.(); return; }
  el.classList.add(el.id === 'detailScreen' || el.id === 'folderScreen' ? 'screen-out' : 'sheet-out');
  setTimeout(() => {
    el.hidden = true;
    el.classList.remove('screen-out', 'sheet-out');
    after?.();
  }, 200);
}

// Terugvegen vanaf de linkerrand, zoals in iOS-apps
function enableSwipeBack(el, onClose) {
  let x0 = null, y0 = 0, dx = 0, horizontal = null;
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t.clientX > 30) { x0 = null; return; }
    x0 = t.clientX; y0 = t.clientY; dx = 0; horizontal = null;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (x0 == null) return;
    const t = e.touches[0];
    dx = t.clientX - x0;
    if (horizontal == null && (Math.abs(dx) > 8 || Math.abs(t.clientY - y0) > 8)) horizontal = Math.abs(dx) > Math.abs(t.clientY - y0);
    if (!horizontal) return;
    el.style.transition = 'none';
    el.style.transform = `translateX(${Math.max(0, dx)}px)`;
  }, { passive: true });
  el.addEventListener('touchend', () => {
    if (x0 == null) return;
    x0 = null;
    if (!horizontal) return;
    el.style.transition = 'transform .2s ease-out';
    if (dx > 90) {
      el.style.transform = 'translateX(100%)';
      setTimeout(() => { el.hidden = true; el.style.transform = ''; el.style.transition = ''; onClose?.(); }, 200);
    } else {
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 200);
    }
  });
}

// ---------- Navigatie ----------
let sub = null; // subpagina binnen Bibliotheek: een lijst-id, 'all', 'platforms', 'series' of 'genres'

function renderTabs() {
  const brand = `<div class="mb-5 hidden items-center gap-2.5 px-3 text-[19px] font-extrabold tracking-tight lg:flex"><img src="/icons/icon.svg" alt="" class="size-8 rounded-lg">Game List</div>`;
  $('#tabs').innerHTML = brand + TABS.map(t => {
    const active = prefs.tab === t.id;
    return `<button data-tab="${t.id}" class="mx-1 my-1.5 flex flex-col items-center justify-center gap-[3px] rounded-2xl py-1.5 text-[10px] font-semibold transition-colors ${active ? 'bg-accent/15 text-ink [&_svg]:text-accent' : 'text-muted'}">
      ${ICONS[t.id]}<span class="whitespace-nowrap">${t.label}</span>
    </button>`;
  }).join('');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== id; });
}

function setHeader(title, meta = '', { back = false, sort = false } = {}) {
  $('#viewTitle').textContent = title;
  $('#viewMeta').textContent = meta;
  $('#backBtn').hidden = !back;
  $('#sortBtn').hidden = !sort;
}

function render() {
  const tab = prefs.tab;
  const listId = tab === 'library' && (listById[sub] || sub === 'all') ? sub : null;
  $('#addBtn').hidden = !listId;
  if (listId) renderList(listId);
  else if (tab === 'library' && sub) renderBrowse(sub);
  else if (tab === 'library') renderLibrary();
  else if (tab === 'home') renderHome();
  else if (tab === 'discover') renderDiscover();
  else renderMore();
  $('#appHeader').hidden = tab === 'home' && !listId; // Home heeft een eigen kop met afbeelding
  renderTabs();
}

function goTab(tab, s = null) {
  if (listById[tab]) { s = tab; tab = 'library'; } // oude links zoals data-tab="playing"
  const same = prefs.tab === tab && sub === s;
  prefs.tab = tab; savePrefs();
  sub = s;
  render();
  document.querySelectorAll('.view').forEach(v => {
    if (v.hidden) return;
    if (same) v.scrollTo({ top: 0, behavior: 'smooth' }); // nog eens op de tab tikken = naar boven
    else { v.scrollTop = 0; v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in'); }
  });
}

// ---------- Bibliotheek ----------
const lastCover = (list) => list.slice().sort((a, b) => (b.updatedAt ?? b.addedAt ?? 0) - (a.updatedAt ?? a.addedAt ?? 0)).find(g => coverSrc(g) || g.coverFile);

function renderLibrary() {
  setHeader('Bibliotheek', `${games.length} ${games.length === 1 ? 'game' : 'games'}`);
  showView('libraryView');
  const el = $('#libraryView');
  const tile = (id) => {
    const l = listById[id], c = LIST_COLORS[id];
    const items = games.filter(g => g.status === id);
    const cover = lastCover(items);
    return `<button data-sub="${id}" class="flex aspect-[1/.85] flex-col justify-between rounded-2xl border p-3 text-left active:scale-[.96]"
        style="background:color-mix(in srgb,${c} 14%,var(--color-surface,#191c23));border-color:color-mix(in srgb,${c} 30%,transparent)">
      <span class="truncate text-[14px] font-medium text-ink/85">${l.label}</span>
      <span class="flex items-end justify-between gap-1">
        <b class="text-[32px] font-extrabold leading-none" style="color:${c}">${items.length}</b>
        ${cover ? coverHTML(cover, { cls: 'w-9 flex-none rounded-md! shadow-md!', placeholder: false, w: THUMB_W }) : `<span class="pb-1 [&_svg]:size-4">${ICONS.chevron}</span>`}
      </span>
    </button>`;
  };
  const row = (attrs, icon, text, n) => `<button ${attrs} class="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left active:scale-[.98] [&>svg:first-child]:size-5 [&>svg:first-child]:text-muted">
    ${icon}<span class="flex-1 text-[17px] font-semibold">${text}</span><span class="text-[17px] font-bold text-muted">${n}</span>${ICONS.chevron}</button>`;
  el.innerHTML = `
    <div class="lib-tiles grid grid-cols-3 gap-2.5 pt-1">${LIBRARY_ORDER.map(tile).join('')}</div>
    <button data-sub="all" class="mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3.5 text-left active:scale-[.98] [&>svg:first-child]:size-5 [&>svg:first-child]:text-accent">
      ${ICONS.all}<span class="flex-1 text-[17px] font-semibold">Alle games</span><b class="text-[22px] text-accent">${games.length}</b>${ICONS.chevron}</button>
    <button data-swipe class="mt-2.5 flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left active:scale-[.98] [&>svg:first-child]:size-5 [&>svg:first-child]:text-[#4fd18b]">
      ${svg('<rect x="3" y="5" width="12" height="16" rx="2" transform="rotate(-8 9 13)"/><rect x="9" y="3" width="12" height="16" rx="2"/>')}
      <span class="flex-1"><span class="block text-[17px] font-semibold">Wat heb ik gespeeld?</span><span class="text-[12px] text-muted">Veeg per franchise door je games</span></span>${ICONS.chevron}</button>
    <h2 class="mb-2.5 mt-7 text-[22px] font-bold tracking-tight">Bladeren</h2>
    <div class="flex flex-col gap-2">
      ${row('data-sub="platforms"', ICONS.platforms, 'Platforms', groupsOf('platforms').length)}
      ${row('data-sub="series"', ICONS.series, 'Series', groupsOf('series').length)}
      ${row('data-sub="genres"', ICONS.genres, 'Genres', groupsOf('genres').length)}
    </div>`;
  hydrate(el);
}

const BROWSE = {
  platforms: { title: 'Platforms', of: (g) => g.myPlatform ? [g.myPlatform] : [...new Set((g.platforms || []).map(shortPlatform))] },
  series: { title: 'Series', of: (g) => g.franchise ? [g.franchise] : [] },
  genres: { title: 'Genres', of: (g) => (g.info?.genres?.length ? g.info.genres : g.genres) || [] },
};

// [[naam, games[]], …] gesorteerd op aantal
function groupsOf(kind) {
  const map = new Map();
  for (const g of games) for (const k of BROWSE[kind].of(g)) (map.get(k) || map.set(k, []).get(k)).push(g);
  return [...map].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'nl'));
}

function renderBrowse(kind) {
  const groups = groupsOf(kind);
  setHeader(BROWSE[kind].title, `${groups.length} in je bibliotheek`, { back: true });
  showView('libraryView');
  const el = $('#libraryView');
  el.innerHTML = groups.length ? `<div class="overflow-hidden rounded-2xl">${groups.map(([name, list], i) => {
    const cover = lastCover(list);
    return `<button data-group="${i}" class="flex w-full items-center gap-3 border-b border-line bg-surface px-3 py-2.5 text-left last:border-0 active:bg-surface-2">
      ${cover ? coverHTML(cover, { cls: 'w-9 flex-none rounded-md! shadow-none!', placeholder: false, w: THUMB_W }) : '<span class="w-9"></span>'}
      <span class="min-w-0 flex-1 truncate font-semibold">${esc(name)}</span><span class="text-muted">${list.length}</span>${ICONS.chevron}</button>`;
  }).join('')}</div>`
    : `<div class="px-6 py-16 text-center text-muted">${kind === 'genres' ? 'Genres verschijnen zodra de info van je games is opgehaald (online).' : 'Nog niks om te tonen. Voeg eerst games toe.'}</div>`;
  el.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => {
    const [name, list] = groups[b.dataset.group];
    openFolder(name, sortGames(list), null, { owned: true });
  }));
  hydrate(el);
}

// ---------- Lijsten ----------
function sortGames(list) {
  const s = prefs.sort;
  return list.slice().sort((a, b) => {
    if (s === 'title') return a.title.localeCompare(b.title, 'nl');
    if (s === 'rating') return (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title, 'nl');
    if (s === 'release') return String(b.release || b.year || '').localeCompare(String(a.release || a.year || ''));
    return (b.addedAt ?? 0) - (a.addedAt ?? 0);
  });
}

function renderList(listId) {
  const list = listById[listId] || { label: 'Alle games', empty: 'Je bibliotheek is nog leeg.' };
  let items = sortGames(listId === 'all' ? games : games.filter(g => g.status === listId));
  // Op de wishlist staan aankomende games bovenaan, op volgorde van release
  if (listId === 'wishlist') {
    const up = items.filter(g => isFuture(g.release) || g.release === today()).sort((a, b) => String(a.release).localeCompare(String(b.release)));
    items = [...up, ...items.filter(g => !up.includes(g))];
  }
  const avg = average(items);
  setHeader(list.label, `${items.length} ${items.length === 1 ? 'game' : 'games'}${avg ? ` · gem. ${avg}` : ''}`, { back: true, sort: true });
  $('#sortSelect').value = prefs.sort;
  showView('listView');
  const el = $('#listView');
  el.innerHTML = items.length
    ? items.map(g => cardHTML(g)).join('')
    : `<div class="col-span-full px-6 py-16 text-center text-muted [&_svg]:mx-auto [&_svg]:mb-2 [&_svg]:size-11 [&_svg]:opacity-50">
        ${ICONS[listId] || ICONS.all}<div>${list.empty}</div>
        <button data-tab="discover" class="mt-4 rounded-full bg-surface-2 px-4 py-2 font-semibold text-ink">Games ontdekken</button>
      </div>`;
  hydrate(el);
}

// ---------- Home ----------
// Grote kop op Home: de game die je nu speelt. Kies een andere via "Aan het spelen".
function heroGame(playing) {
  return playing.find(g => g.id === prefs.heroId) || playing[0] || null;
}

// Liggende afbeelding (artwork) van IGDB, één keer per game opgehaald en bij de game bewaard
const artworkTried = new Set();
async function ensureArtwork(g) {
  if (!g || g.artwork !== undefined || !g.igdbId || !online() || artworkTried.has(g.id)) return;
  artworkTried.add(g.id);
  try {
    const res = await fetch('/api/game?id=' + encodeURIComponent(g.igdbId));
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return; // bv. yarn dev zonder functions
    const d = await res.json();
    const patch = { artwork: d.artwork || null };
    if (g.info && !g.info.playtime && d.playtime) patch.info = { ...g.info, playtime: d.playtime, critic: d.critic || g.info.critic };
    updateGame(g.id, patch);
    if (prefs.tab === 'home' && $('#detailScreen').hidden) renderHome();
  } catch {}
}

function heroHTML(g) {
  const d = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const date = d.charAt(0).toUpperCase() + d.slice(1); // "Woensdag 18 november"
  const title = `<div class="pt-safe relative z-[2] px-4"><h1 class="text-[32px] font-extrabold tracking-tight [text-shadow:0_2px_12px_rgba(0,0,0,.5)]">Game List</h1>
    <div class="-mt-0.5 text-[13px] font-medium text-white/80 [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">${esc(date)}</div></div>`;
  if (!g) {
    return `<div id="hero" class="home-hero relative -mx-4 overflow-hidden" style="--hero-h:300px;height:var(--hero-h)">
      <div id="heroImg" class="absolute inset-0 bg-linear-to-br from-accent/45 via-[#3b2a6b]/40 to-bg"></div>
      ${title}
      <div class="absolute inset-x-0 bottom-0 z-[2] px-4 pb-6">
        <div class="text-[24px] font-extrabold leading-tight">Wat speel je nu?</div>
        <p class="mt-1 text-[14px] text-white/75">Zet een game op <b>Speel ik</b>, dan staat hij hier groot.</p>
        <button data-tab="discover" class="mt-3 rounded-full bg-white px-4 py-2 text-[14px] font-bold text-bg">Game zoeken</button>
      </div>
    </div>`;
  }
  const extra = extrasFor(g.igdbId);
  const pt = g.info?.playtime || extra?.playtime;
  const hours = pt && (pt.normally || pt.hastily || pt.completely);
  const genre = (g.info?.genres?.length ? g.info.genres : g.genres || [])[0];
  const line = [genre, g.myPlatform || g.platforms?.[0]].filter(Boolean).join(' · ');
  const art = g.artwork ? imgUrl(g.artwork, 1280) : null;
  const cover = coverSrc(g);
  const bg = art || (cover ? imgUrl(cover) : null);
  return `<div id="hero" class="home-hero relative -mx-4 overflow-hidden bg-surface" style="height:var(--hero-h)">
    <div id="heroImg" class="absolute inset-0 origin-top bg-cover bg-center will-change-transform ${art ? '' : 'scale-125 blur-2xl brightness-[.55] saturate-150'}"
      style="${bg ? `background-image:url('${esc(bg).replace(/'/g, '%27')}')` : ''}"></div>
    <div class="absolute inset-0 bg-linear-to-b from-black/50 via-black/0 via-35% to-bg"></div>
    ${title}
    ${art ? '' : cover ? `<div class="absolute left-1/2 top-[44%] z-[1] w-[34%] max-w-[170px] -translate-x-1/2 -translate-y-1/2">${coverHTML(g, { cls: 'shadow-2xl! shadow-black/60!', placeholder: false })}</div>` : ''}
    <button data-open="${g.id}" class="absolute inset-x-0 bottom-0 z-[2] px-4 pb-5 pr-20 text-left">
      <div class="line-clamp-2 text-[30px] font-black leading-[1.05] tracking-tight [text-shadow:0_2px_16px_rgba(0,0,0,.6)]">${esc(g.title)}</div>
      ${line ? `<div class="mt-2 text-[15px] font-medium text-white/85">${esc(line)}</div>` : ''}
      ${hours ? `<div class="text-[14px] text-white/65">~${fmtHours(hours)} om uit te spelen</div>` : ''}
    </button>
    <button data-open="${g.id}" aria-label="Info" class="absolute bottom-6 right-4 z-[3] grid size-12 place-items-center rounded-full border border-white/35 bg-black/25 backdrop-blur-md">
      ${svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>')}
    </button>
  </div>`;
}

// Grote kop van een sectie op Home, met pijltje als hij ergens heen gaat
const homeHead = (t, attrs = '') => attrs
  ? `<button ${attrs} class="mb-3 mt-8 flex items-center gap-1 text-[23px] font-bold tracking-tight active:opacity-70">${t}${svg('<path d="m9 18 6-6-6-6"/>', 'size-6! stroke-[2.5]! text-accent')}</button>`
  : `<h2 class="mb-3 mt-8 text-[23px] font-bold tracking-tight">${t}</h2>`;

function renderHome() {
  setHeader('Home');
  showView('homeView');
  const el = $('#homeView');
  const keepScroll = el.scrollTop;
  const year = new Date().getFullYear();
  const count = (s) => games.filter(g => g.status === s).length;
  const finishedYear = games.filter(g => g.finishedAt?.startsWith(String(year))).length;

  const tile = (n, t, tab, accent) => `<button data-tab="${tab}" class="rounded-2xl ${accent ? 'bg-accent text-white' : 'bg-surface'} p-3 text-left active:scale-[.97]">
    <b class="block text-[26px] leading-none">${n}</b><span class="text-[12px] ${accent ? 'text-white/85' : 'text-muted'}">${t}</span></button>`;

  // Afteller: eigen games met een releasedatum in de toekomst
  const mineUpcoming = games.filter(g => countdown(g.release)).sort((a, b) => String(a.release).localeCompare(String(b.release)));
  const countdownRows = mineUpcoming.map(g => {
    const cd = countdown(g.release);
    return `<button data-open="${g.id}" class="flex w-full items-center gap-3 rounded-2xl bg-surface p-2.5 text-left active:scale-[.98]">
      ${coverHTML(g, { cls: 'w-12 flex-none rounded-md! shadow-none!', placeholder: false, w: THUMB_W })}
      <div class="min-w-0 flex-1">
        <div class="truncate font-semibold">${esc(g.title)}</div>
        <div class="text-[12px] text-muted">${esc(cd.small)} · ${esc(listById[g.status].label)}</div>
      </div>
      <div class="flex-none pr-1 text-right">
        <div class="text-[24px] font-extrabold leading-none text-accent">${esc(cd.big)}</div>
        ${cd.unit ? `<div class="text-[11px] text-muted">${cd.unit}</div>` : ''}
      </div>
    </button>`;
  }).join('');

  const playing = games.filter(g => g.status === 'playing')
    .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')) || (b.addedAt ?? 0) - (a.addedAt ?? 0));
  const hero = heroGame(playing);
  const top = games.filter(g => g.rating != null).sort((a, b) => b.rating - a.rating).slice(0, 10);
  const lastFinished = games.filter(g => g.status === 'finished').sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || ''))).slice(0, 10);
  const nintendoUpcoming = upcoming(30).filter(e => !ownedBy(e.key)).slice(0, 15);

  // "Aan het spelen": tik = in de kop zetten, nog eens tikken = info-pagina
  const playCard = (g) => {
    const sel = g === hero;
    return `<button data-hero="${g.id}" class="flex-none rounded-2xl p-2 text-left transition-colors ${sel ? 'bg-accent/12 ring-2 ring-accent/70' : 'active:bg-surface'}">
      ${coverHTML(g, { cls: 'w-full' })}
      <div class="mt-2 truncate text-[15px] font-semibold">${esc(g.title)}</div>
      <div class="truncate text-[13px] ${sel ? 'font-semibold text-accent' : 'text-muted'}">${esc(g.myPlatform || g.platforms?.[0] || '')}</div>
    </button>`;
  };

  // Lege lijst en geen sync: misschien heeft Safari de gegevens gewist, dus herstellen aanbieden
  const restoreCard = !games.length && !syncCode() ? `<button data-sync-restore class="mt-4 flex w-full items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-3.5 text-left active:scale-[.98]">
      <span class="grid size-10 flex-none place-items-center rounded-full bg-accent/20 text-accent [&_svg]:size-5">${svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>')}</span>
      <span class="min-w-0 flex-1"><b class="block text-[16px]">Lijst terugzetten</b><span class="text-[12.5px] text-muted">Heb je een herstelcode? Haal je games terug.</span></span>${ICONS.chevron}</button>` : '';

  el.innerHTML = `
    ${heroHTML(hero)}
    ${restoreCard}
    ${playing.length ? homeHead('Aan het spelen', 'data-tab="playing"')
      + `<div class="row-scroller play-row no-scrollbar -mx-4 flex items-start gap-2 overflow-x-auto px-3 pb-1 [&>*]:w-[148px]">${playing.map(playCard).join('')}</div>` : ''}
    ${mineUpcoming.length ? homeHead('Afteller') + `<div class="flex flex-col gap-2">${countdownRows}</div>` : ''}
    ${homeHead('Overzicht')}
    <div class="home-tiles grid grid-cols-2 gap-2.5">
      ${tile(count('playing'), 'speel ik nu', 'playing', true)}
      ${tile(count('backlog'), 'nog te spelen', 'backlog')}
      ${tile(count('wishlist'), 'op mijn wishlist', 'wishlist')}
      ${tile(finishedYear, `uitgespeeld in ${year}`, 'finished')}
    </div>
    ${nintendoUpcoming.length ? homeHead('Binnenkort op Nintendo', 'data-upcoming')
      + rowScroller(nintendoUpcoming.map(e => cardHTML(e, { ref: e.key, sub: countdown(e.release)?.small || '' })).join('')) : ''}
    ${top.length ? homeHead('Mijn hoogste cijfers') + rowScroller(top.map(g => cardHTML(g)).join('')) : ''}
    ${lastFinished.length ? homeHead('Laatst uitgespeeld', 'data-tab="finished"') + rowScroller(lastFinished.map(g => cardHTML(g, { sub: g.finishedAt ? formatRelease(g.finishedAt) : '' })).join('')) : ''}
    <div class="mt-6 text-center text-[12px] text-muted">${games.length} games in je verzameling${average(games) ? ` · gemiddeld cijfer ${average(games)}` : ''}</div>
  `;
  el.scrollTop = keepScroll;
  onHomeScroll();
  hydrate(el);
  ensureArtwork(hero);
}

// ---------- Home: trek-om-te-vergroten en parallax op de kop ----------
const homeEl = $('#homeView');
function onHomeScroll() {
  const img = $('#heroImg');
  if (img && !pullStart) img.style.transform = homeEl.scrollTop > 0 ? `translateY(${homeEl.scrollTop * 0.4}px)` : '';
}
let pullStart = null, pulled = 0;
function setPull(px, animate) {
  const hero = $('#hero');
  if (!hero) return;
  hero.style.transition = animate ? 'height .4s cubic-bezier(.2,.8,.2,1)' : 'none';
  hero.style.height = px ? `calc(var(--hero-h) + ${px}px)` : 'var(--hero-h)';
}
homeEl.addEventListener('scroll', onHomeScroll, { passive: true });
homeEl.addEventListener('touchstart', (e) => {
  pullStart = homeEl.scrollTop <= 0 && $('#hero') && e.touches.length === 1 ? e.touches[0].clientY : null;
  pulled = 0;
}, { passive: true });
homeEl.addEventListener('touchmove', (e) => {
  if (pullStart == null) return;
  const dy = e.touches[0].clientY - pullStart;
  if (dy <= 0 || homeEl.scrollTop > 0) { if (pulled) { pulled = 0; setPull(0); } return; }
  e.preventDefault(); // geen stuiter van de browser: wij rekken de kop zelf op
  pulled = Math.min(260, dy * 0.55);
  setPull(pulled);
}, { passive: false });
const endPull = () => { if (pulled) setPull(0, true); pullStart = null; pulled = 0; };
homeEl.addEventListener('touchend', endPull);
homeEl.addEventListener('touchcancel', endPull);

// ---------- Ontdek ----------
let searchTimer, searchCtrl, onlineResults = null, onlineSource = null;
const candidates = new Map(); // key -> game uit online zoekresultaten
let igdbAvailable = true;
const SOURCE_NAMES = { igdb: 'IGDB', wikipedia: 'Wikipedia', wikidata: 'Wikidata' };

function renderDiscover() {
  setHeader('Ontdek', datasetInfo() ? `${datasetInfo().count.toLocaleString('nl-NL')} Nintendo-games` : '');
  showView('discoverView');
  const q = $('#searchInput').value.trim();
  $('#clearSearch').hidden = !q;
  const body = $('#discoverBody');

  loadDataset().then(() => {
    if (prefs.tab !== 'discover') return;
    setHeader('Ontdek', `${datasetInfo().count.toLocaleString('nl-NL')} Nintendo-games`);
    body.innerHTML = q ? discoverResultsHTML(q) : discoverHomeHTML();
    hydrate(body);
    if (!q) loadFranchiseArt(body);
  }).catch(() => {
    body.innerHTML = notice('De gamelijst kon niet geladen worden.<small>Open de app een keer met internet, dan werkt hij daarna ook offline.</small>');
  });
}

const notice = (html) => `<div class="px-3 py-10 text-center text-muted [&_small]:mt-1.5 [&_small]:block [&_small]:opacity-80">${html}</div>`;

// Liggende afbeelding per franchise-tegel (artwork van het vlaggenschip), bewaard per IGDB-id ('' = geen)
const FR_ART_KEY = 'gl.franchiseArt';
let franchiseArt;
try { franchiseArt = JSON.parse(localStorage.getItem(FR_ART_KEY)) || {}; } catch { franchiseArt = {}; }
const frArtTried = new Set();

function franchiseArtHTML(e) {
  const art = e.igdbId && franchiseArt[e.igdbId];
  if (!art) {
    return `<div data-fr-art="${e.igdbId || ''}" class="absolute inset-0 opacity-60 [&>div]:aspect-auto! [&>div]:size-full [&>div]:rounded-none! [&>div]:shadow-none!">${coverHTML(e, { placeholder: false })}</div>`;
  }
  return `<img src="${esc(imgUrl(art, 640))}" data-orig="${esc(art)}" alt="" loading="lazy" onload="this.style.opacity=.75" onerror="${IMG_ERROR}"
    class="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300">`;
}

// Ontbrekende artworks in één keer ophalen en de tegels bijwerken
async function loadFranchiseArt(root) {
  const slots = [...root.querySelectorAll('[data-fr-art]')].filter(el => el.dataset.frArt);
  const ids = [...new Set(slots.map(el => el.dataset.frArt))].filter(id => !(id in franchiseArt) && !frArtTried.has(id));
  if (!ids.length || !online()) return;
  ids.forEach(id => frArtTried.add(id));
  try {
    const res = await fetch('/api/artworks?ids=' + ids.join(','));
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return; // bv. yarn dev zonder functions
    const d = await res.json();
    for (const id of ids) franchiseArt[id] = d[id] || '';
    try { localStorage.setItem(FR_ART_KEY, JSON.stringify(franchiseArt)); } catch {}
    // Opnieuw zoeken: Ontdek kan intussen opnieuw getekend zijn
    for (const el of document.querySelectorAll('[data-fr-art]')) {
      if (franchiseArt[el.dataset.frArt]) el.outerHTML = franchiseArtHTML({ igdbId: el.dataset.frArt });
    }
  } catch {}
}

function discoverHomeHTML() {
  const up = upcoming(20);
  const fr = franchiseList();
  const tile = (f) => {
    const e = franchiseCover(f.name);
    return `<button data-franchise="${esc(f.name)}" class="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface text-left active:scale-[.97]">
      ${e ? franchiseArtHTML(e) : ''}
      <div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent"></div>
      <div class="absolute inset-x-0 bottom-0 p-2.5">
        <div class="flex items-center gap-1.5 font-bold leading-tight [&_svg]:size-4 [&_svg]:flex-none [&_svg]:text-accent">${ICONS.folder}<span class="truncate">${esc(f.name)}</span></div>
        <div class="text-[11px] text-white/70">${f.count} games</div>
      </div>
    </button>`;
  };
  const curated = fr.filter(f => f.curated);
  const others = fr.filter(f => !f.curated);
  return `
    ${up.length ? sectionHead('Binnenkort', `<button data-upcoming class="text-[13px] font-semibold text-accent">Alles</button>`).replace('mt-6', 'mt-1')
      + rowScroller(up.map(e => cardHTML(e, { ref: e.key, sub: countdown(e.release)?.small || '' })).join('')) : ''}
    ${sectionHead('Franchises')}
    <div class="grid grid-cols-2 gap-2.5">${curated.map(tile).join('')}</div>
    ${others.length ? sectionHead('Meer series') + `<div class="grid grid-cols-2 gap-2.5">${others.slice(0, 40).map(tile).join('')}</div>` : ''}
    <button data-manual class="mt-6 w-full rounded-xl bg-surface-2 p-3.5 font-semibold">Game staat er niet tussen? Handmatig toevoegen</button>
  `;
}

function resultRow(g, key) {
  const mine = ownedBy(key);
  const plats = [...new Set((g.platforms || []).map(shortPlatform))];
  return `<button data-open="${esc(key)}" class="flex w-full items-center gap-3 border-b border-line py-2 text-left">
    ${coverHTML(mine ? { ...g, cover: mine.cover || g.cover } : g, { cls: 'w-12 flex-none rounded-md! shadow-none!', placeholder: false, w: THUMB_W })}
    <div class="min-w-0 flex-1">
      <div class="font-semibold leading-snug">${esc(g.title)}</div>
      <div class="truncate text-[12.5px] text-muted">${esc([formatRelease(g.release) || g.year, plats.join(', ')].filter(Boolean).join(' · '))}</div>
    </div>
    ${mine ? `<span class="flex-none text-[11px] font-bold text-accent">${esc(listById[mine.status].short)}</span>` : ''}
  </button>`;
}

function discoverResultsHTML(q) {
  const nq = normalize(q);
  const folders = franchiseList().filter(f => normalize(f.name).includes(nq) || nq.includes(normalize(f.name))).slice(0, 4);
  const local = searchDataset(q);
  let html = folders.map(f => `<button data-franchise="${esc(f.name)}" class="mb-2 flex w-full items-center gap-3 rounded-xl bg-surface p-3 text-left [&_svg]:text-accent">
      ${ICONS.folder}<div class="flex-1"><div class="font-semibold">${esc(f.name)}</div><div class="text-[12px] text-muted">${f.count} games</div></div>${ICONS.chevron}</button>`).join('');

  if (onlineResults && onlineResults.q === q) {
    const list = onlineResults.items.filter(r => !r.platforms?.length || r.platforms.some(p => NINTENDO_RE.test(p.name || p)));
    html += `<div class="pb-1 pt-1 text-[11px] text-muted">Online gezocht via ${SOURCE_NAMES[onlineSource]}</div>`;
    html += list.length ? list.map(r => resultRow(r, r.key)).join('') : notice('Ook online niks gevonden.');
  } else {
    html += local.length ? local.map(e => resultRow(e, e.key)).join('') : notice('Niet gevonden in de offline lijst.');
    html += online()
      ? `<button data-online-search class="mt-4 w-full rounded-xl bg-surface-2 p-3.5 font-semibold">Niet gevonden? Zoek online</button>`
      : `<div class="mt-4 text-center text-[12px] text-muted">Je bent offline · online zoeken kan later</div>`;
  }
  html += `<button data-manual class="mt-2 w-full rounded-xl p-3 font-semibold text-muted">Handmatig toevoegen</button>`;
  return html;
}

async function searchOnline(q) {
  if (searchCtrl) searchCtrl.abort();
  const ctrl = searchCtrl = new AbortController();
  $('#discoverBody').innerHTML = notice('Online zoeken…');
  try {
    let results = null, source = 'wikipedia';
    if (igdbAvailable) {
      try { results = await searchIGDB(q, ctrl.signal); source = 'igdb'; }
      catch (e) {
        if (e.name === 'AbortError') throw e;
        if (e instanceof SourceUnavailable) igdbAvailable = false;
      }
    }
    if (!results) results = await searchWikipedia(q, ctrl.signal);
    if (ctrl !== searchCtrl) return;
    for (const r of results) {
      r.release = r.release || (r.year ? String(r.year) : null);
      // Bestaat de game ook in de offline lijst? Gebruik dan die gegevens (platforms, franchise, trailer)
      const ds = getEntry(r.key);
      candidates.set(r.key, ds ? { ...ds, cover: r.cover || null, summary: r.summary } : r);
    }
    onlineResults = { q, items: results.map(r => candidates.get(r.key)) };
    onlineSource = source;
    renderDiscover();
  } catch (e) {
    if (e.name === 'AbortError') return;
    $('#discoverBody').innerHTML = notice(`Online zoeken mislukt.<small>${esc(e.message)}</small>`);
  }
}

// ---------- Franchise-map ----------
function openFolder(title, items, meta, { owned = false } = {}) {
  $('#folderTitle').textContent = title;
  $('#folderMeta').textContent = meta ?? `${items.length} ${items.length === 1 ? 'game' : 'games'}`;
  const body = $('#folderBody');
  body.innerHTML = items.map(e => owned ? cardHTML(e) : cardHTML(e, { ref: e.key, sub: [e.platforms?.[0], e.year].filter(Boolean).join(' · ') })).join('');
  body.scrollTop = 0;
  $('#folderSwipe').hidden = true;
  hideScreen($('#detailScreen'), { animate: false }); // anders ligt de map achter de info-pagina
  showScreen($('#folderScreen'));
  hydrate(body);
}
const openFranchise = (name) => loadDataset().then(() => {
  openFolder(name, franchiseGames(name));
  const btn = $('#folderSwipe');
  btn.dataset.swipe = name;
  btn.hidden = !swipeCandidates(name).length;
});
const openUpcoming = () => loadDataset().then(() => {
  const known = upcoming(1000);
  const list = [...known, ...upcoming(1000, { notable: false }).filter(e => !known.includes(e))];
  openFolder('Binnenkort', list, `${list.length} aangekondigde Nintendo-games`);
  $('#folderBody').querySelectorAll('[data-open]').forEach((b, i) => {
    const cd = countdown(list[i].release);
    if (cd) b.lastElementChild.textContent = cd.small;
  });
});

// ---------- Swipen: wat heb ik gespeeld? ----------
// Per franchise een stapel kaarten: naar rechts = gespeeld (komt in Uitgespeeld, zonder datum),
// naar links = niet gespeeld (wordt niet meer gevraagd). Details vul je later zelf aan.
const SWIPE_TOP = '__top';
const swipe = { set: null, queue: [], history: [], yes: 0, no: 0, busy: false };
const swipedNo = new Set(store.load('gl.swipedNo', []));
const saveSwipedNo = () => { store.save('gl.swipedNo', [...swipedNo]); scheduleSync(); };
const swipeName = (set) => (set === SWIPE_TOP ? 'Populair' : set);

function swipeCandidates(set) {
  const list = set === SWIPE_TOP ? popularGames(400) : franchiseGames(set);
  return list.filter(e => !isFuture(e.release) && !ownedBy(e.key) && !swipedNo.has(e.key))
    .sort((a, b) => b.pop - a.pop || String(a.release).localeCompare(String(b.release)));
}

function openSwipe(set = null) {
  loadDataset().then(() => {
    hideScreen($('#folderScreen'), { animate: false });
    hideScreen($('#detailScreen'), { animate: false });
    showScreen($('#swipeScreen'));
    if (set) startSwipe(set); else renderSwipePicker();
  });
}

function startSwipe(set) {
  Object.assign(swipe, { set, queue: swipeCandidates(set), history: [], yes: 0, no: 0, busy: false });
  renderSwipe();
}

function renderSwipePicker() {
  swipe.set = null;
  $('#swipeTitle').textContent = 'Wat heb ik gespeeld?';
  $('#swipeMeta').textContent = 'Kies een franchise';
  const sets = [SWIPE_TOP, ...franchiseList().map(f => f.name)]
    .map(name => ({ name, left: swipeCandidates(name).length }))
    .filter((f, i) => f.left > 0 && (i < 60));
  const tile = ({ name, left }) => {
    const cover = name === SWIPE_TOP ? popularGames(1)[0] : franchiseCover(name);
    return `<button data-swipe-pick="${esc(name)}" class="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface text-left active:scale-[.97]">
      ${cover ? franchiseArtHTML(cover) : ''}
      <div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent"></div>
      <div class="absolute inset-x-0 bottom-0 p-2.5"><b class="block truncate text-[16px] leading-tight">${esc(swipeName(name))}</b>
        <span class="text-[12px] text-white/70">nog ${left}</span></div></button>`;
  };
  const el = $('#swipeBody');
  el.innerHTML = `
    <p class="mb-3 text-[13px] text-muted">Veeg naar <b class="text-[#4fd18b]">rechts</b> als je een game gespeeld hebt, naar <b class="text-[#ff5c5c]">links</b> als niet.
      Gespeelde games komen in <b class="text-ink">Uitgespeeld</b>; cijfer en details vul je later aan.</p>
    <div class="grid grid-cols-2 gap-2.5 pb-6 lg:grid-cols-4">${sets.map(tile).join('')}</div>`;
  el.scrollTop = 0;
  hydrate(el);
  loadFranchiseArt(el);
}

function swipeCardHTML(e, top) {
  const plats = (e.platforms || []).slice(0, 3).join(', ');
  const stamp = (kind, text, color, side) => `<div data-stamp="${kind}" class="pointer-events-none absolute ${side} top-5 z-[3] rounded-lg border-4 px-2 py-0.5 text-[26px] font-black tracking-wide opacity-0" style="border-color:${color};color:${color};transform:rotate(${kind === 'yes' ? -14 : 14}deg)">${text}</div>`;
  return `<div ${top ? 'id="swipeCard"' : ''} class="relative col-start-1 row-start-1 flex min-h-0 select-none flex-col rounded-2xl bg-surface p-2.5 shadow-2xl shadow-black/50 ${top ? 'z-[2] cursor-grab touch-none' : 'z-[1] scale-[.94] translate-y-3 opacity-60'}">
    ${top ? stamp('yes', 'GESPEELD', '#4fd18b', 'left-5') + stamp('no', 'NIET', '#ff5c5c', 'right-5') : ''}
    ${coverHTML(e, { cls: 'min-h-0 w-full flex-1 aspect-auto! rounded-xl! shadow-none!', w: 640 })}
    <div class="flex-none px-1 pb-0.5 pt-2.5"><div class="line-clamp-2 text-[20px] font-bold leading-tight">${esc(e.title)}</div>
      <div class="mt-0.5 truncate text-[14px] text-muted">${esc([e.year, plats].filter(Boolean).join(' · '))}</div></div>
  </div>`;
}

function renderSwipe() {
  const { set, queue, history } = swipe;
  const total = history.length + queue.length;
  $('#swipeTitle').textContent = swipeName(set);
  $('#swipeMeta').textContent = queue.length ? `${history.length + 1} van ${total} · ${swipe.yes} gespeeld` : `${swipe.yes} gespeeld · ${swipe.no} niet`;
  const el = $('#swipeBody');
  const btn = (attrs, cls, icon, label) => `<button ${attrs} aria-label="${label}" class="grid place-items-center rounded-full bg-surface shadow-lg active:scale-90 ${cls}">${icon}</button>`;
  const undo = btn(`data-swipe-undo ${history.length ? '' : 'disabled'}`, 'size-12 text-muted disabled:opacity-30', svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'), 'Ongedaan maken');
  if (!queue.length) {
    el.innerHTML = `<div class="m-auto flex flex-col items-center px-6 py-10 text-center">
      <div class="mb-3 grid size-16 place-items-center rounded-full bg-[#4fd18b]/15 text-[#4fd18b] [&_svg]:size-8">${ICONS.finished}</div>
      <b class="text-[20px]">${total ? `Klaar met ${esc(swipeName(set))}!` : `Niks meer te doen bij ${esc(swipeName(set))}`}</b>
      <p class="mt-1 text-[13px] text-muted">${total ? `${swipe.yes} gespeeld, ${swipe.no} niet gespeeld.` : 'Alle games staan al in je bibliotheek of zijn al langsgekomen.'}</p>
      <div class="mt-5 flex flex-col gap-2">
        <button data-swipe-pickers class="rounded-full bg-accent px-5 py-2.5 font-bold text-white">Andere franchise</button>
        ${swipe.yes ? `<button data-tab="finished" class="rounded-full bg-surface-2 px-5 py-2.5 font-semibold">Bekijk Uitgespeeld</button>` : ''}
      </div>
      ${history.length ? `<div class="mt-6">${undo}</div>` : ''}
    </div>`;
    return;
  }
  el.innerHTML = `
    <div class="mx-auto grid min-h-0 w-full max-w-[460px] flex-1 grid-rows-[minmax(0,1fr)] pt-2" style="max-height:760px">
      ${queue[1] ? swipeCardHTML(queue[1], false) : ''}${swipeCardHTML(queue[0], true)}
    </div>
    <div class="flex flex-none items-center justify-center gap-6 pb-3 pt-4">
      ${btn('data-swipe-no', 'size-16 text-[#ff5c5c] [&_svg]:size-8 [&_svg]:stroke-[3]', svg('<path d="M18 6 6 18M6 6l12 12"/>'), 'Niet gespeeld')}
      ${undo}
      ${btn('data-swipe-yes', 'size-16 text-[#4fd18b] [&_svg]:size-8 [&_svg]:stroke-[3]', svg('<path d="M20 6 9 17l-5-5"/>'), 'Gespeeld')}
    </div>`;
  bindSwipeCard($('#swipeCard'));
  hydrate(el);
}

function placeCard(card, dx, dy) {
  card.style.transform = `translate(${dx}px, ${dy * 0.3}px) rotate(${dx / 16}deg)`;
  const p = Math.min(1, Math.abs(dx) / 90);
  card.querySelector('[data-stamp="yes"]').style.opacity = dx > 0 ? p : 0;
  card.querySelector('[data-stamp="no"]').style.opacity = dx < 0 ? p : 0;
}

function bindSwipeCard(card) {
  if (!card) return;
  let x0 = null, y0 = 0, dx = 0, dy = 0;
  card.addEventListener('dragstart', (e) => e.preventDefault()); // anders sleept de browser de cover-afbeelding mee
  card.addEventListener('pointerdown', (e) => {
    if (swipe.busy) return;
    x0 = e.clientX; y0 = e.clientY; dx = dy = 0;
    card.setPointerCapture(e.pointerId);
    card.style.transition = 'none';
    card.classList.replace('cursor-grab', 'cursor-grabbing');
  });
  card.addEventListener('pointermove', (e) => {
    if (x0 == null) return;
    dx = e.clientX - x0; dy = e.clientY - y0;
    placeCard(card, dx, dy);
  });
  const end = () => {
    if (x0 == null) return;
    x0 = null;
    card.classList.replace('cursor-grabbing', 'cursor-grab');
    if (Math.abs(dx) > 90) swipeDecide(dx > 0);
    else { card.style.transition = 'transform .25s'; placeCard(card, 0, 0); }
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

function swipeDecide(played) {
  const card = $('#swipeCard');
  if (!card || swipe.busy) return;
  swipe.busy = true;
  card.style.transition = 'transform .25s ease-in, opacity .25s';
  placeCard(card, played ? 140 : -140, 0); // stempel tonen
  card.style.transform = `translate(${played ? '' : '-'}130vw, 40px) rotate(${played ? 30 : -30}deg)`;
  navigator.vibrate?.(10);
  setTimeout(() => {
    const e = swipe.queue.shift();
    if (played) {
      const rec = addFromView(e, 'finished');
      rec.finishedAt = null; // datum onbekend: telt niet mee als "uitgespeeld in <jaar>"
      saveGames();
      swipe.history.push({ e, played, id: rec.id });
      swipe.yes++;
    } else {
      swipedNo.add(e.key); saveSwipedNo();
      swipe.history.push({ e, played });
      swipe.no++;
    }
    swipe.busy = false;
    renderSwipe();
  }, 230);
}

function swipeUndo() {
  const h = swipe.history.pop();
  if (!h || swipe.busy) return;
  if (h.played) { games = games.filter(g => g.id !== h.id); saveGames(); swipe.yes--; }
  else { swipedNo.delete(h.e.key); saveSwipedNo(); swipe.no--; }
  swipe.queue.unshift(h.e);
  renderSwipe();
}

document.addEventListener('keydown', (e) => {
  if ($('#swipeScreen').hidden || !swipe.set || e.target.closest('input, textarea, select')) return;
  if (e.key === 'ArrowRight') swipeDecide(true);
  else if (e.key === 'ArrowLeft') swipeDecide(false);
  else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') swipeUndo();
});
$('#swipeBack').addEventListener('click', () => {
  if (swipe.set) renderSwipePicker();
  else hideScreen($('#swipeScreen'), { after: render });
});

// ---------- Meer ----------
function renderMore() {
  setHeader('Meer');
  showView('moreView');
  const year = new Date().getFullYear();
  const info = datasetInfo();
  const row = (attrs, icon, text, right = '') => `<button ${attrs} class="flex w-full items-center gap-3 border-b border-line bg-surface px-4 py-3.5 text-left last:border-0 [&>svg:first-child]:text-accent">
    ${icon}<span class="flex-1 font-semibold">${text}</span>${right}${ICONS.chevron}</button>`;
  const stat = (v, t) => `<div class="rounded-xl bg-surface px-2 py-3 text-center"><b class="block text-[22px]">${v}</b><span class="text-[11px] text-muted">${t}</span></div>`;

  $('#moreView').innerHTML = `
    <div class="overflow-hidden rounded-2xl">
      ${row('data-upcoming', ICONS.clock, 'Binnenkort op Nintendo')}
      ${row('data-manual', ICONS.plus, 'Handmatig toevoegen')}
    </div>
    <div>
      ${label('Statistieken')}
      <div class="grid grid-cols-3 gap-2">
        ${stat(games.length, 'games')}${stat(average(games) ?? '–', 'gem. cijfer')}${stat(games.filter(g => g.finishedAt?.startsWith(String(year))).length, `klaar in ${year}`)}
      </div>
    </div>
    <div>
      ${label('Gamedatabase')}
      <div class="rounded-2xl bg-surface p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="font-semibold">${info ? `${info.count.toLocaleString('nl-NL')} Nintendo-games` : 'Nog niet geladen'}</div>
            <div id="dataStatus" class="text-[12px] text-muted">${info ? `Bijgewerkt ${formatDateTime(info.generated)}` : ''}</div>
          </div>
          <button id="refreshBtn" class="flex-none rounded-xl bg-accent px-4 py-2.5 font-bold text-white disabled:opacity-50" ${refreshing ? 'disabled' : ''}>${refreshing ? 'Bezig…' : 'Nu bijwerken'}</button>
        </div>
        <p class="mt-2 text-[12px] text-muted">Bron: IGDB. Wordt elke maandag automatisch bijgewerkt.</p>
      </div>
    </div>
    <div>
      ${label('Sync & herstel')}
      ${syncCode() ? `<div class="rounded-2xl bg-surface p-4">
        <div class="flex items-center gap-3">
          <span id="syncDot" class="size-2.5 flex-none rounded-full bg-[#4fd18b]"></span>
          <div class="min-w-0 flex-1"><div class="font-semibold">Sync staat aan</div><div id="syncStatus" class="text-[12px] text-muted"></div></div>
          <button data-sync-now class="flex-none rounded-xl bg-surface-2 px-3.5 py-2 text-[14px] font-semibold">Nu syncen</button>
        </div>
        <p class="mt-2.5 text-[12px] text-muted">Je lijst staat ook online en is op elk toestel terug te zetten met je herstelcode.</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button data-sync-code class="rounded-xl bg-accent p-3 font-bold text-white">Toon herstelcode</button>
          <button data-sync-off class="rounded-xl bg-surface-2 p-3 font-semibold">Sync uitzetten</button>
        </div>
      </div>` : `<div class="rounded-2xl bg-surface p-4">
        <div class="font-semibold">Je games staan alleen op dit toestel</div>
        <p class="mt-1 text-[12.5px] text-muted">Safari kan die gegevens na een tijd wissen. Zet sync aan: je lijst wordt dan ook online bewaard
          en met een herstelcode zet je hem terug, ook op een ander toestel.</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button data-sync-on class="rounded-xl bg-accent p-3 font-bold text-white">Sync aanzetten</button>
          <button data-sync-restore class="rounded-xl bg-surface-2 p-3 font-semibold">Ik heb een code</button>
        </div>
      </div>`}
    </div>
    <div>
      ${label('Back-up als bestand')}
      <div class="grid grid-cols-2 gap-2">
        <button id="exportBtn" class="rounded-xl bg-surface-2 p-3.5 font-bold">Exporteren</button>
        <button id="importBtn" class="rounded-xl bg-surface-2 p-3.5 font-bold">Importeren</button>
      </div>
    </div>
    <div class="text-center text-[12px] leading-relaxed text-muted">
      Gegevens: IGDB · omschrijvingen: Wikipedia (CC BY-SA)<br>
      <span id="storageInfo" class="block empty:hidden"></span>
      Versie ${APP_VERSION}
    </div>
  `;
  storageInfoText().then(t => { const el = $('#storageInfo'); if (el) el.textContent = t; });
  updateSyncStatus();
  $('#exportBtn').onclick = exportBackup;
  $('#refreshBtn').onclick = startRefresh;
  if (refreshing && refreshText) $('#dataStatus').textContent = refreshText;
  $('#importBtn').onclick = () => $('#importInput').click();
}

// ---------- Sync & herstel ----------
function updateSyncStatus() {
  const el = $('#syncStatus');
  if (!el) return;
  const { state, error } = syncStatus();
  const last = lastSync();
  const when = last ? formatDateTime(new Date(last).toISOString()) : 'nog niet';
  el.textContent = state === 'syncing' ? 'Bezig met syncen…'
    : state === 'error' ? `Niet gelukt: ${error}` : !navigator.onLine ? `Offline · laatst ${when}` : `Laatst gesynct ${when}`;
  $('#syncDot').style.background = state === 'error' ? '#ff5c5c' : state === 'syncing' || !navigator.onLine ? '#f5b942' : '#4fd18b';
}

// Onderin uitschuivend paneel; geeft het element terug, `close()` sluit het
function sheet(html) {
  const el = document.createElement('div');
  el.className = 'fixed inset-0 z-[55] flex items-end justify-center bg-black/60 opacity-0 transition-opacity duration-200';
  el.innerHTML = `<div class="pb-safe w-full max-w-[480px] translate-y-full rounded-t-3xl bg-surface px-5 pt-5 transition-transform duration-300">${html}</div>`;
  const panel = el.firstElementChild;
  el.close = () => { el.classList.add('opacity-0'); panel.classList.add('translate-y-full'); setTimeout(() => el.remove(), 300); };
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-sheet-close]')) el.close(); });
  document.body.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.remove('opacity-0'); panel.classList.remove('translate-y-full'); }));
  return el;
}

function showSyncCode(fresh = false) {
  const code = syncCode();
  if (!code) return;
  const el = sheet(`
    <b class="block text-[20px]">${fresh ? 'Sync staat aan' : 'Je herstelcode'}</b>
    <p class="mt-1 text-[13.5px] text-muted">Bewaar deze code goed, bijvoorbeeld in je wachtwoorden-app of notities.
      Wist Safari je gegevens of pak je een ander toestel, dan zet je hiermee je lijst terug.</p>
    <div class="my-4 select-all rounded-2xl bg-bg p-4 text-center font-mono text-[24px] font-bold tracking-[.08em] text-ink">${esc(code)}</div>
    <div class="grid grid-cols-2 gap-2">
      <button data-code-copy class="rounded-xl bg-surface-2 p-3 font-semibold">Kopiëren</button>
      <button data-code-share class="rounded-xl bg-surface-2 p-3 font-semibold">Delen / bewaren</button>
    </div>
    <button data-sheet-close class="mt-2 w-full rounded-xl bg-accent p-3.5 font-bold text-white">${fresh ? 'Ik heb hem bewaard' : 'Klaar'}</button>`);
  el.querySelector('[data-code-copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(code); toast('Herstelcode gekopieerd'); } catch { toast('Kopiëren lukt niet, selecteer de code'); }
  };
  el.querySelector('[data-code-share]').onclick = async () => {
    const text = `Herstelcode Game List: ${code}\n${location.origin}`;
    try { if (navigator.share) await navigator.share({ title: 'Herstelcode Game List', text }); else { await navigator.clipboard.writeText(text); toast('Herstelcode gekopieerd'); } } catch {}
  };
}

function showRestore() {
  const el = sheet(`
    <b class="block text-[20px]">Lijst terugzetten</b>
    <p class="mt-1 text-[13.5px] text-muted">Vul je herstelcode in. Wat er nu op dit toestel staat, wordt samengevoegd met je online lijst.</p>
    <input id="restoreInput" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" inputmode="text" maxlength="19"
      placeholder="XXXX-XXXX-XXXX-XXXX" class="mt-4 w-full rounded-2xl bg-bg p-4 text-center font-mono text-[22px] font-bold tracking-[.08em] text-ink outline-none placeholder:text-muted/50">
    <div id="restoreError" class="mt-2 min-h-[18px] text-center text-[13px] text-[#ff5c5c]"></div>
    <button id="restoreGo" class="mt-1 w-full rounded-xl bg-accent p-3.5 font-bold text-white disabled:opacity-50">Terugzetten</button>
    <button data-sheet-close class="mt-2 w-full rounded-xl p-3 font-semibold text-muted">Annuleren</button>`);
  const input = el.querySelector('#restoreInput');
  const go = el.querySelector('#restoreGo');
  const err = el.querySelector('#restoreError');
  input.addEventListener('input', () => { input.value = formatCode(input.value); err.textContent = ''; });
  setTimeout(() => input.focus(), 350);
  const submit = async () => {
    if (!navigator.onLine) { err.textContent = 'Je bent offline'; return; }
    go.disabled = true; go.textContent = 'Bezig…';
    try {
      const n = await restoreSync(input.value);
      el.close();
      toast(`Sync staat aan · ${n} games`);
      render();
    } catch (e) {
      err.textContent = e.message || 'Terugzetten mislukt';
      go.disabled = false; go.textContent = 'Terugzetten';
    }
  };
  go.onclick = submit;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-sync-restore]')) { showRestore(); return; }
  if (e.target.closest('[data-sync-code]')) { showSyncCode(); return; }
  if (e.target.closest('[data-sync-now]')) { await syncNow(); updateSyncStatus(); return; }
  const on = e.target.closest('[data-sync-on]');
  if (on) {
    if (!navigator.onLine) { toast('Je bent offline'); return; }
    on.disabled = true; on.textContent = 'Bezig…';
    try { await enableSync(); render(); showSyncCode(true); }
    catch (err) { toast(err.message || 'Sync aanzetten mislukt'); on.disabled = false; on.textContent = 'Sync aanzetten'; }
    return;
  }
  if (e.target.closest('[data-sync-off]')) {
    const ok = await pick('Sync uitzetten op dit toestel?', [{ value: 'yes', label: 'Uitzetten (online lijst blijft bestaan)' }]);
    if (ok !== 'yes') return;
    disableSync(); render(); toast('Sync staat uit op dit toestel');
  }
});

// ---------- Keuze-sheet ----------
function pick(title, options) {
  return new Promise((resolve) => {
    const el = $('#picker');
    $('#pickerTitle').textContent = title;
    $('#pickerOptions').innerHTML = options.map(o =>
      `<button data-val="${esc(o.value)}" class="flex w-full items-center gap-3 border-t border-line bg-surface px-[18px] py-[15px] text-base font-semibold active:bg-surface-2 [&_svg]:text-accent">${o.icon || ''}${esc(o.label)}</button>`
    ).join('');
    el.hidden = false;
    const done = (v) => { el.hidden = true; el.onclick = null; resolve(v); };
    el.onclick = (e) => {
      const b = e.target.closest('[data-val]');
      if (b) return done(b.dataset.val);
      if (e.target === el || e.target.closest('[data-cancel]')) done(null);
    };
  });
}

// ---------- Info-pagina ----------
let currentRef = null;
const detailsCache = new Map(); // voor games die je (nog) niet hebt

function viewOf(ref) {
  const owned = games.find(g => g.id === ref) || ownedBy(ref);
  if (owned) return { owned: true, g: owned };
  const g = candidates.get(ref) || getEntry(ref);
  return g ? { owned: false, g } : null;
}

function openDetail(ref) {
  currentRef = ref;
  destroyNotes(); // elke keer vers, met de opgeslagen notities
  renderDetail();
  showScreen($('#detailScreen'));
  $('#detailBody').scrollTop = 0;
  loadDetails();
}

async function loadDetails() {
  const v = viewOf(currentRef);
  if (!v || !online()) return;
  const { g, owned } = v;
  const have = owned ? g.info : detailsCache.get(g.key);
  if (have) return;
  if (!g.igdbId && !g.qid && !g.wikiTitle && !g.summary) return;
  const ref = currentRef;
  try {
    const info = await fetchDetails(g);
    info.fetchedAt = Date.now();
    if (owned) {
      const patch = { info };
      if (info.youtube && !g.youtube) patch.youtube = info.youtube;
      updateGame(g.id, patch);
    } else detailsCache.set(g.key, info);
  } catch {
    if (!owned) detailsCache.set(g.key, { failed: true });
  }
  if (currentRef === ref && !$('#detailScreen').hidden) renderDetail();
}

// Critici-score (0–100, kleur zoals Metacritic) en speeltijd volgens spelers
const fmtHours = (h) => (h >= 10 ? Math.round(h) : String(Math.round(h * 2) / 2).replace('.', ',')) + ' u';
function scoresHTML(critic, playtime, title) {
  let html = '';
  // Speelduur zoals HowLongToBeat: Main Story / Main + Extras / Completionist, met balkjes
  const rows = [['hastily', 'Main Story', 'alleen het hoofdverhaal'], ['normally', 'Main + Extras', 'verhaal plus zijmissies'], ['completely', 'Completionist', 'alles 100% uitspelen']]
    .filter(([k]) => playtime?.[k]);
  const hltb = `https://howlongtobeat.com/?q=${encodeURIComponent(title)}`;
  const link = `<a href="${hltb}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">HowLongToBeat
    ${svg('<path d="M7 17 17 7M8 7h9v9"/>', 'size-3.5! stroke-[2.5]!')}</a>`;
  if (rows.length) {
    const max = Math.max(...rows.map(([k]) => playtime[k]));
    html += `<div class="mt-6">
      <div class="mb-2 flex items-baseline justify-between">${label('Hoe lang duurt het?').replace('mb-2', 'mb-0')}${link}</div>
      <div class="flex flex-col gap-3.5 rounded-2xl bg-surface p-3.5">
        ${rows.map(([k, t, sub]) => `<div>
          <div class="mb-1.5 flex items-baseline justify-between gap-2">
            <span><b class="text-[15px]">${t}</b> <span class="text-[12px] text-muted">${sub}</span></span>
            <b class="flex-none text-[17px]">${fmtHours(playtime[k])}</b>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-surface-2"><div class="h-full rounded-full bg-accent" style="width:${Math.max(6, Math.round(playtime[k] / max * 100))}%"></div></div>
        </div>`).join('')}
      </div>
      <p class="mt-1.5 text-[11px] text-muted">Gemiddelde speeltijd volgens spelers (IGDB). Precieze cijfers per speelstijl op HowLongToBeat.</p>
    </div>`;
  } else {
    html += `<div class="mt-6 flex items-center justify-between rounded-2xl bg-surface p-3.5">
      <span class="text-[13px] text-muted">Speelduur nog onbekend</span>${link}</div>`;
  }
  if (critic) {
    const c = critic.score >= 75 ? '#4fd18b' : critic.score >= 50 ? '#f5b84a' : '#ff5c5c';
    html += `<div class="mt-2.5 flex items-center gap-3 rounded-2xl bg-surface p-3">
      <div class="grid size-12 flex-none place-items-center rounded-xl text-[22px] font-extrabold" style="background:${c};color:#0f1115">${critic.score}</div>
      <div><b class="block">Critici-score</b><span class="text-[12px] text-muted">${critic.count > 1 ? `gemiddelde van ${critic.count} recensies` : critic.count === 1 ? 'op basis van 1 recensie' : 'uit recensies'} · IGDB</span></div>
    </div>`;
  }
  return html;
}

function renderDetail() {
  const v = viewOf(currentRef);
  if (!v) return;
  const { g, owned } = v;
  const info = (owned ? g.info : detailsCache.get(g.key)) || null;
  const src = coverSrc(g);
  $('#detailBg').style.backgroundImage = src ? `url("${imgUrl(src).replace(/"/g, '%22')}")` : 'none';
  $('#deleteBtn').hidden = !owned;

  const cd = countdown(g.release);
  const trailer = g.trailer || g.youtube || info?.youtube;
  const platforms = [...new Set([...(g.platforms || []).map(shortPlatform)])];
  const genres = info?.genres?.length ? info.genres : g.genres || [];

  // Nog niet uit: spelen, uitspelen of ermee stoppen kan nog niet
  const notOut = isFuture(g.release);
  const statusBtns = LISTS.map(l => {
    const off = notOut && NEEDS_RELEASE.includes(l.id) && g.status !== l.id;
    return `<button data-status="${l.id}" ${off ? 'disabled' : ''} class="flex flex-col items-center gap-1 rounded-xl px-0.5 py-2.5 text-[10.5px] font-semibold disabled:opacity-35 ${owned && g.status === l.id ? 'bg-accent text-white' : 'bg-surface text-muted'}">${ICONS[l.id]}${l.short}</button>`;
  }).join('');

  const ratingBtns = Array.from({ length: 11 }, (_, i) => {
    const on = g.rating != null && i <= g.rating;
    return `<button data-rate="${i}" class="h-[38px] rounded-[9px] text-sm font-bold ${on ? 'bg-gold text-[#1a1400]' : 'bg-surface'} ${g.rating === i ? 'ring-2 ring-white ring-inset' : ''}">${i}</button>`;
  }).join('');

  const facts = [
    ['Release', formatRelease(g.release) || (g.year ? String(g.year) : 'Nog niet bekend')],
    ['Platforms', platforms.join(', ')],
    ['Ontwikkelaar', info?.developers?.join(', ')],
    ['Uitgever', info?.publishers?.join(', ')],
    ['Genre', genres.join(', ')],
  ].filter(([, v]) => v);

  const summary = info?.summary || (g.summary && !info ? g.summary : '');
  const summaryNote = info?.summaryLang === 'nl-vertaald' ? 'Automatisch vertaald uit het Engels' : info?.summaryLang === 'en' ? 'Alleen in het Engels beschikbaar' : '';
  const loadingInfo = !info && online() && (g.igdbId || g.qid || g.wikiTitle);
  const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(g.title + ' trailer')}`;
  const extra = extrasFor(g.igdbId);
  const critic = info?.critic || extra?.critic;
  const playtime = info?.playtime || extra?.playtime;

  detachNotes(); // editor bewaren, niet opnieuw maken (anders verlies je de cursor tijdens het typen)
  $('#detailBody').innerHTML = `
    <div class="flex items-end gap-4">
      ${coverHTML(g, { cls: 'w-[120px] flex-none' })}
      <div class="min-w-0">
        <h2 class="mb-1 select-text text-[21px] font-bold leading-tight tracking-tight">${esc(g.title)}</h2>
        <div class="text-[13px] text-muted">${esc([formatRelease(g.release) || g.year, platforms.slice(0, 3).join(', ')].filter(Boolean).join(' · '))}</div>
        ${g.franchise ? `<button data-franchise="${esc(g.franchise)}" class="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold [&_svg]:size-3.5 [&_svg]:text-accent">${ICONS.folder}${esc(g.franchise)}</button>` : ''}
        ${owned ? `<div class="mt-2 flex items-center gap-1 text-xl font-extrabold [&_svg]:size-5">${ICONS.star}${g.rating != null ? `${g.rating}<small class="text-[13px] font-semibold text-muted">/10</small>` : '<small class="text-[13px] font-semibold text-muted">Nog geen cijfer</small>'}</div>` : ''}
      </div>
    </div>

    ${cd ? `<div class="mt-5 flex items-center justify-between rounded-2xl bg-accent/15 p-3.5 ring-1 ring-accent/40">
      <div><div class="text-[12px] font-semibold uppercase tracking-wider text-accent">Release</div><div class="text-[13px] text-muted">${esc(cd.small)}</div></div>
      <div class="text-right"><div class="text-[28px] font-extrabold leading-none text-accent">${esc(cd.big)}</div>${cd.unit ? `<div class="text-[12px] text-muted">${cd.unit} te gaan</div>` : ''}</div>
    </div>` : ''}

    <div class="mt-5 flex gap-2">
      ${trailer ? `<button data-trailer="${esc(trailer)}" class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink p-3 font-bold text-bg [&_svg]:size-4">${ICONS.play}Trailer</button>`
        : `<a href="${ytSearch}" target="_blank" rel="noopener" class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-surface-2 p-3 font-semibold [&_svg]:size-4">${ICONS.play}Zoek trailer op YouTube</a>`}
    </div>

    ${cd ? '' : scoresHTML(critic, playtime, g.title)}

    <div class="mt-6">
      ${label(owned ? 'Lijst' : 'Zet op een lijst')}
      <div class="grid grid-cols-3 gap-1.5">${statusBtns}</div>
      ${notOut ? '<p class="mt-1.5 text-[12px] text-muted">Nog niet uit: spelen, uitspelen of stoppen kan pas na de release.</p>' : ''}
    </div>

    ${owned ? `<div class="mt-6">${label('Notities & voortgang')}<div id="notesMount"></div></div>` : ''}

    ${owned ? `
    <div class="mt-6">
      ${label('Mijn cijfer')}
      <div class="grid grid-cols-11 gap-1">${ratingBtns}</div>
    </div>

    <div class="mt-6">
      ${label('Mijn platform')}
      <div class="flex flex-wrap gap-1.5">
        ${platforms.map(p => `<button data-platform="${esc(p)}" class="rounded-full px-3 py-1.5 text-[13px] font-semibold ${g.myPlatform === p ? 'bg-ink text-bg' : 'bg-surface text-muted'}">${esc(p)}</button>`).join('')}
        <button data-add-platform class="rounded-full border border-dashed border-line px-3 py-1.5 text-[13px] font-semibold text-muted">+ Platform</button>
      </div>
    </div>

    ${g.status === 'playing' || g.status === 'finished' || g.startedAt || g.finishedAt ? `
    <div class="mt-6">
      ${label('Datums')}
      <div class="flex gap-2.5">
        <label class="flex-1 text-xs text-muted">Begonnen<input type="date" data-date="startedAt" value="${g.startedAt || ''}" class="mt-1 block min-h-10 w-full rounded-[10px] bg-surface px-2.5 py-2 text-ink"></label>
        <label class="flex-1 text-xs text-muted">Uitgespeeld<input type="date" data-date="finishedAt" value="${g.finishedAt || ''}" class="mt-1 block min-h-10 w-full rounded-[10px] bg-surface px-2.5 py-2 text-ink"></label>
      </div>
    </div>` : ''}
` : ''}

    <div class="mt-6">
      ${label('Over deze game')}
      ${summary ? `<div class="select-text text-sm leading-relaxed text-[#c4c8d0]">${esc(summary)}</div>${summaryNote ? `<div class="mt-1.5 text-[11px] text-muted">${summaryNote}</div>` : ''}`
        : `<div class="text-sm text-muted">${loadingInfo ? 'Info ophalen…' : online() ? 'Geen omschrijving gevonden.' : 'Meer info verschijnt als je online bent.'}</div>`}
      <dl class="mt-4 overflow-hidden rounded-xl bg-surface text-[13px]">
        ${facts.map(([k, v]) => `<div class="flex gap-3 border-b border-line px-3 py-2.5 last:border-0"><dt class="w-24 flex-none text-muted">${k}</dt><dd class="select-text">${esc(v)}</dd></div>`).join('')}
      </dl>
    </div>

    ${owned ? `
    <div class="mt-6">
      ${label('Aanpassen')}
      <input id="trailerUrl" type="url" inputmode="url" placeholder="Eigen YouTube-trailer (link)" value="${esc(g.trailer ? 'https://youtu.be/' + g.trailer : '')}" class="mb-2 w-full rounded-xl bg-surface p-3 text-[13px] text-muted outline-none focus:text-ink">
      <input id="coverUrl" type="url" inputmode="url" placeholder="Andere cover (link naar plaatje)" value="${esc(g.cover || '')}" class="w-full rounded-xl bg-surface p-3 text-[13px] text-muted outline-none focus:text-ink">
    </div>` : ''}

    ${g.wikiTitle || g.nlTitle ? `<a href="https://${g.nlTitle ? 'nl' : 'en'}.wikipedia.org/wiki/${encodeURIComponent((g.nlTitle || g.wikiTitle).replace(/ /g, '_'))}" target="_blank" rel="noopener" class="mt-5 block text-center text-[12px] text-muted underline">Lees meer op Wikipedia</a>` : ''}
  `;
  if (owned) {
    const id = g.id;
    mountNotes($('#notesMount'), id, g.notes, (html) => {
      const rec = games.find(x => x.id === id);
      if (rec) { rec.notes = html; rec.updatedAt = Date.now(); saveGames(); }
    });
  } else destroyNotes();
  hydrate($('#detailBody')).then(() => {
    const img = $('#detailBody img[src]');
    if (img && !src) $('#detailBg').style.backgroundImage = `url("${img.src}")`;
  });
}

function addFromView(g, status) {
  const sorted = (g.platforms || []).map(p => (typeof p === 'string' ? { name: p } : p));
  const platforms = [...new Set(sorted.map(shortPlatform))];
  const myPlatform = platforms.find(p => NINTENDO_RE.test(p)) || platforms[0] || null;
  const rec = {
    id: uid(),
    sourceKey: g.key, source: g.source, qid: g.qid || null,
    igdbId: g.source === 'igdb' ? g.sourceId : null,
    title: g.title,
    cover: coverSrc(g), coverFile: g.coverFile || null,
    release: g.release || (g.year ? String(g.year) : null), year: g.year || null,
    platforms, myPlatform,
    franchise: g.franchise || null,
    wikiTitle: g.wikiTitle || null, nlTitle: g.nlTitle || null,
    youtube: g.youtube || null, trailer: null,
    genres: g.genres || [], summary: g.summary || '',
    info: detailsCache.get(g.key) && !detailsCache.get(g.key).failed ? detailsCache.get(g.key) : null,
    status, rating: null, notes: '',
    addedAt: Date.now(),
    startedAt: status === 'playing' ? today() : null,
    finishedAt: status === 'finished' ? today() : null,
  };
  games.push(rec);
  saveGames();
  cacheCover(rec.cover);
  requestPersist();
  if (!rec.cover && rec.coverFile) enrichOwned();
  return rec;
}

function updateGame(id, patch) {
  const g = games.find(x => x.id === id);
  if (!g) return;
  Object.assign(g, patch, { updatedAt: Date.now() });
  saveGames();
  render();
}

$('#detailBody').addEventListener('click', async (e) => {
  const v = viewOf(currentRef);
  if (!v) return;
  const { g, owned } = v;

  const s = e.target.closest('[data-status]');
  if (s) {
    const status = s.dataset.status;
    if (isFuture(g.release) && NEEDS_RELEASE.includes(status)) { toast('Deze game is nog niet uit'); return; }
    if (!owned) {
      const rec = addFromView(g, status);
      currentRef = rec.id;
      render();
      toast(`Toegevoegd aan ${listById[status].label}`);
    } else {
      const patch = { status };
      if (status === 'playing' && !g.startedAt) patch.startedAt = today();
      if (status === 'finished' && !g.finishedAt) patch.finishedAt = today();
      updateGame(g.id, patch);
      toast(`Verplaatst naar ${listById[status].label}`);
    }
    renderDetail();
    return;
  }
  const r = e.target.closest('[data-rate]');
  if (r && owned) {
    const val = Number(r.dataset.rate);
    updateGame(g.id, { rating: g.rating === val ? null : val });
    renderDetail();
    return;
  }
  const p = e.target.closest('[data-platform]');
  if (p && owned) { updateGame(g.id, { myPlatform: p.dataset.platform }); renderDetail(); return; }
  if (e.target.closest('[data-add-platform]') && owned) {
    const choice = await pick('Platform toevoegen', ALL_PLATFORMS.filter(x => !g.platforms.includes(x)).map(x => ({ value: x, label: x })));
    if (choice) { updateGame(g.id, { platforms: [...g.platforms, choice], myPlatform: choice }); renderDetail(); }
    return;
  }
  const t = e.target.closest('[data-trailer]');
  if (t) { openTrailer(t.dataset.trailer); return; }
  const f = e.target.closest('[data-franchise]');
  if (f) openFranchise(f.dataset.franchise);
});

$('#detailBody').addEventListener('change', (e) => {
  const v = viewOf(currentRef);
  if (!v?.owned) return;
  const id = v.g.id;
  const d = e.target.closest('[data-date]');
  if (d) updateGame(id, { [d.dataset.date]: d.value || null });
  if (e.target.id === 'coverUrl') {
    const url = e.target.value.trim();
    if (url && !/^https?:\/\//i.test(url)) { toast('Dat is geen geldige link'); return; }
    updateGame(id, { cover: url || null, coverFile: url ? v.g.coverFile : null });
    cacheCover(url);
    renderDetail();
    toast('Cover bijgewerkt');
  }
  if (e.target.id === 'trailerUrl') {
    const raw = e.target.value.trim();
    const yt = youtubeId(raw);
    if (raw && !yt) { toast('Geen geldige YouTube-link'); return; }
    updateGame(id, { trailer: yt });
    renderDetail();
    toast(yt ? 'Trailer opgeslagen' : 'Trailer verwijderd');
  }
});


$('#deleteBtn').addEventListener('click', async () => {
  const v = viewOf(currentRef);
  if (!v?.owned) return;
  const ok = await pick(`“${v.g.title}” verwijderen uit je lijsten?`, [{ value: 'yes', label: 'Verwijderen' }]);
  if (ok !== 'yes') return;
  const key = v.g.sourceKey;
  games = games.filter(x => x.id !== v.g.id);
  saveGames();
  render();
  toast('Verwijderd');
  if (key && (getEntry(key) || candidates.get(key))) { currentRef = key; renderDetail(); }
  else hideScreen($('#detailScreen'));
});

// ---------- Trailer-popup ----------
function openTrailer(id) {
  $('#trailerFrame').innerHTML = `<iframe class="size-full" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1&modestbranding=1"
    title="Trailer" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  $('#trailer').hidden = false;
}
function closeTrailer() {
  $('#trailer').hidden = true;
  $('#trailerFrame').innerHTML = ''; // stopt het afspelen
}
$('#trailer').addEventListener('click', (e) => {
  if (e.target.closest('[data-close-trailer]') || e.target.id === 'trailer') closeTrailer();
});

// ---------- Handmatig ----------
function openManual() {
  const f = $('#manualForm');
  f.reset();
  f.platform.innerHTML = ALL_PLATFORMS.map(p => `<option>${p}</option>`).join('');
  f.status.innerHTML = LISTS.map(l => `<option value="${l.id}">${l.label}</option>`).join('');
  f.status.value = listById[prefs.tab] ? prefs.tab : 'wishlist';
  const q = $('#searchInput').value.trim();
  if (q) f.title.value = q;
  showScreen($('#manualScreen'));
}

function saveManual() {
  const f = $('#manualForm');
  const title = f.title.value.trim();
  if (!title) { f.title.focus(); return; }
  const status = f.status.value;
  const release = f.release.value || null;
  if (isFuture(release) && NEEDS_RELEASE.includes(status)) { toast('Deze game is nog niet uit: kies Wishlist of Interessant'); return; }
  const rec = addFromView({
    key: 'manual:' + uid(), source: 'manual', title,
    cover: f.cover.value.trim() || null, release, year: release ? Number(release.slice(0, 4)) : null,
    platforms: [f.platform.value],
  }, status);
  hideScreen($('#manualScreen'), { animate: false });
  render();
  toast(`Toegevoegd aan ${listById[status].label}`);
  openDetail(rec.id);
}

// ---------- Gamedatabase handmatig bijwerken ----------
// Start de GitHub Action via /api/refresh en wacht tot de nieuwe data in Netlify Blobs staat.
let refreshing = false;
let refreshText = '';
const formatDateTime = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const setRefreshStatus = (text) => {
  refreshText = text;
  const el = $('#dataStatus');
  if (el) el.textContent = text;
};

async function startRefresh() {
  if (refreshing) return;
  if (!online()) { toast('Je bent offline'); return; }
  refreshing = true;
  renderIfMore();
  try {
    const res = await fetch('/api/refresh', { method: 'POST' });
    const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || 'Bijwerken is hier niet beschikbaar');
    const since = data.started ? Date.parse(data.startedAt) - 30000 : Date.parse(data.run?.createdAt || 0) - 1000;
    setRefreshStatus('Bezig met ophalen uit IGDB… (± 2 minuten)');
    const deadline = Date.now() + 15 * 60 * 1000;
    for (;;) {
      await new Promise(r => setTimeout(r, 10000));
      if (Date.now() > deadline) throw new Error('Duurt te lang, probeer het later opnieuw');
      const st = await (await fetch('/api/refresh')).json().catch(() => ({}));
      const run = st.run;
      if (!run || Date.parse(run.createdAt) < since || run.status !== 'completed') continue;
      if (run.conclusion !== 'success') throw new Error('Bijwerken mislukt');
      const changed = await checkForUpdate().catch(() => false);
      toast(changed ? 'Gamedatabase bijgewerkt' : 'Gamedatabase was al up-to-date');
      break;
    }
  } catch (e) {
    toast(e.message || 'Bijwerken mislukt');
  } finally {
    refreshing = false;
    refreshText = '';
    renderIfMore();
  }
}
const renderIfMore = () => { if (prefs.tab === 'more') render(); };

// ---------- Back-up ----------
async function exportBackup() {
  const data = JSON.stringify({ app: 'game-list', version: 2, exportedAt: new Date().toISOString(), games }, null, 2);
  const name = `game-list-${today()}.json`;
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Game List back-up' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.games;
    if (!Array.isArray(incoming)) throw new Error();
    const mode = await pick(`${incoming.length} games gevonden`, [
      { value: 'merge', label: 'Samenvoegen met huidige lijst' },
      { value: 'replace', label: 'Huidige lijst vervangen' },
    ]);
    if (!mode) return;
    if (mode === 'replace') games = incoming;
    else {
      const byId = new Map(games.map(g => [g.id, g]));
      for (const g of incoming) {
        const cur = byId.get(g.id);
        if (!cur || (g.updatedAt ?? g.addedAt ?? 0) > (cur.updatedAt ?? cur.addedAt ?? 0)) byId.set(g.id, g);
      }
      games = [...byId.values()];
    }
    saveGames();
    games.forEach(g => cacheCover(g.cover));
    render();
    toast('Back-up geïmporteerd');
    enrichOwned();
  } catch {
    toast('Ongeldig back-upbestand');
  }
});

// ---------- Eigen games aanvullen (covers, datums, info) ----------
let enriching = false;
async function enrichOwned() {
  if (enriching || !online()) return;
  enriching = true;
  try {
    await loadDataset().catch(() => {});
    let changed = false;
    // Gegevens uit de gamedatabase overnemen. Games uit een oudere versie (Wikidata) krijgen
    // via hun titel een IGDB-id, zodat ze weer aan de database gekoppeld zijn.
    for (const g of games) {
      let e = (g.sourceKey && getEntry(g.sourceKey)) || (g.igdbId && getEntry('igdb:' + g.igdbId));
      if (!e && !g.igdbId) {
        e = findEntry(g.title, g.year, g.platforms);
        if (e) { g.igdbId = e.igdbId; g.sourceKey = e.key; g.source = 'igdb'; g.info = null; changed = true; }
      }
      if (!e) continue;
      for (const k of ['release', 'franchise', 'youtube']) {
        if (!g[k] && e[k]) { g[k] = e[k]; changed = true; }
      }
      if (!g.genres?.length && e.genres?.length) { g.genres = e.genres; changed = true; }
      if (!g.cover && e.cover) { g.cover = e.cover; cacheCover(g.cover); changed = true; }
      const merged = [...new Set([...(g.platforms || []), ...e.platforms])];
      if (merged.length !== (g.platforms || []).length) { g.platforms = merged; changed = true; }
    }
    // Ontbrekende covers
    const needCover = games.filter(g => !g.cover && g.coverFile);
    if (needCover.length) {
      const urls = await resolveCovers(needCover.map(g => g.coverFile));
      needCover.forEach((g, i) => { if (urls[i]) { g.cover = urls[i]; cacheCover(g.cover); changed = true; } });
    }
    if (changed) { saveGames({ silent: true }); render(); }
    // Info (omschrijving, makers, genres): rustig één voor één
    for (const g of games.filter(x => !x.info && (x.igdbId || x.qid || x.wikiTitle))) {
      try {
        const info = await fetchDetails(g);
        info.fetchedAt = Date.now();
        g.info = info;
        if (info.youtube && !g.youtube) g.youtube = info.youtube;
        saveGames({ silent: true });
      } catch { break; }
    }
  } finally {
    enriching = false;
  }
}

// ---------- Events ----------
document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    ['#detailScreen', '#folderScreen', '#manualScreen', '#swipeScreen'].forEach(s => hideScreen($(s), { animate: false }));
    goTab(tab.dataset.tab, tab.dataset.sub || null);
    return;
  }
  const close = e.target.closest('[data-close]');
  if (close) { hideScreen(close.closest('section'), { after: render }); return; }
  const heroBtn = e.target.closest('[data-hero]');
  if (heroBtn) {
    if (prefs.heroId === heroBtn.dataset.hero || heroGame(games.filter(g => g.status === 'playing'))?.id === heroBtn.dataset.hero) openDetail(heroBtn.dataset.hero);
    else { prefs.heroId = heroBtn.dataset.hero; savePrefs(); renderHome(); homeEl.scrollTo({ top: 0, behavior: 'smooth' }); }
    return;
  }
  const open = e.target.closest('[data-open]');
  if (open) { openDetail(open.dataset.open); return; }
  const fr = e.target.closest('[data-franchise]');
  if (fr && !fr.closest('#detailBody')) { openFranchise(fr.dataset.franchise); return; }
  if (e.target.closest('[data-upcoming]')) { openUpcoming(); return; }
  const sw = e.target.closest('[data-swipe]');
  if (sw) { openSwipe(sw.dataset.swipe || null); return; }
  const pickSet = e.target.closest('[data-swipe-pick]');
  if (pickSet) { startSwipe(pickSet.dataset.swipePick); return; }
  if (e.target.closest('[data-swipe-pickers]')) { renderSwipePicker(); return; }
  if (e.target.closest('[data-swipe-yes]')) { swipeDecide(true); return; }
  if (e.target.closest('[data-swipe-no]')) { swipeDecide(false); return; }
  if (e.target.closest('[data-swipe-undo]')) { swipeUndo(); return; }
  if (e.target.closest('[data-manual]')) { openManual(); return; }
  if (e.target.closest('[data-online-search]')) { searchOnline($('#searchInput').value.trim()); return; }
  const subEl = e.target.closest('[data-sub]');
  if (subEl) goTab('library', subEl.dataset.sub);
});
enableSwipeBack($('#detailScreen'), render);
enableSwipeBack($('#folderScreen'));

$('#backBtn').addEventListener('click', () => { sub = null; render(); });
$('#sortSelect').addEventListener('change', (e) => { prefs.sort = e.target.value; savePrefs(); render(); });
$('#addBtn').addEventListener('click', () => { goTab('discover'); setTimeout(() => $('#searchInput').focus(), 50); });
$('#manualSave').addEventListener('click', saveManual);
$('#manualForm').addEventListener('submit', (e) => { e.preventDefault(); saveManual(); });
$('#searchInput').addEventListener('input', () => {
  clearTimeout(searchTimer);
  onlineResults = null;
  searchTimer = setTimeout(renderDiscover, 120);
});
$('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
$('#clearSearch').addEventListener('click', () => { $('#searchInput').value = ''; onlineResults = null; renderDiscover(); });
window.addEventListener('online', () => { enrichOwned(); render(); });
window.addEventListener('offline', render);

// Pinch-zoom blokkeren (iOS negeert user-scalable=no soms).
// Dubbeltik-zoom staat uit via `touch-action: manipulation` in de CSS.
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev =>
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

// ---------- Nieuwe versie van de app ----------
// Staat er een nieuwe versie klaar, dan schuift bovenin een melding in. Tik = vernieuwen.
// Zoekt naar updates bij het openen en elke keer dat je de app weer naar voren haalt (PWA op beginscherm).
function setupUpdates() {
  let reg = null;
  let lastCheck = 0;
  const check = () => {
    if (!reg || !online() || Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    reg.update().catch(() => {});
  };
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, r) { reg = r || null; },
    onNeedRefresh() { showUpdateBanner(() => updateSW(true)); },
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(check, 30 * 60_000);
}

function showUpdateBanner(apply) {
  if ($('#updateBanner')) return;
  const el = document.createElement('div');
  el.id = 'updateBanner';
  el.className = 'pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+8px)] transition-transform duration-300 -translate-y-[150%]';
  el.innerHTML = `<div class="pointer-events-auto flex w-full max-w-[440px] items-center gap-3 rounded-2xl border border-white/10 bg-surface-2/95 p-2.5 pl-3.5 shadow-2xl shadow-black/60 backdrop-blur">
    <span class="grid size-8 flex-none place-items-center rounded-full bg-accent/15 text-accent [&_svg]:size-[18px]">${svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>')}</span>
    <span class="min-w-0 flex-1 leading-tight"><b class="block text-[15px]">Nieuwe versie beschikbaar</b><span class="text-[12.5px] text-muted">Tik op vernieuwen om bij te werken</span></span>
    <button data-update-apply class="flex-none rounded-full bg-accent px-3.5 py-2 text-[14px] font-bold text-white active:scale-95">Vernieuwen</button>
    <button data-update-close aria-label="Later" class="grid size-8 flex-none place-items-center rounded-full text-muted active:bg-white/10 [&_svg]:size-4">${svg('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
  </div>`;
  document.body.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('-translate-y-[150%]')));
  el.querySelector('[data-update-apply]').addEventListener('click', (e) => {
    e.currentTarget.textContent = 'Bezig…';
    apply();
    setTimeout(() => location.reload(), 3000); // vangnet als de nieuwe versie niet vanzelf herlaadt
  });
  el.querySelector('[data-update-close]').addEventListener('click', () => {
    el.classList.add('-translate-y-[150%]');
    setTimeout(() => el.remove(), 300);
  });
}

// ---------- Start ----------
render();
loadDataset().then(() => { if (prefs.tab === 'home' || prefs.tab === 'discover') render(); enrichOwned(); }).catch(() => {});
loadExtras().then(() => { if (!$('#detailScreen').hidden) renderDetail(); });
// Nieuwe gamedatabase binnen (wekelijkse update of de knop in Meer): opnieuw tekenen
onDatasetUpdate(() => { render(); enrichOwned(); });
setupUpdates();
initSync({
  getLocal: () => ({ games, deleted, swipedNo: [...swipedNo] }),
  applyMerged(doc) {
    games = doc.games;
    deleted = doc.deleted;
    snapshot = new Map(games.map(g => [g.id, bare(g)]));
    store.save('gl.games', games);
    store.save('gl.deleted', deleted);
    swipedNo.clear(); doc.swipedNo.forEach(k => swipedNo.add(k));
    store.save('gl.swipedNo', doc.swipedNo);
    games.forEach(g => cacheCover(g.cover));
    if ($('#swipeScreen').hidden) render();
    enrichOwned();
  },
  onStatus() { if (prefs.tab === 'more') updateSyncStatus(); },
});
requestPersist();
migrateCoverCache();
