const WIDTH = 320;
const HEIGHT = 180;
const PLAYER_SPEED = 72;
const PICKUP_RADIUS = 10;
const EXIT_RADIUS = 14;
const ATTACK_RANGE = 30;
const ATTACK_COOLDOWN = 0.35;
const RECOVERY_HP = 5;
const EXTRACTION_SECONDS = 3;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function randomFor(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function runState(g) {
  const rand = randomFor(g.seed);
  const pos = () => ({ x: 62 + rand() * 190, y: 25 + rand() * 130 });
  return {
    scene: "run",
    player: { x: 24, y: 90, hp: RECOVERY_HP },
    enemies: [
      { ...pos(), hp: 2, windup: 0, attackCooldown: 0 },
      { ...pos(), hp: 2, windup: 0, attackCooldown: 0 },
    ],
    loot: [
      { ...pos(), value: 2 },
      { ...pos(), value: 3 },
    ],
    exit: { x: 294, y: 90 },
    carried: 0,
    stash: g.stash,
    message: "Find salvage, then reach the extraction beacon.",
    attackCooldown: 0,
    extracting: 0,
    elapsed: 0,
  };
}

function returnHome(g, message, bankCarried = false) {
  if (bankCarried) g.stash += g.carried;
  const amount = g.carried;
  g.carried = 0;
  g.scene = "home";
  g.player = { x: 160, y: 90, hp: RECOVERY_HP };
  g.enemies = [];
  g.loot = [];
  g.exit = null;
  g.extracting = 0;
  g.attackCooldown = 0;
  g.message = typeof message === "function" ? message(amount) : message;
}

export function createGame() {
  const g = {
    scene: "home",
    player: { x: 160, y: 90, hp: RECOVERY_HP },
    enemies: [],
    loot: [],
    exit: null,
    carried: 0,
    stash: 0,
    message: "Colony safehouse. Press action to begin an expedition.",
    attackCooldown: 0,
    extracting: 0,
    elapsed: 0,
    seed: 1,
    runNumber: 0,
  };
  return g;
}

export function step(g, dt, dx = 0, dy = 0) {
  if (!g || !Number.isFinite(dt) || dt <= 0) return g;
  dt = Math.min(dt, 0.1);
  g.elapsed = (g.elapsed || 0) + dt;
  g.attackCooldown = Math.max(0, (g.attackCooldown || 0) - dt);

  const mag = Math.hypot(dx, dy);
  if (mag > 0) {
    const speed = PLAYER_SPEED;
    g.player.x = clamp(
      g.player.x + (dx / Math.max(1, mag)) * speed * dt,
      5,
      WIDTH - 5,
    );
    g.player.y = clamp(
      g.player.y + (dy / Math.max(1, mag)) * speed * dt,
      5,
      HEIGHT - 5,
    );
  }
  if (g.scene !== "run") return g;

  if (g.extracting > 0) {
    if (!g.exit || distance(g.player, g.exit) > EXIT_RADIUS) {
      g.extracting = 0;
      g.message = "Extraction interrupted. Return to the beacon to try again.";
    } else {
      g.extracting = Math.max(0, g.extracting - dt);
      g.message = `Extraction contested: ${g.extracting.toFixed(1)}s remaining.`;
      if (g.extracting === 0) {
        returnHome(
          g,
          (amount) =>
            `Extraction complete. ${amount} salvage secured in the colony stash.`,
          true,
        );
        return g;
      }
    }
  }

  for (let i = g.loot.length - 1; i >= 0; i--) {
    if (distance(g.player, g.loot[i]) <= PICKUP_RADIUS) {
      const item = g.loot.splice(i, 1)[0];
      const value = item.value || 1;
      g.carried += value;
      g.message = `Salvage collected (+${value}). Get to extraction.`;
    }
  }

  for (const enemy of g.enemies) {
    enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - dt);
    const d = distance(g.player, enemy);
    if (enemy.windup > 0) {
      enemy.windup = Math.max(0, enemy.windup - dt);
      if (enemy.windup === 0) {
        if (distance(g.player, enemy) <= 25) {
          g.player.hp -= 1;
          g.message = "A bug struck you! Move away during its windup.";
          if (g.player.hp <= 0) {
            returnHome(
              g,
              "You were overwhelmed and lost carried salvage. Recovery kit restored.",
            );
            return g;
          }
        }
        enemy.attackCooldown = 0.8;
      }
    } else if (d <= 24 && enemy.attackCooldown <= 0) {
      enemy.windup = 0.65;
    } else if (d > 20) {
      enemy.x += ((g.player.x - enemy.x) / d) * 16 * dt;
      enemy.y += ((g.player.y - enemy.y) / d) * 16 * dt;
    }
  }
  return g;
}

export function act(g) {
  if (!g) return g;
  if (g.scene === "home") {
    g.runNumber = (g.runNumber || 0) + 1;
    g.seed = (g.seed || 0) + 1;
    const fresh = runState(g);
    Object.assign(g, fresh);
  } else if (
    g.scene === "run" &&
    g.exit &&
    distance(g.player, g.exit) <= EXIT_RADIUS
  ) {
    if (g.extracting <= 0) {
      g.extracting = EXTRACTION_SECONDS;
      g.message = `Extraction contested: ${EXTRACTION_SECONDS.toFixed(1)}s remaining.`;
    }
  } else if (g.scene === "run") {
    g.message = "Reach the beacon and press action to begin extraction.";
  }
  return g;
}

export function attack(g, dx = 0, dy = 0) {
  if (!g || g.scene !== "run" || g.attackCooldown > 0) return g;
  g.attackCooldown = ATTACK_COOLDOWN;
  const mag = Math.hypot(dx, dy);
  const ux = mag ? dx / mag : 1;
  const uy = mag ? dy / mag : 0;
  let target = null;
  let best = Infinity;
  for (const enemy of g.enemies) {
    const ex = enemy.x - g.player.x;
    const ey = enemy.y - g.player.y;
    const d = Math.hypot(ex, ey);
    const dot = d ? (ex * ux + ey * uy) / d : 1;
    if (d <= ATTACK_RANGE && dot >= 0.35 && d < best) {
      target = enemy;
      best = d;
    }
  }
  if (target) {
    target.hp -= 1;
    if (target.hp <= 0) {
      g.enemies.splice(g.enemies.indexOf(target), 1);
      g.loot.push({ x: target.x, y: target.y, value: 2 });
      g.message = "Bug defeated. Salvage dropped.";
    } else {
      target.windup = 0;
      target.attackCooldown = Math.max(target.attackCooldown || 0, 0.25);
      g.message = "Hit! Keep moving when a bug winds up.";
    }
  } else {
    g.message = "No bug in reach.";
  }
  return g;
}
