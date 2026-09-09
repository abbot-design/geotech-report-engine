/* Abbot Report Engine — offline-first service worker.
   App-shell cache: the whole app must work with zero signal on site.
   Bump CACHE version on every deploy to invalidate old shells. */
const CACHE = "abbot-engine-v32";
const SHELL = ["./","./index.html","./manifest.webmanifest","./engine-manual.pdf","./icon-192.png","./icon-512.png","./assets/abbot-logo.svg","./assets/cover-photo.jpg","./vendor/qrcode.min.js","./info-sheets/manifest.js","./vendor/fonts/carlito-regular.woff2","./vendor/fonts/carlito-bold.woff2","./vendor/fonts/carlito-italic.woff2","./vendor/fonts/carlito-bolditalic.woff2","./info-sheets/pages/csiro-foundation-maintenance-01.jpg","./info-sheets/pages/csiro-foundation-maintenance-02.jpg","./info-sheets/pages/csiro-foundation-maintenance-03.jpg","./info-sheets/pages/csiro-foundation-maintenance-04.jpg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
