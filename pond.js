import { ellipse, line } from "./field-art.js";
import { FISH_ACTION, REEL_ACTION } from "./meadow.js";
const panel = document.querySelector("#pond"),
  canvas = panel.querySelector("canvas"),
  g = canvas.getContext("2d");
const hint = panel.querySelector("p"),
  button = panel.querySelector(".scene-action");
let session;
function prompt(text, verb) {
  if (hint.textContent !== text) hint.textContent = text;
  if (button.textContent !== verb) button.textContent = verb;
}
export function openPond(send, keep) {
  session = { send, keep, phase: "shore", result: null, x: 208, y: 119 };
  prompt("Watch the shadows. Tap the water to cast.", "Cast a line");
  panel.showModal();
}
function tap(e) {
  if (!session) return;
  if (["shore", "result"].includes(session.phase)) {
    if (e.currentTarget === canvas) {
      const r = canvas.getBoundingClientRect();
      session.x = Math.max(
        90,
        Math.min(304, ((e.clientX - r.left) * 400) / r.width),
      );
      session.y = Math.max(
        67,
        Math.min(169, ((e.clientY - r.top) * 240) / r.height),
      );
    }
    session.result = null;
    session.sequence = session.send(FISH_ACTION);
    session.phase = "casting";
    session.sentAt = performance.now();
    prompt("The float lands softly.", "Watch the float");
  } else if (session.phase === "tug") {
    session.sequence = session.send(REEL_ACTION);
    session.phase = "reeling";
    session.sentAt = performance.now();
  }
}
button.onclick = tap;
canvas.onclick = tap;
panel.querySelector(".scene-close").onclick = () => panel.close();
panel.onclose = () => {
  session = null;
};
function silhouette(x, y, heading, size, color) {
  g.save();
  g.translate(x, y);
  g.rotate(heading);
  g.scale(size, size);
  ellipse(g, 0, 0, 13, 4.5, color);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-9, 0);
  g.lineTo(-19, -5);
  g.lineTo(-18, 5);
  g.closePath();
  g.fill();
  g.restore();
}
export function drawPond(now, world, player) {
  if (!session || !panel.open) return;
  const s = session,
    t = now / 1000;
  if (
    s.phase === "casting" &&
    player?.castSeq === s.sequence &&
    player.castUntil
  ) {
    s.phase = "waiting";
  }
  if (s.phase === "reeling" && player?.landing?.sequence === s.sequence) {
    s.result = player.landing;
    s.phase = "result";
    if (s.result.name) s.keep(s.result);
    prompt(
      s.result.name
        ? s.result.cm
          ? s.result.name + " · " + s.result.cm + " cm. Released into the pond."
          : "A " + s.result.name + " for your collection!"
        : "It swam away. Watch for the next tug.",
      "Cast again",
    );
  }
  if (["waiting", "tug"].includes(s.phase)) {
    if (!player?.castUntil || world.time >= player.castUntil) {
      s.phase = "result";
      prompt(
        "The pond goes quiet. There are more shadows below.",
        "Cast again",
      );
    } else if (world.time >= player.biteAt) {
      s.phase = "tug";
      prompt("Tug! Tap anywhere on the pond!", "Pull!");
    } else prompt("A shadow is turning toward your float…", "Watch the float");
  }
  if (["casting", "reeling"].includes(s.phase) && now - s.sentAt > 4500) {
    s.phase = "result";
    prompt("The line came back empty.", "Cast again");
  }
  const water = g.createRadialGradient(202, 113, 10, 200, 114, 228);
  water.addColorStop(0, "#2a585e");
  water.addColorStop(0.66, "#478d88");
  water.addColorStop(0.88, "#82aa8c");
  water.addColorStop(1, "#a4ad79");
  g.fillStyle = water;
  g.fillRect(0, 0, 400, 240);
  for (let i = 0; i < 62; i++) {
    const x = (i * 77 + Math.sin(t * 0.6 + i) * 4) % 400,
      y = (i * 49) % 240;
    ellipse(g, x, y, 3 + (i % 9), 0.65, i % 3 ? "#ffffff20" : "#102f3d18");
  }
  for (let i = 0; i < 21; i++) {
    const x = i % 2 ? (i * 41) % 92 : 342 + ((i * 17) % 62),
      y = (i * 69) % 240,
      r = 5 + (i % 8);
    ellipse(g, x + 2, y + 3, r, r * 0.53, "#344d4e55");
    g.fillStyle = i % 2 ? "#80995f" : "#a2af70";
    g.beginPath();
    g.moveTo(x, y);
    g.ellipse(x, y, r, r * 0.6, -0.18, 0.45, 6.05);
    g.closePath();
    g.fill();
    line(g, x - 1, y, x - r * 0.6, y - r * 0.16, 0.8, "#c9cb90");
    if (i % 7 === 0)
      for (let j = 0; j < 5; j++)
        ellipse(
          g,
          x + Math.cos(j * 1.26) * 3,
          y + Math.sin(j * 1.26) * 2,
          3,
          1.7,
          "#f1dbc7",
          j * 1.26,
        );
  }
  const fishing = ["waiting", "tug", "reeling", "casting"].includes(s.phase);
  for (let i = 0; i < 4; i++) {
    const a = t * (0.22 + i * 0.035) + i * 2;
    let x = 195 + Math.sin(a) * 110,
      y = 117 + Math.cos(a * 1.3 + i) * 48;
    const k =
      i === 0 && fishing && player?.castUntil
        ? Math.min(1, Math.max(0, 1 - (player.biteAt - world.time) / 3))
        : 0;
    x = x * (1 - k) + s.x * k;
    y = y * (1 - k) + s.y * k;
    silhouette(
      x,
      y,
      Math.atan2(-Math.sin(a * 1.3 + i), Math.cos(a)),
      0.65 + i * 0.18,
      "#183f4588",
    );
  }
  if (fishing) {
    const tug = s.phase === "tug" || s.phase === "reeling";
    const x = s.x + (tug ? Math.sin(t * 14) * 2 : 0),
      y = s.y + Math.sin(t * (tug ? 12 : 2)) * (tug ? 3 : 1);
    line(g, 380, 240, x, y, 1, "#efe7c8bb");
    const ripple = ((t * (tug ? 21 : 9)) % 25) + 2;
    g.strokeStyle = tug ? "#fff5bd" : "#cbe7d4aa";
    g.lineWidth = tug ? 2 : 1;
    g.beginPath();
    g.ellipse(x, y + 3, ripple, ripple * 0.35, 0, 0, Math.PI * 2);
    g.stroke();
    ellipse(g, x, y, 4, 4.3, "#fff0c6");
    ellipse(g, x, y - 1.8, 4, 3, "#db6748");
    if (tug) {
      g.fillStyle = "#fff1ba";
      g.font = "bold 22px Georgia";
      g.fillText("!", x + 8, y - 9);
    }
  }
  if (s.phase === "result" && s.result?.name) drawPrize(s.result, t);
}
function drawPrize(prize, t) {
  const x = 201,
    y = 112 + Math.sin(t * 1.8) * 2;
  if (!prize.cm) {
    const pearl = prize.name === "river pearl",
      r = pearl ? 12 : 16;
    const shine = g.createRadialGradient(x - 5, y - 6, 1, x, y, r);
    shine.addColorStop(0, "#fff5ce");
    shine.addColorStop(0.5, pearl ? "#cecfd1" : "#bd9a54");
    shine.addColorStop(1, pearl ? "#81979a" : "#7e6037");
    ellipse(g, x, y, r, r, shine);
    if (!pearl)
      for (const dx of [-4, 4])
        for (const dy of [-4, 4])
          ellipse(g, x + dx, y + dy, 1.8, 1.8, "#55452f");
    return;
  }
  g.save();
  g.translate(x, y);
  g.rotate(-0.09);
  const sun = prize.name === "Sunfish",
    trout = prize.name === "Speckled trout",
    carp = prize.name === "Moon carp";
  const len = 28 + prize.cm * 0.39,
    ht = len * (sun ? 0.53 : carp ? 0.41 : 0.3);
  const fin = carp ? "#be9566" : sun ? "#be8e56" : "#81978a";
  g.fillStyle = fin;
  g.beginPath();
  g.moveTo(-len * 0.72, 0);
  g.lineTo(-len * 1.24, -ht * 0.76);
  g.quadraticCurveTo(-len * 1.1, 0, -len * 1.24, ht * 0.8);
  g.closePath();
  g.fill();
  ellipse(g, -len * 0.14, -ht * 0.68, len * 0.4, ht * 0.37, fin, -0.14);
  const scales = g.createLinearGradient(0, -ht, 0, ht);
  scales.addColorStop(
    0,
    carp ? "#596c56" : trout ? "#5c786b" : sun ? "#607b65" : "#587e7f",
  );
  scales.addColorStop(
    0.55,
    carp ? "#bda867" : trout ? "#c39889" : sun ? "#ddaa5b" : "#bad0bc",
  );
  scales.addColorStop(1, "#e0d7ad");
  ellipse(g, 0, 0, len, ht, scales);
  for (let i = 0; i < 22; i++) {
    const px = (((i * 13) % 100) / 100 - 0.55) * len * 1.5,
      py = Math.sin(i * 3.8) * 0.56 * ht;
    ellipse(
      g,
      px,
      py,
      trout ? 1.6 : 1.3,
      trout ? 1.6 : 0.7,
      trout ? "#504e42" : "#f1dda88f",
    );
  }
  ellipse(g, len * 0.13, ht * 0.38, len * 0.24, ht * 0.2, fin, -0.3);
  ellipse(g, len * 0.68, -ht * 0.23, 3, 3, "#e7d79c");
  ellipse(g, len * 0.69, -ht * 0.23, 1.7, 1.7, "#263c36");
  g.restore();
}
