// A low-resolution meadow painted in world coordinates with upright sprite billboards.
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
export function paint(ctx, world, id, camera, time, walking) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
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
  const c = Math.cos(camera.angle),
    s = Math.sin(camera.angle);
  function project(x, y) {
    x -= camera.x;
    y -= camera.y;
    return [w / 2 + x * c + y * s, h / 2 - x * s + y * c];
  }
  const radius = Math.ceil(Math.hypot(w, h) / 2) + 32;
  r(0, 0, w, h, "#bed783");
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
      const [x, y] = project(wx, wy);
      if (x < -18 || x > w + 18 || y < -15 || y > h + 28) continue;
      const tint = n % 2 ? "#acc879" : "#cce28f";
      oval(x, y, 5 + (n % 8), 2, tint);
      r(x + 8, y + 5, 3, 1, "#a1bd71");
      r(x - 7, y - 5, 1, 3, "#9cba69");
      r(x - 9, y - 6, 1, 2, "#9cba69");
      if (n % 13 === 0) objects.push({ y, draw: () => tree(x, y, n) });
      else if (n % 5 === 0) objects.push({ y, draw: () => flowers(x, y, n) });
      else if (n % 11 === 0) {
        oval(x, y, 6, 3, "#91ad71");
        oval(x, y - 2, 5, 3, "#a9b69b");
        r(x - 3, y - 4, 4, 1, "#d8d9b2");
      }
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
  function bug(x, y, b) {
    const flap = Math.sin(time * 6 + b.x) > 0 ? 1 : 0;
    oval(x, y + 3, 5, 1, "#96b46c");
    y -= b.kind === "ladybug" ? 0 : 2 + flap;
    if (b.kind === "butterfly") {
      oval(x - 3, y - 1, 3, 3 + flap, "#926493");
      oval(x + 3, y - 1, 3, 3 + flap, "#926493");
      r(x - 5, y - 3, 3, 3, "#eab6cf");
      r(x + 2, y - 3, 3, 3, "#eab6cf");
      r(x, y - 2, 1, 5, "#664e57");
    } else if (b.kind === "bee") {
      r(x - 2, y - 5 - flap, 3, 3, "#edf5cd");
      r(x + 1, y - 4 - flap, 3, 3, "#edf5cd");
      oval(x, y, 5, 3, "#6e5942");
      r(x - 3, y - 2, 2, 5, "#f1bc56");
      r(x + 1, y - 2, 2, 5, "#ffcc60");
    } else {
      oval(x, y, 5, 4, "#4c5041");
      oval(x, y - 1, 4, 3, "#dd714d");
      r(x - 2, y - 1, 1, 1, "#494538");
      r(x + 2, y - 2, 1, 1, "#494538");
      r(x, y - 4, 1, 6, "#a34f39");
      r(x - 2, y - 4, 4, 2, "#494538");
    }
  }
  function explorer(x, y, color, bounce, heading) {
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
    r(x + 7, y - 11, 1, 7, "#846849");
    oval(x + 9, y - 14, 3, 3, "#849981");
    oval(x + 9, y - 14, 2, 2, "#e5ecc5");
  }
  for (const b of world.bugs) {
    const [x, y] = project(b.x, b.y);
    if (x >= -8 && x <= w + 8 && y >= -8 && y <= h + 8)
      objects.push({ y, draw: () => bug(x, y, b) });
  }
  for (const [key, p] of Object.entries(world.players)) {
    const local = key === id,
      [x, y] = local ? [w / 2, h / 2 + 7] : project(p.x, p.y);
    objects.push({
      y,
      draw: () =>
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
        ),
    });
  }
  objects.sort((a, b) => a.y - b.y);
  for (const obj of objects) obj.draw();
}
