import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { connectPages } from "./pages-net.js";

function testBroker() {
  const registry = new Map();
  let nextId = 0;

  class Channel extends EventEmitter {
    constructor(label) {
      super();
      this.label = label;
      this.open = false;
    }

    send(message) {
      queueMicrotask(() => {
        if (this.other.open) this.other.emit("data", message);
      });
    }

    close() {
      this.open = this.other.open = false;
      this.emit("close");
      this.other.emit("close");
    }
  }

  return class Peer extends EventEmitter {
    constructor(id = `guest-${nextId++}`) {
      super();
      this.id = id;
      this.channels = [];
      queueMicrotask(() => {
        if (this.destroyed) return;
        if (registry.has(id)) {
          this.emit("error", { type: "unavailable-id" });
        } else {
          registry.set(id, this);
          this.emit("open");
        }
      });
    }

    connect(id, { label }) {
      const outbound = new Channel(label);
      const inbound = new Channel(label);
      outbound.other = inbound;
      inbound.other = outbound;
      this.channels.push(outbound);
      queueMicrotask(() => {
        if (this.destroyed) return;
        const host = registry.get(id);
        if (!host) {
          this.emit("error", { type: "peer-unavailable" });
          return;
        }
        host.channels.push(inbound);
        host.emit("connection", inbound);
        inbound.open = outbound.open = true;
        inbound.emit("open");
        outbound.emit("open");
      });
      return outbound;
    }

    destroy() {
      this.destroyed = true;
      if (registry.get(this.id) === this) registry.delete(this.id);
      for (const channel of this.channels) {
        if (channel.open) channel.close();
      }
    }
  };
}

async function until(condition) {
  let time = 0;
  while (!condition() && time < 6000) {
    await delay(25);
    time += 25;
  }
  assert.ok(condition(), "Timed out waiting for meadow update");
}

function client(t, Peer, scope = "https://example.test/garden/") {
  const game = {};
  game.net = connectPages({
    Peer,
    scope,
    onStatus: (status) => { game.status = status; },
    onWorld: (world, id) => {
      game.world = structuredClone(world);
      game.id = id;
    },
  });
  t.after(() => game.net.close());
  return game;
}

test("automatic join keeps one meadow and migrates it to the oldest remaining guest", async (t) => {
  const Peer = testBroker();
  const original = client(t, Peer);
  await until(() => original.status === "hosting");
  original.net.input({ forward: 1, turn: 0 });
  await until(() => original.world.caught > 0);
  original.net.input({ forward: 0, turn: 0 });

  const first = client(t, Peer);
  await until(() => first.status === "online");
  const second = client(t, Peer);
  await until(() => second.status === "online");
  assert.equal(Object.keys(second.world.players).length, 3);
  assert.deepEqual(second.world.bugs, original.world.bugs);

  first.net.input({ forward: 200, turn: NaN });
  const startY = first.world.players[first.id].y;
  await until(() => first.world.players[first.id].y < startY - 24);
  first.net.input({ forward: 0, turn: 0 });
  await delay(150);
  const last = first.world;
  original.net.close();
  await until(() => first.status === "hosting" && second.status === "online");
  assert.equal(Object.keys(second.world.players).length, 2);
  assert.equal(second.world.players[original.id], undefined);
  assert.equal(second.world.players[first.id].angle, last.players[first.id].angle);
  assert.ok(second.world.players[first.id].y <= last.players[first.id].y);
  assert.ok(second.world.players[first.id].y >= last.players[first.id].y - 7);
  assert.ok(last.caught > 0);
  assert.ok(second.world.caught >= last.caught);
});

test("different Pages directories get separate meadows on the same broker", async (t) => {
  const Peer = testBroker();
  const garden = client(t, Peer, "https://example.test/garden/");
  const park = client(t, Peer, "https://example.test/park/");
  await until(() => garden.status === "hosting" && park.status === "hosting");
  assert.deepEqual(Object.keys(garden.world.players), [garden.id]);
  assert.deepEqual(Object.keys(park.world.players), [park.id]);
});
