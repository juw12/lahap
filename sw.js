// Offline cache. App shell: network first so updates land. Heavy vendor files (cutout model, OCR):
// cache first, fetched only when a feature needs them. Meals and photos live in IndexedDB, not here.
const CACHE = "lahap-v59";
const VENDOR = "lahap-vendor-v1";
const SHELL = ["./", "index.html", "styles.css", "logic.js", "memory.js", "nutrition.js", "recipes.js", "vision.js", "app.js", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "manifest.webmanifest", "assets/dish/noodle.jpg", "assets/dish/salad.jpg", "assets/dish/pizza.jpg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== VENDOR).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin === location.origin && url.pathname.includes("/vendor/")) {
    event.respondWith(
      caches.open(VENDOR).then((cache) =>
        cache.match(event.request).then(
          (hit) =>
            hit ||
            fetch(event.request).then((response) => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
        )
      )
    );
    return;
  }
  // r37: never answer with nothing. Offline, a page load falls back to the cached app shell, so the app opens
  // (with every saved meal) instead of a browser error page; only good responses are cached.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.origin === location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(event.request, { ignoreSearch: true })
          .then((hit) => hit || (event.request.mode === "navigate" ? caches.match("index.html") : undefined))
          .then((hit) => hit || Response.error())
      )
  );
});
