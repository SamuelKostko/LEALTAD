const CACHE_NAME = "wallet-pwa-v35";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== CACHE_NAME)
              .map((key) => caches.delete(key))
          )
        ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  // For HTML navigations (/, /card/<token>, etc.) prefer network so UI updates
  // are visible immediately; fall back to cache when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(async () => {
          const cachedRequest = await caches.match(request);
          if (cachedRequest) return cachedRequest;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Never cache admin pages/assets (avoid stale admin UI).
  try {
    const url = new URL(request.url);
    if (
      url.pathname === '/admin' ||
      url.pathname.startsWith('/admin/') ||
      url.pathname === '/admin-qr.html' ||
      url.pathname === '/admin-qr.js'
    ) {
      event.respondWith(fetch(request));
      return;
    }
  } catch {
    // Ignore URL parsing issues.
  }

  // Never cache API responses (per-user data).
  try {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(fetch(request));
      return;
    }
  } catch {
    // Ignore URL parsing issues.
  }

  // Core UI files should prefer network so style/app changes are visible quickly.
  try {
    const url = new URL(request.url);
    if (url.pathname === '/styles.css' || url.pathname === '/app.js' || url.pathname === '/index.html') {
      event.respondWith(
        fetch(request)
          .then((response) => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            return response;
          })
          .catch(() => caches.match(request))
      );
      return;
    }
  } catch {
    // Ignore URL parsing issues.
  }

  // For the client-provided card artwork we want updates to show immediately
  // even when the filename stays the same (network-first, cache fallback).
  try {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/images/card-cliente.png")) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            return response;
          })
          .catch(() => caches.match(request))
      );
      return;
    }
  } catch {
    // Ignore URL parsing issues and fall back to default behavior.
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});


