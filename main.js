import { createGame, step, act, attack } from "./game.js";
import { paint } from "./art.js";
import { createParty, updateParty, viewParty } from "./coop.js";
import { openPairing } from "./pairing.js";
const solo = createGame();
let g = solo;
const canvas = document.querySelector("canvas"),
  ctx = canvas.getContext("2d");
const el = (id) => document.getElementById(id),
  keys = new Set();
try {
  const record = JSON.parse(localStorage.getItem("bug-city-colony")) || {};
  const stash = record.stash ?? Number(localStorage.getItem("bug-city-stash"));
  if (Number.isSafeInteger(stash) && stash >= 0) g.stash = stash;
  if (Number.isSafeInteger(record.crowns) && record.crowns >= 0)
    g.crowns = record.crowns;
} catch {}
let saved = g.stash,
  previous = performance.now(),
  stick = null,
  aim = null,
  sx = 0,
  sy = 0;
let session = null;
let queued = {};
let peerInput = {};
let sentAt = 0;
let receivedAt = 0;
el("partyButton").onclick = () => {
  if (session) {
    session.link.close();
    endSession("Co-op ended. Returned to your solo colony.");
    return;
  }
  openPairing({
    ready(link, host) {
      const party = host ? createParty() : null;
      session = { link, party, host, banked: 0, crowns: 0 };
      queued = {};
      peerInput = {};
      receivedAt = performance.now();
      sentAt = 0;
      if (host) g = viewParty(party, 0);
      set("partyButton", "Leave co-op");
    },
    receive(msg) {
      if (!session || !msg || typeof msg !== "object") return;
      if (session.host && msg.type === "input") {
        const axis = (n) =>
          Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
        peerInput = {
          dx: axis(msg.dx),
          dy: axis(msg.dy),
          attack: peerInput.attack || msg.attack === true,
          action: peerInput.action || msg.action === true,
          aimX: axis(msg.aimX),
          aimY: axis(msg.aimY),
        };
        receivedAt = performance.now();
      } else if (
        !session.host &&
        msg.type === "view" &&
        ["run", "home"].includes(msg.state?.scene) &&
        msg.state.player &&
        Array.isArray(msg.state.enemies) &&
        Array.isArray(msg.state.loot) &&
        (msg.state.scene === "home" || msg.state.exit)
      ) {
        g = msg.state;
      }
    },
    closed: endSession,
    fullscreen,
  });
};
function endSession(reason) {
  session = null;
  queued = {};
  peerInput = {};
  g = solo;
  g.message = reason;
  set("partyButton", "Play with a friend");
}
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
  if (session) {
    const length = Math.hypot(dx, dy) || 1;
    Object.assign(queued, {
      attack: true,
      aimX: dx / length,
      aimY: dy / length,
    });
  } else attack(g, dx, dy);
}
function set(id, value) {
  if (el(id).textContent !== value) el(id).textContent = value;
}
function frame(now) {
  const dt = (now - previous) / 1000;
  previous = now;
  const dx =
    sx +
    Number(keys.has("d") || keys.has("arrowright")) -
    Number(keys.has("a") || keys.has("arrowleft"));
  const dy =
    sy +
    Number(keys.has("s") || keys.has("arrowdown")) -
    Number(keys.has("w") || keys.has("arrowup"));
  if (!session) step(g, dt, dx, dy);
  else {
    const input = { dx, dy, ...queued };
    if (session.host) {
      updateParty(session.party, dt, [
        input,
        now - receivedAt < 500 ? peerInput : {},
      ]);
      peerInput.attack = peerInput.action = false;
      queued = {};
      g = viewParty(session.party, 0);
      if (now - sentAt >= 50) {
        session.link.send({ type: "view", state: viewParty(session.party, 1) });
        sentAt = now;
      }
    } else if (now - sentAt >= 50 || queued.attack || queued.action) {
      if (session.link.send({ type: "input", ...input })) queued = {};
      sentAt = now;
    }
  }
  paint(ctx, g, now / 1000);
  const home = g.scene === "home";
  set("place", home ? "Lantern Hollow" : "The Rustway");
  set("sector", home ? "COLONY" : "EXPEDITION");
  set(
    "safe",
    session
      ? "●  Co-op · " + (session.host ? "Host" : "Guest")
      : home
        ? "●  Safe zone"
        : "◆  Hostile zone",
  );
  set(
    "brief",
    home
      ? "Venture beyond the colony, gather salvage, and reach the eastern beacon to bring it home."
      : "Extract at the eastern beacon. For a richer haul, seek the Copper Stag in the northeast grove.",
  );
  document.body.classList.toggle("expedition", !home);
  const distance = home
    ? 0
    : Math.hypot(g.player.x - g.exit.x, g.player.y - g.exit.y);
  el("action").disabled = !home && (distance > 14 || g.extracting > 0);
  set(
    "action",
    home
      ? "Enter expedition  →"
      : g.extracting > 0
        ? "Hold position · " + g.extracting.toFixed(1) + "s"
        : distance <= 14
          ? "Extract now  [E]"
          : "Reach EXIT · " + Math.ceil(distance) + " px",
  );
  set("log", g.message);
  set("hp", g.player.hp + " / 5");
  set("bag", g.carried + " salvage");
  set("stash", g.stash + " salvage");
  el("trophy").hidden = !home || !g.crowns;
  set("crowns", String(g.crowns));
  if (
    session &&
    g !== solo &&
    g.scene === "home" &&
    Number.isSafeInteger(g.stash) &&
    g.stash > session.banked
  ) {
    solo.stash += g.stash - session.banked;
    session.banked = g.stash;
    if (Number.isSafeInteger(g.crowns) && g.crowns > session.crowns) {
      solo.crowns += g.crowns - session.crowns;
      session.crowns = g.crowns;
    }
  }
  if (saved !== solo.stash) {
    try {
      localStorage.setItem(
        "bug-city-colony",
        JSON.stringify({ stash: solo.stash, crowns: solo.crowns }),
      );
    } catch {}
    saved = solo.stash;
  }
  requestAnimationFrame(frame);
}
function fullscreen() {
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen?.().catch(() => {});
}
function interact() {
  if (g.scene === "home") fullscreen();
  if (session) queued.action = true;
  else act(g);
}
el("action").onclick = interact;
window.onkeydown = (e) => {
  if (el("partyDialog").open) return;
  const k = e.key.toLowerCase();
  if (k === " " && e.target.tagName === "BUTTON") return;
  if ([" ", "arrowup", "arrowdown", "arrowright", "arrowleft"].includes(k))
    e.preventDefault();
  keys.add(k);
  if (!e.repeat && k === "e") interact();
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
