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
    caches.open(CACHE_NAME).then((cache) =>
      // Cache each file independently rather than with cache.addAll(),
      // which fails ALL entries the moment even one fails — leaving
      // nothing cached at all for something as important as the offline
      // app shell. A single failure here should never cost us the rest.
      Promise.allSettled(
        APP_SHELL_URLS.map((url) =>
          fetch(url).then((response) => {
            if(response && response.ok) return cache.put(url, response);
            console.error("Onnihom service worker: bad response caching", url, response && response.status);
          }).catch((e) => console.error("Onnihom service worker: failed to fetch", url, e))
        )
      )
    )
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
    fetch(event.request).catch(async () => {
      const cached = (await caches.match("/index.html")) || (await caches.match("/"));
      if(cached) return cached;
      // Genuinely nothing cached yet (e.g. the very first visit was
      // interrupted before caching finished) — a real, readable response
      // beats returning nothing at all, which shows as a raw browser error.
      return new Response(
        "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Onnihom</title></head><body style='font-family:sans-serif;text-align:center;padding:3rem 1.5rem;'><h1>You're offline</h1><p>This page hasn't finished saving for offline use yet. Please reconnect once, fully, before trying again offline.</p></body></html>",
        { headers: { "Content-Type": "text/html" } }
      );
    })
  );
});
