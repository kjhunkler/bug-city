import { openHunt, drawEncounter } from "./encounter.js";
import { jarScene } from "./field-art.js";
import { createWorld, addPlayer, stepWorld, movePlayer, inReach, BUG_KINDS, FISH_ACTION } from "./meadow.js";
import { drawJar, drawBug } from "./art.js";
import { connectGarden } from "./garden-net.js";
import { connectPages } from "./pages-net.js";

import { paint, placeName } from "./forest.js";
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

const coats = {"Clay":"#dd7956","Honey":"#e7b948","Fern":"#73ab65","Lake":"#579ac1","Berry":"#ba78a1","Lilac":"#aa95d6"};
let coat;
try { coat=localStorage.getItem("forest-coat"); } catch {}
axis.coat=Object.values(coats).includes(coat)?coat:coats.Clay;
connection.input(axis);
const wardrobe=document.querySelector("#wardrobe");
for(const [name,value] of Object.entries(coats)){
  const btn=document.createElement("button");btn.style.background=value;btn.ariaLabel=name;
  btn.onclick=()=>{axis.coat=value;connection.input(axis);try{localStorage.setItem("forest-coat",value)}catch{} wardrobe.close();};
  document.querySelector("#swatches").append(btn);
}
document.querySelector("#outfit").onclick=()=>{keys.clear();release();wardrobe.showModal()};
document.querySelector("#done-coat").onclick=()=>wardrobe.close();
let originX=0,originY=0,dragged=false;
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
canvas.addEventListener("pointerdown", e=>{
  if(e.button!==0||pointer!==null||e.clientY<canvas.clientHeight*.45)return;
  originX=e.clientX;originY=e.clientY;dragged=false;pointer=e.pointerId;
  canvas.setPointerCapture(pointer);
  stick.style.left=originX+"px";stick.style.top=originY+"px";stick.hidden=false;
});
canvas.onpointermove=e=>{
  if(pointer!==e.pointerId)return;
  const dx=e.clientX-originX,dy=e.clientY-originY;
  if(Math.hypot(dx,dy)>8)dragged=true;
  stickX=dx/45;stickY=dy/45;recalc();
};
function release() {
  pointer=null;stick.hidden=true;stickX=stickY=0;recalc();
}
canvas.onpointercancel=release;
canvas.onlostpointercapture=()=>{if(pointer!==null)release()};
const jar = document.querySelector("#collection");
const glass = document.querySelector("#glass").getContext("2d");
const label = document.querySelector("#jar-label");
const prev = document.querySelector("#prev"), next = document.querySelector("#next");
const perPage = 24;
let page = 0, pendingFind=null;
const journalKey="bug-city-field-journal-v1";
let journal={bugs:{}, fish:[], keepsakes:[]};
try{const saved=JSON.parse(localStorage.getItem(journalKey));if(saved&&saved.bugs&&Array.isArray(saved.fish)&&Array.isArray(saved.keepsakes))journal=saved;}catch{}
function saveJournal(){try{localStorage.setItem(journalKey,JSON.stringify(journal))}catch{}}
const bugTotal=()=>BUG_KINDS.reduce((n,k)=>n+(journal.bugs[k]||0),0);
function notify(text){flash.textContent=text;flashUntil=performance.now()+2200;}
function claim(target){axis.targetBug=target.id;axis.targetSequence++;pendingFind={id:target.id,seq:axis.targetSequence,seed:world.seed,owner:myId};connection.input(axis);}

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
  const total=bugTotal();
  page=Math.max(0,Math.min(page,Math.ceil(total/perPage)-1));
  const start=page*perPage, kinds=[];
  let offset=0;
  for(const kind of BUG_KINDS){
    const stop=offset+(journal.bugs[kind]||0);
    for(let i=Math.max(offset,start);i<Math.min(stop,start+perPage);i++)kinds.push(kind);
    offset=stop;
  }
  jarScene(glass,kinds,time);
  label.textContent=total ? total+" bug"+(total===1?"":"s")+" · "+Object.keys(journal.bugs).length+" species" : "Your first discovery is out there.";
  prev.disabled=page===0;next.disabled=start+perPage>=total;
}
// Hit-test the last painted sprites so steering and screen rotation use the same projection.
canvas.onpointerup = (e) => {
  if(pointer!==null && e.pointerId!==pointer)return;
  const moved=pointer!==null&&dragged;release();if(moved)return;
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
  if(nearest.id!==FISH_ACTION){keys.clear();release();openHunt(nearest,claim);return;}
  axis.targetBug=nearest.id;axis.targetSequence++;connection.input(axis);
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
  if (document.querySelector('dialog[open]')) return;
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
  const scale = Math.max(1, Math.min(w, h) / 450, Math.max(w, h) / 880);
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
    const place=document.querySelector('#place');if(place.textContent!==placeName(camera))place.textContent=placeName(camera);
    targets = paint(
      ctx,
      { ...world, players: Object.fromEntries(Object.entries(world.players).map(([id, p]) =>
        [id, { ...(id === myId ? camera : remote[id]), coat: id===myId ? axis.coat : p.coat, castUntil: p.castUntil }])) },
      myId,
      camera,
      now / 1000,
      Math.abs(axis.forward) > 0.1,
      swings,
    );
  }
  if(pendingFind){
    const find=player?.find;
    if(pendingFind.seed!==world.seed||pendingFind.owner!==myId)pendingFind=null;
    else if(find?.id===pendingFind.id&&find.sequence===pendingFind.seq){
      const fresh=!journal.bugs[find.kind];journal.bugs[find.kind]=(journal.bugs[find.kind]||0)+1;
      saveJournal();notify((fresh?"First ":"Caught a ")+find.kind+"!");pendingFind=null;
    }else if(!world.bugs.some(b=>b.id===pendingFind.id)){notify("It slipped away!");pendingFind=null;}
  }
  drawEncounter(now);
  if (world.fish > priorFish) {
    flash.textContent = "Caught a fish!";
    flashUntil = now + 1300;
  }
  priorFish = world.fish;
  if (jar.open) showCollection(now / 1000);
  if (now > flashUntil && flash.textContent) flash.textContent = "";
  if (count.textContent !== String(bugTotal()))
    count.textContent = String(bugTotal());
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
