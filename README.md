# Bug City

[Open the meadow](https://kjhunkler.github.io/bug-city/) and walk up to a butterfly, bee or ladybug to catch it. The jar counts everyone’s finds. Bug City is a cooperative pixel game for ages three to five.

Push the bottom stick forward to walk. Tilt it sideways to turn your explorer and the camera. On a keyboard use the arrows or WASD. The game fills the viewport and requests native fullscreen on the first touch or movement key; browser and system controls govern whether it can stay fullscreen.

## Multiplayer

The first browser in the meadow runs the simulation. Later explorers join automatically. The host resolves catches once and shares the world seed, positions and jar count. A remaining explorer can resume from the latest shared snapshot when the host leaves. The meadow is playable alone while connecting.

The static Pages build uses PeerJS Cloud for anonymous discovery and WebRTC between browsers. Browsers that cannot establish a direct or relayed connection can keep playing locally. The Node server supports automatic play over ordinary HTTP on a local network. Participants open the same URL. Sessions use generated identifiers, and gameplay has no names, messages, accounts or invitation screens.

## Development

Use Node.js 22 or newer. Run `npm start` and open http://localhost:4173. On another device on the same network, use the computer’s LAN address and that port. Run `npm test` to check simulation, joining and host migration.

[Game requirements](docs/requirements.md)
