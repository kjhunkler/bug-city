# Bug City · Whisperwood

[Enter the forest](https://kjhunkler.github.io/bug-city/). Drag anywhere in the lower part of the screen to walk forward, back up, or turn. Arrow keys and WASD work too. Open the coat button to choose a color other explorers can see.

Watch for rustling ferns and wobbling stones. Tap one nearby to inspect the forest floor, then tap the insect to catch it. Two occupied hiding places near the starting clearing introduce the hunt. Farther along the trail, search Fern Hollow, Amberwood, and Bluebell Reach for six species and three landmark stamps.

Giant trunks rise overhead among low woodland plants. Watch for insects crawling or flying briefly out of cover. Tap a visible insect within about ten steps to swing your net. Swipe down to drop it into your open jar, then watch the lid settle. If a resident climbs to the rim while you wait, swipe down on that bug to keep it inside. The down-arrow key also works.

At a flagged pond, tap the water to cast. Watch the shadows and pull when the float tugs. Minnows, sunfish, trout, and moon carp have different size ranges. Some catches are keepsakes. Fish return to the pond, and your largest catch of each species goes into your record.

Open your jar to see your insects, fishing records, and trail stamps. The journal and coat color are saved in this browser. Players explore one shared habitat, and only the explorer who makes a catch adds it to their jar.

## Multiplayer

One browser runs the forest simulation. Other explorers join automatically. The host resolves catches and fishing timing. A remaining explorer can take over from the last shared snapshot when the host leaves.

The static Pages build uses PeerJS Cloud for anonymous discovery and WebRTC between browsers. Browsers that cannot establish a direct or relayed connection can keep playing locally. The Node server supports automatic play over ordinary HTTP on a local network. Participants open the same URL. Sessions use generated identifiers, and gameplay has no names, messages, accounts or invitation screens.

## Development

Use Node.js 22 or newer. Run `npm start` and open http://localhost:4173. On another device on the same network, use the computer’s LAN address and that port. Run `npm test` to check simulation, joining and host migration.

[Game requirements](docs/requirements.md)
