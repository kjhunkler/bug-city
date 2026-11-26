const PLAYER_SPEED = 66;
const TURN_SPEED = 1.85;
export const NET_REACH = 56;
export const FISH_ACTION = -1;
export const REEL_ACTION = -2;
export const POND_SPACING = 760;
export const BUG_KINDS = [
  "ladybug",
  "butterfly",
  "bee",
  "dragonfly",
  "caterpillar",
  "firefly",
];
const PATCH_SIZE = 96;
const RECOVERY = 90;
const FULL_TURN = 2 * Math.PI;

export const validCoat = (value) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function forestRegion(x, y) {
  const region = Math.floor((x + 160) / 320) + 2 * Math.floor((y + 160) / 320);
  return ((region % 3) + 3) % 3;
}

function resident(x, y, n, seed, starter, slot) {
  if (starter) return slot === 0 ? "ladybug" : "caterpillar";
  const pond = nearestPond({ x, y }, seed);
  if (within({ x, y }, pond, 155) && (n >>> 8) % 3 !== 0) return "dragonfly";
  const zone = forestRegion(x, y);
  if (zone === 2 && (n >>> 12) % 4 === 0) return "firefly";
  if (zone === 1) return (n >>> 9) % 3 ? "butterfly" : "bee";
  return ["ladybug", "caterpillar", "bee"][(n >>> 16) % 3];
}

function axis(value) {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

function within(a, b, radius) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= radius ** 2;
}

function hash(x, y, seed) {
  let n = Math.imul(x ^ seed, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

export function pondAt(ix, iy, seed) {
  const n = hash(ix, iy, seed);
  return {
    x: ix * POND_SPACING + 15 + (n % 24),
    y: iy * POND_SPACING - 220 + ((n >>> 8) % 20),
  };
}

export function fishingSpot(pond) {
  return { x: pond.x, y: pond.y + 21 };
}

export function nearestPond(point, seed) {
  return pondAt(
    Math.round((point.x - 27) / POND_SPACING),
    Math.round((point.y + 210) / POND_SPACING),
    seed,
  );
}

export function inWater(point, pond) {
  return ((point.x - pond.x) / 36) ** 2 + ((point.y - pond.y) / 22) ** 2 <= 1;
}

export function inReach(a, b) {
  return within(a, b, NET_REACH);
}

// A patch has fixed residents. Only caught slots need to be remembered off-screen.
function loadPatches(world, players) {
  const existing = new Map(world.bugs.map((b) => [b.slot, b]));
  const patches = new Set();
  const bugs = [];
  for (const [slot, until] of Object.entries(world.resting))
    if (until <= world.time) delete world.resting[slot];
  for (const player of players) {
    const cx = Math.round(player.x / PATCH_SIZE),
      cy = Math.round(player.y / PATCH_SIZE);
    for (const dy of [0, -1, 1])
      for (const dx of [0, -1, 1]) {
        const ix = cx + dx,
          iy = cy + dy,
          key = `${ix},${iy}`;
        if (patches.has(key)) continue;
        patches.add(key);
        const residents = ix === 0 && iy === 0 ? 2 : 1;
        for (let i = 0; i < residents; i++) {
          if ((ix || iy) && hash(ix, iy, world.seed) % 5 > 2) continue;
          const slot = `${key},${i}`;
          if (world.resting[slot]) continue;
          let bug = existing.get(slot);
          if (!bug) {
            const n = hash(ix, iy, world.seed + i);
            const starter = ix === 0 && iy === 0 && i < 2;
            const x =
              ix * PATCH_SIZE + (starter ? (i ? 15 : -9) : (n % 81) - 40);
            const y = iy * PATCH_SIZE + (starter ? -21 : ((n >>> 8) % 81) - 40);
            if (inWater({ x, y }, nearestPond({ x, y }, world.seed))) continue;
            bug = {
              id: world.nextBugId++,
              slot,
              x,
              y,
              cover: n & 1 ? "stone" : "fern",
              kind: resident(x, y, n, world.seed, starter, i),
            };
          }
          bugs.push(bug);
        }
      }
  }
  world.bugs = bugs;
}

export function createWorld(seed = 1) {
  seed = seed >>> 0;
  return {
    seed,
    randomState: seed,
    players: Object.create(null),
    bugs: [],
    caught: 0,
    time: 0,
    resting: {},
    collection: Object.fromEntries(BUG_KINDS.map((kind) => [kind, 0])),
    fish: 0,
    nextBugId: 1,
  };
}

export function addPlayer(world, id) {
  if (Object.hasOwn(world.players, id)) return world.players[id];

  const [other] = Object.values(world.players);
  const player = other
    ? {
        x: other.x + Math.cos(other.angle) * 16,
        y: other.y + Math.sin(other.angle) * 16,
        angle: other.angle,
      }
    : { x: 0, y: 0, angle: 0 };
  Object.defineProperty(world.players, id, {
    value: player,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  loadPatches(world, Object.values(world.players));
  return player;
}

export function removePlayer(world, id) {
  delete world.players[id];
  loadPatches(world, Object.values(world.players));
  return world;
}

export function movePlayer(player, dt, input, seed) {
  if (!Number.isFinite(dt) || dt <= 0) return player;

  const turn = axis(input?.turn) * TURN_SPEED * dt;
  const nextAngle = player.angle + turn;
  const distance = axis(input?.forward) * PLAYER_SPEED * dt;

  // Follow the arc defined by simultaneously turning and walking.
  const halfTurn = turn / 2;
  const chord =
    turn === 0 ? distance : (distance * Math.sin(halfTurn)) / halfTurn;
  const direction = player.angle + halfTurn;
  const nextX = player.x + Math.sin(direction) * chord,
    nextY = player.y - Math.cos(direction) * chord;
  if (seed === undefined) {
    player.x = nextX;
    player.y = nextY;
  } else {
    // Slide along the bank while walking diagonally into a pond.
    const pond = nearestPond({ x: nextX, y: nextY }, seed);
    if (!inWater({ x: nextX, y: player.y }, pond)) player.x = nextX;
    if (!inWater({ x: player.x, y: nextY }, pond)) player.y = nextY;
  }
  player.angle = nextAngle % FULL_TURN;
  return player;
}

export function isAction(target) {
  return (
    target === FISH_ACTION ||
    target === REEL_ACTION ||
    (Number.isSafeInteger(target) && target > 0)
  );
}

function act(world, player, input) {
  const target = input?.targetBug;
  if (target === null) {
    delete player.lastTarget;
    delete player.lastTargetSequence;
    return;
  }
  if (!isAction(target)) return;

  const sequence = Number.isSafeInteger(input.targetSequence)
    ? input.targetSequence
    : 0;
  if (target === player.lastTarget && sequence === player.lastTargetSequence)
    return;

  player.lastTarget = target;
  player.lastTargetSequence = sequence;
  if (target === FISH_ACTION) {
    const spot = fishingSpot(nearestPond(player, world.seed));
    if (!inReach(player, spot)) return;
    const roll = hash(sequence, Math.floor(world.time * 13), world.seed);
    player.castSeq = sequence;
    player.biteAt = world.time + 2.2 + (roll % 240) / 100;
    player.castUntil = player.biteAt + 3;
    player.catchRoll = roll;
    return;
  }
  if (target === REEL_ACTION) {
    player.landing = { sequence };
    if (
      player.castUntil &&
      world.time >= player.biteAt &&
      world.time <= player.castUntil &&
      inReach(player, fishingSpot(nearestPond(player, world.seed)))
    ) {
      const roll = player.catchRoll,
        pick = roll % 16;
      if (pick < 2)
        player.landing.name = pick ? "river pearl" : "lost brass button";
      else {
        const [name, min, range] =
          pick < 8
            ? ["Brook minnow", 4, 9]
            : pick < 12
              ? ["Sunfish", 10, 17]
              : pick < 15
                ? ["Speckled trout", 18, 29]
                : ["Moon carp", 32, 49];
        Object.assign(player.landing, {
          name,
          cm: min + ((roll >>> 8) % range),
        });
        world.fish++;
      }
    }
    delete player.castUntil;
    return;
  }
  const index = world.bugs.findIndex((bug) => bug.id === target);
  const bug = world.bugs[index];
  if (!bug || !inReach(bug, player)) return;

  world.bugs.splice(index, 1);
  player.find = { id: bug.id, sequence, kind: bug.kind };
  world.caught++;
  world.collection[bug.kind]++;
  world.resting[bug.slot] = world.time + RECOVERY;
  player.swingX = bug.x;
  player.swingY = bug.y;
  player.swing = (player.swing ?? 0) + 1;
}

export function stepWorld(world, dt, inputs = {}) {
  if (!Number.isFinite(dt) || dt < 0) return world;

  for (const [id, player] of Object.entries(world.players)) {
    const input = Object.hasOwn(inputs, id) ? inputs[id] : undefined;
    if (validCoat(input?.coat)) player.coat = input.coat;
    act(world, player, input);
    movePlayer(player, dt, input, world.seed);
    if (player.castUntil) {
      if (!inReach(player, fishingSpot(nearestPond(player, world.seed))))
        delete player.castUntil;
      else if (world.time + dt >= player.castUntil) {
        delete player.castUntil;
      }
    }
  }
  world.time += dt;
  loadPatches(world, Object.values(world.players));
  return world;
}

export function validHabitat(world) {
  const count = (n) => Number.isSafeInteger(n) && n >= 0;
  return (
    Number.isFinite(world.time) &&
    world.time >= 0 &&
    count(world.fish) &&
    world.collection &&
    BUG_KINDS.every((k) => count(world.collection[k])) &&
    BUG_KINDS.reduce((n, k) => n + world.collection[k], 0) === world.caught &&
    world.resting &&
    typeof world.resting === "object" &&
    !Array.isArray(world.resting) &&
    Object.entries(world.resting).every(
      ([k, t]) => /^-?\d+,-?\d+,[0-2]$/.test(k) && Number.isFinite(t),
    ) &&
    world.bugs.every(
      (b) =>
        b && /^-?\d+,-?\d+,[0-2]$/.test(b.slot) && BUG_KINDS.includes(b.kind),
    )
  );
}
