import { createGame, step, act, attack } from "./game.js";
import { paint } from "./art.js";
const g = createGame(),
  canvas = document.querySelector("canvas"),
  ctx = canvas.getContext("2d");
const el = (id) => document.getElementById(id),
  keys = new Set();
try {
  g.stash = Math.max(0, Number(localStorage.getItem("bug-city-stash")) || 0);
} catch {}
let saved = g.stash,
  previous = performance.now(),
  stick = null,
  aim = null,
  sx = 0,
  sy = 0;
function strike(dx = 0, dy = 0) {
  if (!dx && !dy) {
    const closest = [...g.enemies].sort(
      (a, b) =>
        Math.hypot(a.x - g.player.x, a.y - g.player.y) -
        Math.hypot(b.x - g.player.x, b.y - g.player.y),
    )[0];
    if (closest) {
      dx = closest.x - g.player.x;
      dy = closest.y - g.player.y;
    }
  }
  attack(g, dx, dy);
}
function set(id, value) {
  if (el(id).textContent !== value) el(id).textContent = value;
}
function frame(now) {
  const dt = (now - previous) / 1000;
  previous = now;
  step(
    g,
    dt,
    sx +
      (keys.has("d") || keys.has("arrowright")) -
      (keys.has("a") || keys.has("arrowleft")),
    sy +
      (keys.has("s") || keys.has("arrowdown")) -
      (keys.has("w") || keys.has("arrowup")),
  );
  paint(ctx, g, now / 1000);
  const home = g.scene === "home";
  set("place", home ? "Lantern Hollow" : "The Rustway");
  set("sector", home ? "COLONY" : "EXPEDITION");
  set("safe", home ? "●  Safe zone" : "◆  Hostile zone");
  set(
    "brief",
    home
      ? "Venture beyond the colony, gather salvage, and reach the eastern beacon to bring it home."
      : "Extract at the eastern beacon. For a richer haul, seek the Copper Stag in the northeast grove.",
  );
  set("action", home ? "Enter expedition  →" : "Activate beacon");
  set("log", g.message);
  set("hp", g.player.hp + " / 5");
  set("bag", g.carried + " salvage");
  set("stash", g.stash + " salvage");
  if (saved !== g.stash) {
    try {
      localStorage.setItem("bug-city-stash", g.stash);
    } catch {}
    saved = g.stash;
  }
  requestAnimationFrame(frame);
}
el("action").onclick = () => act(g);
window.onkeydown = (e) => {
  const k = e.key.toLowerCase();
  if (k === " " && e.target.tagName === "BUTTON") return;
  if ([" ", "arrowup", "arrowdown", "arrowright", "arrowleft"].includes(k))
    e.preventDefault();
  keys.add(k);
  if (!e.repeat && k === "e") act(g);
  if (k === " ") strike();
};
window.onkeyup = (e) => keys.delete(e.key.toLowerCase());
function drag(node, move) {
  node.onpointerdown = (e) => {
    node.setPointerCapture(e.pointerId);
    if (move) stick = e;
    else aim = e;
  };
  node.onpointermove = (e) => {
    if (move && stick?.pointerId === e.pointerId) {
      sx = (e.clientX - stick.clientX) / 22;
      sy = (e.clientY - stick.clientY) / 22;
    }
  };
  node.onpointerup = (e) => {
    if (move) {
      sx = sy = 0;
      stick = null;
    } else if (aim) {
      let x = e.clientX - aim.clientX,
        y = e.clientY - aim.clientY;
      Math.hypot(x, y) < 6 ? strike() : strike(x, y);
      aim = null;
    }
  };
  node.onpointercancel = () => {
    if (move) {
      sx = sy = 0;
      stick = null;
    } else aim = null;
  };
}
drag(el("stick"), true);
drag(el("strike"), false);
drag(canvas, false);
window.onblur = () => {
  keys.clear();
  sx = sy = 0;
  stick = aim = null;
};
requestAnimationFrame(frame);
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});
