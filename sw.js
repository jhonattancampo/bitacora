/* =========================================================
   sw.js — Service worker
   Guarda la app en el teléfono para que abra sin señal.
   Subí el número de VERSION cada vez que cambies un archivo:
   así el teléfono se entera de que hay una versión nueva.
   ========================================================= */
const VERSION = "bitacora-v5";
const SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./sync.js",
  "./config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Firebase: nunca cachear las llamadas de datos, sí las librerías del CDN
  if (/firestore\.googleapis|identitytoolkit|googleapis\.com\/google\.firestore/.test(url.host + url.pathname)) return;

  if (url.host === "www.gstatic.com") {
    e.respondWith(
      caches.open(VERSION + "-lib").then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => fetch(req))
    );
    return;
  }

  // Propio: primero la red (para tomar cambios), con el cache como red de seguridad
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
  }
});
