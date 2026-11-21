import { stepWorld } from "./meadow.js";

export function connectGarden({ onWorld, onStatus = () => {}, baseUrl = "" }) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
  const endpoint = (action) => `${baseUrl.replace(/\/$/, "")}/api/garden/${action}?token=${token}`;
  const events = new EventSource(endpoint("events"));
  let id;
  let status;
  let frame;
  let controls = { turn: 0, forward: 0, targetBug: null, targetSequence: null };
  let sentControls;
  let localWorld;
  let pending = false;
  let lastTick = performance.now();
  const controller = new AbortController();

  function setStatus(next) {
    if (next === status) return;
    status = next;
    onStatus(next);
  }

  setStatus("connecting");
  const initialTimeout = setTimeout(() => {
    if (!frame) setStatus("offline");
  }, 3000);

  events.addEventListener("identity", (event) => {
    id = JSON.parse(event.data);
  });

  events.onmessage = (event) => {
    const next = JSON.parse(event.data);
    if (next.host === id && (!frame || frame.epoch !== next.epoch || frame.revision !== next.revision)) {
      localWorld = next.world;
      lastTick = performance.now();
    }
    frame = next;
    onWorld(frame.host === id ? localWorld : frame.world, id);
    setStatus("online");
  };

  events.addEventListener("input", (event) => {
    if (frame?.host !== id) return;
    const { id: guest, input } = JSON.parse(event.data);
    frame.inputs[guest] = input;
  });

  events.onerror = () => {
    const wasOnline = status === "online" || status === "reconnecting";
    frame = undefined;
    sentControls = undefined;
    setStatus(wasOnline ? "reconnecting" : "offline");
  };

  async function send(action, value) {
    pending = true;
    try {
      const response = await fetch(endpoint(action), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
        signal: controller.signal,
      });
      if (response.ok && action === "input" && frame) sentControls = value;
    } catch {
      // The next tick can retry while the event stream reconnects.
    } finally {
      pending = false;
    }
  }

  const timer = setInterval(() => {
    if (!frame) return;
    if (frame.host === id) {
      const now = performance.now();
      const dt = Math.min((now - lastTick) / 1000, 0.15);
      lastTick = now;
      stepWorld(localWorld, dt, { ...frame.inputs, [id]: controls });
      onWorld(localWorld, id);
      if (!pending) void send("world", { world: localWorld, epoch: frame.epoch, revision: frame.revision });
    } else if (!pending && controls !== sentControls) {
      void send("input", controls);
    }
  }, 1000 / 20);

  return {
    input({ turn, forward, targetBug, targetSequence }) {
      const hasTarget = Number.isSafeInteger(targetBug) && targetBug > 0;
      const selected = hasTarget ? targetBug : controls.targetBug;
      const sequence = hasTarget && Number.isSafeInteger(targetSequence) && targetSequence > 0
        ? targetSequence
        : selected === controls.targetBug ? controls.targetSequence : null;
      if (turn !== controls.turn || forward !== controls.forward ||
          selected !== controls.targetBug || sequence !== controls.targetSequence) {
        controls = { turn, forward, targetBug: selected, targetSequence: sequence };
      }
    },
    close() {
      events.close();
      controller.abort();
      clearInterval(timer);
      clearTimeout(initialTimeout);
    },
  };
}
