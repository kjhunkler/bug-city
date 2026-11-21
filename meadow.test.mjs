import { strict as assert } from "node:assert";
import { test } from "node:test";
import { addPlayer, createWorld, movePlayer, removePlayer, stepWorld } from "./meadow.js";

test("meadow movement uses facing, with no world boundary", () => {
  const world = createWorld(42);
  const player = addPlayer(world, "walker");
  movePlayer(player, 30, { forward: 1 });
  assert.deepEqual(player, { x: 0, y: -1980, angle: 0 });

  movePlayer(player, Math.PI / (2 * 2.7), { turn: 1 });
  movePlayer(player, 1, { forward: 1 });
  assert.equal(player.x, 66);
  assert.equal(player.y, -1980);
  assert.equal(player.angle, Math.PI / 2);
});

test("the bug straight ahead is caught and the meadow replenishes", () => {
  const world = createWorld(42);
  addPlayer(world, "walker");
  const first = world.bugs[0];
  stepWorld(world, 1, { walker: { forward: 1 } });
  assert.ok(world.caught >= 1);
  assert.ok(!world.bugs.some(({ id }) => id === first.id));
  assert.ok(world.bugs.length >= 8);
});

test("players share catches and each gets bugs even when far apart", () => {
  const world = createWorld(42);
  const a = addPlayer(world, "a");
  const b = addPlayer(world, "b");
  assert.equal(addPlayer(world, "a"), a);
  const first = world.bugs[0];
  Object.assign(a, { x: first.x, y: first.y });
  Object.assign(b, { x: first.x, y: first.y });
  stepWorld(world, 0);
  assert.equal(world.caught, 1);

  b.x += 10000;
  stepWorld(world, 0);
  for (const player of [a, b]) {
    assert.ok(world.bugs.filter((bug) => Math.hypot(bug.x - player.x, bug.y - player.y) <= 106).length >= 8);
  }
  removePlayer(world, "b");
  assert.ok(world.bugs.every((bug) => Math.hypot(bug.x - a.x, bug.y - a.y) <= 148));
  removePlayer(world, "a");
  assert.deepEqual(world.bugs, []);
  assert.equal(world.caught, 1);
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
