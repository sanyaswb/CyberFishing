# Specs

Each folder records one decision: the verified problem, the change and its evidence. A completed spec describes the
code **as it was when the spec was done** and is not updated afterwards; current structure lives in
[docs/architecture.md](../docs/architecture.md) and open work in
[docs/refactoring_remaining.md](../docs/refactoring_remaining.md). Specs 029 and later are numbered after the owner's
spec-kit work (029); Claude's specs start at 030.

## Active

| Spec | Decision | Status | Release |
| --- | --- | --- | --- |
| [020](020-production-console-noise/spec.md) | Production console carries no developer logs | Done | v0.31.0 |
| [021](021-shared-number-normalization/spec.md) | 81 private numeric helpers → shared `engine/math` functions | Done | v0.31.0 |
| [022](022-reuse-duplicates/spec.md) | Reuse instead of copied blocks (GodMode, equipment, gradients, …) | Done | v0.31.0 |
| [023](023-fight-frame/spec.md) | Production fight frame instead of the DEV diagnostics snapshot | Done | v0.31.0 |
| [024](024-fish-physics-normalization/spec.md) | Fish runtime physics normalized once per fish | Done | v0.31.0 |
| [025](025-fixed-catch-dev-only/spec.md) | Fixed Catch exists only in DEV | Done | v0.31.0 |
| [026](026-config-composed-once/spec.md) | Configuration collaborators composed once in bootstrap | Done | v0.31.0 |
| [027](027-physics-config-cache/spec.md) | Normalized physics settings cached per config revision | Done | v0.31.0 |
| [028](028-session-out-of-bootstrap/spec.md) | Game session moved from bootstrap to the application layer | Done | v0.31.0 |
| [029](029-backend-foundation/spec.md) | Accounts and cloud progress: [plan](029-backend-foundation/plan.md), [follow-up decisions](029-backend-foundation/follow-up-decisions.md) | Plan only (owner) | — |
| [030](030-storage-cache-instance/spec.md) | `LocalStorageCache` is an instance over injected storage | Done | v0.32.0 |
| [031](031-composition-root-split/spec.md) | `GameCompositionRoot` split into named composition steps | Done | v0.32.0 |
| [032](032-direct-calls/spec.md) | Direct calls on always-present collaborators (orchestrator, session) | Done | v0.32.0 |
| [033](033-platform-singletons/spec.md) | Page loop guard, per-instance id counter, injected logger | Done | v0.32.0 |
| [034](034-inactive-dev-flags/spec.md) | Production composes inactive DEV flags; GodMode off in production | Done | v0.32.0 |
| [035](035-inactive-diagnostics/spec.md) | Session diagnostics and debug events behind injected ports | Done | v0.32.0 |
| [036](036-listener-counter/spec.md) | Listener counts through an injected DEV counter | Done | v0.32.0 |
| [037](037-starting-inventory/spec.md) | New player's inventory without the legacy conversion | Done | v0.32.0 |
| [038](038-pages-release/spec.md) | Immutable GitHub Pages release directories (`npm run release:pages`) | Done | v0.32.0 |
| [039](039-version-copy-path/spec.md) | Version-copy folder from `CYBER_FISHING_VERSIONS_DIR` | Done | v0.32.0 |
| [040](040-shared-clamp/spec.md) | Private clamp copies use the shared functions | Done | v0.32.0 |
| [041](041-direct-calls-inventory/spec.md) | Direct calls on inventory collaborators | Done | v0.32.0 |
| [042](042-src-module-type/spec.md) | `src/package.json` declares the module type | Done | v0.32.0 |
| [043](043-fight-diagnostics-builder/spec.md) | DEV fight snapshot builder out of the orchestrator | Done | v0.32.0 |
| [044](044-fight-stages-pressure-landing-stamina/spec.md) | Pressure, landing/tension and stamina fight stages | Done | v0.32.0 |
| [045](045-fight-stages-motion-line/spec.md) | Fish motion, rod movement and line fight stages | Done | v0.32.0 |
| [046](046-fight-direct-calls/spec.md) | Direct calls in fight systems; typeof guards on composed receivers | Done | v0.32.0 |
| [047](047-smart-asset-preloader/spec.md) | Smart asset loading, optional Spine and DEV image tools: [plan](047-smart-asset-preloader/plan.md) | Spec and design only (owner review) | — |
| [048](048-game-cycle-baseline/spec.md) | Tracked game-cycle baseline; gameplay changes re-baseline as a reviewed diff | Done | — |
| [049](049-fishing-services-composition/spec.md) | One fishing services composition for production and game-cycle | Done | — |
| [050](050-sliding-float/spec.md) | Sliding float: depth costs no cast distance (gameplay G-002) | Done | — |
| [051](051-dev-item-grant/spec.md) | DEV item grant: any catalog item into the inventory (G-004) | Done | — |
| [052](052-depth-selector-ux/spec.md) | Depth on the float button, slide-down track, cast limit line (G-005) | Done | — |
| [053](053-water-metric/spec.md) | Perspective metres on the water: one `WaterMetric` per location; casting, fight and tackle in ground metres (G-006) | Implemented | — |
| [054](054-bait-boat-water-metric/spec.md) | Bait boat speed and motion on the water metric (G-007) | Specified | — |
| [055](055-live-bait-aquarium/spec.md) | Live bait, keepnet, aquarium and Fisherman's House: [plan](055-live-bait-aquarium/plan.md), [tasks](055-live-bait-aquarium/tasks.md) | Implementation/release tasks complete; 2 open: owner gameplay acceptance and second room | v0.35.0 |
| [056](056-inventory-icon-design/spec.md) | Minimal-text inventory design, vector placeholders, automatic refill pills and scrollbar spacing | Implemented; owner checks visuals | v0.34.3 |
| [057](057-modular-ui-catalog/spec.md) | Reusable UI components, isolated DEV catalog and logical 320px scaling: [plan](057-modular-ui-catalog/plan.md), [tasks](057-modular-ui-catalog/tasks.md), [coverage](057-modular-ui-catalog/coverage.md) | Implemented; Architecture 4/4, Quick 21/21, Full 47/47; owner visual acceptance pending | v0.35.0 |
| [058](058-dev-time-controls/spec.md) | Tablet/landscape loadout, locked placeholders, compact DEV navigation, House DevTools and transient calendar acceleration | Implemented; Architecture4/4, Quick23/23, Full49/49; owner visual acceptance pending | v0.35.0 |
| [059](059-map-navigation-input/spec.md) | Map click/drag/wheel before rod equipment, configurable navigation and clock input isolation | Implemented; Architecture 4/4, Quick 24/24, Full 50/50; index/dev browser smoke passed; owner phone feel pending | v0.35.0 |
| [060](060-house-navigation-header/spec.md) | House scene/zone gestures, tap/swipe sheets, shared single-row HUD and wide-screen cover | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; console clear; owner visual/input acceptance pending | v0.35.0 |
| [061](061-aquarium-feed-loading/spec.md) | Aquarium right-aligned counts, single-pack selection/loading, half-time lock and additive protection with v5 save migration | Implemented; automated checks pass; console clear; owner visual/input acceptance pending | v0.35.0 |
| [062](062-house-feed-preview/spec.md) | Shared compact feed row, selection/reopen flow, responsive numeric upgrade and stable desktop dock hover | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; console clear; owner visual/input acceptance pending | v0.35.0 |
| [063](063-house-time-of-day/spec.md) | House time of day shares the location base/overlay composition and blends each refresh with a CSS transition | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [064](064-house-dev-config/spec.md) | House DevTools apply live aquarium visual edits; shared DEV config validation and item catalog | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner check pending | v0.36.0 |
| [065](065-dev-house-override-handoff/spec.md) | One DEV override handoff between the location and the embedded House replaces the separate visual/time messages | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner check pending | v0.36.0 |
| [066](066-house-review-cleanup/spec.md) | House review cleanup: view texts in HOUSE_LABELS, plural fish counters, token colors/layers, fish canvas resize and shared visual validation, HouseView split | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [067](067-inventory-sections/spec.md) | Grey unit-scaled equipment container (rod condition, adaptive dependent column, four wells), icon section tabs and section switching: equipment, backpack summary, keepnet as an inventory section | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [068](068-portrait-inventory-screen/spec.md) | Landscape equipment pinned to the top; full-screen portrait inventory with bottom tabs, one-row header, compact switches, list-only scrolling and backpack/keepnet backgrounds | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [069](069-portrait-inventory-container/spec.md) | Portrait inventory as one full-screen dark container: rounded header panel, equipment without the item list | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [070](070-inventory-slot-pick/spec.md) | Empty cell or craft socket picks through the backpack; rodless rod cell fills the free height | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [071](071-bamboo-rod-skin/spec.md) | First rod skin: bottom-cropped thumbnail, equipment art with and without line; prompts in docs/art-prompts | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [072](072-inventory-consumable-controls/spec.md) | Header consumable buttons per hook slot, manual/automatic counts, sequential bait selection, 100kg load row | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [073](073-glyph-ink-centring/spec.md) | Emoji glyphs centred by measured ink through one shared ui-glyph | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [074](074-header-sections-and-collections/spec.md) | Two-section wide header, header circle applies a waiting bait/chum, picks keep a visible list, shared filter/items collections | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [075](075-backpack-pager-and-capacity/spec.md) | Portrait backpack pager (Items/Backpack, swipe), backpack view with a 0/100 capacity scale, uniform container gaps | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [076](076-scroll-input-fixes/spec.md) | Map pan whenever the rod cannot cast; drag-scrolling lists without selecting cards; list height chain restored | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [077](077-inventory-sidebar-parent/spec.md) | One sidebar parent paints the left column; transparent tab bar, no outer section frames | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |
| [078](078-portrait-equipment-real-size/spec.md) | Portrait equipment unit from its real row (size container) instead of a viewport estimate | Implemented; Architecture 4/4, Quick 25/25, Full 51/51; owner visual acceptance pending | v0.36.0 |

## Archived

Specs 001–019 (Stage 7 inventory decomposition, the v0.30.x cleanup, the CSS restructure and post-closure dead code)
are completed and were removed from `develop`. They stay readable at the
[`specs-archive-001-019`](https://github.com/sanyaswb/CyberFishing/tree/specs-archive-001-019/specs) tag.

| Spec | Decision | Release |
| --- | --- | --- |
| 001 | Inventory decomposition (Stage 7 final step) | v0.29.0 |
| 002 | Line capacity follows the current equipment | v0.30.0 |
| 003 | Names follow responsibilities; files follow classes | v0.30.0 |
| 004 | Dead CSS removed, inventory styles in one place | v0.30.0 |
| 005 | Player-facing texts live in presentation | v0.30.0 |
| 006 | Unreachable item progression UI removed | v0.30.1 |
| 007 | Write-only progression styling removed | v0.30.1 |
| 008 | Test-only capacity policy moved out of Domain | v0.30.1 |
| 009 | Historical editing notes retired from production comments | v0.30.1 |
| 010 | Optional rating tiers kept; card metadata visibility respected | v0.30.1 |
| 011 | Unused bite/chum readiness APIs retired | v0.30.1 |
| 013 | World perspective separated from camera projection | v0.30.1 |
| 014 | Project tree generated only from Git-tracked files | v0.30.1 |
| 015 | Release 0.30.1 cleanup closure | v0.30.1 |
| 016 | Owner's image converter moved into `utils` | v0.31.0 |
| 017 | Force and tackle snapshots named diagnostics | v0.30.1 |
| 018 | Presentation CSS restructure (ownership, load order, visual parity) | v0.31.0 |
| 019 | Post-closure dead code removed | v0.31.0 |
