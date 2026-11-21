import test from "node:test";
import assert from "node:assert/strict";
import { createGame, step, act, attack } from "./game.js";

test("starts at home and starts a fresh run while preserving stash", () => {
  const g = createGame();
  g.stash = 7;
  act(g);
  assert.equal(g.scene, "run");
  assert.equal(g.stash, 7);
  assert.equal(g.player.hp, 5);
  assert.equal(g.enemies.filter((enemy) => enemy.kind !== "stag").length, 2);
});

test("movement works at home and in a run, normalized and bounded", () => {
  const g = createGame();
  step(g, 0.1, 1, 1);
  assert.ok(g.player.x > 160 && g.player.y > 90);
  act(g);
  step(g, 0.1, 1, 1);
  assert.ok(g.player.x > 24 && g.player.y > 90);
  g.player.x = 319;
  step(g, 0.1, 1, 0);
  assert.equal(g.player.x, 315);
});

test("run layouts vary by seed", () => {
  const g = createGame();
  act(g);
  const first = JSON.stringify({ enemies: g.enemies, loot: g.loot });
  act(g); // first call from run does not restart
  assert.equal(g.scene, "run");
  g.scene = "home";
  act(g);
  assert.notEqual(JSON.stringify({ enemies: g.enemies, loot: g.loot }), first);
});

test("collects loot and only banks it after the contested extraction countdown", () => {
  const g = createGame();
  act(g);
  g.player.x = g.loot[0].x;
  g.player.y = g.loot[0].y;
  step(g, 0.016);
  assert.equal(g.carried, 2);
  g.player.x = g.exit.x;
  g.player.y = g.exit.y;
  act(g);
  assert.equal(g.scene, "run");
  assert.equal(g.stash, 0);
  assert.equal(g.extracting, 3);
  step(g, 0.1);
  assert.match(g.message, /2\.9s remaining/);
  assert.equal(g.scene, "run");
  for (let i = 0; i < 29; i++) step(g, 0.1);
  assert.equal(g.scene, "home");
  assert.equal(g.stash, 2);
  act(g);
  assert.equal(g.scene, "run");
  assert.equal(g.stash, 2);
});

test("leaving the beacon interrupts extraction", () => {
  const g = createGame();
  act(g);
  g.player.x = g.exit.x;
  g.player.y = g.exit.y;
  act(g);
  g.player.x = 270;
  step(g, 0.1, -1, 0);
  assert.equal(g.extracting, 0);
  assert.match(g.message, /interrupted/);
});

test("directional attacks defeat nearby bugs and create loot", () => {
  const g = createGame();
  act(g);
  const enemy = g.enemies[0];
  g.player.x = enemy.x - 10;
  g.player.y = enemy.y;
  attack(g, 1, 0);
  assert.equal(enemy.hp, 1);
  g.attackCooldown = 0;
  attack(g, 1, 0);
  assert.equal(g.enemies.includes(enemy), false);
  assert.ok(g.loot.some((item) => item.value === 2));
});

test("death drops carried salvage and restores a recovery kit", () => {
  const g = createGame();
  act(g);
  g.carried = 4;
  g.player.hp = 1;
  const bug = g.enemies[0];
  g.player.x = bug.x;
  g.player.y = bug.y;
  bug.windup = 0.02;
  step(g, 0.05);
  assert.equal(g.scene, "home");
  assert.equal(g.carried, 0);
  assert.equal(g.stash, 0);
  assert.equal(g.player.hp, 5);
});

test("Copper Stag is an optional lair boss with a dangerous telegraph and crown reward", () => {
  const g = createGame();
  act(g);
  const stag = g.enemies.find((enemy) => enemy.kind === "stag");
  assert.ok(stag);
  assert.ok(stag.hp >= 4);
  assert.deepEqual(stag.lair, { x: 276, y: 34 });

  g.player.x = stag.x - 32;
  g.player.y = stag.y;
  step(g, 0.1);
  assert.ok(
    stag.windup >= 1.0,
    "stag should have a longer windup than ordinary bugs",
  );
  assert.match(g.message, /antlers|charge/i);
  const hp = g.player.hp;
  step(g, 0.1, 0, 1);
  assert.equal(g.player.hp, hp, "player can evade the telegraphed charge");

  g.player.x = stag.x - 10;
  g.player.y = stag.y;
  for (let i = 0; i < 5; i++) {
    g.attackCooldown = 0;
    attack(g, 1, 0);
  }
  assert.equal(g.enemies.includes(stag), false);
  const crown = g.loot.find((item) => item.kind === "crown");
  assert.ok(crown);
  assert.ok(crown.value > 2);
  g.player.x = crown.x;
  g.player.y = crown.y;
  step(g, 0.01);
  assert.equal(g.carried, crown.value);
});

test("a crown enters the colony display only after extraction", () => {
  const g = createGame();
  act(g);
  g.enemies = [];
  g.loot = [{ ...g.player, kind: "crown", value: 10 }];
  step(g, 0.1);
  assert.equal(g.crowns, 0);
  Object.assign(g.player, g.exit);
  act(g);
  for (let i = 0; i < 31; i++) step(g, 0.1);
  assert.equal(g.crowns, 1);
  assert.equal(g.stash, 10);
  act(g);
  g.carryingCrown = true;
  g.player.hp = 1;
  Object.assign(g.enemies[0], g.player, { windup: 0.01 });
  step(g, 0.1);
  assert.equal(g.scene, "home");
  assert.equal(g.carryingCrown, false);
  assert.equal(g.crowns, 1);
});
