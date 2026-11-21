import { act, attack, createGame, stepEnemies, stepPlayer } from "./game.js";

function startRun(party) {
  const [host, guest] = party.players;
  act(host);
  act(guest);
  guest.player.y += 12;
  guest.enemies = host.enemies;
  guest.loot = host.loot;
  guest.exit = host.exit;
}

export function createParty() {
  const party = { players: [createGame(), createGame()] };
  startRun(party);
  return party;
}

const finite = (value) => Number.isFinite(value) ? value : 0;

function attackFromInput(player, input) {
  let dx = finite(input.aimX);
  let dy = finite(input.aimY);
  if (!dx && !dy) {
    let best = Infinity;
    for (const enemy of player.enemies) {
      const ex = enemy.x - player.player.x;
      const ey = enemy.y - player.player.y;
      const distance = Math.hypot(ex, ey);
      if (distance < best) {
        best = distance;
        dx = ex;
        dy = ey;
      }
    }
  }
  attack(player, dx, dy);
}

export function updateParty(party, dt, inputs = []) {
  if (!Number.isFinite(dt) || dt <= 0) return party;
  dt = Math.min(dt, 0.1);

  const { players } = party;
  if (
    players.every((player) => player.scene === "home") &&
    players.some((_, slot) => inputs[slot]?.action === true)
  ) {
    startRun(party);
    return party;
  }

  const guestWasRunning = players[1].scene === "run";
  for (const [slot, player] of players.entries()) {
    const input = inputs[slot] ?? {};
    if (player.scene === "run") {
      if (input.action === true) act(player);
      if (input.attack === true) attackFromInput(player, input);
    } else if (input.action === true) {
      player.message = "Your partner is still on the expedition.";
    }
  }

  for (const [slot, player] of players.entries()) {
    stepPlayer(player, dt, finite(inputs[slot]?.dx), finite(inputs[slot]?.dy));
  }

  const runner = players.find((player) => player.scene === "run");
  if (runner) stepEnemies(runner.enemies, players, dt);
  if (guestWasRunning && players[1].scene === "home") players[1].player.y += 12;
  return party;
}

export function viewParty(party, slot) {
  const player = party.players[slot];
  const ally = party.players[1 - slot];
  return structuredClone({
    ...player,
    ally: player.scene === ally.scene ? ally.player : null,
  });
}
