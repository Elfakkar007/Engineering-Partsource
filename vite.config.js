import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        // Cache strategy: pre-cache app shell, runtime-cache Google Fonts
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Plant Sourcing App',
        short_name: 'PlantSource',
        description: 'Sistem manajemen spare part & referensi teknis pabrik',
        theme_color: '#188038',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],

  build: {
    // Naikkan batas peringatan chunk — sesuaikan dengan rekomendasi rolldown
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        // Vendor chunks terpisah untuk library besar — mengurangi re-download
        manualChunks(id) {
          // SheetJS / xlsx — hanya dimuat saat Import/Export dibuka
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-xlsx'
          }
          // Dexie (IndexedDB ORM)
          if (id.includes('node_modules/dexie')) {
            return 'vendor-dexie'
          }
          // PocketBase SDK
          if (id.includes('node_modules/pocketbase')) {
            return 'vendor-pocketbase'
          }
          // React core
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
          // React Router
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router'
          }
          // Workbox / PWA
          if (id.includes('node_modules/workbox') || id.includes('virtual:pwa')) {
            return 'vendor-pwa'
          }
        },
      },
    },
  },
})
