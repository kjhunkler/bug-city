const PLAYER_SPEED = 66;
const TURN_SPEED = 1.85;
const CATCH_RADIUS = 210;
const SPAWN_RADIUS = 106;
const KEEP_RADIUS = 148;
const BUGS_NEAR_PLAYER = 8;
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

function catchBug(world, player, input) {
  const target = input?.targetBug;
  if (target === null) {
    delete player.lastTarget;
    delete player.lastTargetSequence;
    return;
  }
  if (!Number.isSafeInteger(target) || target <= 0) return;

  const sequence = Number.isSafeInteger(input.targetSequence) ? input.targetSequence : 0;
  if (target === player.lastTarget && sequence === player.lastTargetSequence)
    return;

  player.lastTarget = target;
  player.lastTargetSequence = sequence;
  const index = world.bugs.findIndex((bug) => bug.id === target);
  const bug = world.bugs[index];
  if (!bug || !within(bug, player, CATCH_RADIUS)) return;

  world.bugs.splice(index, 1);
  world.caught++;
  player.swingX = bug.x;
  player.swingY = bug.y;
  player.swing = (player.swing ?? 0) + 1;
}

export function stepWorld(world, dt, inputs = {}) {
  if (!Number.isFinite(dt) || dt < 0) return world;

  for (const [id, player] of Object.entries(world.players)) {
    const input = Object.hasOwn(inputs, id) ? inputs[id] : undefined;
    catchBug(world, player, input);
    movePlayer(player, dt, input);
  }
  keepBugsNearPlayers(world, Object.values(world.players));
  return world;
}
