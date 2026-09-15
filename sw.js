/* Onnihom service worker.
   Job: let the app itself (the page shell) open with zero connection,
   once it's been visited at least once while online. This does NOT try
   to cache your listings, map tiles, or anything from Supabase — those
   genuinely need a live connection and are left to fail/retry normally.
   Only the app's own shell is cached, so "Submit a Lead" can still open
   and work with no signal at all. */

const CACHE_NAME = "onnihom-shell-v1";
const APP_SHELL_URLS = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch((e) => console.error("Onnihom service worker: failed to cache app shell", e))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only the page's own navigation (loading the app itself) is handled
  // here — everything else (API calls, images, fonts, map tiles) passes
  // straight through untouched, exactly as if this service worker didn't
  // exist at all.
  if(event.request.mode !== "navigate") return;

  event.respondWith(
    // Always prefer a fresh copy when online, so a redeploy takes effect
    // immediately for anyone with a connection — only fall back to the
    // cached shell when the network request genuinely fails.
    fetch(event.request).catch(() => caches.match("/index.html"))
  );
});
