// Minimal service worker for blog.ashiqur.in.
//
// Job #1: having any fetch handler here is what lets browsers treat the
// site as installable. Job #2: cache the app shell so the site still
// opens (and shows *something*) when there's no connection.
//
// Strategy is network-first for same-origin GET requests: always try the
// network so edits to the blog show up immediately, and only fall back to
// the cache when the network fails (offline). Cross-origin requests
// (Google Fonts, embeds, etc.) are left alone entirely.
//
// Bump CACHE_NAME whenever you want returning visitors to drop any old
// cached files.
const CACHE_NAME = "ashiqur-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./manifest.json"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        return response;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match("./index.html");
        });
      })
  );
});
