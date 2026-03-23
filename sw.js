/**
 * LIDLT Service Worker
 * Handles caching strategies for offline support and performance.
 */

const CACHE_VERSION = 'lidlt-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const MEDIA_CACHE = `${CACHE_VERSION}-media`;

// Files to cache on install (app shell)
const SHELL_FILES = [
  '/offline.html',
  '/',
];

// --- Install ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(SHELL_FILES);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// --- Activate ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('lidlt-') && key !== SHELL_CACHE && key !== DATA_CACHE && key !== MEDIA_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// --- Fetch ---
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Strategy: Network-first for manifest.json
  if (url.pathname === '/api/v1/manifest.json' || url.pathname.endsWith('/manifest.json')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Strategy: Stale-while-revalidate for API JSON data
  if (url.pathname.startsWith('/api/v1/') && url.pathname.endsWith('.json')) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // Strategy: Cache-first for media thumbnails
  if (url.pathname.startsWith('/media/thumbnails/')) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  // Strategy: Cache-first for static assets (CSS, JS, images)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // Strategy: Network-first for navigation requests with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Default: network with cache fallback
  event.respondWith(networkFirst(request, SHELL_CACHE));
});

/**
 * Network-first strategy.
 * Try network, cache the response, fall back to cache.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('No cached response available');
  }
}

/**
 * Stale-while-revalidate strategy.
 * Return cached response immediately, update cache in background.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cachedResponse || await fetchPromise || new Response('{}', {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Cache-first strategy.
 * Return cached response if available, otherwise fetch and cache.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

/**
 * Navigation handler with offline fallback.
 */
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try cache first
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fall back to offline page
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Check if a path is a static asset.
 */
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.css', '.js', '.mjs', '.woff', '.woff2', '.ttf', '.otf',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico',
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}
