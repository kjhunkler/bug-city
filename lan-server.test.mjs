import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createLanRouter } from "./lan-server.js";

async function harness(t, options) {
  const lan = createLanRouter(options);
  const server = createServer((req, res) => lan.route(req, res, new URL(req.url, "http://localhost")));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    lan.close();
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const api = `http://127.0.0.1:${server.address().port}/api/lan/rooms`;
  const post = (path, body, token) => fetch(api + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2000),
  });
  return { api, post };
}

async function connect(api, seat) {
  const controller = new AbortController();
  const res = await fetch(`${api}/${seat.code}/events?token=${seat.token}`, {
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]),
  });
  assert.equal(res.status, 200);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let received = "";
  return {
    abort: () => controller.abort(),
    async next(predicate) {
      while (true) {
        const end = received.indexOf("\n\n");
        if (end >= 0) {
          const event = received.slice(0, end);
          received = received.slice(end + 2);
          if (event.startsWith("data: ")) {
            const value = JSON.parse(event.slice(6));
            if (predicate(value)) return value;
          }
          continue;
        }
        const chunk = await reader.read();
        assert.equal(chunk.done, false, "stream ended before expected event");
        received += chunk.value;
      }
    },
  };
}

test("LAN players join by room code and receive authoritative movement, disconnect, and resume", async (t) => {
  const { api, post } = await harness(t);
  const created = await post("", {});
  assert.equal(created.status, 201);
  const host = await created.json();
  assert.match(host.code, /^[A-Z2-9]{6}$/);
  assert.equal(host.slot, 0);
  const hostEvents = await connect(api, host);
  assert.deepEqual(await hostEvents.next(() => true), { status: "waiting", state: null });

  const joined = await post("/join", { code: host.code.toLowerCase() });
  assert.equal(joined.status, 200);
  const guest = await joined.json();
  assert.equal(guest.slot, 1);
  assert.notEqual(guest.token, host.token);
  assert.equal((await post("/join", { code: host.code })).status, 409);
  assert.equal((await post(`/${host.code}/input`, { dx: 1 }, "bad-token")).status, 403);

  const guestEvents = await connect(api, guest);
  const connected = ({ status }) => status === "connected";
  const { state: before } = await guestEvents.next(connected);
  assert.equal(before.scene, "run");
  assert.deepEqual((await hostEvents.next(connected)).state.player, before.ally);
  assert.equal((await post(`/${guest.code}/input`, { dx: 1000 }, guest.token)).status, 204);
  const moved = await hostEvents.next(({ state }) => state?.ally.x > before.player.x);
  assert.ok(moved.state.ally.x - before.player.x <= 7.2);
  assert.deepEqual(moved.state.player, before.ally);
  guestEvents.abort();
  const paused = await hostEvents.next(({ status }) => status === "partner-disconnected");

  const reconnected = await connect(api, guest);
  const { state: resumed } = await reconnected.next(connected);
  assert.deepEqual(resumed.player, paused.state.ally);
  assert.equal((await fetch(`${api}/${guest.code}/session`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${guest.token}` },
    signal: AbortSignal.timeout(2000),
  })).status, 204);
  assert.deepEqual(
    await hostEvents.next(({ status }) => status === "closed"),
    { status: "closed", state: null },
  );
});

test("waiting LAN rooms expire and request bodies are bounded", async (t) => {
  const { api, post } = await harness(t, { waitingMs: 500 });
  assert.equal((await post("", { padding: "x".repeat(2000) })).status, 413);
  const host = await (await post("", {})).json();
  const events = await connect(api, host);
  await events.next(({ status }) => status === "waiting");
  assert.deepEqual(
    await events.next(({ status }) => status === "closed"),
    { status: "closed", state: null },
  );
  assert.equal((await post("/join", { code: host.code })).status, 404);
});
