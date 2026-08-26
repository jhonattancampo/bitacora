import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
  },
  plugins: [
    VitePWA({
      // The app keeps its own hand-written manifest in public/, so install
      // behaviour (name, icons, start_url, colors) stays byte-identical.
      manifest: false,
      // src/pwa.ts registers the worker by hand, the same way app.js did.
      injectRegister: null,
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        // Offline navigations fall back to the shell, like the old worker's
        // caches.match("./index.html") did.
        navigateFallback: "index.html",
        // skipWaiting + clientsClaim reproduce the old worker exactly: a new
        // build takes over as soon as it installs, and the user sees it on
        // their next reload. Nothing is ever force-reloaded mid-workout.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Firebase SDK modules from Google's CDN: same cache-first strategy
            // the hand-written worker used, so the app boots without signal.
            urlPattern: /^https:\/\/www\.gstatic\.com\/firebasejs\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "firebase-sdk",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
