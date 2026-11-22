import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { createGardenRelay } from "./garden-relay.js";
import { stepWorld, FISH_ACTION, fishingSpot, nearestPond } from "./meadow.js";

const tokens = new Map();
function identity(char) {
  const token = char.repeat(64);
  const id = createHash("sha256").update(token).digest("hex").slice(0, 32);
  tokens.set(id, token);
  return id;
}
const HOST = identity("1");
const GUEST = identity("2");
const THIRD = identity("3");

async function fixture(t, options) {
  const relay = createGardenRelay({ seed: 42, ...options });
  const server = createServer(async (req, res) => {
    if (!await relay.route(req, res, new URL(req.url, "http://127.0.0.1"))) {
      res.writeHead(404).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    relay.close();
    server.closeAllConnections();
    server.close();
  });

  const url = (action, token) => `http://127.0.0.1:${server.address().port}/api/garden/${action}?token=${token}`;
  return {
    post(action, id, value, token = tokens.get(id)) {
      return fetch(url(action, token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
    },
    async join(id) {
      const controller = new AbortController();
      const response = await fetch(url("events", tokens.get(id)), { signal: controller.signal });
      assert.equal(response.status, 200);
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      return {
        close() {
          controller.abort();
        },
        async next(match = () => true) {
          while (true) {
            const boundary = buffer.indexOf("\n\n");
            if (boundary === -1) {
              const result = await reader.read();
              assert.equal(result.done, false, "stream ended before the expected event");
              buffer += result.value;
              continue;
            }
            const message = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            if (message.includes("event: identity")) continue;
            const payload = message.split("\n").find((line) => line.startsWith("data: "));
            if (payload) {
              const value = JSON.parse(payload.slice(6));
              if (match(value)) return value;
            }
          }
        },
      };
    },
  };
}

test("players join one garden and the oldest guest continues its simulation", { timeout: 5000 }, async (t) => {
  const relay = await fixture(t);
  const host = await relay.join(HOST);
  const first = await host.next();
  assert.equal(first.host, HOST);

  const guest = await relay.join(GUEST);
  const guestFirst = await guest.next();
  assert.deepEqual(Object.keys(guestFirst.world.players), [HOST, GUEST]);

  const third = await relay.join(THIRD);
  const hostFrame = await host.next((frame) => frame.world?.players[THIRD]);
  const world = hostFrame.world;
  const bug = world.bugs[0];
  Object.assign(world.players[GUEST], { x: bug.x, y: bug.y });
  const movement = { turn: 1, forward: 0.5 };
  assert.equal((await relay.post("input", GUEST, movement)).status, 204);
  const initialInput = await host.next((frame) => frame.id === GUEST);
  stepWorld(world, 1 / 20, { [GUEST]: initialInput.input });
  assert.equal(world.caught, 0);

  const tap = { ...movement, targetBug: bug.id, targetSequence: 2 };
  assert.equal((await relay.post("input", GUEST, tap)).status, 204);
  assert.deepEqual(await host.next((frame) => frame.id === GUEST), { id: GUEST, input: tap });
  assert.equal((await relay.post("input", GUEST, movement)).status, 204);
  const { input: controls } = await host.next((frame) => frame.id === GUEST);
  assert.deepEqual(controls, tap);
  stepWorld(world, 1 / 20, { [GUEST]: controls });
  assert.equal(world.caught, 1);
  assert.equal(world.players[GUEST].swing, 1);
  assert.ok(!world.bugs.some((candidate) => candidate.id === bug.id));
  const submitted = { world, epoch: hostFrame.epoch, revision: hostFrame.revision };
  assert.equal((await relay.post("world", GUEST, submitted)).status, 409);
  assert.equal((await relay.post("world", HOST, submitted, HOST)).status, 401);
  assert.equal((await relay.post("world", HOST, submitted, HOST.repeat(2))).status, 409);
  const malformed = structuredClone(submitted);
  malformed.world.bugs[0].kind = "invalid";
  assert.equal((await relay.post("world", HOST, malformed)).status, 409);
  assert.equal((await relay.post("world", HOST, submitted)).status, 204);
  const shared = await third.next((frame) => frame.world?.caught > 0);
  assert.deepEqual(shared.world, world);

  host.close();
  const promoted = await guest.next((frame) => frame.host === GUEST);
  assert.ok(promoted.epoch > submitted.epoch);
  assert.deepEqual(Object.keys(promoted.world.players), [GUEST, THIRD]);
  assert.deepEqual(promoted.world.players[GUEST], world.players[GUEST]);
  assert.equal(promoted.world.seed, first.world.seed);
  assert.equal(promoted.world.caught, world.caught);
  assert.equal((await relay.post("world", HOST, submitted)).status, 409);

  const guestPlayerBefore = structuredClone(promoted.world.players[GUEST]);
  stepWorld(promoted.world, 1 / 20, { [GUEST]: controls });
  assert.equal((await relay.post("world", GUEST, promoted)).status, 204);
  const continued = await third.next((frame) => frame.host === GUEST &&
    frame.world.players[GUEST].angle !== guestPlayerBefore.angle);
  assert.ok(continued.world.caught >= world.caught);
});

test("a guest's dock tap reaches the host and lands one fish", { timeout: 5000 }, async (t) => {
  const relay = await fixture(t);
  const host = await relay.join(HOST);
  await host.next();
  await relay.join(GUEST);
  const { world } = await host.next((frame) => frame.world?.players[GUEST]);

  const bogus = { turn: 0, forward: 0, targetBug: -2, targetSequence: 1 };
  assert.equal((await relay.post("input", GUEST, bogus)).status, 204);
  assert.equal((await host.next((frame) => frame.id === GUEST)).input.targetBug, null);

  const cast = { turn: 0, forward: 0, targetBug: FISH_ACTION, targetSequence: 1 };
  assert.equal((await relay.post("input", GUEST, cast)).status, 204);
  const { input } = await host.next((frame) => frame.id === GUEST);
  assert.deepEqual(input, cast);

  Object.assign(world.players[GUEST], fishingSpot(nearestPond(world.players[GUEST], world.seed)));
  for (let i = 0; i < 40; i++) stepWorld(world, 1 / 20, { [GUEST]: input });
  assert.equal(world.fish, 1);
});

test("an idle host expires and can rejoin behind the active guest", { timeout: 5000 }, async (t) => {
  const relay = await fixture(t, { hostTimeout: 250, heartbeatInterval: 20 });
  const host = await relay.join(HOST);
  const initial = await host.next();
  const guest = await relay.join(GUEST);
  await guest.next((frame) => frame.host === GUEST);

  const rejoined = await relay.join(HOST);
  const frame = await rejoined.next();
  assert.equal(frame.host, GUEST);
  assert.equal(frame.world.seed, initial.world.seed);
  assert.deepEqual(Object.keys(frame.world.players), [GUEST, HOST]);
});
