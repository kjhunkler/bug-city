import test from "node:test";
import assert from "node:assert/strict";
import { createParty, updateParty, viewParty } from "./coop.js";

test("both slots see the same run and move independently", () => {
  const party = createParty();
  const host = viewParty(party, 0);
  const guest = viewParty(party, 1);
  assert.equal(host.scene, "run");
  assert.equal(guest.scene, "run");
  assert.deepEqual(host.enemies, guest.enemies);
  assert.deepEqual(host.loot, guest.loot);
  assert.deepEqual(host.ally, guest.player);
  assert.deepEqual(guest.ally, host.player);
  assert.notDeepEqual(host.player, guest.player);

  updateParty(party, 0.1, [{ dx: 1 }, { dy: -1 }]);
  assert.ok(viewParty(party, 0).player.x > host.player.x);
  assert.equal(viewParty(party, 0).player.y, host.player.y);
  assert.ok(viewParty(party, 1).player.y < guest.player.y);
  assert.equal(viewParty(party, 1).player.x, guest.player.x);
  host.enemies[0].hp = -100;
  assert.ok(viewParty(party, 0).enemies[0].hp > 0);
});

test("both players can damage the same boss, and its crown can only be picked up once", () => {
  const party = createParty();
  const [host, guest] = party.players;
  const stag = host.enemies.find((enemy) => enemy.kind === "stag");
  Object.assign(host.player, { x: stag.x - 10, y: stag.y });
  Object.assign(guest.player, { x: stag.x + 10, y: stag.y });
  const inputs = [{ attack: true }, { attack: true, aimX: -1 }];

  updateParty(party, 0.1, inputs);
  assert.equal(stag.hp, 3);
  updateParty(party, 0.1, inputs);
  assert.equal(stag.hp, 3, "attack cooldown applies independently");
  for (let i = 0; i < 8; i++) updateParty(party, 0.1, inputs);
  assert.equal(guest.enemies.includes(stag), false);
  assert.equal(Number(host.carryingCrown) + Number(guest.carryingCrown), 1);
  assert.equal(host.carried + guest.carried, 10);
  assert.equal(host.loot.some((item) => item.kind === "crown"), false);
});

test("enemy hit and lethal salvage loss affect only players within range", () => {
  const party = createParty();
  const [host, guest] = party.players;
  const bug = host.enemies[0];
  Object.assign(host.player, { x: bug.x, y: bug.y, hp: 1 });
  host.carried = 4;
  guest.carried = 2;
  bug.windup = 0.02;
  updateParty(party, 0.1);

  assert.equal(host.scene, "home");
  assert.equal(host.carried, 0);
  assert.equal(host.stash, 0);
  assert.equal(guest.scene, "run");
  assert.equal(guest.player.hp, 5);
  assert.equal(guest.carried, 2);
  assert.equal(viewParty(party, 0).ally, null);
  assert.equal(viewParty(party, 1).ally, null);
});

test("extraction banks each player's own loot and next expedition waits for both", () => {
  const party = createParty();
  const [host, guest] = party.players;
  host.enemies.length = 0;
  host.carried = 10;
  host.carryingCrown = true;
  guest.carried = 2;
  Object.assign(host.player, host.exit);
  updateParty(party, 0.1, [{ action: true }]);
  for (let i = 0; i < 30; i++) updateParty(party, 0.1);
  assert.equal(host.scene, "home");
  assert.equal(host.crowns, 1);
  assert.equal(host.stash, 10);
  assert.equal(guest.scene, "run");
  updateParty(party, 0.1, [{ action: true }]);
  assert.equal(host.scene, "home");
  assert.equal(guest.runNumber, 1);

  Object.assign(guest.player, guest.exit);
  updateParty(party, 0.1, [{}, { action: true }]);
  for (let i = 0; i < 30; i++) updateParty(party, 0.1);
  assert.equal(guest.scene, "home");
  assert.equal(guest.stash, 2);
  assert.deepEqual(viewParty(party, 1).ally, host.player);

  updateParty(party, 0.1, [{}, { action: true }]);
  assert.equal(host.scene, "run");
  assert.equal(guest.scene, "run");
  assert.equal(host.runNumber, 2);
  assert.equal(guest.runNumber, 2);
  assert.equal(host.stash, 10);
  assert.equal(guest.stash, 2);
  assert.equal(host.enemies, guest.enemies);
});

test("shared enemy windup advances once per tick and can hit both players", () => {
  const party = createParty();
  const [host, guest] = party.players;
  const stag = host.enemies.find((enemy) => enemy.kind === "stag");
  Object.assign(host.player, { x: stag.x, y: stag.y });
  Object.assign(guest.player, { x: stag.x, y: stag.y + 10 });
  stag.windup = 0.15;

  updateParty(party, 0.1);
  assert.ok(stag.windup > 0);
  assert.equal(host.player.hp, 5);
  assert.equal(guest.player.hp, 5);

  updateParty(party, 0.1);
  assert.equal(stag.windup, 0);
  assert.equal(host.player.hp, 3);
  assert.equal(guest.player.hp, 3);
});
