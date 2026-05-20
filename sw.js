const CACHE_NAME = 'facility-pro-v1';

// Static assets to cache immediately upon installation
const STATIC_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght=400;500;600;700;800&display=swap'
];

// 1. Install Event: Cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Forces the waiting service worker to become the active service worker
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache and caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. Activate Event: Clean up old caches if the CACHE_NAME is updated
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open pages immediately
  );
});

// 3. Fetch Event: Network-First Strategy with Cache Fallback
self.addEventListener('fetch', (event) => {
  // Service Workers cannot cache POST requests (which your callApi function uses).
  // We ignore them here. Offline POSTs must be handled by localStorage in your Index.html.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If the network request is successful, clone it and put it in the cache
        // We ensure we only cache valid responses
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If the network fails (offline), look for a cached version
        return caches.match(event.request);
      })
  );
});
