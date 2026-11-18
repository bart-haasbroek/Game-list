import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { searchIGDB, searchWikipedia, SourceUnavailable } from './sources.js';
import {
  loadDataset, datasetInfo, getEntry, searchDataset, franchiseList, franchiseGames, franchiseCover,
  upcoming, isFuture, formatRelease, countdown, normalize, findEntry, checkForUpdate, onDatasetUpdate,
} from './data.js';
import { resolveCovers, knownCoverUrl, fetchDetails, youtubeId } from './info.js';

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
const saveGames = () => store.save('gl.games', games);
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
function renderHome() {
  setHeader('Home', new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()));
  showView('homeView');
  const el = $('#homeView');
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

  const playing = sortGames(games.filter(g => g.status === 'playing'));
  const top = games.filter(g => g.rating != null).sort((a, b) => b.rating - a.rating).slice(0, 10);
  const lastFinished = games.filter(g => g.status === 'finished').sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || ''))).slice(0, 10);
  const nintendoUpcoming = upcoming(30).filter(e => !ownedBy(e.key)).slice(0, 15);

  el.innerHTML = `
    <div class="home-tiles grid grid-cols-2 gap-2.5 pt-1">
      ${tile(count('playing'), 'speel ik nu', 'playing', true)}
      ${tile(count('backlog'), 'nog te spelen', 'backlog')}
      ${tile(count('wishlist'), 'op mijn wishlist', 'wishlist')}
      ${tile(finishedYear, `uitgespeeld in ${year}`, 'finished')}
    </div>
    ${sectionHead('Afteller')}
    ${countdownRows ? `<div class="flex flex-col gap-2">${countdownRows}</div>`
      : `<div class="rounded-2xl bg-surface p-4 text-[13px] text-muted">Zet een aangekondigde game op je wishlist, dan tel je hier af tot de release.</div>`}
    ${playing.length ? sectionHead('Nu aan het spelen', `<button data-tab="playing" class="text-[13px] font-semibold text-accent">Alles</button>`) + rowScroller(playing.map(g => cardHTML(g)).join('')) : ''}
    ${nintendoUpcoming.length ? sectionHead('Binnenkort op Nintendo', `<button data-upcoming class="text-[13px] font-semibold text-accent">Alles</button>`)
      + rowScroller(nintendoUpcoming.map(e => cardHTML(e, { ref: e.key, sub: countdown(e.release)?.small || '' })).join('')) : ''}
    ${top.length ? sectionHead('Mijn hoogste cijfers') + rowScroller(top.map(g => cardHTML(g)).join('')) : ''}
    ${lastFinished.length ? sectionHead('Laatst uitgespeeld') + rowScroller(lastFinished.map(g => cardHTML(g, { sub: g.finishedAt ? formatRelease(g.finishedAt) : '' })).join('')) : ''}
    <div class="mt-6 text-center text-[12px] text-muted">${games.length} games in je verzameling${average(games) ? ` · gemiddeld cijfer ${average(games)}` : ''}</div>
  `;
  hydrate(el);
}

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
  }).catch(() => {
    body.innerHTML = notice('De gamelijst kon niet geladen worden.<small>Open de app een keer met internet, dan werkt hij daarna ook offline.</small>');
  });
}

const notice = (html) => `<div class="px-3 py-10 text-center text-muted [&_small]:mt-1.5 [&_small]:block [&_small]:opacity-80">${html}</div>`;

function discoverHomeHTML() {
  const up = upcoming(20);
  const fr = franchiseList();
  const tile = (f) => {
    const e = franchiseCover(f.name);
    return `<button data-franchise="${esc(f.name)}" class="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface text-left active:scale-[.97]">
      ${e ? `<div class="absolute inset-0 opacity-60 [&>div]:aspect-auto! [&>div]:size-full [&>div]:rounded-none! [&>div]:shadow-none!">${coverHTML(e, { placeholder: false })}</div>` : ''}
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
  hideScreen($('#detailScreen'), { animate: false }); // anders ligt de map achter de info-pagina
  showScreen($('#folderScreen'));
  hydrate(body);
}
const openFranchise = (name) => loadDataset().then(() => openFolder(name, franchiseGames(name)));
const openUpcoming = () => loadDataset().then(() => {
  const known = upcoming(1000);
  const list = [...known, ...upcoming(1000, { notable: false }).filter(e => !known.includes(e))];
  openFolder('Binnenkort', list, `${list.length} aangekondigde Nintendo-games`);
  $('#folderBody').querySelectorAll('[data-open]').forEach((b, i) => {
    const cd = countdown(list[i].release);
    if (cd) b.lastElementChild.textContent = cd.small;
  });
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
      ${label('Back-up')}
      <div class="grid grid-cols-2 gap-2">
        <button id="exportBtn" class="rounded-xl bg-accent p-3.5 font-bold text-white">Exporteren</button>
        <button id="importBtn" class="rounded-xl bg-surface-2 p-3.5 font-bold">Importeren</button>
      </div>
      <p class="mt-2 text-center text-[12px] text-muted">Je games staan alleen op dit toestel. Maak af en toe een back-up.</p>
    </div>
    <div class="text-center text-[12px] leading-relaxed text-muted">
      Gegevens: IGDB · omschrijvingen: Wikipedia (CC BY-SA)<br>
      <span id="storageInfo" class="block empty:hidden"></span>
      Versie ${APP_VERSION}
    </div>
  `;
  storageInfoText().then(t => { const el = $('#storageInfo'); if (el) el.textContent = t; });
  $('#exportBtn').onclick = exportBackup;
  $('#refreshBtn').onclick = startRefresh;
  if (refreshing && refreshText) $('#dataStatus').textContent = refreshText;
  $('#importBtn').onclick = () => $('#importInput').click();
}

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

  const statusBtns = LISTS.map(l => `<button data-status="${l.id}" class="flex flex-col items-center gap-1 rounded-xl px-0.5 py-2.5 text-[10.5px] font-semibold ${owned && g.status === l.id ? 'bg-accent text-white' : 'bg-surface text-muted'}">${ICONS[l.id]}${l.short}</button>`).join('');

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

    <div class="mt-6">
      ${label(owned ? 'Lijst' : 'Zet op een lijst')}
      <div class="grid grid-cols-3 gap-1.5">${statusBtns}</div>
    </div>

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

    <div class="mt-6">
      ${label('Notities')}
      <textarea id="notes" placeholder="Wat vind je ervan?" class="min-h-[90px] w-full resize-none rounded-xl bg-surface p-3 outline-none">${esc(g.notes)}</textarea>
    </div>` : ''}

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

$('#detailBody').addEventListener('input', (e) => {
  if (e.target.id !== 'notes') return;
  const v = viewOf(currentRef);
  if (v?.owned) { v.g.notes = e.target.value; v.g.updatedAt = Date.now(); saveGames(); }
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
    if (changed) { saveGames(); render(); }
    // Info (omschrijving, makers, genres): rustig één voor één
    for (const g of games.filter(x => !x.info && (x.igdbId || x.qid || x.wikiTitle))) {
      try {
        const info = await fetchDetails(g);
        info.fetchedAt = Date.now();
        g.info = info;
        if (info.youtube && !g.youtube) g.youtube = info.youtube;
        saveGames();
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
    ['#detailScreen', '#folderScreen', '#manualScreen'].forEach(s => hideScreen($(s), { animate: false }));
    goTab(tab.dataset.tab, tab.dataset.sub || null);
    return;
  }
  const close = e.target.closest('[data-close]');
  if (close) { hideScreen(close.closest('section'), { after: render }); return; }
  const open = e.target.closest('[data-open]');
  if (open) { openDetail(open.dataset.open); return; }
  const fr = e.target.closest('[data-franchise]');
  if (fr && !fr.closest('#detailBody')) { openFranchise(fr.dataset.franchise); return; }
  if (e.target.closest('[data-upcoming]')) { openUpcoming(); return; }
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

// ---------- Start ----------
render();
loadDataset().then(() => { if (prefs.tab === 'home' || prefs.tab === 'discover') render(); enrichOwned(); }).catch(() => {});
// Nieuwe gamedatabase binnen (wekelijkse update of de knop in Meer): opnieuw tekenen
onDatasetUpdate(() => { render(); enrichOwned(); });
registerSW({ immediate: true });
requestPersist();
migrateCoverCache();
