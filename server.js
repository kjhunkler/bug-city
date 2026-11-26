import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createGardenRelay } from "./garden-relay.js";

const assets = new Set([
  "index.html",
  "style.css",
  "main.js",
  "art.js",
  "forest.js",
  "wonders.js",
  "field-art.js",
  "encounter.js",
  "pond.js",
  "meadow.js",
  "garden-net.js",
  "pages-net.js",
  "vendor/peerjs.min.js",
  "sw.js",
  "manifest.webmanifest",
  ...["beetle-192.png", "beetle-512.png", "beetle-maskable-512.png"].map(
    (name) => "public/icons/" + name,
  ),
]);
const mime = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};
const garden = createGardenRelay();
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (await garden.route(req, res, url)) return;
  const path = url.pathname.slice(1) || "index.html";
  if (assets.has(path)) {
    try {
      const data = await readFile(new URL(path, import.meta.url));
      res.writeHead(200, { "Content-Type": mime[extname(path)] });
      return res.end(path === "index.html"
        ? data.toString().replace("</head>", '<meta name="bug-city-garden" content="available">\n</head>')
        : data);
    } catch {}
  }
  res.writeHead(404).end("Not found");
});
server.on("close", garden.close);
server.listen(Number(process.env.PORT || 4173), () =>
  console.log("Bug City listening on port", process.env.PORT || 4173),
);
