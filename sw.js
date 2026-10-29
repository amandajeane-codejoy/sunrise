// Change VERSION whenever any app file changes, so phones pick up the update.
const VERSION = 'sunrise-0.13';
const FILES = [
  './',
  'index.html',
  'styles.css',
  'store.js',
  'exercises.js',
  'progression.js',
  'workout.js',
  'checkin.js',
  'davis.js',
  'app.js',
  'manifest.webmanifest',
  'fonts/fredoka.woff2',
  'fonts/nunito.woff2',
  'img/icon-180.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/sunrise-header.jpg'
];
// How long to wait for the network before using the saved copy.
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  // cache: 'reload' skips the browser's own cache, so we never save a stale file.
  event.waitUntil(
    caches.open(VERSION).then(cache =>
      cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, so updates show up right away. Fall back to the saved copy
// when offline or when the network is too slow.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const fromNetwork = fetch(request, { cache: 'no-cache' }).then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    });
    const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT_MS));
    try {
      const response = await Promise.race([fromNetwork, timeout]);
      if (response) return response;
    } catch (e) { /* offline */ }
    const saved = await cache.match(request, { ignoreSearch: true });
    return saved || fromNetwork;
  })());
});
