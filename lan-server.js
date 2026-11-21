import { randomBytes, randomInt } from "node:crypto";
import { createParty, updateParty, viewParty } from "./coop.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TICK_MS = 50;
const INPUT_STALE_MS = 350;
const INPUTS_PER_SECOND = 60;
const MAX_ROOMS = 64;
const MAX_BODY = 1024;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
    req.resume();
    throw new RequestError(415, "Send an application/json request.");
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_BODY) {
      req.resume();
      throw new RequestError(413, "Request is too large.");
    }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new RequestError(400, "Send a valid JSON object.");
  }
}

function createSeat(now) {
  return {
    token: randomBytes(24).toString("base64url"),
    stream: null,
    disconnectedAt: now,
    lastSent: 0,
    lastStatus: null,
    input: {},
    inputAt: 0,
    windowAt: now,
    inputCount: 0,
  };
}

function writeEvent(seat, status, state, now) {
  if (!seat.stream || seat.stream.writableNeedDrain) return;
  seat.stream.write(`data: ${JSON.stringify({ status, state })}\n\n`);
  seat.lastStatus = status;
  seat.lastSent = now;
}

function consumeInput(seat, now) {
  const input = now - seat.inputAt <= INPUT_STALE_MS ? seat.input : {};
  seat.input = { dx: input.dx, dy: input.dy };
  return input;
}

function updateInput(seat, input, now) {
  if (now - seat.windowAt >= 1000) {
    seat.windowAt = now;
    seat.inputCount = 0;
  }
  if (++seat.inputCount > INPUTS_PER_SECOND) {
    throw new RequestError(429, "Input is arriving too quickly.");
  }
  const axis = (value) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  const aimX = Number.isFinite(input.aimX) ? input.aimX : 0;
  const aimY = Number.isFinite(input.aimY) ? input.aimY : 0;
  const aimScale = Math.max(1, Math.abs(aimX), Math.abs(aimY));
  seat.input = {
    dx: axis(input.dx),
    dy: axis(input.dy),
    attack: input.attack === true || seat.input.attack === true,
    action: input.action === true || seat.input.action === true,
    aimX: input.attack === true ? aimX / aimScale : seat.input.aimX,
    aimY: input.attack === true ? aimY / aimScale : seat.input.aimY,
  };
  seat.inputAt = now;
}

export function createLanRouter({
  waitingMs = 10 * 60_000,
  reconnectMs = 90_000,
} = {}) {
  const rooms = new Map();

  function closeRoom(room, now) {
    rooms.delete(room.code);
    for (const seat of room.seats) {
      writeEvent(seat, "closed", null, now);
      seat.stream?.end();
    }
  }

  function refresh(room, now) {
    const ready = room.seats.length === 2 && room.seats.every((seat) => seat.stream);
    if (!room.party && ready) room.party = createParty();
    const status = ready ? "connected" : room.party ? "partner-disconnected" : "waiting";
    for (const [slot, seat] of room.seats.entries()) {
      if (ready || status !== seat.lastStatus || now - seat.lastSent >= 15_000) {
        writeEvent(seat, status, room.party ? viewParty(room.party, slot) : null, now);
      }
    }
    return ready;
  }

  const timer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      const expired = room.party
        ? room.seats.some((seat) => !seat.stream && now - seat.disconnectedAt >= reconnectMs)
        : now - room.createdAt >= waitingMs;
      if (expired) {
        closeRoom(room, now);
        continue;
      }
      if (room.party && room.seats.every((seat) => seat.stream)) {
        updateParty(room.party, TICK_MS / 1000, room.seats.map((seat) => consumeInput(seat, now)));
      }
      refresh(room, now);
    }
  }, TICK_MS);
  timer.unref();

  async function handle(req, res, url) {
    const path = url.pathname;
    if (path === "/api/lan/rooms" && req.method === "POST") {
      await readJson(req);
      if (rooms.size >= MAX_ROOMS) throw new RequestError(503, "All LAN rooms are in use.");
      let code;
      do {
        code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
      } while (rooms.has(code));
      const now = Date.now();
      const seat = createSeat(now);
      rooms.set(code, { code, createdAt: now, seats: [seat], party: null });
      return json(res, 201, { code, token: seat.token, slot: 0 });
    }
    if (path === "/api/lan/rooms/join" && req.method === "POST") {
      const body = await readJson(req);
      const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
      const room = rooms.get(code);
      if (!room) throw new RequestError(404, "LAN room code was not found.");
      if (room.seats.length === 2) throw new RequestError(409, "LAN room is full.");
      const seat = createSeat(Date.now());
      room.seats.push(seat);
      return json(res, 200, { code, token: seat.token, slot: 1 });
    }

    const match = /^\/api\/lan\/rooms\/([A-Z2-9]{6})\/(events|input|session)$/.exec(path);
    const room = match && rooms.get(match[1]);
    if (!room) throw new RequestError(404, "LAN room code was not found.");
    const endpoint = match[2];
    const token = endpoint === "events"
      ? url.searchParams.get("token")
      : /^Bearer (\S+)$/.exec(req.headers.authorization ?? "")?.[1];
    const seat = room.seats.find((candidate) => candidate.token === token);
    if (!seat) throw new RequestError(403, "LAN session is invalid.");

    const now = Date.now();
    if (endpoint === "events" && req.method === "GET") {
      seat.stream?.end();
      seat.stream = res;
      seat.lastStatus = null;
      seat.input = {};
      res.on("close", () => {
        if (seat.stream !== res) return;
        seat.stream = null;
        seat.disconnectedAt = Date.now();
        for (const candidate of room.seats) candidate.input = {};
        if (rooms.has(room.code)) refresh(room, seat.disconnectedAt);
      });
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
      });
      res.write("retry: 1000\n\n");
      refresh(room, now);
      return;
    }
    if (endpoint === "input" && req.method === "POST") {
      const stream = seat.stream;
      const body = await readJson(req);
      if (rooms.get(room.code) !== room) throw new RequestError(404, "LAN room has closed.");
      if (stream === seat.stream && room.party && room.seats.every((candidate) => candidate.stream)) {
        updateInput(seat, body, Date.now());
      }
      return res.writeHead(204).end();
    }
    if (endpoint === "session" && req.method === "DELETE") {
      closeRoom(room, now);
      return res.writeHead(204).end();
    }
    throw new RequestError(405, "Unsupported LAN request.");
  }

  return {
    async route(req, res, url) {
      if (!url.pathname.startsWith("/api/lan/")) return false;
      try {
        await handle(req, res, url);
      } catch (error) {
        if (!res.headersSent) {
          if (error instanceof RequestError) json(res, error.status, { error: error.message });
          else json(res, 500, { error: "LAN request failed." });
        } else {
          res.end();
        }
      }
      return true;
    },
    close() {
      clearInterval(timer);
      for (const room of rooms.values()) closeRoom(room, Date.now());
    },
  };
}
