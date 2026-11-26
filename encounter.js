import { cover } from "./forest.js";
import { insect, ellipse, line } from "./field-art.js";

const dialog = document.querySelector("#encounter"),
  canvas = dialog.querySelector("canvas"),
  g = canvas.getContext("2d");
const caption = dialog.querySelector("p"),
  title = dialog.querySelector("h2"),
  action = dialog.querySelector(".scene-action");
let scene = null;
const notes = {
  ladybug: "Count the spots on its scarlet wings.",
  bee: "Its fuzzy legs carry golden pollen.",
  firefly: "A tiny lantern blinks in the shade.",
  caterpillar: "Watch its feet move like a little wave.",
  butterfly: "Its patterned wings open in the light.",
  dragonfly: "Four glassy wings catch the light.",
};
function woodland(s, t) {
  const grad = g.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, "#45685c");
  grad.addColorStop(0.48, "#69815e");
  grad.addColorStop(1, "#8f7955");
  g.fillStyle = grad;
  g.fillRect(0, 0, 400, 240);
  for (let i = 0; i < 45; i++) {
    const x = (i * 79 + 13) % 416,
      y = (i * 41 + 23) % 240;
    ellipse(
      g,
      x,
      y,
      4 + (i % 8),
      1 + (i % 4),
      i % 2 ? "#acb37b77" : "#3c564b66",
      Math.sin(i),
    );
  }
  for (let i = 0; i < 15; i++) {
    const x = i % 2 ? i * 5 : 400 - i * 5,
      y = 240 - (i % 4) * 13;
    line(g, x, y, x - 10, y - 68, 2, "#52704b");
    for (let j = 0; j < 7; j++)
      ellipse(
        g,
        x - 1 - j * 1.5,
        y - j * 9,
        10 - j * 0.7,
        3,
        "#6f945c",
        j % 2 ? 0.55 : -0.55,
      );
  }
  ellipse(g, 205, 159, 76, 22, "#514c39");
  if (s.target.id)
    insect(
      g,
      198 + Math.sin(t) * 10,
      146 + Math.cos(t * 0.5) * 3,
      s.target.point.kind,
      t,
      2.9,
    );
  else {
    for (let i = 0; i < 6; i++)
      ellipse(g, 171 + i * 10, 147 + Math.sin(i) * 4, 2.5, 1.6, "#c1b58e");
  }
  const reveal = Math.min(1, t / 1.15);
  g.save();
  g.translate(200 + reveal * 72, 158 - reveal * 30);
  g.scale(4, 4);
  cover(g, s.target.point.cover, -reveal * 0.85);
  g.restore();
}
export function openHunt(target, claim) {
  scene = { target, claim, start: performance.now() };
  title.textContent =
    target.point.cover === "stone" ? "Under the moss stone" : "Inside the fern";
  caption.textContent = "Look closely…";
  action.textContent = "Look closer";
  dialog.showModal();
}
export function drawEncounter(now) {
  if (!dialog.open || !scene) return;
  const t = (now - scene.start) / 1000;
  woodland(scene, t);
  if (t > 1.15 && !scene.ready) {
    scene.ready = true;
    const kind = scene.target.point.kind;
    caption.textContent = kind
      ? notes[kind]
      : "Tiny tracks! Someone has already wandered on.";
    action.textContent = kind ? "Catch the " + kind : "Back to the trail";
  }
}
function tap() {
  if (!scene || !scene.ready) return;
  const s = scene;
  dialog.close();
  if (s.target.id) s.claim(s.target);
}
action.onclick = tap;
canvas.onclick = tap;
dialog.querySelector(".scene-close").onclick = () => dialog.close();
dialog.addEventListener("close", () => {
  scene = null;
});
