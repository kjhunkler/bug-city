const CACHE = "bug-city-shell-forest-6";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./main.js",
  "./art.js",
  "./forest.js",
  "./wonders.js",
  "./field-art.js",
  "./encounter.js",
  "./catch-jar.js",
  "./pond.js",
  "./meadow.js",
  "./garden-net.js",
  "./pages-net.js",
  "./vendor/peerjs.min.js",
  "./manifest.webmanifest",
  "./public/audio/bug-catcher-quest.m4a",
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
          keys
            .filter((key) => key.startsWith("bug-city-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
const urls = new Set(
  SHELL.map((path) => new URL(path, self.registration.scope).href),
);
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !urls.has(event.request.url)) return;
  // Audio players can seek to the loop start with a byte-range request.
  const range = event.request.headers.get("Range");
  if (range && event.request.url.endsWith("/bug-catcher-quest.m4a")) {
    event.respondWith((async () => {
      const cached = await (await caches.open(CACHE)).match(event.request.url);
      const match = /^bytes=(\d+)-(\d*)$/i.exec(range);
      if (!cached || !match) return fetch(event.request);
      const audio = await cached.blob();
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), audio.size - 1) : audio.size - 1;
      if (start > end) return new Response(null, {status: 416, headers: {"Content-Range": "bytes */" + audio.size}});
      return new Response(audio.slice(start, end + 1), {status: 206, headers: {
        "Content-Type": "audio/mp4", "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Content-Range": "bytes " + start + "-" + end + "/" + audio.size
      }});
    })());
    return;
  }
  event.respondWith(
    caches
      .open(CACHE)
      .then(
        async (cache) =>
          (await cache.match(event.request)) || fetch(event.request),
      ),
  );
});
