import { ellipse, line } from "./field-art.js";

export const wonders = [
  "The Lantern Stump",
  "Sleeping Fox Stone",
  "Mooncap Circle",
];
export function trail(y, seed) {
  return Math.sin(y / 95 + (seed % 5)) * 24;
}
export function landmark(band, row, seed) {
  const y = row * 320 - 100,
    index = (((row + band) % 3) + 3) % 3;
  return { x: band * 280 + trail(y, seed) + 24, y, index };
}
export function nearbyWonder(p, seed) {
  const band = Math.round(p.x / 280),
    row = Math.round((p.y + 100) / 320);
  const at = landmark(band, row, seed);
  return Math.hypot(at.x - p.x, at.y - p.y) < 48 ? wonders[at.index] : null;
}
export function drawWonder(g, index, t) {
  ellipse(g, 0, 1, 23, 5, "#314f44");
  if (index === 0) {
    const shell = new Path2D(
      "M-23 2 Q-13 -4 -12 -17 L-14 -29 L-10 -26 L-6 -32 L0 -28 L5 -33 L9 -27 L13 -30 L12 -10 Q15 -2 23 3 L9 1 L3 4 L-6 1 Z",
    );
    g.fillStyle = "#725a44";
    g.fill(shell);
    for (const x of [-10, -6, 5, 9]) line(g, x, -23, x * 0.9, -4, 1, "#a0815a");
    ellipse(g, 0, -10, 6, 10, "#433e34");
    const glow = g.createRadialGradient(0, -10, 0, 0, -10, 12);
    glow.addColorStop(0, "#ffe6a5c9");
    glow.addColorStop(1, "#ffe09400");
    ellipse(g, 0, -10, 12, 12, glow);
    for (let i = 0; i < 6; i++)
      ellipse(
        g,
        Math.cos(t * 0.8 + i * 3) * (5 + i),
        -10 + Math.sin(t + i) * 7,
        0.75,
        1,
        "#fff1a4",
      );
  } else if (index === 1) {
    ellipse(g, 0, -8, 22, 10, "#859086");
    ellipse(g, 5, -13, 11, 8, "#a5aba0");
    for (const x of [-2, 10]) {
      g.fillStyle = "#999f92";
      g.beginPath();
      g.moveTo(x, -17);
      g.lineTo(x + 2, -27);
      g.lineTo(x + 8, -16);
      g.fill();
    }
    ellipse(g, 8, -10, 5, 2.6, "#cec5a5");
    ellipse(g, 12, -10, 1.6, 1.2, "#44564e");
    line(g, 4, -14, 7, -13, 0.9, "#485a53");
    ellipse(g, -9, -15, 10, 3, "#82925f");
    ellipse(g, -8, -4, 13, 3.6, "#b4b19a", 0.11);
  } else
    for (let j = 0; j < 7; j++) {
      const a = j * 2.4,
        x = Math.sin(a) * 17,
        y = Math.cos(a) * 5,
        ht = 9 + (j % 3) * 3;
      ellipse(g, x, y - ht / 2, 1.8, ht / 2, "#d4caae");
      ellipse(g, x, y - ht, 5.3 + (j % 2), 3.1, "#c8bbd4");
      ellipse(g, x - 1.5, y - ht - 1.3, 2.6, 1, "#f0e5e6");
    }
}
