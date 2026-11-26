import {
  residentPose,
  drawBottle,
  insect,
  ellipse,
  line,
} from "./field-art.js";

const dialog = document.querySelector("#transfer");
const canvas = dialog.querySelector("canvas");
const g = canvas.getContext("2d");
const status = dialog.querySelector("[role=status]");
const clamp = (n) => Math.min(1, Math.max(0, n));
const ease = (n) => 1 - Math.pow(1 - clamp(n), 3);
let catchScene = null,
  gesture = null;

function words(text) {
  if (status.textContent !== text) status.textContent = text;
}
function fillPath(path, color) {
  g.fillStyle = color;
  g.fill(new Path2D(path));
}
function forestLight(t) {
  const light = g.createRadialGradient(170, 65, 15, 210, 160, 285);
  light.addColorStop(0, "#b0bd83");
  light.addColorStop(0.47, "#617e62");
  light.addColorStop(1, "#233f39");
  g.fillStyle = light;
  g.fillRect(0, 0, 400, 320);
  for (let i = 0; i < 24; i++) {
    const x = (i * 79) % 411,
      y = (i * 31) % 310;
    ellipse(
      g,
      x + Math.sin(t * 0.5 + i) * 2,
      y,
      5 + (i % 13),
      4 + (i % 10),
      i % 3 ? "#eee3a818" : "#273f3317",
    );
  }
}
function hand(coat, front) {
  if (!front) {
    // Palm cradles the bottom, sleeve follows the wrist out of frame.
    fillPath(
      "M-10 248 Q22 234 46 218 Q72 199 93 185 Q113 170 131 173 L183 194 Q201 209 193 223 Q177 240 147 241 Q112 243 83 262 L29 301 L-8 291 Z",
      "#a56e51",
    );
    fillPath(
      "M-7 242 Q36 222 74 194 Q99 171 122 169 Q143 166 155 184 L181 202 Q187 215 169 226 Q133 232 104 240 Q78 249 44 277 L5 298 Z",
      "#d79e73",
    );
    fillPath("M-6 226 Q20 216 46 201 Q72 208 81 242 Q43 269 2 309 Z", coat);
    line(g, 46, 205, 75, 242, 4, "#f1d4a4");
    return;
  }
  // Thumb rests on the near face; fingertips curl around the far edge.
  fillPath(
    "M65 201 Q77 181 84 162 Q90 143 103 138 Q112 135 116 143 Q119 149 111 164 L104 185 Q98 206 84 218 Z",
    "#c58b66",
  );
  fillPath(
    "M70 199 Q82 175 89 155 Q97 139 105 140 Q113 140 112 147 Q110 154 103 166 L96 190 Q88 207 78 211 Z",
    "#e1ad80",
  );
  ellipse(g, 105, 148, 4, 7, "#edc5a3", 0.49);
  for (let j = 0; j < 3; j++) {
    const x = 221 - j * 2,
      y = 160 + j * 15;
    ellipse(g, x, y, 10 - j, 6.2, "#a36e55", -0.28);
    ellipse(g, x - 1, y - 1, 8.8 - j, 5.1, "#dcaa80", -0.28);
  }
}
function net(x, y, angle, scale) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.scale(scale, scale);
  line(g, 15, -4, 95, 39, 6, "#76563a");
  line(g, 15, -5, 95, 37, 2, "#dfb77f");
  const pouch = new Path2D("M-25 -8 Q-22 9 -10 25 Q3 38 16 22 Q25 8 25 -8 Z");
  g.fillStyle = "#e5f1d65e";
  g.fill(pouch);
  g.save();
  g.clip(pouch);
  for (let i = -60; i < 60; i += 7) {
    line(g, i, -12, i + 36, 38, 1, "#d9f0dcbb");
    line(g, i, -12, i - 36, 38, 1, "#c9ded2aa");
  }
  g.restore();
  g.strokeStyle = "#e6e9c9";
  g.lineWidth = 1.5;
  g.stroke(pouch);
  ellipse(g, 0, -8, 25, 7, "#78988566");
  g.lineWidth = 3;
  g.strokeStyle = "#b69361";
  g.stroke();
  g.lineWidth = 1;
  g.strokeStyle = "#fff1c6";
  g.stroke();
  g.restore();
}
function chevrons(x, y, t, color) {
  for (let i = 0; i < 2; i++) {
    const yy = y + i * 9 + Math.sin(t * 4) * 2;
    g.lineWidth = 3;
    g.strokeStyle = color;
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(x - 6, yy - 3);
    g.lineTo(x, yy + 2);
    g.lineTo(x + 6, yy - 3);
    g.stroke();
  }
}
export function openTransfer({
  kind,
  residents,
  coat,
  stow,
  escape,
  resume = false,
}) {
  catchScene = {
    kind,
    residents,
    coat,
    stow,
    escape,
    time: resume ? 1.4 : 0,
    last: performance.now(),
    drop: null,
    attemptAt:
      residents.length && Math.random() < 0.16
        ? 1.4 + 5 + Math.random() * 10
        : Infinity,
    climber: null,
    savedAt: null,
  };
  words(resume ? "Swipe down to tuck it in." : "Got you, " + kind + "!");
  dialog.showModal();
  canvas.focus({ preventScroll: true });
}
function residentPosition(s) {
  const c = s.climber;
  if (!c) return null;
  const age = s.time - c.start;
  const climb = ease(age / 2.5);
  const home = residentPose(c.idx, s.time),
    start = residentPose(c.idx, c.start);
  if (c.returnAt !== undefined) {
    const fall = clamp((s.time - c.returnAt) / 0.48);
    return {
      x: c.returnFrom.x + (home.x + 50 - c.returnFrom.x) * fall,
      y: c.returnFrom.y + (home.y + 80 - c.returnFrom.y) * fall * fall,
    };
  }
  const fly = ease((age - 6) / 1.25);
  return {
    x:
      start.x +
      50 +
      (155 - start.x - 50) * climb +
      Math.sin(age * 4) * 1.8 -
      150 * fly,
    y: start.y + 80 + (116 - start.y - 80) * climb - 135 * fly,
  };
}
function handleSwipe(rescue) {
  const s = catchScene;
  if (!s || s.time < 1.12 || s.drop !== null) return;
  if (rescue && s.climber && s.climber.returnAt === undefined) {
    s.climber.returnFrom = residentPosition(s);
    s.climber.returnAt = s.time;
    s.savedAt = s.time;
    words("Back on the moss!");
    return;
  }
  s.drop = s.time;
  if (s.climber && s.climber.returnAt === undefined) {
    s.climber.returnFrom = residentPosition(s);
    s.climber.returnAt = s.time;
  }
  s.stow();
  words("In you go!");
}
function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * 400) / r.width,
    y: ((e.clientY - r.top) * 320) / r.height,
  };
}
canvas.onpointerdown = (e) => {
  if (gesture || !catchScene || e.button !== 0) return;
  const p = point(e),
    bug = residentPosition(catchScene);
  const rescue =
    bug &&
    catchScene.climber.returnAt === undefined &&
    Math.hypot(p.x - bug.x, p.y - bug.y) < 34;
  gesture = { id: e.pointerId, ...p, rescue };
  canvas.setPointerCapture(e.pointerId);
};
function swipe(e) {
  if (gesture?.id !== e.pointerId) return;
  const p = point(e),
    dy = p.y - gesture.y;
  if (dy > 20 && dy > Math.abs(p.x - gesture.x) * 0.7) {
    const rescue = gesture.rescue;
    gesture = null;
    handleSwipe(rescue);
  }
}
canvas.onpointermove = swipe;
canvas.onpointerup = (e) => {
  swipe(e);
  if (gesture?.id === e.pointerId) gesture = null;
};
canvas.onlostpointercapture = canvas.onpointercancel = (e) => {
  if (gesture?.id === e.pointerId) gesture = null;
};
dialog.oncancel = (e) => e.preventDefault();
dialog.onkeydown = (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!e.repeat)
      handleSwipe(
        catchScene?.climber?.returnAt === undefined && !!catchScene?.climber,
      );
  }
};
export function drawTransfer(now) {
  const s = catchScene;
  if (!s) return;
  // Backgrounding the tab pauses a climbing bug, including the lip warning.
  s.time += Math.max(0, Math.min(0.1, (now - s.last) / 1000));
  s.last = now;
  const t = s.time;
  if (t >= s.attemptAt && s.drop === null) {
    s.attemptAt = Infinity;
    const idx = Math.floor(Math.random() * s.residents.length);
    s.climber = { idx, kind: s.residents[idx], start: t };
    s.residents[idx] = null;
    words("Look! A bug is climbing the glass.");
  }
  const c = s.climber;
  if (c) {
    if (c.returnAt !== undefined) {
      if (t - c.returnAt > 0.5) {
        s.residents[c.idx] = c.kind;
        s.climber = null;
      }
    } else if (t - c.start >= 7.25) {
      s.escape(c.kind);
      s.climber = null;
      s.savedAt = t;
      words("It fluttered back to the forest.");
    } else if (t - c.start >= 2.45) words("At the rim! Swipe that bug down.");
  }
  if (
    t >= 1.12 &&
    s.drop === null &&
    !s.climber &&
    (s.savedAt === null || t - s.savedAt > 1)
  )
    words("Swipe down to tuck your " + s.kind + " in.");
  const dropped = s.drop === null ? 0 : t - s.drop;
  const lift = ease((t - 0.48) / 0.72),
    lid = ease((dropped - 0.78) / 0.5);
  g.save();
  g.scale(canvas.width / 400, canvas.height / 320);
  forestLight(t);
  g.save();
  g.translate(50, 80 + (1 - lift) * 264);
  hand(s.coat, false);
  drawBottle(g, s.residents, t, lid);
  hand(s.coat, true);
  g.restore();
  if (s.climber) {
    const p = residentPosition(s);
    if (s.climber.returnAt === undefined) {
      g.strokeStyle = "#fff1a7";
      g.lineWidth = 1.7;
      g.beginPath();
      g.arc(p.x, p.y, 13 + Math.sin(t * 6) * 2, 0, Math.PI * 2);
      g.stroke();
      if (t - s.climber.start > 2.45) {
        g.fillStyle = "#fff3b3";
        g.font = "bold 20px Georgia";
        g.fillText("!", p.x - 20, p.y - 7);
      }
    }
    insect(g, p.x, p.y, s.climber.kind, t, 1.15);
  }
  const sweep = ease(t / 0.65);
  const nx = 12 + 190 * sweep + 95 * ease(dropped / 0.48),
    ny = 122 - 85 * Math.sin(sweep * Math.PI * 0.6) - 60 * ease(dropped / 0.48);
  if (t < 0.62)
    for (let j = 0; j < 3; j++) {
      g.strokeStyle = "#ffefba99";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(nx - 66, ny + 10 + j * 6);
      g.quadraticCurveTo(nx - 40, ny - 7 + j * 4, nx - 13, ny + j * 4);
      g.stroke();
    }
  net(nx, ny, 0.8 * (1 - sweep) - 0.16, 1.18);
  const fall = clamp(dropped / 0.72),
    settle =
      fall === 1
        ? Math.sin(Math.min(1, (dropped - 0.72) / 0.22) * Math.PI) * 5
        : 0;
  const by = (t < 0.38 ? 76 : 68) + fall * fall * 185 - settle;
  insect(g, 199 + Math.sin(t * 3) * 3, by, s.kind, t, 1.75 - fall * 0.52);
  if (t > 1.12 && s.drop === null) chevrons(200, 89, t, "#fff2b4");
  g.restore();
  if (dropped > 1.7) {
    catchScene = null;
    gesture = null;
    dialog.close();
  }
}
