// Minimal service worker for blog.ashiqur.in.
//
// Job #1: having any fetch handler here is what lets browsers treat the
// site as installable. Job #2: cache the app shell so the site still
// opens (and shows *something*) when there's no connection.
//
// Two caches, so you can control each independently:
//
//  - CORE_CACHE_NAME: downloaded and cached the moment the service worker
//    installs, from the CORE_FILES list below. These pages/files are
//    guaranteed to work offline, even on someone's very first visit.
//    Edit CORE_FILES to choose exactly what that covers.
//
//  - RUNTIME_CACHE_NAME: everything else, cached automatically the first
//    time it's fetched successfully. This is what makes an individual
//    blog post "just work" offline once someone's actually read it,
//    without you having to list every post URL by hand.
//
// Strategy is network-first for same-origin GET requests: always try the
// network so edits to the blog show up immediately, and only fall back to
// a cache when the network fails (offline). Cross-origin requests
// (Google Fonts, embeds, etc.) are left alone entirely.
//
// Bump VERSION whenever you want returning visitors to drop old cached
// files and re-fetch the CORE_FILES list fresh.
const VERSION = "v4";
const CORE_CACHE_NAME = "ashiqur-core-" + VERSION;
const RUNTIME_CACHE_NAME = "ashiqur-runtime-" + VERSION;

// --- Edit this list to choose what's ALWAYS available offline. ---
// Add or remove paths as your section pages change. You don't need to
// list individual blog posts here — those get picked up by
// RUNTIME_CACHE_NAME the first time someone opens one. Keep this list to
// pages/files you want guaranteed even if someone has never visited them
// with a connection before.
const CORE_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./manifest.json",
  "./manifest-dark.json",
  "./favicon.svg",
  "./offline.html",
  "./ashiqur.png",
  // Manifest icon + OG preview images: small, shared, worth having on
  // day one. NOT included: assets/posts/... and assets/works/... — those
  // are per-post media (some are large: video, zip, pdf) and get cached
  // automatically the first time someone actually opens that post instead.
  "./assets/icon/icon.png",
  "./blog/",
  "./blog/index.html",
  "./about/",
  "./about/index.html",
  "./contact/",
  "./contact/index.html",
  "./links/",
  "./links/index.html",
  "./404.html"
];

// --- /assets/images/ (and only that folder — NOT /blog/assets/) ---
// The Cache API has no way to "cache a whole folder": every URL has to be
// listed by name, and I don't have the actual filenames inside
// /assets/images/ from what you've uploaded so far. Rather than guess (or
// make you come back here each time you add an image), this list lives
// in its own file — EXTRA_CACHE_MANIFEST below — so adding a new image to
// the offline set is just adding one line to that JSON file, no sw.js
// edits or VERSION bumps needed.
const EXTRA_CACHE_MANIFEST = "./cache-manifest.json";

// Shown instead of the browser's built-in "no internet" page when someone
// navigates to a page that isn't in either cache while offline.
const OFFLINE_FALLBACK_PAGE = "./offline.html";

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CORE_CACHE_NAME).then(function (cache) {
      return fetch(EXTRA_CACHE_MANIFEST)
        .then(function (res) { return res.ok ? res.json() : []; })
        .catch(function () { return []; }) // manifest missing/offline at install: just skip it
        .then(function (extra) {
          var files = CORE_FILES.concat(Array.isArray(extra) ? extra : []);
          // addAll fails all-or-nothing, so a single bad path (e.g. a page
          // that doesn't exist yet) would silently block every other file
          // from being cached. Adding them individually means one miss
          // doesn't take the rest down with it.
          return Promise.all(
            files.map(function (url) {
              return cache.add(url).catch(function (err) {
                console.warn("sw: couldn't precache", url, err);
              });
            })
          );
        });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CORE_CACHE_NAME && key !== RUNTIME_CACHE_NAME;
          })
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

  var isPage = req.mode === "navigate" || req.destination === "document";

  event.respondWith(
    fetch(req)
      .then(function (response) {
        // Only cache real, complete responses (network-first still caches
        // as it goes, so pages/assets visited once become available
        // offline from then on).
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(RUNTIME_CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return response;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          if (cached) return cached;
          // Nothing cached for this exact request.
          if (isPage) {
            // A page visit with nothing cached: show the offline page
            // instead of the browser's own "no internet" screen.
            return caches.match(OFFLINE_FALLBACK_PAGE);
          }
          // A missing css/js/image/font: let it fail rather than
          // swapping in a full HTML page, which would break more than
          // it fixes.
          return Response.error();
        });
      })
  );
});
