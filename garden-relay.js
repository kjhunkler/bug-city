import { createHash, randomBytes } from "node:crypto";
import { addPlayer, createWorld, removePlayer } from "./meadow.js";

const API = "/api/garden/";
const MAX_BODY = 128 * 1024;
const TOKEN = /^[a-f0-9]{64}$/;
const BUG_KINDS = new Set(["ladybug", "butterfly", "bee"]);

function coordinate(value) {
  return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}

function snapshotMatches(world, previous) {
  return world?.seed === previous.seed &&
    Number.isInteger(world.randomState) && world.randomState >= 0 && world.randomState <= 0xffffffff &&
    Number.isSafeInteger(world.nextBugId) && world.nextBugId >= previous.nextBugId &&
    Number.isSafeInteger(world.caught) && world.caught >= previous.caught && world.caught < world.nextBugId &&
    Array.isArray(world.bugs) && world.bugs.every((bug) =>
      Number.isSafeInteger(bug?.id) && bug.id > 0 && bug.id < world.nextBugId &&
      coordinate(bug.x) && coordinate(bug.y) && BUG_KINDS.has(bug.kind)
    ) &&
    new Set(world.bugs.map((bug) => bug.id)).size === world.bugs.length &&
    world.players && Object.keys(world.players).length === Object.keys(previous.players).length &&
    Object.keys(previous.players).every((id) => {
      const player = world.players[id];
      return coordinate(player?.x) && coordinate(player.y) &&
        Number.isFinite(player.angle) && Math.abs(player.angle) < 2 * Math.PI;
    });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) return null;
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

export function createGardenRelay({
  hostTimeout = 10_000,
  heartbeatInterval = 2_000,
  seed = randomBytes(4).readUInt32BE(),
} = {}) {
  const peers = new Map();
  let world = createWorld(seed);
  let host = null;
  let epoch = 0;
  let revision = 0;
  let lastSnapshot = 0;

  function publish() {
    const event = JSON.stringify({ world, host, epoch, revision,
      inputs: Object.fromEntries([...peers].map(([id, peer]) => [id, peer.input])),
    });
    for (const peer of peers.values()) peer.res.write(`data: ${event}\n\n`);
  }

  function chooseHost() {
    host = peers.keys().next().value ?? null;
    epoch += 1;
    lastSnapshot = Date.now();
  }

  function leave(id, peer) {
    if (peers.get(id) !== peer) return;
    peers.delete(id);
    removePlayer(world, id);
    revision += 1;
    if (host === id) chooseHost();
    publish();
  }

  const heartbeat = setInterval(() => {
    if (host && Date.now() - lastSnapshot >= hostTimeout) {
      const peer = peers.get(host);
      leave(host, peer);
      peer.res.end();
    }
    for (const peer of peers.values()) peer.res.write(": heartbeat\n\n");
  }, heartbeatInterval);
  heartbeat.unref();

  return {
    async route(req, res, url) {
      if (!url.pathname.startsWith(API)) return false;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Cache-Control", "no-store");

      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return true;
      }

      const token = url.searchParams.get("token");
      if (!token || !TOKEN.test(token)) {
        res.writeHead(401).end();
        return true;
      }
      const id = createHash("sha256").update(token).digest("hex").slice(0, 32);

      if (url.pathname === API + "events" && req.method === "GET") {
        const oldPeer = peers.get(id);
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no",
        });
        res.write(`retry: 1000\nevent: identity\ndata: ${JSON.stringify(id)}\n\n`);
        const peer = { res, input: oldPeer?.input ?? { turn: 0, forward: 0, targetBug: null, targetSequence: null } };
        peers.set(id, peer);
        if (oldPeer) {
          oldPeer.res.end();
        } else {
          addPlayer(world, id);
          revision += 1;
          if (!host) chooseHost();
        }
        res.on("close", () => leave(id, peer));
        publish();
        return true;
      }

      const action = url.pathname.slice(API.length);
      if (req.method !== "POST" || (action !== "input" && action !== "world")) {
        res.writeHead(404).end();
        return true;
      }

      const peer = peers.get(id);
      if (!peer) {
        res.writeHead(409).end();
        return true;
      }

      let body;
      try {
        body = await readBody(req);
      } catch {
        res.writeHead(400).end();
        return true;
      }

      if (peers.get(id) !== peer) {
        res.writeHead(409).end();
      } else if (action === "input" && Number.isFinite(body?.turn) && Number.isFinite(body.forward)) {
        const hasTarget = Number.isSafeInteger(body.targetBug) && body.targetBug > 0;
        const targetBug = hasTarget ? body.targetBug : peer.input.targetBug;
        const targetSequence = hasTarget && Number.isSafeInteger(body.targetSequence) && body.targetSequence > 0
          ? body.targetSequence
          : targetBug === peer.input.targetBug ? peer.input.targetSequence : null;
        peer.input = {
          turn: Math.max(-1, Math.min(1, body.turn)),
          forward: Math.max(-1, Math.min(1, body.forward)),
          targetBug,
          targetSequence,
        };
        if (host !== id) {
          const event = JSON.stringify({ id, input: peer.input });
          peers.get(host).res.write(`event: input\ndata: ${event}\n\n`);
        }
        res.writeHead(204).end();
      } else if (action === "world" && id === host && body?.epoch === epoch &&
                 body.revision === revision && snapshotMatches(body.world, world)) {
        world = body.world;
        lastSnapshot = Date.now();
        publish();
        res.writeHead(204).end();
      } else {
        res.writeHead(409).end();
      }
      return true;
    },
    close() {
      clearInterval(heartbeat);
      const connected = [...peers.values()];
      peers.clear();
      for (const peer of connected) peer.res.end();
    },
  };
}
