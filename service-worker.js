const CACHE_NAME = "wallet-pwa-v70";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/icons/icon-v2.svg",
  "/icons/icon-192.png",
  "/icons/badge-72.png"
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
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
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

  // Never cache admin/merchant/login pages (avoid stale UI).
  try {
    const url = new URL(request.url);
    if (
      url.pathname === '/login' ||
      url.pathname === '/admin' ||
      url.pathname.startsWith('/admin/') ||
      url.pathname === '/admin-qr.html' ||
      url.pathname === '/admin-qr.js' ||
      url.pathname === '/admin-promotions.html' ||
      url.pathname === '/admin-promotions.js' ||
      url.pathname === '/comercio/qr' ||
      url.pathname.startsWith('/comercio/') ||
      url.pathname === '/merchant-qr.html' ||
      url.pathname === '/merchant-qr.js' ||
      url.pathname === '/login.html'
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
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
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
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
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
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "V+ Puntos";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/badge-72.png",
    tag: data.tag || undefined,
    data: {
      url: data.url || "/",
      ...(data.data || {})
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const resolvedTarget = new URL(targetUrl, self.location.origin).href;
      for (const client of clientList) {
        if (client.url === resolvedTarget && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(resolvedTarget);
      }
    })
  );
});
