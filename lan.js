// The local Node server owns the simulation. Each browser submits only its inputs.
export function createLanLink({ onOpen, onMessage, onClose }) {
  let room,
    events,
    opened = false,
    closed = false,
    sending = false;
  const path = () => "/api/lan/rooms/" + room.code;
  const authorization = () => ({ Authorization: "Bearer " + room.token });
  function release() {
    if (room)
      fetch(path() + "/session", {
        method: "DELETE",
        headers: authorization(),
        keepalive: true,
      }).catch(() => {});
  }
  function close() {
    if (closed) return;
    closed = true;
    events?.close();
    release();
  }
  function fail(reason) {
    if (closed) return;
    close();
    onClose(reason);
  }
  async function enter(code) {
    const response = await fetch("/api/lan/rooms" + (code ? "/join" : ""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(code ? { code: code.toUpperCase() } : {}),
    });
    if (!response.ok)
      throw Error((await response.json()).error || "Unable to enter room.");
    room = await response.json();
    if (closed) {
      release();
      throw Error("Room closed.");
    }
    events = new EventSource(
      path() + "/events?token=" + encodeURIComponent(room.token),
    );
    events.onmessage = (event) => {
      const { status, state } = JSON.parse(event.data);
      if (status === "closed") {
        fail("The room closed. You are back at the colony.");
        return;
      }
      if (status === "connected" && !opened) {
        opened = true;
        onOpen();
      }
      if (opened && state) onMessage({ type: "view", state });
      if (status === "partner-disconnected" && state)
        onMessage({
          type: "view",
          state: {
            ...state,
            message: "Waiting for your partner to reconnect…",
          },
        });
    };
    events.onerror = () => {
      if (events.readyState === EventSource.CLOSED)
        fail("The room connection ended.");
    };
    return room.code;
  }
  return {
    offer: () => enter(),
    answer: enter,
    close,
    send({ type, ...input }) {
      if (closed || !opened || sending) return false;
      sending = true;
      fetch(path() + "/input", {
        method: "POST",
        headers: { ...authorization(), "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
        .then((res) => {
          if (!res.ok && res.status !== 429)
            fail("The room is no longer available.");
        })
        .catch(() => {})
        .finally(() => {
          sending = false;
        });
      return true;
    },
  };
}
