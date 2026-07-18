// HOA Connect — Service Worker
// Conservative update strategy: no skipWaiting, no clients.claim.
// New worker waits until all old clients close, then activates naturally.
// Versioned caches prevent stale chunk conflicts with lazy-loaded routes.

const CACHE_VERSION = 'v2';
const CACHE_NAME = `hoa-connect-${CACHE_VERSION}`;

// Only precache the essential app shell — not navigation routes.
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable-192.svg',
  '/icons/icon-maskable-512.svg',
  '/icons/apple-touch-icon.svg',
];

// Static asset patterns that are safe to cache-first.
function isStaticAsset(url) {
  const { pathname } = new URL(url);
  return (
    pathname.startsWith('/assets/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.woff') ||
    pathname === '/manifest.json'
  );
}

// Navigation requests (HTML documents) we serve with a network-first fallback.
function isNavigation(request) {
  return request.mode === 'navigate';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Individual asset 404s should not block installation.
      });
    })
  );
  // Intentionally NOT calling skipWaiting().
  // The new worker waits until all open tabs close, then activates.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Intentionally NOT calling clients.claim().
  // Existing pages keep using their current worker until reloaded naturally.
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  // Never cache cross-origin resources (CDN icons, fonts, analytics, etc.).
  if (url.origin !== self.location.origin) return;

  // Static assets: cache-first with network fallback.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        }).catch(() => {
          // Network unavailable and no cache — let the browser show its offline page.
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
    return;
  }

  // Navigation requests: network-first, fall back to cached shell if offline.
  if (isNavigation(request)) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response('', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // Everything else (API calls, form submissions, simulated operations):
  // pass through to the network — never cache.
  event.respondWith(fetch(request));
});