const PLAYER_SPEED = 66;
const TURN_SPEED = 2.7;
const CATCH_RADIUS = 11;
const SPAWN_RADIUS = 106;
const KEEP_RADIUS = 148;
const BUGS_NEAR_PLAYER = 8;
const MAX_STEP = 1 / 30;
const FULL_TURN = 2 * Math.PI;
const BUG_KINDS = ["ladybug", "butterfly", "bee"];

function axis(value) {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

function within(a, b, radius) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= radius ** 2;
}

function random(world) {
  world.randomState = (Math.imul(world.randomState, 1664525) + 1013904223) >>> 0;
  return world.randomState / 0x100000000;
}

function keepBugsNearPlayers(world, players) {
  world.bugs = world.bugs.filter((bug) =>
    players.some((player) => within(bug, player, KEEP_RADIUS)),
  );
  for (const player of players) {
    const nearby = world.bugs.filter((bug) =>
      within(bug, player, SPAWN_RADIUS),
    ).length;
    for (let i = nearby; i < BUGS_NEAR_PLAYER; i++) {
      const direction = i === 0
        ? player.angle + (random(world) - 0.5) * 0.3
        : random(world) * FULL_TURN;
      const distance = i === 0 ? 36 + random(world) * 8 : 32 + random(world) * 72;
      world.bugs.push({
        id: world.nextBugId++,
        x: player.x + Math.sin(direction) * distance,
        y: player.y - Math.cos(direction) * distance,
        kind: BUG_KINDS[Math.floor(random(world) * BUG_KINDS.length)],
      });
    }
  }
}

export function createWorld(seed = 1) {
  seed = seed >>> 0;
  return {
    seed,
    players: Object.create(null),
    bugs: [],
    caught: 0,
    randomState: seed,
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
  keepBugsNearPlayers(world, Object.values(world.players));
  return player;
}

export function removePlayer(world, id) {
  delete world.players[id];
  keepBugsNearPlayers(world, Object.values(world.players));
  return world;
}

export function movePlayer(player, dt, input) {
  if (!Number.isFinite(dt) || dt <= 0) return player;

  const turn = axis(input?.turn) * TURN_SPEED * dt;
  const nextAngle = player.angle + turn;
  const distance = axis(input?.forward) * PLAYER_SPEED * dt;

  // Follow the arc defined by simultaneously turning and walking.
  const halfTurn = turn / 2;
  const chord = turn === 0 ? distance : distance * Math.sin(halfTurn) / halfTurn;
  const direction = player.angle + halfTurn;
  player.x += Math.sin(direction) * chord;
  player.y -= Math.cos(direction) * chord;
  player.angle = nextAngle % FULL_TURN;
  return player;
}

export function stepWorld(world, dt, inputs = {}) {
  if (!Number.isFinite(dt) || dt < 0) return world;

  const entries = Object.entries(world.players);
  const players = entries.map(([, player]) => player);
  const steps = Math.max(1, Math.ceil(dt / MAX_STEP));
  const duration = dt / steps;

  // Subdivide long frames so a walker cannot pass through a bug between catches.
  for (let step = 0; step < steps; step++) {
    for (const [id, player] of entries) {
      movePlayer(player, duration, Object.hasOwn(inputs, id) ? inputs[id] : undefined);
    }
    const previousBugCount = world.bugs.length;
    world.bugs = world.bugs.filter((bug) =>
      players.every((player) => !within(bug, player, CATCH_RADIUS)),
    );
    world.caught += previousBugCount - world.bugs.length;
  }
  keepBugsNearPlayers(world, players);
  return world;
}
