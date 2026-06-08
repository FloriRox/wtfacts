const CACHE_NAME = 'estimatesv1';

// Assets to cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: precache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API/Firebase, cache-first for static assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network for Firebase, external APIs
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('fonts.g') ||
    url.pathname.includes('/api/')
  ) {
    return; // Let browser handle normally
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (
    e.request.destination === 'script' ||
    e.request.destination === 'style' ||
    e.request.destination === 'image' ||
    e.request.destination === 'font'
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML navigation
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
  }
});
