const CACHE_NAME = 'puntproai-shell-v1';
const SHELL_ASSETS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only ever touch simple GETs. Video uploads, the /api/analyze call, and
  // any other POST must always go straight to the network, untouched.
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/')) return;

  // App shell HTML: network-first, so a fresh deploy is always picked up
  // when online. Falls back to the cached shell only if offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Static assets (icons, manifest): cache-first for speed, network fallback
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
