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
      // The stag stays near its lair unless a player approaches, so it can be skipped.
      {
        kind: "stag",
        hp: 5,
        x: 276,
        y: 34,
        lair: { x: 276, y: 34 },
        windup: 0,
        attackCooldown: 0,
      },
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
  if (bankCarried) {
    g.stash += g.carried;
    if (g.carryingCrown) g.crowns++;
  }
  g.carryingCrown = false;
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
    carryingCrown: false,
    crowns: 0,
    message: "Colony safehouse. Press action to begin an expedition.",
    attackCooldown: 0,
    extracting: 0,
    elapsed: 0,
    seed: 1,
    runNumber: 0,
  };
  return g;
}

export function stepPlayer(g, dt, dx = 0, dy = 0) {
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
      if (item.kind === "crown") g.carryingCrown = true;
      g.message =
        item.kind === "crown"
          ? "Crown recovered. Extract to display it in Lantern Hollow."
          : `Salvage collected (+${value}). Get to extraction.`;
    }
  }

  return g;
}

export function stepEnemies(enemies, players, dt) {
  for (const enemy of enemies) {
    const active = players.filter((player) => player.scene === "run");
    if (active.length === 0) break;
    const g = active.reduce((nearest, player) =>
      distance(player.player, enemy) < distance(nearest.player, enemy)
        ? player
        : nearest,
    );
    enemy.attackCooldown = Math.max(0, (enemy.attackCooldown || 0) - dt);
    const d = distance(g.player, enemy);
    const isStag = enemy.kind === "stag";
    if (enemy.windup > 0) {
      enemy.windup = Math.max(0, enemy.windup - dt);
      if (enemy.windup === 0) {
        for (const nearby of active) {
          if (distance(nearby.player, enemy) > (isStag ? 34 : 25)) continue;
          nearby.player.hp -= isStag ? 2 : 1;
          nearby.message = isStag
            ? "The Copper Stag crashes through the grove!"
            : "A bug struck you! Move away during its windup.";
          if (nearby.player.hp <= 0) {
            returnHome(
              nearby,
              "You were overwhelmed and lost carried salvage. Recovery kit restored.",
            );
          }
        }
        enemy.attackCooldown = 0.8;
      }
    } else if (isStag) {
      const lair = enemy.lair;
      const fromLair = distance(enemy, lair);
      if (d <= 36 && enemy.attackCooldown <= 0) {
        enemy.windup = 1.2;
        for (const nearby of active) {
          if (distance(nearby.player, enemy) <= 36) {
            nearby.message =
              "The Copper Stag lowers its antlers! Evade the heavy charge.";
          }
        }
      } else if (d <= 92 && d > 30) {
        // Aggro is limited to the grove; never let the boss chase out of its lair.
        const nextX = enemy.x + ((g.player.x - enemy.x) / d) * 12 * dt;
        const nextY = enemy.y + ((g.player.y - enemy.y) / d) * 12 * dt;
        if (Math.hypot(nextX - lair.x, nextY - lair.y) <= 58) {
          enemy.x = clamp(nextX, 8, WIDTH - 8);
          enemy.y = clamp(nextY, 8, HEIGHT - 8);
        }
      } else if (d > 92 && fromLair > 1) {
        enemy.x +=
          ((lair.x - enemy.x) / fromLair) * Math.min(12 * dt, fromLair);
        enemy.y +=
          ((lair.y - enemy.y) / fromLair) * Math.min(12 * dt, fromLair);
      }
    } else if (d <= 24 && enemy.attackCooldown <= 0) {
      enemy.windup = 0.65;
    } else if (d > 20) {
      enemy.x += ((g.player.x - enemy.x) / d) * 16 * dt;
      enemy.y += ((g.player.y - enemy.y) / d) * 16 * dt;
    }
  }
}

export function step(g, dt, dx = 0, dy = 0) {
  if (!g || !Number.isFinite(dt) || dt <= 0) return g;
  dt = Math.min(dt, 0.1);
  stepPlayer(g, dt, dx, dy);
  if (g.scene === "run") stepEnemies(g.enemies, [g], dt);
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
      if (target.kind === "stag") {
        g.loot.push({ x: target.x, y: target.y, value: 10, kind: "crown" });
        g.message = "Copper Stag defeated! Its crown is yours.";
      } else {
        g.loot.push({ x: target.x, y: target.y, value: 2 });
        g.message = "Bug defeated. Salvage dropped.";
      }
    } else {
      if (target.kind !== "stag") target.windup = 0;
      target.attackCooldown = Math.max(target.attackCooldown || 0, 0.25);
      g.message = "Hit! Keep moving when a bug winds up.";
    }
  } else {
    g.message = "No bug in reach.";
  }
  return g;
}
