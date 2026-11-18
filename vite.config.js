import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Covers-cache begrenzen: langst niet gebruikte eruit boven 2500 plaatjes, en meteen opruimen als de opslag vol raakt
// (anders groeit hij onbeperkt en kan iOS de opslag van de app wissen)
const COVER_EXPIRY = { maxEntries: 2500, purgeOnQuotaError: true }; // geen leeftijdsgrens: covers van eigen games moeten offline blijven

export default defineConfig({
  plugins: [
    tailwindcss(),
    VitePWA({
      // 'prompt': een nieuwe versie wacht tot je op 'Vernieuwen' tikt in de melding bovenin (src/main.js)
      registerType: 'prompt',
      includeAssets: ['icons/*'],
      manifest: {
        name: 'Game List',
        short_name: 'Game List',
        description: 'Mijn persoonlijke game-tracker',
        lang: 'nl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'icons/icon-192.png?v=3', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // De gamedatabase zit niet in de precache: die komt uit /api/games en wordt door de app zelf bewaard (src/data.js)
        // extras.json (critici-score en speeltijd, ~170 KB) wel: dan staat die ook offline in het gameprofiel
        globPatterns: ['**/*.{js,css,html,png,svg}', 'data/extras.json', 'data/hltb.json'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//, /^\/\.netlify\//],
        runtimeCaching: [
          {
            // Gecomprimeerde covers via Netlify Image CDN (alles wat je bekeken hebt blijft offline)
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/.netlify/images'),
            handler: 'CacheFirst',
            options: { cacheName: 'covers-v2', cacheableResponse: { statuses: [0, 200] }, expiration: COVER_EXPIRY },
          },
          {
            // Grote IGDB-covers van je eigen games: offline beschikbaar
            urlPattern: ({ url }) => url.hostname === 'images.igdb.com' && /t_cover_big|t_1080p/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'covers-v2', cacheableResponse: { statuses: [0, 200] }, expiration: COVER_EXPIRY },
          },
          {
            // Handmatige cover-URL's van andere sites
            urlPattern: ({ url, request }) =>
              request.destination === 'image' && url.origin !== self.location.origin && url.hostname !== 'images.igdb.com',
            handler: 'CacheFirst',
            options: { cacheName: 'covers-v2', cacheableResponse: { statuses: [0, 200] }, expiration: COVER_EXPIRY },
          },
        ],
      },
    }),
  ],
});
