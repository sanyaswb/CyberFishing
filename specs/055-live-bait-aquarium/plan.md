# Implementation Plan: Live Bait, Keepnet, and Fisherman's House Aquarium

**Branch**: `develop` (existing checkout) | **Date**: 2026-10-11 | **Spec**: [spec.md](spec.md)  
**Feature directory**: `specs/055-live-bait-aquarium/`

## Summary

Give each caught fish one authoritative record, add separate aquarium care and feed-stock owners, and connect them to the existing victory and bait paths through application commands. Complete a Keepnet modal and the separate Fisherman's House page. This turn delivers the design and implementation tasks; it does not implement runtime behavior.

## Technical Context

**Language/Version**: Existing browser-native JavaScript ESM; Node versions per root `package.json` for checks. The separately planned backend is TypeScript but not implemented.  
**Primary Dependencies**: Existing game modules, DOM/Canvas adapters, root npm scripts; no new runtime package.  
**Storage**: A new versioned local snapshot through an injected browser adapter, separate from inventory schema v4. Cloud inclusion requires a future revision of spec 029.  
**Testing**: Focused deterministic Node checks; Architecture, Quick, Full suites; production, DEV, house, and release browser smoke; save round trip.  
**Target Platform**: Existing browser game and static multi-page release.  
**Project Type**: Gameplay mechanic plus two UI surfaces in the current client.  
**Performance Goals**: No per-frame storage writes, DOM queries, fish-list sorting, or timer allocations. Settle real time at lifecycle boundaries and coarse scheduler ticks.  
**Constraints**: Preserve unrelated fights, inventory v4 bytes/semantics, ordinary bait, and page entry behavior. No currency/payment code; no production→DEV imports.  
**Scale/Scope**: One initially eligible species; configurable future species; ten aquarium levels; one feed slot per species present.

## Constitution Check

Pre-research and post-design assessment against constitution 1.1.0 and `DEVELOPMENT_RULES.md`:

| Gate | Design result | Implementation evidence required |
| --- | --- | --- |
| Clear responsibilities | Pass: fish collection, aquarium care, feed supply, commands, presentation, and adapters have distinct roles. | Constructor/file review; avoid a catch-all house manager. |
| Dependency direction | Pass: domain receives config values; application receives time/RNG/storage contracts; bootstrap binds browser and DEV. | Architecture guard, import graph, no cycles or production→DEV reachability. |
| State ownership | Pass: one fish record owns disposition/life; aquarium owns level/feed; supply owns stock/feeder. Views derive facts. | Transfer, cast, reload, no-duplication checks. |
| Compatibility | Pass by design: separate snapshot key, old inventory/chum keys untouched. | Before/after inventory bytes; corrupt snapshot recovery. |
| Performance | Pass by design: event-time care settlement and cached per-hook movement profile. | Game-cycle comparison and populated-aquarium profiling. |
| Backend boundary | Pass: no invented server API; cloud contract extension is separate. | Confirm backend remains independent and client domain has no server dependency. |
| Gameplay workflow | This new mechanic has a spec. | Backlog deterministic scenario, focused checks, full suites, owner play check, minor release/CHANGELOG at implementation. |

These are design findings, not claims that implementation checks pass.

## Current Repository Facts and Integration Seams

- `VictoryState.handleInput` currently closes Claim and Release identically, without persisting a catch. The third action must extend `VictoryActionGestureResolver`, `VictoryLayoutResolver`, `VictoryRenderer`, and the outcome frame. Commit only after a valid post-entry gesture, never on render/entry.
- `crucian_stalker` is defined in `src/game/config/raw/fish/peaceful_fish.js`; weights are kg and movement states are under `physics.behaviorProfile.behaviors`. `FishBehavior` can run as a separate per-hook behavior instance. `BaitFactory` makes tackle entities, not inventory bait items.
- `WaitingState` reuses a `baitCandidates` array; `FishingController.collectAvailableBaits` reads equipped baits; `BiteSystem` uses `BaitEffectivenessResolver` and target-species `baitMultipliers`. `PlayingState.enter` consumes the first hook bait; bite and break paths can also consume bait. `BiteSystem` does not carry the matched bait instance ID through to consumption. Therefore the first slice permits only one live bait on a single compatible free hook, with a targeted identity contract before any multi-hook support.
- Inventory locations are closed to `INVENTORY`, `ATTACHED`, `LOADOUT`; its mapper allowlists saved fields, and `InventoryStateStore` uses schema v4 at `player_inventory_v2`. Do not extend its location semantics for aquarium/keepnet or use DEV item grants as a permanent catch API.
- `fisherman-house.html`, `src/entrypoints/house.entry.js`, and `src/game/presentation/house/` are **untracked partial user work**. The entry imports missing `house_startup.js`; CSS and art at the current HTML paths are missing. The owner's actual images are now present as untracked files in the repository root. Preserve and reconcile all of these files. `HousePresenter` computes display feed priority; authoritative priority belongs in domain.
- Inventory constructs its own two-column modal and backpack button. Build a separate Keepnet view and coordinate focus; extract a shared shell only if actual consumers justify it.
- DEV tools support button rows. Inject house navigation in development bootstrap; production remains unaware of DEV.
- Architecture/release/version-copy scripts currently enumerate older entries/pages. Extend their page graph and asset checks before shipping.
- `backend/` currently has no server package. `specs/029-backend-foundation/` designs account progress with inventory/chum only; the new snapshot is not yet in its cloud contract.

## Design Decisions

1. **Fish ownership**: `CaughtFishCollection` owns IDs, immutable catch facts, location (`keepnet`, `aquarium`, `hook`, terminal state), and remaining survival time. A resolved catch enters once. A configured `live_crucian` bait archetype references the source `crucian_stalker` definition and supplies the bait identity for attraction; no parallel writable inventory bait item is created.
2. **Care ownership**: `AquariumState` owns purchase, level, and per-species feed fraction. `FeedSupplyState` owns stock and feeder state. Application commands coordinate one save unit and expose read-only models to UI.
3. **Time**: Live-bait care and room renovation use an injected epoch wall clock, not gameplay timeScale. Settle elapsed time before each command, on startup/focus, and on a bounded display tick. Clamp backward clocks to `lastAppliedAt`. Persist one sampled life per fish, remaining life, and random death tie order; never reroll on reload. Keepnet and hook life always runs; aquarium life pauses while its species slot is fed and resumes when empty. Refeeding pauses survivors without reviving dead fish. The separate day/night game clock now has one persisted anchor shared by the fishing location and house; both read the same blend formula. This remains client-local until a future backend contract explicitly adds game time.
4. **Feed**: One portion fills one non-full species slot to 100%. Priority is lowest percentage, then larger fish count, then stable species ID. Decay rate is `baseRate × [1 + countFactor × (fishCount - 1)]`; config supplies all numeric values. Automatic feeding consumes existing stock at configured trigger. Settle elapsed offline time by feed/death events, not frame-by-frame simulation.
5. **Capacity**: Config uses the explicit `[5,6,7,8,16,18,20,22,24,48]` table. The prose formula does not reproduce jumps at levels 5 and 10. At full capacity, new bait goes to keepnet with an explanation.
6. **Hook/bite lifecycle**: Selection references one fish ID. At a compatible free-hook cast boundary, the same fish moves to `hook` and contributes a read-only bait candidate. Existing bite/gear-loss events consume it once; safe retrieve returns a survivor to keepnet. Reject occupied/incompatible hooks. Carry exact live-bait identity through consumption; initial single-hook restriction prevents the current “consume first bait” path from taking the wrong fish. Do not alter ordinary-bait odds or consumption.
7. **Movement**: Derive a per-hook `FishBehavior` from injected source species physics and apply a configured reduction to the result of **every** state. Preserve source transitions and durations; do not instantiate a full wild `Fish` or mutate its fight profile. Feed a bounded impulse into the waiting/biting tackle update through a bait-only motion component. Cache the resolved profile and reuse a lightweight output to avoid `FishBehavior.getStateData()` allocation every frame. No-live-bait game-cycle output stays identical.
8. **Persistence**: A separate `player_live_bait_v1` local snapshot owns fish, care, stock, selection, revision, and last applied time. Browser storage implements an application port; invalid/unknown bytes remain recoverable. Detect observed stale revisions from open tabs and surface a conflict; localStorage alone cannot guarantee an atomic cross-tab compare-and-swap. Leave inventory v4 unchanged.
9. **Backend alignment**: No HTTP/TypeScript work in this feature. Before future cloud sync includes this section, version spec 029's progress envelope, server validation, and migrations explicitly. Do not assume server-authoritative death/economy.
10. **Presentation**: Complete the house as one native-ESM page with horizontal room support and a full-viewport three-layer background under the transparent aquarium on the table. The owner subsequently supplied day/evening/night art for levels 1–5 and a renovation overlay; the page uses these assets, bottom sheets for functional controls, and a scroll-direction header. Keepnet uses its own read model. Labels stay in presentation catalogs; bootstrap passes configuration and concrete browser adapters.

### Provisional configuration defaults

These are starting values for an executable first implementation, not fixed balance promises. Put each value in the new feature config and review the feel with the owner:

| Parameter | Initial value |
| --- | --- |
| Eligible crucian maximum mass | 0.100 kg, inclusive |
| Sampled live-bait survival range | 30–60 minutes of unfed real time |
| Bait motion output multiplier, `swim` state only | 0.5 |
| Feed depletion for one fish in a slot | One full bar per 24 hours |
| Additional fish count factor | +0.25 base depletion per extra fish of that species |
| Automatic feeder trigger | At 0% feed, before starvation if stock remains |
| Free feed acquisition | One portion per click |
| Care settlement tick / visual countdown refresh | 10 seconds / 1 second |
| Aquarium levels 1–10 capacities | 5, 6, 7, 8, 16, 18, 20, 22, 24, 48 |

The input clock and RNG remain injectable. The duration range is sampled once per converted fish; refeeding preserves remaining time. Config validation rejects non-finite, negative, or out-of-range values, and a zero motion multiplier is permitted only if the intended still-bait behavior is explicitly chosen.

## Project Structure

### Documentation (this feature)

```text
specs/055-live-bait-aquarium/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/live-bait-actions.md
  contracts/local-save-and-assets.md
  quickstart.md
  tasks.md
  checklists/requirements.md
```

### Source Code (planned paths, not generated here)

```text
fisherman-house.html                         # preserve/reconcile current untracked page
assets/house/room-1/lvl-{1..5}/*          # day/evening/night for each level
assets/house/room-1/room--1_aqua.png       # transparent aquarium
assets/house/room-1/under-renovation.png   # transparent construction layer
src/entrypoints/house.entry.js             # existing untracked one-entry page
src/game/config/raw/live_bait/live_bait_config.js
src/game/config/runtime/game_config.js
src/game/config/raw/items/item_database.js
src/game/config/raw/fish/predator_fish.js
src/game/domain/live_bait/caught_fish_collection.js
src/game/domain/live_bait/aquarium_state.js
src/game/domain/live_bait/feed_supply_state.js
src/game/domain/live_bait/live_bait_eligibility_policy.js
src/game/domain/live_bait/live_bait_motion_profile_resolver.js
src/game/domain/live_bait/feed_slot_priority_policy.js
src/game/domain/live_bait/aquarium_care_calculator.js
src/game/application/live_bait/catch_disposition_service.js
src/game/application/live_bait/live_bait_command_service.js
src/game/application/live_bait/live_bait_care_service.js
src/game/application/live_bait/live_bait_snapshot_store.js
src/game/application/live_bait/live_bait_bait_candidate_port.js
src/game/presentation/keepnet/keepnet_ui.js
src/game/presentation/house/house_presenter.js  # reconcile existing untracked source
src/game/presentation/house/house_view.js
src/game/presentation/styles/house.css
src/bootstrap/production/live_bait_composition.js
src/bootstrap/production/house_startup.js
src/bootstrap/development/development_game_startup.js
src/dev/tools/dev_tools.js
src/platform/browser/time/browser_wall_clock.js
src/platform/browser/storage/live_bait_local_store.js
utils/live-bait-check.js
utils/architecture-check.js
utils/create-version-copy.js
utils/build-pages-release.js
```

**Structure Decision**: Feature modules remain in the existing client layers. Application ports describe only real external boundaries; bootstrap composes all stateful/configurable/host-dependent collaborators. Domain receives resolved config values and has no raw config import. Remove a proposed file if it only forwards calls, while preserving ownership and dependency direction.

### Import and composition paths

```text
game.entry.js  → production/game_startup.js → live_bait_composition.js
house.entry.js → production/house_startup.js → live_bait_composition.js
dev.entry.js   → development/development_game_startup.js → DEV house navigation

production bootstrap → game/application + game/domain + game/presentation + platform/browser
game/application      → game/domain + engine + small application ports
game/domain           → game/domain + engine only
DEV                   → production layers (never the reverse)
```

Both pages construct their own short-lived runtime from the same persisted feature snapshot; they do not share an in-memory singleton or a browser global. Navigation first saves the accepted command state, and the destination page validates/settles the snapshot before presenting it. A future simultaneous-tab authority requires a real atomic store; local revision checks only detect observed conflicts.

## Asset Placement and Release

The owner supplied fifteen 2752×1536 room JPEGs (day/evening/night for levels 1–5), `assets/house/room-1/room--1_aqua.png` (transparent aquarium), and `assets/house/room-1/under-renovation.png` (transparent construction art). `HOUSE_CONFIG.room.backgrounds` maps every level and phase to a file. The background fills the viewport, the aquarium is an independent layer aligned with the table, and renovation art stays above the dimming layer. The immutable release set must contain the house HTML, CSS, module graph, and all room assets.

## Implementation Sequence

1. Lock config, identity, care/time semantics, and save contract with deterministic focused checks. Add a mechanic entry to `docs/gameplay_backlog.md` with reproduction. Do not mix unrelated structural migration.
2. Implement domain/application commands and connect the victory and single-hook bait lifecycle. Keep ordinary bait cases unchanged.
3. Add local adapter, Keepnet view, and house UI/composition. Reconcile the owner's untracked files incrementally.
4. Extend architecture/page/release guards. Run focused, Architecture, Quick, Full, and browser smoke; rebaseline game-cycle output only for deliberate gameplay differences, documenting why.
5. At release, add a minor version and CHANGELOG entry, then get the owner's play check for movement/care feel. Cloud save coverage is a separate backend-contract change.

## Complexity Tracking

No constitution exception is planned. The separate snapshot and small ports solve cross-page lifetime and inventory-schema isolation; they should stay as narrow as their actual consumers.
