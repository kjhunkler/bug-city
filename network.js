const CHANNEL = "bug-city";
const CODE_PREFIX = "BUG1";
const MAX_SDP_BYTES = 24 * 1024;
const MAX_CODE_LENGTH = 4 * Math.ceil(MAX_SDP_BYTES / 3) + 16;
const MAX_MESSAGE_BYTES = 32 * 1024;
const MAX_BUFFERED_BYTES = 256 * 1024;
const ICE_WAIT_MS = 6000;
const HOST_CONNECT_MS = 30000;
const GUEST_CONNECT_MS = 180000;
const RECONNECT_MS = 10000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64(code) {
  return Uint8Array.from(atob(code.replaceAll("-", "+").replaceAll("_", "/")),
    character => character.charCodeAt(0));
}

async function readBytes(stream, limit = MAX_SDP_BYTES) {
  const reader = stream.getReader();
  const bytes = new Uint8Array(limit);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return bytes.subarray(0, length);
      if (length + value.byteLength > bytes.byteLength) {
        await reader.cancel();
        throw new Error("Connection code is too large.");
      }
      bytes.set(value, length);
      length += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
}

async function encodeCode(description) {
  const bytes = encoder.encode(description.sdp);
  if (bytes.byteLength > MAX_SDP_BYTES) {
    throw new Error("This browser generated a connection code that is too large.");
  }
  let data = bytes;
  let format = "raw";
  if (typeof CompressionStream === "function" && typeof DecompressionStream === "function") {
    const compressed = await readBytes(new Blob([bytes]).stream()
      .pipeThrough(new CompressionStream("deflate")), MAX_SDP_BYTES + 64);
    if (compressed.byteLength < bytes.byteLength) {
      data = compressed;
      format = "zip";
    }
  }
  return [CODE_PREFIX, description.type, format, toBase64(data)].join(".");
}

async function decodeCode(value, type) {
  const code = typeof value === "string" ? value.trim() : "";
  if (code.length > MAX_CODE_LENGTH) throw new Error("Connection code is too large.");
  const match = /^BUG1\.(offer|answer)\.(raw|zip)\.([A-Za-z0-9_-]+)$/.exec(code);
  if (!match || match[1] !== type) {
    throw new Error(`Paste the complete ${type} code from the other device.`);
  }
  if (match[2] === "zip" && typeof DecompressionStream !== "function") {
    throw new Error("Update your browser to read this connection code.");
  }
  try {
    let bytes = fromBase64(match[3]);
    if (bytes.byteLength > MAX_SDP_BYTES) throw new Error();
    if (match[2] === "zip") {
      bytes = await readBytes(new Blob([bytes]).stream()
        .pipeThrough(new DecompressionStream("deflate")));
    }
    const sdp = decoder.decode(bytes);
    if (!sdp.startsWith("v=0") || !/^m=application /m.test(sdp) || /^m=(audio|video) /m.test(sdp)) {
      throw new Error();
    }
    return { type, sdp };
  } catch {
    throw new Error(`The ${type} code is damaged. Copy it again from the other device.`);
  }
}

export function createLink({ onOpen, onMessage, onClose } = {}) {
  if (typeof RTCPeerConnection !== "function") {
    throw new Error("This browser does not support online co-op.");
  }
  const peer = new RTCPeerConnection({
    iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
  });
  let channel;
  let role;
  let closed = false;
  let connecting;
  let disconnected;
  let finishGathering;

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(connecting);
    clearTimeout(disconnected);
    finishGathering?.();
    channel?.close();
    peer.close();
  }

  function fail(reason) {
    if (closed) return;
    close();
    onClose?.(reason);
  }

  function waitForConnection(delay) {
    if (closed || channel?.readyState === "open") return;
    clearTimeout(connecting);
    connecting = setTimeout(() => fail("The connection timed out. Start a new co-op session and try again."), delay);
  }

  peer.addEventListener("connectionstatechange", () => {
    clearTimeout(disconnected);
    if (closed) return;
    switch (peer.connectionState) {
      case "failed":
        fail("The devices could not connect. Try again on the same Wi-Fi network.");
        break;
      case "disconnected":
        disconnected = setTimeout(() => fail("The connection to the other player was lost."), RECONNECT_MS);
        break;
      case "closed":
        fail("The connection to the other player was closed.");
        break;
    }
  });

  function attachChannel(dataChannel) {
    channel = dataChannel;
    function opened() {
      if (closed) return;
      channel.removeEventListener("open", opened);
      clearTimeout(connecting);
      onOpen?.();
    }
    if (channel.readyState === "open") {
      queueMicrotask(opened);
    } else {
      channel.addEventListener("open", opened);
    }
    channel.addEventListener("message", ({ data }) => {
      if (closed || typeof data !== "string" || data.length > MAX_MESSAGE_BYTES ||
          encoder.encode(data).byteLength > MAX_MESSAGE_BYTES) return;
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (message && typeof message === "object" && !Array.isArray(message)) onMessage?.(message);
    });
    channel.addEventListener("error", () => fail("The connection to the other player failed."));
    channel.addEventListener("close", () => fail("The other player disconnected."));
  }

  peer.addEventListener("datachannel", ({ channel: incoming }) => {
    if (closed || role !== "guest" || channel || incoming.label !== CHANNEL ||
        !incoming.ordered || incoming.maxRetransmits !== null || incoming.maxPacketLifeTime !== null) {
      incoming.close();
      return;
    }
    attachChannel(incoming);
  });

  function ensureOpen() {
    if (closed) throw new Error("This co-op session is closed.");
  }

  async function localCode(description) {
    await peer.setLocalDescription(description);
    ensureOpen();
    if (peer.iceGatheringState !== "complete") {
      await new Promise(resolve => {
        const complete = () => {
          clearTimeout(timer);
          peer.removeEventListener("icegatheringstatechange", check);
          finishGathering = undefined;
          resolve();
        };
        const check = () => {
          if (peer.iceGatheringState === "complete") complete();
        };
        const timer = setTimeout(complete, ICE_WAIT_MS);
        finishGathering = complete;
        peer.addEventListener("icegatheringstatechange", check);
        check();
      });
    }
    ensureOpen();
    const code = await encodeCode(peer.localDescription);
    ensureOpen();
    return code;
  }

  return {
    async offer() {
      ensureOpen();
      if (role) throw new Error("This co-op session has already started.");
      role = "host";
      try {
        attachChannel(peer.createDataChannel(CHANNEL, { ordered: true }));
        return await localCode(await peer.createOffer());
      } catch (error) {
        close();
        throw error;
      }
    },

    async answer(code) {
      ensureOpen();
      if (role) throw new Error("This co-op session has already started.");
      role = "guest";
      try {
        const offer = await decodeCode(code, "offer");
        ensureOpen();
        await peer.setRemoteDescription(offer);
        const answerCode = await localCode(await peer.createAnswer());
        waitForConnection(GUEST_CONNECT_MS);
        return answerCode;
      } catch (error) {
        close();
        throw error;
      }
    },

    async accept(code) {
      ensureOpen();
      if (role !== "host" || peer.signalingState !== "have-local-offer") {
        throw new Error("Create a host offer before connecting with an answer.");
      }
      const answer = await decodeCode(code, "answer");
      ensureOpen();
      await peer.setRemoteDescription(answer);
      waitForConnection(HOST_CONNECT_MS);
    },

    send(message) {
      if (closed || channel?.readyState !== "open" || !message ||
          typeof message !== "object" || Array.isArray(message)) return false;
      try {
        const data = JSON.stringify(message);
        if (typeof data !== "string" || data.length > MAX_MESSAGE_BYTES) return false;
        const size = encoder.encode(data).byteLength;
        if (size > MAX_MESSAGE_BYTES || channel.bufferedAmount + size > MAX_BUFFERED_BYTES) return false;
        channel.send(data);
        return true;
      } catch {
        return false;
      }
    },

    close,
  };
}
