# Bug City

Bug City is a mobile-first cooperative extraction game in development. The first playable build is a solo scavenging expedition. Walk through Lantern Hollow, venture into the Rustway, collect salvage, and activate the eastern beacon to bring it home. Defeat costs the contents of your backpack. Your secured stash is saved in the current browser. Refreshing abandons the active run.

[Play Bug City on GitHub Pages](https://kjhunkler.github.io/bug-city/). The optional Copper Stag guards the northeast grove. Bring its crown home to display it in Lantern Hollow.

## Play locally

With Node.js 22 or newer, run `npm start` and open http://localhost:4173. There are no package dependencies. Run `npm test` for simulation checks.

Move with WASD or the arrow keys. Space attacks a nearby enemy and E enters a run or activates the beacon. On touchscreens, drag the left pad to move. Tap Strike for a nearby target or drag and release to aim. Landscape gives the field more room.

The client uses native JavaScript modules and a low-resolution Canvas renderer. The single-player simulation runs locally. SpacetimeDB authority, persistent shared identity, parties, and real-device network measurements are still open milestones. See the [requirements and delivery plan](docs/requirements.md).
