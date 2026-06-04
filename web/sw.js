// toktrend-v3 — fuerza invalidacion de cache vieja
const CACHE = 'toktrend-v3';

// Solo cachear assets estaticos que no cambian logica critica
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest'
];

// app.js se sirve siempre desde la red para evitar quedarse con version vieja
const NETWORK_FIRST = ['./app.js'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Eliminando cache vieja:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNetworkFirst = NETWORK_FIRST.some(p => url.pathname.endsWith(p.replace('./', '/')));

  if (isNetworkFirst) {
    // Network-first: siempre descarga fresco, cache solo como respaldo offline
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first para assets estaticos
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});
