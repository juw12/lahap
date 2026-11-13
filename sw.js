// Offline cache. App shell: network first so updates land. Heavy vendor files (cutout model, OCR):
// cache first, fetched only when a feature needs them. Meals and photos live in IndexedDB, not here.
const CACHE = "lahap-v60";
const VENDOR = "lahap-vendor-v1";
const SHELL = ["./", "index.html", "styles.css", "logic.js", "memory.js", "nutrition.js", "recipes.js", "vision.js", "studio-logic.js", "i18n-strings.js", "i18n.js", "studio.js", "games.js", "app.js", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "manifest.webmanifest", "assets/dish/noodle.jpg", "assets/dish/salad.jpg", "assets/dish/pizza.jpg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== VENDOR && key !== "lahap-widgets").map((key) => caches.delete(key))))
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

// r40: Windows 11 widgets (Widgets board, installed PWA). The app writes a small snapshot (names and places only)
// to the "lahap-widgets" cache; the widgets read it here. Other platforms ignore these events.
async function widgetData() {
  const cache = await caches.open("lahap-widgets");
  const hit = await cache.match("widget-data.json");
  if (hit) return hit.text();
  const fallback = await fetch("widgets/data.json");
  return fallback.text();
}

async function renderWidget(widget) {
  if (!self.widgets || !widget || !widget.definition) return;
  const template = await (await fetch(widget.definition.msAcTemplate)).text();
  const data = await widgetData();
  await self.widgets.updateByTag(widget.definition.tag, { template, data });
}

self.addEventListener("widgetinstall", (event) => event.waitUntil(renderWidget(event.widget)));
self.addEventListener("widgetresume", (event) => event.waitUntil(renderWidget(event.widget)));
self.addEventListener("widgetclick", (event) => {
  const verb = event.action;
  if (verb === "shuffle") {
    event.waitUntil(renderWidget(event.widget));
    return;
  }
  const url = verb === "log" ? "./index.html?log=1" : verb === "wheel" ? "./index.html?wheel=1" : "./index.html";
  event.waitUntil(self.clients.openWindow(url));
});
self.addEventListener("periodicsync", (event) => {
  if (!self.widgets) return;
  event.waitUntil(self.widgets.getByTag(event.tag).then((widget) => renderWidget(widget)));
});
