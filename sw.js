const VERSION = 'v1';
const STATIC_CACHE = 'mortgagecalc-static-' + VERSION;
const PAGE_CACHE = 'mortgagecalc-pages-' + VERSION;
const MAX_PAGES = 40;
const MAX_STATIC = 80;
const STATIC_PATTERN = /\.(css|js|png|jpg|jpeg|webp|avif|svg|ico|woff2?|ttf)$/i;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(['/assets/img/favicon.svg', '/assets/img/logo-mark.svg']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key !== STATIC_CACHE && key !== PAGE_CACHE && key.indexOf('mortgagecalc-') === 0) {
            return caches.delete(key);
          }
          return undefined;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function networkFirst(request) {
  return fetch(request)
    .then(function (response) {
      if (response && response.type === 'basic' && response.ok) {
        putInCache(PAGE_CACHE, request, response.clone(), MAX_PAGES);
      }
      return response;
    })
    .catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || caches.match('/');
      });
    });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cached) {
    const network = fetch(request)
      .then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          putInCache(STATIC_CACHE, request, response.clone(), MAX_STATIC);
        }
        return response;
      })
      .catch(function () { return cached; });
    return cached || network;
  });
}

function putInCache(cacheName, request, response, maxEntries) {
  caches.open(cacheName).then(function (cache) {
    cache.put(request, response).then(function () {
      trimCache(cacheName, maxEntries);
    });
  });
}

function trimCache(cacheName, maxEntries) {
  caches.open(cacheName).then(function (cache) {
    cache.keys().then(function (keys) {
      if (keys.length <= maxEntries) return;
      return Promise.all(
        keys.slice(0, keys.length - maxEntries).map(function (key) {
          return cache.delete(key);
        })
      );
    });
  });
}
