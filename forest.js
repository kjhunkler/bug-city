import { insect } from "./field-art.js";
import { landmark, drawWonder, trail as trailOffset } from "./wonders.js";
import {
  pondAt,
  POND_SPACING,
  forestRegion,
  fishingSpot,
  FISH_ACTION,
  nearestPond,
  inWater,
} from "./meadow.js";

function noise(x, y, seed) {
  let n = Math.imul(x ^ seed, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
const regions = ["Fern Hollow", "Amberwood", "Bluebell Reach"];

const palettes = [
  ["#426b55", "#193f3b", "#336353", "#547e59", "#87ad6a"],
  ["#737342", "#453f34", "#635736", "#99834b", "#caab60"],
  ["#416866", "#253c46", "#354f56", "#547571", "#85a09a"],
];
function oval(g, x, y, a, b, color, angle = 0) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, a, b, angle, 0, Math.PI * 2);
  g.fill();
}
function shape(g, points, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(...points[0]);
  for (const p of points.slice(1)) g.lineTo(...p);
  g.closePath();
  g.fill();
}
const sprites = new Map();
function shrub(n, zone) {
  const key = zone * 16 + (n % 16);
  if (sprites.has(key)) return sprites.get(key);
  const pic = document.createElement("canvas");
  pic.width = 128;
  pic.height = 168;
  const g = pic.getContext("2d"),
    pal = palettes[zone];
  const random = (i) => noise(i, key, 381) / 4294967296;
  g.translate(64, 158);
  function limb(x, y, ex, ey, width, color) {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo((x + ex) / 2 + 3, (y + ey) / 2 + 5, ex, ey);
    g.stroke();
  }
  const pine = key % 3 === 0,
    lean = (random(2) - 0.5) * 16,
    height = 103 + random(3) * 38;
  shape(
    g,
    [
      [-15, 1],
      [-5, -12],
      [-3 + lean * 0.3, -height * 0.54],
      [lean, -height * 0.82],
      [lean + 3, -height * 0.83],
      [5, -15],
      [14, 1],
      [4, -1],
    ],
    "#514b3c",
  );
  limb(1, -6, lean, -height * 0.82, 2.1, "#a59371");
  for (let j = 0; j < 14; j++) {
    const side = j % 2 ? 1 : -1,
      frac = 0.37 + j * 0.037;
    const x =
      lean * frac + side * (11 + random(j + 7) * 18) * (1 - frac * 0.45);
    const y = -height * frac;
    limb(lean * (frac - 0.15), y + 16, x, y, 2.4, "#635b46");
  }
  if (pine) {
    for (let j = 0; j < 17; j++) {
      const frac = j / 17,
        span = 41 * (1 - frac) + 4,
        base = -height * (0.29 + frac * 0.7),
        mid = lean * (0.4 + frac * 0.6);
      const pts = [[mid, base - 18]];
      for (let k = 0; k <= 14; k++) {
        const dx = (1 - k / 7) * span;
        pts.push([
          mid + dx,
          base +
            Math.abs(dx) * 0.12 +
            (k % 2 ? 5 : 0) +
            random(37 + j * 18 + k) * 4,
        ]);
      }
      shape(g, pts, pal[1 + (j % 4 === 0 ? 0 : 1)]);
      for (let k = 0; k < 8; k++) {
        const dx = (random(400 + j * 13 + k) - 0.5) * span * 1.8;
        limb(
          mid + dx,
          base - 4,
          mid + dx * 1.15 - 3,
          base + 1,
          1.5,
          j % 3 ? pal[3] : pal[2],
        );
      }
    }
  } else {
    // Each branch ends in an irregular cluster of overlapping leaf silhouettes.
    for (let j = 0; j < 27; j++) {
      const u = j / 27,
        y = -height * (0.41 + u * 0.57),
        spread = 35 * Math.sin((u * 0.77 + 0.12) * Math.PI);
      const x = lean * u + (random(j * 11 + 81) - 0.5) * spread * 2,
        rad = 11 + random(j + 95) * 10;
      const pts = [];
      for (let k = 0; k < 32; k++) {
        const angle = (k * Math.PI) / 16,
          edge = rad * (0.85 + random(j * 32 + k) * 0.32);
        pts.push([
          x + Math.cos(angle) * edge,
          y + Math.sin(angle) * edge * 0.72,
        ]);
      }
      shape(g, pts, pal[j % 5 === 0 ? 1 : 2]);
      for (let k = 0; k < 18; k++) {
        const dx = (random(161 + j * 30 + k) - 0.5) * rad * 1.5,
          dy = (random(700 + j * 20 + k) - 0.55) * rad * 0.78;
        oval(
          g,
          x + dx,
          y + dy,
          2 + random(j + k) * 2,
          1.2,
          k % 4 ? pal[3] : pal[4],
          -0.4 + random(j + k),
        );
      }
    }
  }
  sprites.set(key, pic);
  return pic;
}
export function cover(g, type, t = 0) {
  g.save();
  g.rotate(t);
  if (type === "stone") {
    shape(
      g,
      [
        [-17, 0],
        [-14, -9],
        [-4, -16],
        [9, -13],
        [17, -5],
        [13, 2],
        [-6, 4],
      ],
      "#526763",
    );
    shape(
      g,
      [
        [-14, -9],
        [-4, -16],
        [9, -13],
        [5, -8],
        [-8, -6],
      ],
      "#9aab94",
    );
    oval(g, -6, -11, 8, 3, "#7c9b58", -0.25);
  } else {
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.32,
        x = Math.sin(a) * 13,
        y = -Math.cos(a) * 9;
      oval(g, x, y, 4, 10, i % 2 ? "#5c8d54" : "#396e52", a);
      oval(g, x - 1, y - 3, 1.1, 6, "#99b96e", a);
    }
  }
  g.restore();
}
export function paint(g, world, id, camera, time, walking) {
  const w = g.canvas.width,
    h = g.canvas.height,
    unit = Math.min(w / 310, h / 280) * 1.22;
  const horizon = h * 0.25,
    center = h * 0.64,
    focal = (center - horizon) / (0.72 * unit);
  const cos = Math.cos(camera.angle),
    sin = Math.sin(camera.angle);
  function project(wx, wy) {
    const dx = wx - camera.x,
      dy = wy - camera.y,
      depth = dx * sin - dy * cos;
    const k = focal / (focal + depth);
    if (depth < -focal * 0.58 || depth > 510) return null;
    return {
      x: w / 2 + (dx * cos + dy * sin) * k * unit,
      y: horizon + (center - horizon) * k,
      k: k * unit,
      depth,
    };
  }
  const zone = forestRegion(camera.x, camera.y),
    pal = palettes[zone];
  const sky = g.createLinearGradient(0, 0, 0, horizon * 1.7);
  sky.addColorStop(0, ["#8bb8b2", "#b9ae88", "#819cad"][zone]);
  sky.addColorStop(0.64, ["#e7dcaa", "#f0d598", "#c1cfc1"][zone]);
  sky.addColorStop(1, pal[0]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const ground = g.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, "#94ac88");
  ground.addColorStop(0.42, pal[0]);
  ground.addColorStop(1, pal[1]);
  g.fillStyle = ground;
  g.fillRect(0, horizon, w, h - horizon);
  // Rows of trunks disappear into the mist; their crowns are above the view.
  for (let layer = 0; layer < 3; layer++) {
    const columns = 44 - layer * 8,
      stride = unit * (20 + layer * 12);
    const offset = ((camera.angle * columns) / (Math.PI * 2)) * stride;
    const start = Math.floor(offset / stride);
    for (let i = start - 1; i < start + w / stride + 2; i++) {
      const n = noise(((i % columns) + columns) % columns, layer, world.seed);
      const x = i * stride - offset + stride * ((n % 29) / 100);
      const depth = 1700 - layer * 490 + ((n >>> 8) % 160);
      const base = horizon + ((center - horizon) * focal) / (focal + depth);
      const width = stride * (0.13 + (n % 9) / 100);
      const lean = (((n >>> 9) % 7) - 3) * unit;
      shape(
        g,
        [
          [x - width + lean, -2],
          [x + width + lean, -2],
          [x + width, base - 5],
          [x + width * 1.7, base],
          [x - width * 1.6, base],
          [x - width, base - 5],
        ],
        ["#afc5b3", "#99b7a1", "#88a890"][layer],
      );
    }
  }
  const things = [],
    targets = [];
  function sprite(p, fn) {
    if (p && p.x > -130 * p.k && p.x < w + 130 * p.k && p.y < h + 150 * p.k)
      things.push([p, fn]);
  }
  // A winding trail ties the glades together. Build short ribbons in world space.
  const trail = (y) => trailOffset(y, world.seed);
  const trailBand = Math.round(camera.x / 280);
  for (let band = trailBand - 2; band <= trailBand + 2; band++)
    for (
      let y = Math.floor((camera.y - 510) / 12) * 12;
      y < camera.y + 510;
      y += 12
    ) {
      const points = [
        [y, -11],
        [y, 11],
        [y + 12, 11],
        [y + 12, -11],
      ].map(([v, d]) => project(band * 280 + trail(v) + d, v));
      if (points.every(Boolean))
        shape(
          g,
          points.map((p) => [p.x, p.y]),
          "#9e9871",
        );
    }
  const cell = 128,
    tx = Math.floor(camera.x / cell),
    ty = Math.floor(camera.y / cell);
  for (let row = ty - 4; row <= ty + 4; row++)
    for (let col = tx - 4; col <= tx + 4; col++) {
      const n = noise(col, row, world.seed),
        y = (row + 0.22) * cell + ((n >>> 12) % 56);
      let x = (col + 0.18) * cell + (n % 76);
      const pathX = Math.round((x - trail(y)) / 280) * 280 + trail(y);
      if (Math.abs(x - pathX) < 43) x = pathX + (x < pathX ? -45 : 45);
      const pond = nearestPond({ x, y }, world.seed);
      if (Math.hypot(x - pond.x, y - pond.y) < 69) continue;
      const p = project(x, y);
      if (!p) continue;
      const radius = 12 + ((n >>> 8) % 13);
      sprite(p, () => {
        // Let the explorer and near-ground targets show through foreground bark.
        if (p.depth < 20 && Math.abs(p.x - w / 2) < (radius + 24) * p.k)
          g.globalAlpha *= 0.24;
        const top = -p.y / p.k - 8,
          lean = ((n % 11) - 5) * 0.013 * top;
        const bark = g.createLinearGradient(-radius, 0, radius, 0);
        bark.addColorStop(0, "#484b3d");
        bark.addColorStop(0.3, "#88765a");
        bark.addColorStop(0.62, "#6b604c");
        bark.addColorStop(1, "#44493c");
        shape(
          g,
          [
            [-radius * 2.2, 2],
            [-radius * 1.32, -8],
            [-radius, -29],
            [-radius * 0.79 + lean, top],
            [radius * 0.8 + lean, top],
            [radius, -26],
            [radius * 1.37, -8],
            [radius * 2.15, 3],
            [radius * 0.57, 1],
            [1, 5],
            [-radius * 0.52, 0],
          ],
          bark,
        );
        for (let j = 0; j < 11; j++) {
          const u = (j - 5) / 6,
            base = u * radius,
            groove = ((noise(j, n, 17) % 13) - 6) * 0.45;
          g.beginPath();
          g.moveTo(base * 1.65, 1);
          g.bezierCurveTo(base * 0.8, -16, base + groove, -27, base, -48);
          g.bezierCurveTo(
            base - groove,
            top * 0.46,
            base * 0.8 + lean + groove,
            top * 0.75,
            base * 0.8 + lean,
            top,
          );
          g.lineWidth = j % 3 === 0 ? 1.6 : 0.7;
          g.strokeStyle = j % 3 === 0 ? "#443f3499" : "#af987566";
          g.stroke();
        }
        for (let i = 0; i < 12; i++) {
          const v = noise(i, n, 9);
          oval(
            g,
            ((v % 100) / 50 - 1) * radius * 1.15,
            -((v >>> 9) % 11),
            1.6 + (i % 4),
            0.9 + (i % 2),
            i % 2 ? "#78865b" : "#627352",
            -0.2,
          );
        }
      });
    }
  const cx = Math.floor(camera.x / 36),
    cy = Math.floor(camera.y / 36);
  for (let iy = cy - 14; iy <= cy + 14; iy++)
    for (let ix = cx - 14; ix <= cx + 14; ix++) {
      const n = noise(ix, iy, world.seed),
        x = ix * 36 + (n % 30),
        y = iy * 36 + ((n >>> 9) % 30),
        p = project(x, y);
      if (!p || p.x < -60 * p.k || p.x > w + 60 * p.k || p.y > h + 130 * p.k)
        continue;
      if (inWater({ x, y }, nearestPond({ x, y }, world.seed))) continue;
      const z = forestRegion(x, y),
        colors = palettes[z];
      const nearTrail =
        Math.abs(x - 280 * Math.round((x - trail(y)) / 280) - trail(y)) < 16;
      oval(g, p.x, p.y, 7 * p.k, 1.5 * p.k, nearTrail ? "#8c8964" : colors[2]);
      if (p.depth < 220)
        for (let j = 0; j < 6; j++) {
          const dx = (((n >>> (j * 3)) % 15) - 7) * 1.7,
            dy = (((n >>> (j + 11)) % 10) - 5) * 0.6;
          oval(
            g,
            p.x + dx * p.k,
            p.y + dy * p.k,
            p.k * (0.9 + (j % 2)),
            p.k * 0.55,
            nearTrail ? "#c0af83" : colors[3],
            -0.4,
          );
        }
      if (Math.abs(x - 280 * Math.round((x - trail(y)) / 280) - trail(y)) < 21)
        continue;
      if (n % 5 < 2) {
        const pic = shrub(n, z),
          s = 0.17 + ((n >>> 12) % 16) / 100;
        sprite(p, () => {
          if (p.depth < 5 && Math.abs(p.x - w / 2) < 48 * p.k)
            g.globalAlpha = 0.28;
          g.drawImage(pic, 0, 0, 128, 126, -64 * s, -70 * s, 128 * s, 72 * s);
        });
      } else if (n % 13 === 0) {
        const type = n % 2 ? "fern" : "stone";
        sprite(p, () => {
          g.scale(0.78, 0.78);
          cover(g, type);
        });
        targets.push({
          id: 0,
          x: p.x,
          y: p.y - 6 * p.k,
          size: p.k,
          point: { x, y, cover: type },
        });
      } else if (n % 5 === 2)
        sprite(p, () => {
          for (let j = 0; j < 4; j++) {
            const v = j * 3 - 5;
            oval(g, v, -3, 1.1, 4, colors[4], v * 0.15);
          }
        });
      else if (n % 11 === 0)
        sprite(p, () => {
          for (let j = 0; j < 3; j++) {
            const v = j * 4;
            g.fillStyle = "#dfcfab";
            g.fillRect(v, -4 - j, 2, 5);
            oval(g, v + 1, -5 - j, 3, 2, z === 2 ? "#bda0cc" : "#ce845a");
          }
        });
    }
  for (
    let iy = Math.round(camera.y / POND_SPACING) - 1;
    iy <= Math.round(camera.y / POND_SPACING) + 1;
    iy++
  )
    for (
      let ix = Math.round(camera.x / POND_SPACING) - 1;
      ix <= Math.round(camera.x / POND_SPACING) + 1;
      ix++
    ) {
      const pond = pondAt(ix, iy, world.seed),
        p = project(pond.x, pond.y);
      if (!p || p.y > h + 20 * p.k || p.x < -40 * p.k || p.x > w + 40 * p.k)
        continue;
      for (const [a, b, c] of [
        [40, 14, "#8a9873"],
        [36, 12, "#3b7c7a"],
        [28, 8, "#599898"],
      ])
        oval(g, p.x, p.y, a * p.k, b * p.k, c);
      for (let j = 0; j < 5; j++)
        oval(
          g,
          p.x + (j * 8 - 17) * p.k,
          p.y + Math.sin(j * 9 + time * 0.7) * 4 * p.k,
          3 * p.k,
          p.k,
          "#a2c398",
        );
      const spot = fishingSpot(pond),
        dock = project(spot.x, spot.y);
      if (dock) {
        sprite(dock, () => {
          for (let j = 0; j < 4; j++) {
            g.fillStyle = j % 2 ? "#ad9065" : "#c6a577";
            g.fillRect(-8, -4 + j * 2, 16, 2);
          }
          g.fillStyle = "#5b4f39";
          g.fillRect(7, -15, 2, 20);
          shape(
            g,
            [
              [9, -15],
              [19, -13],
              [9, -9],
            ],
            "#e5ad66",
          );
        });
        targets.push({
          id: FISH_ACTION,
          x: p.x,
          y: p.y,
          size: 3 * p.k,
          point: spot,
        });
        targets.push({
          id: FISH_ACTION,
          x: dock.x,
          y: dock.y,
          size: dock.k,
          point: spot,
        });
      }
    }
  for (
    let row = Math.round(camera.y / 320) - 2;
    row <= Math.round(camera.y / 320) + 2;
    row++
  )
    for (let band = trailBand - 2; band <= trailBand + 2; band++) {
      const m = landmark(band, row, world.seed),
        p = project(m.x, m.y);
      sprite(p, () => drawWonder(g, m.index, time));
    }
  for (const bug of world.bugs) {
    const p = project(bug.x, bug.y);
    if (!p) continue;
    sprite(p, () => {
      const pulse = (time + bug.id * 0.9) % 3.5;
      cover(g, bug.cover, pulse < 0.85 ? Math.sin(pulse * 20) * 0.095 : 0);
      if (pulse < 0.85) {
        g.fillStyle = "#fff1ac";
        g.fillRect(12, -22, 2, 4);
        g.fillRect(11, -21, 4, 2);
      }
    });
    const period = 10 + (bug.id % 6),
      phase = (world.time + bug.id * 2.6) % period;
    if (phase < 3.5) {
      const peek = Math.sin((Math.PI * phase) / 3.5),
        flying = !["ladybug", "caterpillar"].includes(bug.kind);
      const dx = peek * (bug.id % 2 ? 20 : -20),
        dy = -10 - peek * (flying ? 17 : 4);
      sprite(p, () => insect(g, dx, dy, bug.kind, time, 0.45 + peek * 0.45));
      targets.push({
        id: bug.id,
        point: bug,
        exposed: true,
        x: p.x + dx * p.k,
        y: p.y + dy * p.k,
        size: p.k,
      });
    }
    targets.push({
      id: bug.id,
      point: bug,
      x: p.x,
      y: p.y - 3 * p.k,
      size: p.k,
    });
  }
  for (const [key, player] of Object.entries(world.players)) {
    const p = project(player.x, player.y);
    sprite(p, () => {
      oval(g, 0, 1, 9, 3, "#334e43");
      const bounce = key === id && walking ? Math.sin(time * 10) * 1.6 : 0;
      g.translate(0, bounce);
      const elapsed = world.time - player.swingAt;
      if (elapsed >= 0 && elapsed < 0.65) {
        const side =
          (player.swingX - player.x) * cos + (player.swingY - player.y) * sin <
          0
            ? -1
            : 1;
        const angle = -2.5 + 2.96 * (1 - Math.pow(1 - elapsed / 0.65, 2));
        g.save();
        g.translate(side * 5, -9);
        g.scale(side, 1);
        g.rotate(angle);
        g.strokeStyle = "#987650";
        g.lineWidth = 1.8;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(17, 0);
        g.stroke();
        oval(g, 22, 0, 6, 4, "#dcecd688");
        g.strokeStyle = "#d2ba87";
        g.lineWidth = 1.1;
        g.stroke();
        g.restore();
      }
      const shirt = player.coat || "#dd7956";
      for (const dx of [-4, 3]) oval(g, dx, 0, 2.6, 3, "#493f36");
      oval(g, 0, -8, 7, 8, shirt);
      oval(g, -7, -7, 2, 4, "#d8a377");
      oval(g, 7, -7, 2, 4, "#d8a377");
      oval(g, 0, -17, 6, 6, "#d4a178");
      oval(g, 0, -20, 10, 3, "#ac8150");
      oval(g, 0, -23, 7, 5, "#e2bd7e");
      g.fillStyle = shirt;
      g.fillRect(-6, -22, 12, 2);
      if (Math.cos(player.angle - camera.angle) > 0.1) {
        oval(g, 0, -9, 4, 4, "#9e7247");
        g.fillStyle = "#e3b577";
        g.fillRect(-3, -12, 6, 2);
      } else {
        g.fillStyle = "#463b30";
        g.fillRect(-3, -18, 1, 1);
        g.fillRect(2, -18, 1, 1);
      }
    });
  }
  things.sort((a, b) => b[0].depth - a[0].depth);
  for (const [p, draw] of things) {
    g.save();
    g.globalAlpha = Math.max(0.4, 1 - Math.max(0, p.depth - 75) / 610);
    g.translate(p.x, p.y);
    g.scale(p.k, p.k);
    draw();
    g.restore();
  }
  // Moving flecks of amber leaves, pollen or cool blue light mark the three woods.
  const beams = g.createLinearGradient(0, h * 0.14, w * 0.38, h * 0.82);
  beams.addColorStop(0, "#fff0b015");
  beams.addColorStop(1, "#fff4ba00");
  for (let j = 0; j < 3; j++) {
    const x = ((((j * 0.41 - camera.angle * 0.14) % 1) + 1) % 1) * w;
    shape(
      g,
      [
        [x, 0],
        [x + w * 0.044, 0],
        [x - w * 0.19, h * 0.83],
        [x - w * 0.31, h * 0.76],
      ],
      beams,
    );
  }
  for (let i = 0; i < 10; i++) {
    const x =
      (((((i * 73 + Math.sin(time * 0.34 + i) * 9) % 100) + 100) % 100) / 100) *
      w;
    const y = (0.32 + ((i * 19 + time * 1.1) % 50) / 100) * h;
    oval(
      g,
      x,
      y,
      zone === 1 ? 2 * unit : unit,
      unit,
      ["#ffedaa77", "#f2b56caa", "#c4ece299"][zone],
      Math.sin(time + i),
    );
  }
  return targets;
}
export function placeName(p) {
  return regions[forestRegion(p.x, p.y)];
}
