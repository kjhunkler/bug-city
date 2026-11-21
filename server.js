import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const assets = new Set([
  "index.html",
  "style.css",
  "main.js",
  "art.js",
  "game.js",
  "coop.js",
  "network.js",
  "pairing.js",
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
createServer(async (req, res) => {
  const path =
    new URL(req.url, "http://localhost").pathname.slice(1) || "index.html";
  if (assets.has(path)) {
    try {
      const data = await readFile(new URL(path, import.meta.url));
      res.writeHead(200, { "Content-Type": mime[extname(path)] });
      return res.end(data);
    } catch {}
  }
  res.writeHead(404).end("Not found");
}).listen(Number(process.env.PORT || 4173), () =>
  console.log("Bug City listening on port", process.env.PORT || 4173),
);
