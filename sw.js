const CACHE = "bug-city-shell-v1";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./art.js",
  "./game.js",
  "./manifest.webmanifest",
  "./public/icons/beetle-192.png",
  "./public/icons/beetle-512.png",
  "./public/icons/beetle-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("bug-city-shell-") && key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
const urls = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || !urls.has(event.request.url)) return;
  event.respondWith(caches.open(CACHE).then(async cache =>
    (await cache.match(event.request)) || fetch(event.request)
  ));
});
