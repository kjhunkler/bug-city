# Cooperative extraction game: requirements and delivery plan

Status: working draft · 21 November 2026  
Working title: unnamed · Audience: design and engineering contributors

## 1. Vision

A mobile-first, cooperative extraction game about venturing into dangerous, procedurally assembled dungeons, returning with useful and surprising loot, and building a shared colony. Players risk equipment they have earned to gain access to more challenging encounters and better rewards. Slow, readable combat rewards positioning, preparation, teamwork, and knowing when to leave.

The social experience is central: every player initially belongs to the same persistent colony and is automatically socially connected to everyone else. Friends can adventure together, revive one another, walk around home, and see evidence of one another's achievements. The design should allow for multiple colonies or clans later, but does not require them at launch.

### Experience pillars

1. **A colony worth returning to:** shared progress and visible player contributions give expeditions a social purpose.
2. **Meaningful risk:** equipment improves the odds and expands possibilities, but everything carried into a dungeon can be lost.
3. **Tactical cooperation:** players solve dangerous situations together, especially during revives, boss fights, and extraction.
4. **Delightful discoveries:** items look and feel rewarding, have useful effects, and sometimes form surprising combinations.
5. **Comfortable mobile play:** landscape touch controls, readable threats, and responsive multiplayer take priority over mechanical complexity.

## 2. Scope and decisions

### Established requirements

- Installable, mobile-friendly PWA; landscape gameplay with left-side movement and right-side aiming/attacking.
- SpacetimeDB-backed persistence and multiplayer. Investigate reuse of TURN services from `seven-cycle-chess`, originally copied from SmackTown; verify actual architecture and deployment before depending on it.
- Persistent shared colony; everyone joins automatically. Walk around home and see other players' achievements and contributions.
- Cooperative dungeon expeditions with procedural generation, monsters, boss enemies, team revives, challenging extraction, and increased danger and loot for groups.
- Equipment, randomized loot and rarity, abilities, synergies, inventory, backpacks, recycling, mana and power. Death loses everything carried into or acquired during the expedition.
- Pixel art, strong dungeon atmosphere, and slower combat with dangerous but telegraphed major attacks.
- Smooth networking is prioritized over perfect positional accuracy.

### Proposed starting choices, subject to playtesting

- **Theme:** small non-human scavengers in a lantern-lit colony, exploring the ruins of a much larger civilization. Fantasy and advanced technology coexist. This is a direction to test, not a final name or binding art decision.
- **First party size:** 1–2 players; design data structures to allow more. Solo runs provide a recovery path and a baseline for balancing.
- **Loot ownership:** personal item drops and shared colony resources/trophies. Avoid accidental competition; test whether trading is desirable later.
- **Active abilities:** basic attack plus up to two item-granted active abilities in the first playable version. Other effects are passive.
- **Home:** a single shared walkable map with a communal workshop, public trophy display and visible contribution history. Personal nooks can follow.
- **Recovery:** free basic equipment sufficient for a credible low-level run. It is also lost on death, but can be claimed again.

### Open decisions

Final theme and name; exact camera perspective and engine; combat feel and numerical balance; maximum party and colony population; authentication provider; hosting and budget; how loot is presented and shared; item visibility and privacy; whether disconnected characters can be recovered; trading, PvP, and chat. Do not assume TURN is required for a server-mediated game: establish the actual transport first.

## 3. Player journeys and acceptance criteria

### Join and socialize

- A new player can open the hosted game on a supported mobile browser, establish a persistent identity, enter the one colony automatically, and return to the same account on a later session.
- In the colony, players can walk around and see other connected players. The colony persists across sessions and displays at least a shared boss trophy and a recent contribution with its contributor's name.
- Players can invite or join another available player for an expedition and see party membership and ready status. No separate friend acceptance or clan setup is required.
- A player can inspect a deliberately displayed item or achievement. Inventory visibility and total stash value are optional, not a requirement to expose private inventories.

### Prepare

- A player can view the home stash, equip and unequip items, select a backpack, see weight/capacity and resource costs, and claim a basic recovery loadout.
- Supported equipment categories include weapon hands (one weapon plus shield or dual wield), armor, helmet, legs, boots, gloves, cape/cloak, face mask, rings and necklace. The first playable build may implement a subset, provided its data model allows the rest.
- Dual wielding has a meaningful weight tradeoff; backpack choice determines carrying capacity. The UI explains when a loadout or pickup exceeds a limit and why.
- Players may recycle unwanted items into persistent building/crafting resources through a confirmation flow. Recycling is irreversible once confirmed.

### Explore, fight, and extract

- A ready party enters the same generated dungeon instance. Generation produces connected, traversable rooms, a spawn, encounter spaces and at least one reachable extraction; the seed and generation version are recorded for diagnosis.
- Players move with the left thumb. On the right, tap performs a basic auto-targeted attack when a valid target is available; drag aims and release fires. Ability buttons are reachable without covering critical information. Targeting behavior, range and cancellation must be clear and tested on a real phone.
- Enemies threaten players through readable windups and recoveries. A boss has at least one clearly telegraphed dangerous attack and a distinct reward.
- Items can affect attacks and grant passive or active abilities. Magic consumes mana, technology consumes power, and the HUD communicates availability and recovery. At least one meaningful item synergy is discoverable in the first playable build.
- Loot has legible rarity, identity, effects and comparison to equipped gear. Pickup feedback should make useful discoveries satisfying without hiding danger. Backpack limits force choices; players can inspect and discard carried loot.
- Group scaling increases both opportunity and danger without relying solely on inflated enemy health. Solo and group runs are each completable.
- A defeated player enters a time-limited downed state where a living teammate can perform an interruptible revive. If the timer expires or the party cannot revive them, the player dies and all carried/equipped expedition items are lost. Exact timing is a balance parameter.
- Extraction is an explicit, telegraphed encounter (for example, activate a device and survive a countdown). Each living player must complete extraction to retain their own carried items. A downed player must be revived first. Extracted players keep their carried loot; dead players lose theirs. The run ends when no active players remain or everyone has exited.
- On return, extracted loot enters the persistent stash, rewards and losses are summarized, and eligible shared contributions update once. Duplicate requests, reconnects, and server retries must not duplicate or destroy rewards.

### Failure and recovery

- Persistent home stash and already deposited colony resources are not expedition equipment and are not lost on dungeon death. Items are removed from the stash when committed to a run and resolved exactly once on extraction or death.
- Define and implement a clear disconnect policy before public testing. Proposed initial policy: allow a short rejoin window while the server maintains the character; after expiry, treat the character as lost if the expedition is still active. Display this rule before a run. Server-wide failures must not silently erase committed equipment; record enough state to recover or resolve affected runs fairly.
- Inventory changes, recycling, run entry and run resolution must be validated on the authoritative service, not trusted to the client.

## 4. Systems and content

### Items and economy

An item instance needs a stable ID, definition, rarity, rolled properties, abilities and ownership/location. Define bounded rarity tiers and weighted affix pools; rarity should communicate potential, not guarantee a useful build. Every dropped item must be usable, recyclable, or both. Keep the first economy small: a few resource types, one or two workshop upgrades, and clear sources and sinks. Potions and food are consumables; swords, maces, wands/staves, gadgets and shields are desired categories, not all required for the first test.

Use data-driven definitions for item slots, weight, capacity, stat effects, resource costs, ability behavior, rarity and synergy tags. Server-side validation must prevent invalid equipment combinations, negative balances and duplicated item IDs. Test synergies for understandable feedback and counterplay, not merely additive damage.

### World and generation

Use authored room templates assembled with a seed for the first version. Validate connectivity and spawn/extraction reachability; prevent impossible overlaps and unavoidable hazards. Add variety through room arrangement, encounters and loot before investing in fully generative geometry. The colony and each expedition are separate spaces with explicit player membership.

### Multiplayer and authority

SpacetimeDB is the intended source of persistent identity-linked state, colony state, parties, inventory, expedition records and authoritative game outcomes. Confirm its current runtime, hosting constraints, update frequency, and operational fit during a technical spike. Choose where real-time simulation runs based on measured results; do not assume that database updates alone provide an adequate action-game loop. If a separate simulation service is required, define ownership, authentication, reconciliation and failure recovery across the boundary.

For responsive play, predict local movement and attacks where appropriate, interpolate remote entities, and reconcile against authoritative outcomes. The server decides damage, pickup, death, inventory and extraction. Favor visually smooth correction over exact remote positions, while keeping dangerous telegraphs and hit results understandable. Measure latency, packet loss and reconnect behavior on mobile networks. Evaluate the existing TURN deployment only if the selected transport uses WebRTC or otherwise needs it; TURN is not a substitute for an authoritative simulation.

### PWA and accessibility

Serve over HTTPS with a manifest, installable icons and appropriate service worker caching. The shell may load offline, but online connectivity is required for shared gameplay; show connection and reconnect state. Handle device rotation, safe areas, touch cancellation, app backgrounding, and browser refresh. Avoid promising forced landscape on platforms that do not support it; present a rotate-device prompt when necessary. Support readable UI scaling, sufficient contrast, reduced motion and non-color rarity cues. Provide desktop keyboard/mouse controls for development and accessibility if practical.

### Security, privacy, and operations

Use a persistent authenticated identity, secure transport and server-side authorization for every mutation. Store no secrets in the client or repository. Set reasonable rate and payload limits. Keep player-facing names and public displays appropriate for a shared space; define reporting/moderation and basic abuse controls before opening access broadly. Collect minimal operational data and disclose what is collected. Back up persistent state, test restoration, and document schema migration and rollback. Log run lifecycle and errors without leaking credentials; monitor availability, latency, disconnects and failed run resolution.

## 5. Delivery plan

Each milestone produces a playable or verifiable outcome; content and balance values are provisional.

### 0. Foundation and technical discovery

- Create the repository, choose a web game/rendering stack, document local setup and establish formatting, build and CI checks.
- Inspect `seven-cycle-chess` and its SmackTown-derived TURN configuration, licenses, secrets handling, deployment and current SpacetimeDB integration. Reuse only components suited to this game's transport. Confirm versions against current documentation.
- Prototype two mobile browsers connecting to an authoritative movement session; measure responsiveness on real devices and a realistic network. Compare direct SpacetimeDB simulation with any separate service needed.
- Choose identity, hosting, domains, environments and budget; document a deployment diagram and unresolved constraints.
- **Exit:** repeatable local startup and a written architecture decision supported by a two-device networking test.

### 1. Mobile movement and shared colony

- Establish identity and persistent player records. Automatically place everyone in one colony.
- Build a small walkable map, responsive landscape controls, remote player presentation, reconnect state and basic collision.
- Add PWA manifest, HTTPS development/staging path and initial accessibility checks.
- **Exit:** two people on phones can join, see and move around each other, leave and return with the same identity.

### 2. Expedition and combat vertical slice

- Add party formation and ready flow, isolated seeded dungeon instances, room generation and extraction.
- Implement movement, aim/tap attack, a small set of enemies with telegraphs, health, downed/revive and one boss.
- Run simulation with authoritative outcomes and client smoothing; simulate latency and disconnects.
- **Exit:** two players can complete or fail an expedition together, including a revive and a contested extraction, without relying on developer commands.

### 3. Persistent risk and loot

- Implement stash, item instances, equipment, weight/backpacks, randomized rewards, rarity, pickup and comparison.
- Commit loadouts on entry; resolve extraction, death, retries and reconnects transactionally. Add basic recovery loadout and recycling.
- Add at least one mana item, one power item, one synergy and the initial shared trophy/contribution.
- **Exit:** a player can prepare, risk gear, find loot, extract or die, and observe correct persistent results after refresh; concurrent actions cannot duplicate items.

### 4. Closed playtest and hosting

- Deploy staging with HTTPS, database and any required simulation/relay services. Configure environment-specific secrets, access controls, observability, backups and restore procedures.
- Run phone tests across representative iOS Safari and Android Chrome versions, installation paths, rotation, interruptions and poor networks. Test full inventory, simultaneous pickups, party scaling, disconnect/rejoin and server interruption.
- Invite a small group to run multiple sessions; track extraction rate, run length, disconnects, recovery after loss and whether colony contributions prompt conversation. Gather qualitative feedback on controls, loot and perceived fairness.
- Fix blockers, publish a known-issues list and a support/recovery process, then deploy a limited hosted release.
- **Exit:** a new tester can access the hosted URL, join the colony, party up, complete a run and return with correct rewards; operators can inspect health and restore a tested backup.

### 5. Expand after evidence

Add rooms, biomes, equipment slots and content, colony projects, personal displays, larger parties and richer social tools based on playtest findings. Introduce separate colonies/clans only when the population and operations justify them, with an explicit migration plan for shared history and ownership.

## 6. Release verification

- Automated checks cover inventory ownership and conservation, weight/slot rules, deterministic generation and reachability, run resolution idempotency, and authorization. Integration tests cover two clients, party isolation, revives and extraction.
- Manual tests cover actual touch ergonomics, readable telegraphs, loot delight, PWA installation and resume, plus latency/loss and reconnect scenarios on real devices.
- Before broader access, establish measurable targets for frame rate, input responsiveness, service availability, capacity and acceptable infrastructure costs using the technical spike and playtest. Document the supported browser/device matrix and verify backups and recovery.

## 7. Explicitly deferred

Clans, PvP, trading, a public marketplace, large-scale player counts, full catalog of equipment, elaborate colony construction, rankings and full inventory inspection. These are possibilities, not launch commitments. Their absence should not prevent a complete prepare → explore → fight → extract or die → return loop.

## 8. Existing project reference: seven-cycle-chess

The `seven-cycle-chess` repository was reviewed on 21 November 2026 as a reference, not as a proven architecture for this game. Its README describes GitHub Pages hosting a PWA, a TypeScript SpacetimeDB module on Maincloud for presence, invitations, signaling and encrypted fallback messages, and a host-authoritative browser simulation. WebRTC is used for game traffic where possible; Cloudflare TURN supplies temporary credentials through the SmackTown Worker for restrictive networks. The project also documents client prediction, host snapshots, interpolation and reconnect handling. See its `spacetime-lobby/README.md`, `.github/workflows`, and multiplayer tests for implementation details.

Useful starting points are the Pages build/deployment workflow, PWA assets, SpacetimeDB module and generated bindings workflow, identity/presence and invitation patterns, TURN credential endpoint integration, and network prediction tests. Review dependencies, versions, licenses, account security and configuration before copying. The existing peer host reports match outcomes and cannot resume a match after page refresh; those properties do not by themselves satisfy this game's persistent inventory and recovery requirements. Evaluate a server-authoritative simulation and durable, idempotent run settlement in the technical spike. If a peer host is considered, explicitly assess trust, host loss, cheating and recovery before choosing it. Do not assume the existing TURN service or its origin policy is configured for Bug City; verify authorization, quotas and operating cost with its owner.

A plausible first hosting candidate is GitHub Pages for the PWA and SpacetimeDB Maincloud for persistent state, matching the reference project. A simulation host and TURN are conditional on the selected network architecture. Confirm deployment access, credentials, cost, database backups, operational ownership and platform limits before committing to this topology. Never copy credentials or secrets into this repository.
