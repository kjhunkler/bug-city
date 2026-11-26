import { strict as assert } from "node:assert";
import { test } from "node:test";
import { addPlayer, createWorld, movePlayer, removePlayer, stepWorld, FISH_ACTION, REEL_ACTION, NET_REACH, nearestPond, fishingSpot } from "./meadow.js";

test("meadow movement uses facing, with no world boundary", () => {
  const world = createWorld(42);
  const player = addPlayer(world, "walker");
  movePlayer(player, 30, { forward: 1 });
  assert.deepEqual(player, { x: 0, y: -1980, angle: 0 });

  movePlayer(player, Math.PI / (2 * 1.85), { turn: 1 });
  movePlayer(player, 1, { forward: 1 });
  assert.equal(player.x, 66);
  assert.equal(player.y, -1980);
  assert.equal(player.angle, Math.PI / 2);
});

test("walking over a bug leaves it available for an explicit catch", () => {
  const world = createWorld(42);
  addPlayer(world, "walker");
  const first = world.bugs[0];
  stepWorld(world, 0.4, { walker: { forward: 1 } });
  assert.equal(world.caught, 0);
  assert.ok(world.bugs.some(({ id }) => id === first.id));

  const tap = { walker: { targetBug: first.id } };
  stepWorld(world, 0, tap);
  stepWorld(world, 0, tap);
  assert.equal(world.caught, 1);
  assert.ok(!world.bugs.some(({ id }) => id === first.id));
  assert.equal(world.collection[first.kind], 1);
  const { swing, swingX, swingY } = world.players.walker;
  assert.deepEqual([swing, swingX, swingY], [1, first.x, first.y]);
});

test("walking in range does not retry a tap", () => {
  const world = createWorld(42);
  addPlayer(world, "a");
  const b = addPlayer(world, "b");
  b.y = -NET_REACH - 14;
  const first = world.bugs[0];
  Object.assign(first, { x: 0, y: b.y });
  const tap = { a: { targetBug: first.id, forward: 1 } };
  stepWorld(world, 1, tap);
  stepWorld(world, 0);
  stepWorld(world, 0, tap);
  assert.equal(world.caught, 0);

  stepWorld(world, 0, { a: { targetBug: first.id, targetSequence: 1 } });
  assert.equal(world.caught, 1);
});

test("players share catches and each gets bugs even when far apart", () => {
  const world = createWorld(42);
  const a = addPlayer(world, "a");
  const b = addPlayer(world, "b");
  assert.equal(addPlayer(world, "a"), a);
  const first = world.bugs[0];
  stepWorld(world, 0, {
    a: { targetBug: first.id },
    b: { targetBug: first.id },
  });
  assert.equal(world.caught, 1);

  b.x += 10000;
  stepWorld(world, 0);
  for (const player of [a, b]) {
    assert.ok(world.bugs.some((bug) => Math.hypot(bug.x - player.x, bug.y - player.y) <= 100));
  }
  removePlayer(world, "b");
  assert.ok(world.bugs.every((bug) => Math.abs(bug.x - a.x) < 360));
  removePlayer(world, "a");
  assert.deepEqual(world.bugs, []);
  assert.equal(world.caught, 1);
});

test("a cleared patch stays empty on a return visit until it recovers", () => {
  const world = createWorld(42), player = addPlayer(world, "a");
  const residents = world.bugs.filter(b => b.slot.startsWith("0,0,"));
  for (const b of residents) {
    Object.assign(player, { x: b.x, y: b.y });
    stepWorld(world, 0, { a: { targetBug: b.id } });
  }
  assert.equal(world.caught, residents.length);
  player.x = 500;
  stepWorld(world, 5);
  player.x = 0;
  stepWorld(world, 80);
  assert.ok(!world.bugs.some(b => b.slot.startsWith("0,0,")));
  stepWorld(world, 6);
  assert.equal(world.bugs.filter(b => b.slot.startsWith("0,0,")).length, residents.length);
});

test("fishing requires a fresh tap near the dock and resolves once outside the bug jar", () => {
  const world = createWorld(42), player = addPlayer(world, "a");
  player.y = 100;
  const input = { a: { targetBug: FISH_ACTION, targetSequence: 1 } };
  stepWorld(world, 0, input);
  assert.equal(player.castUntil, undefined);
  Object.assign(player, fishingSpot(nearestPond(player, world.seed)));
  stepWorld(world, 2, input);
  assert.equal(world.fish, 0);
  input.a.targetSequence++;
  stepWorld(world, 0.1, input);
  assert.ok(player.castUntil);
  stepWorld(world, player.biteAt-world.time+0.1, input);
  assert.equal(world.fish,0);
  input.a.targetBug=REEL_ACTION;input.a.targetSequence++;
  stepWorld(world,0,input);stepWorld(world,0,input);
  assert.ok(player.landing.name);
  assert.equal(world.fish,player.landing.cm ? 1 : 0);
  assert.equal(world.caught, 0);
});

test("identical seeds and actions reproduce a serializable world", () => {
  const play = (seed) => {
    const world = createWorld(seed);
    addPlayer(world, "a");
    addPlayer(world, "b");
    for (let frame = 0; frame < 120; frame++) {
      stepWorld(world, 1 / 60, { a: { forward: 1 }, b: { forward: 0.7, turn: -0.6 } });
    }
    return JSON.stringify(world);
  };
  assert.equal(play(42), play(42));
  assert.notEqual(play(42), play(43));
});
