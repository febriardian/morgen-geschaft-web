// service-worker.js
// Bump version string on every deploy to evict stale caches.
const CACHE_NAME = "morgen-geschäft-v2";
// Only cache the app shell — hashed assets (/assets/*) are immutable and
// already cache-controlled by Nginx with 1y expiry. We deliberately do NOT
// pre-cache index.html to avoid serving a stale shell that references
// hashed asset filenames from a previous build.
const FILES_TO_CACHE = [
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Skip non-GET requests and chrome-extension URLs
  if (event.request.method !== "GET") return;
  if (event.request.url.startsWith("chrome-extension")) return;

  // Never cache API calls — always go to network for dynamic data
  if (event.request.url.includes("/api/")) return;

  // Never cache Firestore/Firebase requests
  if (event.request.url.includes("firestore.googleapis.com")) return;
  if (event.request.url.includes("firebaseio.com")) return;

  // Navigation requests (HTML pages) — always network, no cache fallback.
  // This prevents stale index.html from being served after a deploy.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/manifest.json").then(() =>
          new Response(
            '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h1>Offline</h1><p>Periksa koneksi internet kamu lalu muat ulang halaman.</p></body></html>',
            {
              status: 200,
              headers: {
                "Content-Type": "text/html",
                "X-Morgen-Offline": "1",
                "Cache-Control": "no-store",
              },
            }
          )
        )
      )
    );
    return;
  }

  // Hashed assets (/assets/*) — cache-first (immutable filenames)
  if (event.request.url.includes("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else — network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) =>
          cached || new Response("Offline", { status: 503, statusText: "Service Unavailable" })
        )
      )
  );
});

// Push notification
self.addEventListener("push", (event) => {
  let data = { title: "Morgen Geschäft", body: "Ada update baru!", url: "/id" };
  try { data = event.data.json(); } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title || "Morgen Geschäft", {
      body: data.body || "",
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      data: { url: data.url || "/id" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/id";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
