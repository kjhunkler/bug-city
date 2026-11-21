# Bug City

Bug City is a mobile-first cooperative extraction game in development. Play a scavenging expedition alone or with a friend. Walk through Lantern Hollow, venture into the Rustway, collect salvage, and activate the eastern beacon to bring it home. Defeat costs the contents of your backpack. Your secured stash is saved in the current browser. Refreshing abandons the active run.

[Play Bug City on GitHub Pages](https://kjhunkler.github.io/bug-city/). The optional Copper Stag guards the northeast grove. Bring its crown home to display it in Lantern Hollow.

## Play together

On GitHub Pages, both players open the game and choose **Play with a friend**. Choose **Host a run** on one device and **Join a host** on the other. Send the invitation code to the guest, then send the guest’s reply back to the host. Connecting starts the expedition. Your partner is the teal beetle.

The host browser simulates both players, enemies, and loot. Keep it active during the run. Each player must stand at the eastern gate marked **EXIT**, select **Extract now** or press **E**, and survive the countdown. Secured salvage is saved on the extracting device. A disconnect ends the session and unbanked loot is lost. Both players can start another run once they are back at the colony.

Pairing uses a direct WebRTC connection and Google STUN for address discovery. Same Wi-Fi is the easiest first test. Some networks require a TURN relay, which this build does not provide. Persistent shared colony identity and server-side inventory validation are still in development.

## Play locally

With Node.js 22 or newer, run `npm start` and open http://localhost:4173. There are no package dependencies. Run `npm test` for simulation checks.

For LAN co-op, open the Node server on both devices using the computer’s LAN address and port 4173. Choose **Play with a friend** and exchange the six-character room code. The server simulates the expedition and pauses it during a brief network interruption.

Move with WASD or the arrow keys. Space attacks a nearby enemy and E enters a run or activates the beacon. On touchscreens, drag the left pad to move. Tap Strike for a nearby target or drag and release to aim. Landscape gives the field more room.

The client uses native JavaScript modules and a low-resolution Canvas renderer. Solo play runs locally. SpacetimeDB authority, persistent shared identity, public matchmaking, and real-device network measurements are still open milestones. See the [requirements and delivery plan](docs/requirements.md).
