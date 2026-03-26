/**
 * LIDLT Service Worker
 * Static assets only — API/content always fetched fresh.
 */

const CACHE_VERSION = 'lidlt-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const SHELL_FILES = [
  '/offline.html',
  '/',
];

// --- Install ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// --- Activate: clean old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// --- Fetch ---
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API/JSON data: always fresh, never cache
  if (url.pathname.endsWith('.json') || url.pathname.startsWith('/api/')) return;

  // Static assets: cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation: network with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match(request)) || (await caches.match('/offline.html')) || new Response('Offline', { status: 503 });
      })
    );
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

function isStaticAsset(pathname) {
  return /\.(css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/.test(pathname);
}
