const CACHE_NAME = 'facility-pro-v2'; // Bumped version to force phone to update

// 1. Static assets to cache immediately upon installation
const STATIC_ASSETS = [
  '/facility-pro/',
  '/facility-pro/index.html',
  '/facility-pro/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght=400;500;600;700;800&display=swap'
];

// 2. Install Event: Cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Opened cache and caching App Shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 3. Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) 
  );
});

// 4. Fetch Event: Network-First Strategy with Cache Fallback
self.addEventListener('fetch', (event) => {
  // Ignore POST requests (handled by localStorage outbox)
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If network succeeds, clone and update cache for future offline use
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If offline, serve from cache
        console.log('SW: Network failed, serving from cache for', event.request.url);
        return caches.match(event.request);
      })
  );
});
