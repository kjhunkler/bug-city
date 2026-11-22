import { createWorld, addPlayer, stepWorld, movePlayer, inReach, BUG_KINDS, FISH_ACTION } from "./meadow.js";
import { drawJar, drawBug, paint } from "./art.js";
import { connectGarden } from "./garden-net.js";
import { connectPages } from "./pages-net.js";

const canvas = document.querySelector("#meadow"),
  ctx = canvas.getContext("2d", { alpha: false });
const stick = document.querySelector("#stick"),
  knob = document.querySelector("#knob");
const count = document.querySelector("#count"),
  friends = document.querySelector("#players"),
  flash = document.querySelector("#catch");
drawJar(document.querySelector("#jar").getContext("2d"));
let myId = "local",
  world = createWorld(crypto.getRandomValues(new Uint32Array(1))[0]);
addPlayer(world, myId);
let camera = { ...world.players[myId] },
  remote = {},
  online = false,
  snapshotTime = 0,
  priorCount = 0,
  priorFish = 0,
  flashUntil = 0;
let targets = [];
const swings = Object.create(null),
  seenSwings = new Map();
const keys = new Set(),
  axis = { turn: 0, forward: 0, targetBug: 0, targetSequence: 0 };
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function receive(next, id) {
  if (!next.players[id]) return;
  const reset = id !== myId || next.seed !== world.seed;
  if (reset) {
    camera = { ...next.players[id] };
    remote = {};
    axis.targetBug = 0;
    seenSwings.clear();
    priorCount = next.caught;
    priorFish = next.fish;
  }
  world = next;
  myId = id;
  online = true;
  snapshotTime = performance.now();
}
function status(value) {
  document.body.classList.toggle(
    "connected",
    ["online", "hosting"].includes(value),
  );
  if (value === "offline" || value === "reconnecting") online = false;
}
const localServer = document.querySelector('meta[name="bug-city-garden"]');
const connection = (localServer ? connectGarden : connectPages)({
  initialWorld(id) {
    const initial = structuredClone(world);
    initial.players = { [id]: { ...world.players[myId] } };
    return initial;
  },
  onWorld: receive,
  onStatus: status,
});

let pointer = null,
  stickX = 0,
  stickY = 0;
function recalc() {
  const keyboardX =
    Number(keys.has("arrowright") || keys.has("d")) -
    Number(keys.has("arrowleft") || keys.has("a"));
  const keyboardY =
    Number(keys.has("arrowdown") || keys.has("s")) -
    Number(keys.has("arrowup") || keys.has("w"));
  const x = keyboardX || stickX,
    y = keyboardY || stickY,
    length = Math.max(1, Math.hypot(x, y));
  axis.turn = Math.abs(x) < 0.1 ? 0 : x / length;
  axis.forward = Math.abs(y) < 0.1 ? 0 : -y / length;
  knob.style.transform =
    "translate(" + axis.turn * 54 + "%," + -axis.forward * 54 + "%)";
  connection.input(axis);
}
function drag(e) {
  const box = stick.getBoundingClientRect();
  stickX = (e.clientX - box.left - box.width / 2) / (box.width * 0.38);
  stickY = (e.clientY - box.top - box.height / 2) / (box.height * 0.38);
  recalc();
}
stick.onpointerdown = (e) => {
  if (pointer !== null) return;
  pointer = e.pointerId;
  stick.setPointerCapture(pointer);
  drag(e);
};
stick.onpointermove = (e) => {
  if (e.pointerId === pointer) drag(e);
};
function release() {
  pointer = null;
  stickX = stickY = 0;
  recalc();
}
const jar = document.querySelector("#collection");
const glass = document.querySelector("#glass").getContext("2d");
const label = document.querySelector("#jar-label");
const prev = document.querySelector("#prev"), next = document.querySelector("#next");
const perPage = 24;
let page = 0;
document.querySelector(".counter").onclick = () => {
  keys.clear();
  release();
  page = 0;
  jar.showModal();
};
document.querySelector("#close-jar").onclick = () => jar.close();
prev.onclick = () => page--;
next.onclick = () => page++;
function showCollection(time) {
  page = Math.max(0, Math.min(page, Math.ceil(world.caught / perPage) - 1));
  const start = page * perPage, end = Math.min(start + perPage, world.caught);
  glass.clearRect(0, 0, glass.canvas.width, glass.canvas.height);
  let offset = 0;
  for (const kind of BUG_KINDS) {
    const stop = offset + world.collection[kind];
    for (let i = Math.max(start, offset); i < Math.min(end, stop); i++) {
      const t = time * 0.7 + i * 2.4, j = i - start;
      drawBug(glass, 15 + (j % 6) * 30 + Math.cos(t) * 7,
        15 + Math.floor(j / 6) * 27 + Math.sin(t * 1.3) * 7, kind, t);
    }
    offset = stop;
  }
  const text = world.caught ? `${start + 1}–${end} of ${world.caught} bugs` : "No bugs yet";
  const summary = `${text} · ${world.fish} fish caught`;
  if (label.textContent !== summary) label.textContent = summary;
  prev.disabled = page === 0;
  next.disabled = end === world.caught;
}
stick.onlostpointercapture = release;
stick.onpointercancel = release;
stick.onpointerup = (e) => {
  if (e.pointerId === pointer) release();
};
// Hit-test the last painted sprites so steering and screen rotation use the same projection.
canvas.onpointerdown = (e) => {
  if (e.button !== 0) return;
  const box = canvas.getBoundingClientRect();
  const px = ((e.clientX - box.left) * canvas.width) / box.width,
    py = ((e.clientY - box.top) * canvas.height) / box.height;
  const touchRadius = (21 * canvas.width) / box.width;
  let nearest = null,
    best = Infinity;
  for (const target of targets) {
    const distance = Math.hypot(px - target.x, py - target.y);
    if (distance <= Math.max(touchRadius, 7 * target.size) && distance < best) {
      best = distance;
      nearest = target;
    }
  }
  if (!nearest) return;
  if (!inReach(world.players[myId], nearest.point)) {
    flash.textContent = "Walk closer!";
    flashUntil = performance.now() + 900;
    return;
  }
  if (nearest.id !== FISH_ACTION) swings[myId] = {
    x: nearest.point.x,
    y: nearest.point.y,
    start: performance.now() / 1000,
  };
  axis.targetBug = nearest.id;
  axis.targetSequence++;
  connection.input(axis);
};
function fullscreen() {
  if (!document.fullscreenElement)
    document.documentElement
      .requestFullscreen?.({ navigationUI: "hide" })
      .catch(() => {});
}
document.addEventListener("pointerdown", fullscreen, { capture: true });
const accepted = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "w",
  "a",
  "s",
  "d",
]);
document.onkeydown = (e) => {
  if (jar.open) return;
  const key = e.key.toLowerCase();
  if (!accepted.has(key)) return;
  e.preventDefault();
  if (!e.repeat) {
    fullscreen();
    keys.add(key);
    recalc();
  }
};
document.onkeyup = (e) => {
  if (keys.delete(e.key.toLowerCase())) recalc();
};
window.onblur = () => {
  keys.clear();
  release();
};
document.oncontextmenu = document.ondblclick = (e) => e.preventDefault();
for (const event of [
  "gesturestart",
  "gesturechange",
  "gestureend",
  "selectstart",
  "dragstart",
])
  document.addEventListener(event, (e) => e.preventDefault(), {
    passive: false,
  });
document.addEventListener("touchmove", (e) => e.preventDefault(), {
  passive: false,
});
document.addEventListener("wheel", (e) => e.preventDefault(), {
  passive: false,
});
function resize() {
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  const scale = Math.max(1, Math.min(w, h) / 155, Math.max(w, h) / 405);
  canvas.width = Math.round(w / scale);
  canvas.height = Math.round(h / scale);
}
new ResizeObserver(resize).observe(canvas);
resize();
let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.08, (now - previous) / 1000);
  previous = now;
  if (!online) {
    // A personal meadow is playable immediately, including while signaling is unavailable.
    // Detach from the last network-owned object before advancing an offline frame.
    if (snapshotTime) {
      world = structuredClone(world);
      snapshotTime = 0;
    }
    stepWorld(world, dt, { [myId]: axis });
  }
  const player = world.players[myId];
  if (player) {
    movePlayer(camera, dt, axis);
    const target = { ...player };
    if (online)
      movePlayer(target, Math.min(0.1, (now - snapshotTime) / 1000), axis);
    const blend = 1 - Math.exp(-12 * dt);
    camera.x += (target.x - camera.x) * blend;
    camera.y += (target.y - camera.y) * blend;
    camera.angle += angleDelta(target.angle, camera.angle) * blend;
    for (const [id, other] of Object.entries(world.players)) {
      if (id === myId) continue;
      const pose = (remote[id] ??= { ...other });
      pose.x += (other.x - pose.x) * blend;
      pose.y += (other.y - pose.y) * blend;
      pose.angle += angleDelta(other.angle, pose.angle) * blend;
    }
    for (const id of Object.keys(remote))
      if (!world.players[id]) delete remote[id];
    for (const [key, p] of Object.entries(world.players)) {
      if (
        key !== myId &&
        p.swing &&
        seenSwings.has(key) &&
        seenSwings.get(key) !== p.swing
      )
        swings[key] = { x: p.swingX, y: p.swingY, start: now / 1000 };
      seenSwings.set(key, p.swing || 0);
    }
    for (const key of seenSwings.keys())
      if (!world.players[key]) {
        seenSwings.delete(key);
        delete swings[key];
      }
    targets = paint(
      ctx,
      { ...world, players: Object.fromEntries(Object.entries(world.players).map(([id, p]) =>
        [id, { ...(id === myId ? camera : remote[id]), castUntil: p.castUntil }])) },
      myId,
      camera,
      now / 1000,
      Math.abs(axis.forward) > 0.1,
      swings,
    );
  }
  if (world.caught > priorCount) {
    flash.textContent = "✦ +" + (world.caught - priorCount) + " ✦";
    flashUntil = now + 850;
  }
  priorCount = world.caught;
  if (world.fish > priorFish) {
    flash.textContent = "Caught a fish!";
    flashUntil = now + 1300;
  }
  priorFish = world.fish;
  if (jar.open) showCollection(now / 1000);
  if (now > flashUntil && flash.textContent) flash.textContent = "";
  if (count.textContent !== String(world.caught))
    count.textContent = String(world.caught);
  const total = String(Object.keys(world.players).length);
  if (friends.textContent !== total) friends.textContent = total;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener("pagehide", (e) => {
  if (!e.persisted) connection.close();
});
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});
