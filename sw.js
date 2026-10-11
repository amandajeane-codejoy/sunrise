// Change VERSION whenever any app file changes, so phones pick up the update.
const VERSION = 'sunrise-0.1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'img/icon-180.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/sunrise-header.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then(hit => hit || fetch(event.request))
  );
});
