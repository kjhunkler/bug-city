import { createLink } from "./network.js";
const el = (id) => document.getElementById(id);
export function openPairing({ ready, receive, closed, fullscreen }) {
  const dialog = el("partyDialog");
  let link = null,
    host = false,
    connected = false;
  const status = (text) => (el("pairStatus").textContent = text);
  function reset() {
    link?.close();
    link = null;
    el("host").disabled = el("join").disabled = false;
    el("outLabel").hidden = el("inLabel").hidden = el("connect").hidden = true;
    el("outCode").value = el("inCode").value = "";
  }
  function makeLink() {
    return createLink({
      onOpen() {
        connected = true;
        dialog.close();
        ready(link, host);
      },
      onMessage: receive,
      onClose(reason) {
        if (connected) closed(reason);
        else {
          reset();
          status(reason);
        }
      },
    });
  }
  async function work(task) {
    el("connect").disabled = true;
    try {
      await task();
    } catch (error) {
      if (dialog.open) {
        reset();
        status(error.message);
      }
    } finally {
      el("connect").disabled = false;
    }
  }
  function choose(isHost) {
    reset();
    fullscreen();
    host = isHost;
    el("host").disabled = el("join").disabled = true;
    link = makeLink();
    el("inLabel").hidden = false;
    if (!host) {
      status("Paste the host’s invitation, then create your reply.");
      el("connect").textContent = "Create reply";
      el("connect").hidden = false;
      return;
    }
    status("Preparing invitation…");
    const active = link;
    return active.offer().then((code) => {
      if (active !== link) return;
      el("outCode").value = code;
      el("outLabel").hidden = false;
      el("connect").textContent = "Connect guest";
      el("connect").hidden = false;
      status("Send your code to your friend, then paste their reply below.");
    });
  }
  el("host").onclick = () => work(() => choose(true));
  el("join").onclick = () => work(() => choose(false));
  el("connect").onclick = () =>
    work(async () => {
      const code = el("inCode").value.trim();
      if (!code) {
        status("Paste your friend’s code first.");
        return;
      }
      const active = link;
      status("Connecting…");
      if (host) await active.accept(code);
      else {
        const reply = await active.answer(code);
        if (active !== link) return;
        el("outCode").value = reply;
        el("outLabel").hidden = false;
        status(
          "Send this reply to the host. The expedition starts when they connect.",
        );
      }
      el("inLabel").hidden = el("connect").hidden = true;
    });
  el("copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(el("outCode").value);
      status("Code copied. Send it privately to your friend.");
    } catch {
      el("outCode").select();
      status("Copy the selected code and send it to your friend.");
    }
  };
  el("dismiss").onclick = () => dialog.close();
  dialog.onclose = () => {
    if (!connected) reset();
  };
  reset();
  status("");
  dialog.showModal();
}
