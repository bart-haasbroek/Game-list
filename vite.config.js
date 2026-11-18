import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
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
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // games.json (offline gamelijst) gaat mee, zodat zoeken ook zonder internet werkt
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//, /^\/\.netlify\//],
        runtimeCaching: [
          {
            // Gecomprimeerde covers via Netlify Image CDN (alles wat je bekeken hebt blijft offline)
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/.netlify/images'),
            handler: 'CacheFirst',
            options: { cacheName: 'covers-v2', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Grote IGDB-covers van je eigen games: offline beschikbaar
            urlPattern: ({ url }) => url.hostname === 'images.igdb.com' && url.pathname.includes('t_cover_big'),
            handler: 'CacheFirst',
            options: { cacheName: 'covers-v2', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Handmatige cover-URL's van andere sites
            urlPattern: ({ url, request }) =>
              request.destination === 'image' && url.origin !== self.location.origin && url.hostname !== 'images.igdb.com',
            handler: 'CacheFirst',
            options: { cacheName: 'covers-v2', cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
});
