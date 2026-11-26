import { validCoat } from "./meadow.js";
import { addPlayer, createWorld, removePlayer, stepWorld } from "./meadow.js";
import { validHabitat, isAction } from "./meadow.js";

const PROTOCOL = "bug-city-whisperwood-v1";
const FRAME_MS = 50;
const HANDSHAKE_MS = 7000;
const SILENCE_MS = 8000;
const INPUT_TIMEOUT_MS = 750;
const REJOIN_MS = 10000;
const MAX_PLAYERS = 12;
const MAX_BUGS = 1024;
const MAX_MESSAGE = 128 * 1024;
const MAX_BUFFERED = 64 * 1024;
const ZERO_INPUT = { turn: 0, forward: 0, targetBug: null, targetSequence: null };
const PLAYER_ID = /^[a-f0-9]{32}$/;

function hashScope(scope) {
  let hash = 2166136261;
  for (let index = 0; index < scope.length; index++) {
    hash = Math.imul(hash ^ scope.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function playerId() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function boundedAxis(value) {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

function updateInput(previous, next) {
  const hasTarget = isAction(next?.targetBug);
  const targetBug = hasTarget ? next.targetBug : previous.targetBug;
  const targetSequence = hasTarget && Number.isSafeInteger(next.targetSequence) && next.targetSequence > 0
    ? next.targetSequence
    : targetBug === previous.targetBug ? previous.targetSequence : null;
  return {
    ...(validCoat(next?.coat) ? {coat: next.coat} : {}),
    turn: boundedAxis(next?.turn),
    forward: boundedAxis(next?.forward),
    targetBug,
    targetSequence,
  };
}

function boundedCoordinate(value) {
  return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}

function validSnapshot(message, myId) {
  const { host, roster, world } = message;
  if (
    !Array.isArray(roster) ||
    roster.length < 2 ||
    roster.length > MAX_PLAYERS
  )
    return false;
  if (roster[0] !== host || host === myId || !roster.includes(myId))
    return false;
  if (
    !roster.every((id) => typeof id === "string" && PLAYER_ID.test(id)) ||
    new Set(roster).size !== roster.length
  ) {
    return false;
  }
  if (
    !world?.players ||
    !Array.isArray(world.bugs) ||
    world.bugs.length > MAX_BUGS || !validHabitat(world)
  )
    return false;
  if (
    ![world.seed, world.randomState, world.caught, world.nextBugId].every(
      Number.isSafeInteger,
    )
  ) {
    return false;
  }
  if (Object.keys(world.players).length !== roster.length) return false;
  return (
    roster.every((id) => {
      const player = world.players[id];
      return (
        player && [player.x, player.y, player.angle].every(boundedCoordinate)
      );
    }) &&
    world.bugs.every(
      (bug) =>
        bug &&
        Number.isSafeInteger(bug.id) &&
        boundedCoordinate(bug.x) &&
        boundedCoordinate(bug.y) &&
        ["ladybug", "butterfly", "bee", "dragonfly", "firefly", "caterpillar"].includes(bug.kind),
    )
  );
}

export function connectPages({
  onWorld,
  onStatus,
  initialWorld,
  Peer = globalThis.Peer,
  scope = new URL("./", import.meta.url).href,
}) {
  const seed = hashScope(scope);
  const room = `${PROTOCOL}-${seed.toString(16)}`;
  const myId = playerId();
  const guests = new Map();
  const rejoining = new Map();
  const pending = new Map();
  let active = null;
  let retry = null;
  let closed = false;
  let hosting = false;
  let status;
  let world = null;
  let snapshot = null;
  let input = ZERO_INPUT;
  let lastFrame = performance.now();

  function setStatus(next) {
    if (status === next) return;
    status = next;
    onStatus(next);
  }

  function detach() {
    const previous = active;
    active = null;
    hosting = false;
    guests.clear();
    rejoining.clear();
    pending.clear();
    previous?.peer.destroy();
  }

  function schedule(mode, delay) {
    if (closed) return;
    detach();
    retry = { mode, at: performance.now() + delay };
    setStatus(world ? "reconnecting" : "connecting");
  }

  function tryClaim() {
    // Earlier guests get the first chance to carry forward the last shared world.
    const rank = snapshot?.roster.indexOf(myId);
    const delay = rank > 0 ? 150 + (rank - 1) * 350 : 1200;
    schedule("claim", delay + Math.random() * 100);
  }

  function send(conn, serialized) {
    if (conn.open && (conn.dataChannel?.bufferedAmount ?? 0) < MAX_BUFFERED) {
      conn.send(serialized);
    }
  }

  function listen(conn, onMessage) {
    conn.on("data", (data) => {
      if (typeof data !== "string" || data.length > MAX_MESSAGE) return;
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (message?.protocol === PROTOCOL) onMessage(message);
    });
  }

  function encode(message) {
    return JSON.stringify({ ...message, protocol: PROTOCOL });
  }

  function accept(state, conn) {
    if (
      active !== state ||
      !hosting ||
      conn.label !== PROTOCOL ||
      pending.size >= MAX_PLAYERS ||
      guests.size >= MAX_PLAYERS - 1
    ) {
      conn.close();
      return;
    }
    pending.set(conn, performance.now() + HANDSHAKE_MS);
    let id;
    function drop() {
      if (active !== state) return;
      pending.delete(conn);
      if (guests.get(id)?.conn === conn) {
        guests.delete(id);
        removePlayer(world, id);
      }
    }

    conn.on("close", drop);
    conn.on("error", () => {
      drop();
      conn.close();
    });
    listen(conn, (message) => {
      if (active !== state) return;
      if (!id && message.type === "join") {
        const candidate = message.id;
        if (
          typeof candidate !== "string" ||
          !PLAYER_ID.test(candidate) ||
          candidate === myId ||
          guests.has(candidate) ||
          guests.size >= MAX_PLAYERS - 1
        ) {
          conn.close();
          return;
        }
        pending.delete(conn);
        id = candidate;
        // Reserve the players we expect to rejoin before admitting new players.
        if (
          !Object.hasOwn(world.players, id) &&
          Object.keys(world.players).length >= MAX_PLAYERS
        ) {
          conn.close();
          return;
        }
        rejoining.delete(id);
        addPlayer(world, id);
        guests.set(id, {
          conn,
          input: ZERO_INPUT,
          lastInput: performance.now(),
        });
      } else if (
        id &&
        message.type === "input" &&
        guests.get(id)?.conn === conn
      ) {
        const guest = guests.get(id);
        guest.input = updateInput(guest.input, message);
        guest.lastInput = performance.now();
      }
    });
  }

  function becomeHost(state) {
    hosting = true;
    if (snapshot) {
      world = snapshot.world;
      for (const id of snapshot.roster) {
        if (id === myId) continue;
        if (id === snapshot.host) removePlayer(world, id);
        else rejoining.set(id, performance.now() + REJOIN_MS);
      }
    } else {
      // Keep the first child’s meadow, including catches made during discovery.
      world =
        initialWorld?.(myId) ??
        createWorld(crypto.getRandomValues(new Uint32Array(1))[0]);
    }
    addPlayer(world, myId);
    snapshot = { world, host: myId, roster: [myId] };
    state.deadline = Infinity;
    lastFrame = performance.now();
    setStatus("hosting");
    onWorld(world, myId);
  }

  function findHost(state) {
    if (state.conn) return;
    const conn = state.peer.connect(room, {
      label: PROTOCOL,
      reliable: true,
      serialization: "binary",
    });
    if (!conn) return;
    state.conn = conn;
    state.deadline = performance.now() + HANDSHAKE_MS;
    conn.on("open", () => {
      if (active === state) send(conn, encode({ type: "join", id: myId }));
    });
    function lostHost() {
      if (active === state) tryClaim();
    }
    conn.on("close", lostHost);
    conn.on("error", lostHost);
    listen(conn, (message) => {
      if (active !== state) return;
      if (message.type !== "world" || !validSnapshot(message, myId)) return;
      snapshot = message;
      world = message.world;
      state.deadline = performance.now() + SILENCE_MS;
      setStatus("online");
      onWorld(world, myId);
    });
  }

  function start(mode) {
    retry = null;
    if (!Peer) return;
    const peer = mode === "claim" ? new Peer(room) : new Peer();
    const state = {
      peer,
      mode,
      conn: null,
      deadline: performance.now() + HANDSHAKE_MS,
      reconnectAt: Infinity,
    };
    active = state;
    peer.on("open", () => {
      if (active !== state) return;
      state.reconnectAt = Infinity;
      if (mode === "claim") {
        if (!hosting) becomeHost(state);
      } else {
        findHost(state);
      }
    });
    peer.on("connection", (conn) => accept(state, conn));
    peer.on("disconnected", () => {
      if (active === state) state.reconnectAt = performance.now() + 1000;
    });
    peer.on("error", (error) => {
      if (active !== state) return;
      if (error.type === "peer-unavailable") {
        if (mode === "join" && status !== "online") tryClaim();
        return;
      }
      if (error.type === "network" && (hosting || status === "online")) {
        state.reconnectAt = performance.now() + 1500;
        return;
      }
      schedule("join", error.type === "unavailable-id" ? 200 : 2000);
    });
  }

  function tick() {
    const now = performance.now();
    if (retry && now >= retry.at) start(retry.mode);
    if (!active) return;
    if (
      active.peer.disconnected &&
      now >= active.reconnectAt &&
      !active.peer.destroyed
    ) {
      active.reconnectAt = now + 2000;
      active.peer.reconnect();
    }
    if (now >= active.deadline) {
      if (active.mode === "join") tryClaim();
      else schedule("join", 200);
      return;
    }
    if (!hosting) {
      if (status === "online")
        send(active.conn, encode({ type: "input", ...input }));
      return;
    }
    for (const [conn, deadline] of pending) {
      if (now < deadline) continue;
      pending.delete(conn);
      conn.close();
    }
    for (const [id, deadline] of rejoining) {
      if (now < deadline) continue;
      rejoining.delete(id);
      removePlayer(world, id);
    }
    const inputs = Object.create(null);
    inputs[myId] = input;
    for (const [id, guest] of guests) {
      if (now - guest.lastInput < INPUT_TIMEOUT_MS) inputs[id] = guest.input;
    }
    stepWorld(world, Math.min((now - lastFrame) / 1000, 0.1), inputs);
    lastFrame = now;
    const roster = [
      myId,
      ...Object.keys(world.players).filter((id) => id !== myId),
    ];
    snapshot = { world, host: myId, roster };
    if (guests.size) {
      const payload = encode({ type: "world", ...snapshot });
      for (const { conn } of guests.values()) send(conn, payload);
    }
    onWorld(world, myId);
  }

  setStatus("connecting");
  start("join");
  const timer = setInterval(tick, FRAME_MS);
  return {
    input(next) {
      input = updateInput(input, next);
    },
    close() {
      closed = true;
      clearInterval(timer);
      detach();
    },
  };
}
