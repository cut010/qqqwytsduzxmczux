/**
 * LIDLT Service Worker
 *
 * Regla: solo se cachea de forma permanente lo que lleva hash en el nombre.
 *
 * La versión anterior hacía `cacheFirst` sobre cualquier `.css` o `.js` y nunca
 * revalidaba. En desarrollo, donde esas URLs son fijas, el navegador se quedaba
 * servido con la hoja de estilos de una build vieja indefinidamente: marcado
 * nuevo con CSS antiguo. La página parecía rota sin que apareciera ningún error.
 */

const CACHE_VERSION = 'lidlt-v4';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const SHELL_FILES = ['/offline.html'];

/** Los assets de build llevan hash en la ruta: su contenido nunca cambia. */
function isImmutable(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    /\.(woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/.test(pathname)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Los JSON del catálogo tienen que llegar siempre frescos.
  if (url.pathname.endsWith('.json') || url.pathname.startsWith('/api/')) return;

  // Assets con hash: cache-first sin riesgo, porque un cambio implica otra URL.
  if (isImmutable(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Todo lo demás (HTML, y CSS/JS sin hash como en desarrollo): red primero,
  // con la caché solo como red de seguridad si no hay conexión.
  event.respondWith(networkFirst(request));
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

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && request.mode === 'navigate') {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return (await caches.match('/offline.html')) || new Response('Offline', { status: 503 });
    }
    return new Response('', { status: 504 });
  }
}
