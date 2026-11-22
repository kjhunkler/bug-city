// A low-resolution meadow painted in world coordinates with upright sprite billboards.
import { POND_SPACING, FISH_ACTION, pondAt, nearestPond, fishingSpot, inWater } from "./meadow.js";
function hash(x, y, seed) {
  let h = Math.imul(x ^ seed, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
export function drawJar(ctx) {
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  r(4, 1, 10, 3, "#5d6049");
  r(5, 2, 8, 1, "#c68d54");
  r(5, 4, 8, 2, "#789481");
  r(3, 6, 12, 11, "#486757");
  r(5, 17, 8, 1, "#486757");
  r(4, 7, 10, 9, "#cce4bc");
  r(5, 8, 1, 5, "#ffffd6");
  r(8, 10, 5, 4, "#dc744c");
  r(9, 9, 3, 1, "#675741");
  r(10, 11, 1, 2, "#5b513b");
}
function brushes(ctx) {
  const r = (x, y, a, b, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), a, b);
  };
  function oval(x, y, rx, ry, c) {
    for (let j = -ry; j <= ry; j++) {
      const n = Math.round(rx * Math.sqrt(1 - (j / ry) ** 2));
      r(x - n, y + j, n * 2 + 1, 1, c);
    }
  }
  return { r, oval };
}
export function paint(ctx, world, id, camera, time, walking, swings = {}) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const { r, oval } = brushes(ctx);
  const c = Math.cos(camera.angle),
    s = Math.sin(camera.angle);
  function project(x, y) {
    x -= camera.x;
    y -= camera.y;
    const forward = x * s - y * c;
    const perspective = 1 / Math.max(0.15, 1 + forward / (h * 0.68));
    return [
      w / 2 + (x * c + y * s) * perspective,
      h * 0.55 - forward * 0.59 * perspective,
      perspective,
    ];
  }
  function atScale(x, y, scale, draw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-x, -y);
    draw();
    ctx.restore();
  }
  const radius = Math.ceil(Math.hypot(w, h) * 1.15) + 80;
  const horizon = Math.round(h * 0.15);
  r(0, 0, w, h, "#bed783");
  r(0, 0, w, horizon, "#a8d9cf");
  // Distant hills turn with the explorer while the nearer meadow passes faster.
  for (let x = 0; x < w; x += 2) {
    const angle = camera.angle + Math.atan((x - w / 2) / (h * 0.9));
    const hills =
      Math.sin(angle * 8 + (world.seed % 20)) * 3 + Math.cos(angle * 15) * 2;
    const ridge = horizon - 5 + Math.round(hills);
    r(x, ridge, 2, horizon - ridge + 3, "#93b99b");
    const low = horizon - 1 + Math.round(2 * Math.sin(angle * 13));
    r(x, low, 2, 5, "#a9c78d");
  }
  // A pale sandy trail meanders through each band of meadow.
  for (
    let band = Math.floor((camera.x - radius - 60) / 220);
    band <= Math.ceil((camera.x + radius + 60) / 220);
    band++
  ) {
    const edge = [],
      other = [];
    for (
      let wy = Math.floor((camera.y - radius) / 8) * 8;
      wy <= camera.y + radius + 8;
      wy += 8
    ) {
      const wx =
        band * 220 +
        54 +
        28 * Math.sin(wy / 61 + (world.seed % 198) + band) +
        15 * Math.sin(wy / 97 + band);
      edge.push(project(wx - 8, wy));
      other.push(project(wx + 9, wy));
    }
    const pts = edge.concat(other.reverse());
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fillStyle = "#dfd49a";
    ctx.fill();
  }
  const objects = [];
  const targets = [];
  for (let iy = Math.floor((camera.y - radius) / POND_SPACING); iy <= Math.ceil((camera.y + radius) / POND_SPACING); iy++) {
    for (let ix = Math.floor((camera.x - radius) / POND_SPACING); ix <= Math.ceil((camera.x + radius) / POND_SPACING); ix++) {
      const pond = pondAt(ix, iy, world.seed);
      const [px, py, zoom] = project(pond.x, pond.y);
      if (px < -50 * zoom || px > w + 50 * zoom || py < horizon || py > h + 50 * zoom) continue;
      for (const [rx, ry, color] of [[38, 24, "#aaa978"], [36, 22, "#80c4ba"], [29, 17, "#66aeb0"]]) {
        ctx.beginPath();
        for (let i = 0; i <= 32; i++) {
          const a = i * Math.PI / 16;
          const [x, y] = project(pond.x + rx * Math.cos(a), pond.y + ry * Math.sin(a));
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.fillStyle = color;
        ctx.fill();
      }
      function sprite(dx, dy, draw) {
        const [x, y, size] = project(pond.x + dx, pond.y + dy);
        objects.push({ y, draw: () => atScale(x, y, size, () => draw(x, y)) });
      }
      const drift = Math.sin(time + ix);
      sprite(4 + drift * 7, -8, (x, y) => {
        oval(x, y, 4, 2, "#eaba72");
        r(x - 6, y - 1, 2, 3, "#da8d5c"); r(x + 2, y - 1, 1, 1, "#4c604e");
      });
      sprite(-17, 4, (x, y) => {
        oval(x, y, 6, 2, "#8ab973");
        y -= Math.max(0, drift) * 3;
        oval(x, y - 1, 4, 2, "#609958");
        for (const dx of [-3, 1]) {
          r(x + dx, y - 5, 2, 3, "#add07c"); r(x + dx, y - 5, 1, 1, "#354d3c");
        }
      });
      sprite(19, 3 + drift * 2, (x, y) => {
        r(x - 4, y + 2, 2, 2, "#659461"); r(x + 2, y + 2, 2, 2, "#659461");
        oval(x + 5, y - 1, 2, 2, "#9ab478"); oval(x, y, 5, 3, "#587958");
        r(x - 2, y - 2, 4, 2, "#849254");
      });
      const spot = fishingSpot(pond);
      const [x, y, size] = project(spot.x, spot.y);
      targets.push({ id: FISH_ACTION, point: spot, x, y: y - 2 * size, size });
      sprite(0, 21, (x, y) => {
        for (let i = -2; i <= 2; i++) r(x - 7, y + i * 2, 15, 2, i % 2 ? "#b38d60" : "#d5ad77");
        r(x + 5, y - 10, 2, 13, "#795e46");
        r(x + 7, y - 10, 6, 4, "#e78059");
      });
    }
  }
  for (
    let iy = Math.floor((camera.y - radius) / 32);
    iy <= Math.ceil((camera.y + radius) / 32);
    iy++
  ) {
    for (
      let ix = Math.floor((camera.x - radius) / 32);
      ix <= Math.ceil((camera.x + radius) / 32);
      ix++
    ) {
      const n = hash(ix, iy, world.seed),
        wx = ix * 32 + (n % 25),
        wy = iy * 32 + ((n >>> 6) % 25);
      const [x, y, scale] = project(wx, wy);
      if (x < -18 || x > w + 18 || y < -15 || y > h + 28) continue;
      if (scale < 0.25 || scale > 3) continue;
      if (inWater({ x: wx, y: wy }, nearestPond({ x: wx, y: wy }, world.seed))) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.translate(-x, -y);
      const tint = n % 2 ? "#acc879" : "#cce28f";
      oval(x, y, 5 + (n % 8), 2, tint);
      r(x + 8, y + 5, 3, 1, "#a1bd71");
      r(x - 7, y - 5, 1, 3, "#9cba69");
      r(x - 9, y - 6, 1, 2, "#9cba69");
      if (n % 13 === 0)
        objects.push({
          y,
          draw: () => atScale(x, y, scale, () => tree(x, y, n)),
        });
      else if (n % 5 === 0)
        objects.push({
          y,
          draw: () => atScale(x, y, scale, () => flowers(x, y, n)),
        });
      else if (n % 11 === 0) {
        oval(x, y, 6, 3, "#91ad71");
        oval(x, y - 2, 5, 3, "#a9b69b");
        r(x - 3, y - 4, 4, 1, "#d8d9b2");
      }
      ctx.restore();
    }
  }
  function tree(x, y, n) {
    const overlapsExplorer =
      Math.abs(x - w / 2) < 19 && y > h / 2 + 6 && y < h / 2 + 34;
    if (overlapsExplorer) ctx.globalAlpha = 0.45;
    oval(x + 2, y + 1, 11, 3, "#a3be72");
    r(x - 2, y - 8, 5, 9, "#90683f");
    r(x, y - 4, 2, 5, "#b5824c");
    const hue = n % 2 ? "#75a75c" : "#82b263";
    oval(x, y - 13, 12, 8, "#527e53");
    oval(x - 4, y - 17, 8, 7, hue);
    oval(x + 4, y - 15, 8, 6, hue);
    oval(x - 3, y - 21, 6, 3, "#a5c877");
    r(x + 3, y - 12, 2, 2, "#e8b35e");
    r(x - 6, y - 15, 2, 2, "#eff2ae");
    ctx.globalAlpha = 1;
  }
  function flowers(x, y, n) {
    for (let j = 0; j < 3; j++) {
      const dx = x + j * 3,
        dy = y - (j % 2) * 3;
      r(dx, dy, 1, 4, "#6f9a55");
      r(dx - 1, dy - 1, 3, 2, n % 2 ? "#fff2b4" : "#eda88d");
      r(dx, dy - 2, 1, 3, "#ffd46f");
    }
  }
  function explorer(x, y, color, bounce, heading, swinging) {
    oval(x, y + 2, 8, 2, "#92ae6b");
    y -= bounce;
    r(x - 5, y - 2, 4, 4, "#614e3c");
    r(x + 2, y - 2, 4, 4, "#614e3c");
    r(x - 6, y - 9, 13, 8, "#4f6248");
    r(x - 5, y - 9, 11, 7, color);
    r(x - 7, y - 8, 2, 5, "#c99263");
    r(x + 6, y - 8, 2, 5, "#d9a375");
    r(x - 3, y - 7, 7, 5, "#a56d44");
    r(x - 2, y - 7, 5, 2, "#e1ad70");
    r(x - 5, y - 14, 11, 5, "#8f6046");
    r(x - 4, y - 12, 9, 3, "#dbac78");
    r(x - 8, y - 15, 17, 3, "#886c46");
    r(x - 7, y - 16, 15, 2, "#f1cf87");
    r(x - 5, y - 20, 11, 5, "#dfb36c");
    r(x - 4, y - 21, 8, 2, "#f6d796");
    r(x - 5, y - 17, 11, 2, color);
    if (Math.cos(heading) < -0.35) {
      r(x - 3, y - 12, 1, 1, "#604535");
      r(x + 3, y - 12, 1, 1, "#604535");
      r(x - 3, y - 7, 7, 5, color);
      r(x - 4, y - 8, 2, 5, "#f0ce89");
    }
    if (swinging) return;
    r(x + 7, y - 11, 1, 7, "#846849");
    oval(x + 9, y - 14, 3, 3, "#849981");
    oval(x + 9, y - 14, 2, 2, "#e5ecc5");
  }
  for (const b of world.bugs) {
    const [x, y, scale] = project(b.x, b.y);
    if (scale > 3 || x < -8 || x > w + 8 || y < 0 || y > h + 8) continue;
    const size = Math.max(0.65, scale);
    targets.push({
      id: b.id,
      x,
      y: y - (b.kind === "ladybug" ? 1 : 3) * size,
      size,
      point: b,
    });
    objects.push({ y, draw: () => atScale(x, y, size, () => drawBug(ctx, x, y, b.kind, time + b.x)) });
  }
  for (const [key, p] of Object.entries(world.players)) {
    const local = key === id;
    const [x, y, scale] = local ? [w / 2, h * 0.55, 1] : project(p.x, p.y);
    if (scale > 3) continue;
    const swing = swings[key];
    if (world.players[key].castUntil) {
      const pond = nearestPond(p, world.seed);
      const [fx, fy] = project(pond.x, pond.y + 4);
      objects.push({ y: Infinity, draw: () => {
        ctx.strokeStyle = "#fff3c8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 8 * scale, y - 13 * scale);
        ctx.lineTo(fx, fy);
        ctx.stroke();
        oval(fx, fy + Math.sin(time * 8), 2, 2, "#d97856");
      } });
    }
    const progress = swing ? (time - swing.start) / 0.37 : 1;
    const active = progress >= 0 && progress < 1;
    objects.push({
      y,
      draw: () =>
        atScale(x, y, scale, () =>
          explorer(
            x,
            y,
            local
              ? "#d47751"
              : ["#779baa", "#a384ab", "#7b9e62"][
                  hash(key.length, key.charCodeAt(0), 0) % 3
                ],
            local && walking ? Math.floor(time * 6) % 2 : 0,
            p.angle - camera.angle,
            active,
          ),
        ),
    });
    if (active) {
      const [tx, ty] = project(swing.x, swing.y);
      objects.push({
        y: Infinity,
        draw: () => {
          const handX = x + 6 * scale,
            handY = y - 8 * scale;
          const reach = Math.sin(Math.PI * progress);
          const nx =
            handX + (tx - handX) * reach + Math.sin(2 * Math.PI * progress) * 7;
          const ny =
            handY + (ty - handY) * reach - 5 * Math.sin(2 * Math.PI * progress);
          ctx.strokeStyle = "#947048";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(handX, handY);
          ctx.lineTo(nx, ny);
          ctx.stroke();
          oval(nx, ny, 6, 5, "#657f74");
          oval(nx, ny, 5, 4, "#e7f2cc");
          for (let j = -2; j <= 2; j += 2) {
            r(nx + j - 1, ny + j, 1, 2, "#9db6a4");
            r(nx + j + 1, ny - j, 1, 2, "#9db6a4");
          }
        },
      });
    }
  }
  objects.sort((a, b) => a.y - b.y);
  for (const obj of objects) obj.draw();
  return targets;
}

export function drawBug(ctx, x, y, kind, time) {
  const { r, oval } = brushes(ctx);
  const flap = Number(Math.sin(time * 6) > 0);
  if (kind === "butterfly") {
    for (const dx of [-3, 3]) {
      oval(x + dx, y - 2, 3, 3 + flap, "#926493");
      r(x + dx - 1, y - 4, 2, 3, "#eab6cf");
    }
    r(x, y - 3, 1, 5, "#664e57");
  } else if (kind === "bee") {
    r(x - 2, y - 5 - flap, 3, 3, "#edf5cd");
    r(x + 1, y - 4 - flap, 3, 3, "#edf5cd");
    oval(x, y, 5, 3, "#6e5942");
    r(x - 3, y - 2, 2, 5, "#f1bc56");
    r(x + 1, y - 2, 2, 5, "#ffcc60");
  } else if (kind === "dragonfly") {
    for (const dx of [-4, 4]) for (const dy of [-2, 1])
      oval(x + dx, y + dy - flap, 3, 1, "#d6eff1");
    r(x - 1, y - 3, 2, 9, "#377b80");
    r(x - 2, y - 4, 4, 2, "#589e9c");
  } else if (kind === "caterpillar") {
    for (let i = 0; i < 4; i++)
      oval(x - 5 + 3 * i, y - ((i + flap) % 2), 2, 2, i % 2 ? "#639749" : "#87b55a");
    r(x + 4, y - 2, 1, 1, "#354d3c");
  } else if (kind === "firefly") {
    oval(x, y, 4, 2, "#5b5445");
    oval(x - 3, y, 2 + flap, 2, flap ? "#ffed81" : "#d8bd65");
    r(x, y - 3 - flap, 3, 2, "#dfeecb");
  } else {
    oval(x, y, 5, 4, "#4c5041");
    oval(x, y - 1, 4, 3, "#dd714d");
    r(x - 2, y - 1, 1, 1, "#494538");
    r(x + 2, y - 2, 1, 1, "#494538");
    r(x, y - 4, 1, 6, "#a34f39");
    r(x - 2, y - 4, 4, 2, "#494538");
  }
}
