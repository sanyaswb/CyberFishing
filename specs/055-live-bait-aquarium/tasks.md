# Tasks: Live Bait, Keepnet, and Fisherman's House Aquarium

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts](contracts/).  
**Scope**: Executable implementation plan; no task below is marked complete by writing this document.  
**Tests**: Focused checks are required by `DEVELOPMENT_RULES.md` for gameplay changes and by the acceptance scenarios.

## Phase 1: Setup

**Goal**: Protect current user work and establish a reproducible gameplay change.

- [X] T001 Record the current `fisherman-house.html`, `src/entrypoints/house.entry.js`, and `src/game/presentation/house/` contents and consumers before editing; preserve this untracked owner work in the implementation change.
- [X] T002 Add one new-mechanic entry with deterministic reproduction, expected/actual behavior, and priority to `docs/gameplay_backlog.md`; reference `specs/055-live-bait-aquarium/spec.md`.
- [X] T003 Capture the pre-change game-cycle output with `utils/game-cycle-check.js` and an inventory-v4 byte fixture with `utils/inventory-save-round-trip-check.js`; record evidence in `specs/055-live-bait-aquarium/quickstart.md` when implementing.

## Phase 2: Foundational ownership and configuration

**Goal**: Define one source of truth and safe time/save boundaries before connecting UI.

- [X] T004 Add `src/game/config/raw/live_bait/live_bait_config.js` and wire it through `src/game/config/runtime/game_config.js`: initial eligible `crucian_stalker` threshold `0.100` kg inclusive; configured `live_crucian` type/source link; 30–60 minute unfed lifetime; 0.5 motion multiplier in the source fish's `swim` state only; one-fish feed bar/24 hours with +0.25 per extra fish; 0% feeder trigger; one portion per free click; 10-second care and 1-second display ticks; capacities `[5,6,7,8,16,18,20,22,24,48]`. Keep all values editable in config and no wallet field.
- [X] T005 Add config validation for every new numeric bound and catalog reference in `src/game/config/validation/config_schema_validator.js`, plus focused invalid-config cases in `utils/live-bait-check.js`; domain receives only injected resolved values.
- [X] T006 Create `src/game/domain/live_bait/caught_fish_collection.js` with unique fish IDs, one disposition, persisted sampled/remaining life, terminal states, resolved outcome IDs, and idempotent transitions.
- [X] T007 Create `src/game/domain/live_bait/aquarium_state.js` and `src/game/domain/live_bait/feed_supply_state.js` with distinct ownership of level/feed fraction and stock/feeder facts; derive occupancy from fish collection rather than storing a second count.
- [X] T008 Define version-1 snapshot normalization, validation, and revision handling in `src/game/application/live_bait/live_bait_snapshot_store.js`; unknown/corrupt bytes must remain recoverable and inventory schema v4 untouched.
- [X] T009 Implement browser time and storage adapters in `src/platform/browser/time/browser_wall_clock.js` and `src/platform/browser/storage/live_bait_local_store.js`; report failed writes and stale revisions rather than claiming saved success.
- [X] T010 Compose one shared feature runtime for game and house entries in `src/bootstrap/production/live_bait_composition.js`, injecting config, wall clock, RNG, storage, and disposal; do not import DEV from production.

**Checkpoint**: Deterministic fish/care state can be loaded and saved without a UI or inventory mutation.

## Phase 3: User Story 1 — Convert and use a small catch (P1, MVP)

**Independent Test**: 100 g crucian converts once, 101 g cannot, keepnet lifetime expires, one selected live fish is used on a compatible cast and consumed once, and reload preserves the result.

- [X] T011 [US1] Add failing deterministic eligibility, exactly-once outcome, lifetime/reload, and one-hook consumption cases to `utils/live-bait-check.js`; compare ordinary-bait game-cycle output.
- [X] T012 [US1] Implement configured species/weight eligibility in `src/game/domain/live_bait/live_bait_eligibility_policy.js`, including exactly 0.100 kg and invalid weights.
- [X] T013 [US1] Implement `src/game/application/live_bait/catch_disposition_service.js` to resolve Claim/Release/Use as live bait once, assign stable ID, choose aquarium if owned with capacity otherwise keepnet, and sample life once with injected RNG.
- [X] T014 [US1] Extend `src/game/presentation/input/victory_action_gesture_resolver.js`, `src/game/presentation/screens/victory_layout_resolver.js`, `src/game/presentation/screens/victory_renderer.js`, and `src/game/application/state/victory_state.js` for the conditional third action; preserve post-entry gesture protection and route all outcomes to T013.
- [X] T015 [US1] Implement selected/hook/consumed/returned transitions in `src/game/application/live_bait/live_bait_command_service.js`; reject occupied or incompatible hooks and expired fish; never create a second writable inventory item.
- [X] T016 [US1] Add the `live_crucian` bait archetype linked to source `crucian_stalker` in `src/game/config/raw/items/item_database.js`, its intended predator attraction in `src/game/config/raw/fish/predator_fish.js`, and a read-only candidate contract in `src/game/application/live_bait/live_bait_bait_candidate_port.js`; integrate `src/game/application/state/waiting_state.js`, `src/game/application/fishing/fishing_controller.js`, and `src/game/application/fishing/bite_system.js` for one compatible hook without a second writable bait item or altered ordinary-bait matching.
- [X] T017 [US1] Carry the exact live fish ID through bite, `src/game/application/state/playing_state.js`, retrieve, and tackle-loss paths to T015; never infer consumed identity from the first unrelated hook bait, and make repeat loss callbacks idempotent.
- [X] T018 [US1] Derive only the source `swim` behavior in `src/game/domain/live_bait/live_bait_motion_profile_resolver.js` and implement a per-hook bait-only motion adapter in `src/game/application/live_bait/live_bait_motion_adapter.js`; apply the configured speed multiplier, inject into waiting/biting tackle update, reuse hot-path output, and leave wild fish fights unchanged.
- [X] T019 [US1] Wire catch, hook, and motion collaborators in `src/bootstrap/production/game_composition_root.js`; extend `utils/live-bait-check.js` with deterministic swim-only half-speed motion and duplicate-consumption checks.

**Checkpoint**: Playable live-bait catch→cast loop with a keepnet countdown, before aquarium UI.

## Phase 4: User Story 2 — Inspect the keepnet (P2)

**Independent Test**: Claimed and converted fish are listed with filters/countdowns in a separate two-column modal beside Inventory; opening/closing either modal does not corrupt inventory or focus.

- [X] T020 [US2] Add focused filter, countdown-read-model, modal focus, and no-feed checks in `utils/live-bait-check.js` and `utils/inventory-ui-check.js`.
- [X] T021 [US2] Build the separate left visual/parameters and right fish/filter read model in `src/game/presentation/keepnet/keepnet_view_model.js`; read fish facts from application and keep filter state only in presentation.
- [X] T022 [US2] Implement the adjacent Keepnet button and two-column dialog in `src/game/presentation/keepnet/keepnet_ui.js` with matching styles in `src/game/presentation/styles/keepnet.css`; coordinate open/close/focus with `src/game/presentation/inventory/inventory_ui.js` via composition, without making InventoryUI own fish.
- [X] T023 [US2] Compose Keepnet alongside existing inventory in `src/bootstrap/production/inventory_ui_bootstrap.js` and include its stylesheet on `index.html` and `dev.html`; verify no repeated DOM lookup per frame.

**Checkpoint**: Keepnet is usable independently of the house page.

## Phase 5: User Story 3 — Aquarium and Fisherman's House (P3)

**Independent Test**: Install aquarium, move live fish, feed species slots by priority, leave/reopen after elapsed real time, and navigate rooms with the background and aquarium on separate layers.

- [X] T024 [US3] Add failing fake-clock/feed-priority/starvation/reload tests in `utils/live-bait-check.js`: lowest feed %, then largest count, then species ID; positive feed protects; refill pauses remaining life; reload cannot reroll deaths.
- [X] T025 [US3] Implement `src/game/domain/live_bait/feed_slot_priority_policy.js` and `src/game/domain/live_bait/aquarium_care_calculator.js` with config-driven count-scaled decay and event-time feed/death settlement, including long offline intervals and backward-clock clamp.
- [X] T026 [US3] Implement `src/game/application/live_bait/live_bait_care_service.js` to settle elapsed time before commands and on startup/focus/coarse tick; persist one result revision and expose derived slot/read models, never a UI-owned timer.
- [X] T027 [US3] Implement install/transfer/manual-feed actions in `src/game/application/live_bait/live_bait_command_service.js`, enforcing capacity and one portion→one slot at 100% with no feed action for keepnet.
- [X] T028 [US3] Reconcile existing `src/game/presentation/house/house_presenter.js` and `src/game/presentation/house/house_labels.js` with authoritative application commands; remove any display-only feed priority that could disagree with the domain rule.
- [X] T029 [US3] Implement the browser house view in `src/game/presentation/house/house_view.js` and styling in `src/game/presentation/styles/house.css`; use accessible left/right room navigation, equal-width species bar divisions, and emoji for art beyond the two supplied files.
- [X] T030 [US3] Preserve and move the supplied root `home_fishermans_room--1.png` and `room--1_aqua.png` into `assets/house/`, reconcile `fisherman-house.html` and `src/entrypoints/house.entry.js`, create `src/bootstrap/production/house_startup.js`, and update source/preload URLs; keep the transparent aquarium on a separate layer aligned with the central table and test responsive placement.
- [X] T031 [US3] Add a temporary house navigation button through `src/dev/tools/dev_tools.js` and injected browser navigation in `src/bootstrap/development/development_game_startup.js`; production bootstrap must not import DEV.

**Checkpoint**: House and aquarium care work without auto-feeding or upgrades.

## Phase 6: User Story 4 — Free upgrades and automatic feeding (P4)

**Independent Test**: Every acquisition control says Free, each upgrade advances one level through capacities 5/6/7/8/16/18/20/22/24/48, feeder uses stock while away, and empty stock creates no feed.

- [X] T032 [US4] Add capacity-table, one-click upgrade, finite-stock feeder, and no-currency checks to `utils/live-bait-check.js`.
- [X] T033 [US4] Add upgrade/max-level and Free feed-stock acquisition commands in `src/game/application/live_bait/live_bait_command_service.js`, using the exact configured level table in `src/game/domain/live_bait/aquarium_state.js`.
- [X] T034 [US4] Add feeder purchase/toggle and offline stock-consuming refill in `src/game/application/live_bait/live_bait_care_service.js`, using the same priority policy as manual feeding and the configured threshold.
- [X] T035 [US4] Connect “Безкоштовно” labels, disabled states, and working buttons in `src/game/presentation/house/house_presenter.js`, `src/game/presentation/house/house_view.js`, and `src/game/presentation/house/house_labels.js`; do not add wallet, payment, or entitlement state.

**Checkpoint**: All requested house controls function with zero currency implementation.

## Final Phase: Integration, safeguards, and release evidence

- [X] T036 Register `src/entrypoints/house.entry.js` and `fisherman-house.html` in `utils/architecture-check.js`, including production reachability/no-DEV import and one-module-entry rules; do not weaken existing guards or whitelists.
- [X] T037 Extend `utils/create-version-copy.js`, `utils/build-pages-release.js`, and `utils/pages-release-check.js` so an immutable release includes the house page, its stylesheet/module graph, and `assets/house/home_fishermans_room--1.png` plus `assets/house/room--1_aqua.png`; do not claim asset visual checks until supplied.
- [X] T038 Register focused checks in `utils/testing/suites/check_manifest.js` and run `node utils/live-bait-check.js`, `npm run check:architecture`, `npm run check:quick`, and `npm run check`; record actual results in `specs/055-live-bait-aquarium/quickstart.md`.
- [ ] T039 Browser-smoke `index.html`, `dev.html`, and `fisherman-house.html` for Claim/Release/Live bait, Keepnet, house navigation, feeding, reload/offline care, and ordinary bait; compare unaffected game-cycle and inventory v4 bytes, and rebaseline only intentional gameplay differences with an explained commit.
- [ ] T040 Before release, update `CHANGELOG.md` and the project minor version, request the owner's play check for movement/care feel, and document in `specs/055-live-bait-aquarium/plan.md` that future cloud progress requires an explicit spec-029 contract/version change.

## Owner revision: room art, global time, renovation and compact menus

- [X] T041 Make one persisted game-time clock in `src/game/domain/time/`, compose it for the location and house, and reuse one background-blend formula.
- [X] T042 Configure all fifteen room images, the aquarium layer, renovation overlay, and the four room upgrade durations in `src/game/config/raw/house/house_config.js`.
- [X] T043 Implement persistent five-level room progression with elapsed real-time completion and an immediate free finish action.
- [X] T044 Replace the verbose house layout with a full-screen scene, upward-opening functional menus, and a direction-sensitive fixed header.
- [X] T045 Add focused shared-time, art-presence, reload and room-upgrade checks in `utils/house-check.js`; update release asset assertions.
- [X] T046 Browser-smoke the house menu, aquarium install, renovation reload, free finish, level art change and header scroll behavior.
- [X] T047 Refine the house header, fishing button, responsive aquarium layer, bottom shade, centered controls and inventory-style upgrade cards with next-level bonuses and progress.

## Dependencies and execution order

- T001–T003 preserve/record the starting state. T004–T010 establish contracts and owners before gameplay entry points.
- US1 (T011–T019) is the playable MVP and must precede US2/US3 fish views. US2 (T020–T023) and US3 (T024–T031) can be developed as separate UI slices once US1 ownership is stable; they remain independently testable through their listed scenarios. US4 (T032–T035) depends on US3 care/house commands.
- T036–T040 follow the relevant implementation slices. The owner-provided PNG bytes are already in the repository root; T030 places them in the release asset tree before T037 visual/release verification.
- T011, T020, T024, and T032 establish meaningful failing checks before their respective behavior. T036 and T037 may proceed in parallel after the house entry shape is fixed; all shared composition/edit points are sequential.

## Requirement coverage

| Spec requirements | Tasks |
| --- | --- |
| FR-001–FR-005, FR-017–FR-018: catch, bait identity/motion/lifetime, hook | T004–T019 |
| FR-006: Keepnet modal and filters | T020–T023 |
| FR-007–FR-010: slots, decay, priority, death | T024–T030 |
| FR-011–FR-013: Free actions, feeder, level/config | T004–T005, T032–T035 |
| FR-014–FR-015: house page, DEV link, layered art | T029–T031, T036–T037 |
| FR-016: persistence and compatibility | T006–T010, T038–T039 |

## Implementation strategy

Deliver US1 as the first reviewable mechanic, validate it, then add Keepnet, Aquarium/House, and Free upgrades/feeder. Keep structural seams and gameplay changes in separate commits when possible; preserve the old game-cycle baseline in structural commits and document any intentional new-mechanic delta. No backend deployment or cloud-save claim is part of this feature.

## Phase 7: Convergence

- [ ] T048 Add a second accessible room viewport (with a placeholder until room art is supplied), then verify left/right controls, keyboard or swipe navigation, and retained aquarium state per FR-014 and US3/AC5 (partial).
- [X] T049 Run deterministic acceptance checks for 100 eligible/ineligible catch outcomes, 100 repeated outcome/cast lifecycles, and a 24-hour absence plus reload with one-display-tick accuracy per SC-001, SC-002, and SC-003 (`utils/testing/live_bait/keepnet_lifecycle_scenarios.js`).

## Phase 8: Convergence

- [X] T050 Superseded by the owner's shared-feed starvation-window revision (T061). Randomized simultaneous-death tie ordering is no longer a gameplay requirement.
- [X] T051 Show a visible reason when an eligible catch falls back to the keepnet because the aquarium is full, while preserving the single successful disposition change per FR-005 and the aquarium-full edge case. Victory reports the committed result through an injected callback; Keepnet displays the reason. Rejected full-keepnet outcomes remain retryable.
- [ ] T052 After the house files are committed, verify the immutable release contains `fisherman-house.html`, its module/style graph, and all seventeen room assets; smoke the packaged house page and record the result per T037 and plan: release evidence (partial).

## Phase 9: Keepnet detail review (owner request, 2026-10-12)

- [X] T053 Group Keepnet read models by species after filtering; show thumbnail and bottom-right count, preserving individual IDs and capacity accounting.
- [X] T054 Reuse the Keepnet dialog for individual images, weight, rarity, level and timer; add Back/Escape navigation, keyboard focus containment, missing-image fallback, mobile controls, and timer-only DOM updates.
- [X] T055 Preserve caught rarity/art for catches and live bait; validate and migrate snapshot v1 to v2 without rewriting inventory saves or inventing lost historical rarity.
- [X] T056 Expose conversion, selection, aquarium transfer and confirmed release through existing application commands; report stale/expired/capacity failures and retain ownership in the application.
- [X] T057 Fix event-time display projection, expired hook candidates, rejected-command care settlement, configured feeder thresholds, hook return reservations and explicit interrupted-cast recovery at fishing-session startup.
- [X] T058 Register deterministic Keepnet DOM interaction checks; cover legacy/corrupt saves, mixed protected/unprotected fish, reload, filters, expiry and exact fish actions. Run Architecture, Quick and Full; browser visuals remain owner acceptance.

## Phase 10: Shared feed owner revision (2026-10-12)

- [X] T059 Rewrite current specification, plan and data model for shared aquarium feed, common live bait up to 100 g and safe special-fish stacks.
- [X] T060 Add eleven aquarium-feed packs across three qualities, population-adjusted durations, finite stock selection and schema-v3 migration.
- [X] T061 Replace species care with shared feed and independently randomized persistent episode deadlines; cover projection, rescue, re-depletion, transfers and offline automatic feeding.
- [X] T062 Show the feed image/bar above the aquarium, pack selection and quality/countdown labels.
- [X] T063 Generate reduced thumbnails with convert-images.js; animate fish inside a configurable zone with DEV-editable size, speed, direction and green grid.
- [X] T064 Preserve anomaly/unique catch facts; show square safe stacks using rarity/weight representatives and retain exact-ID details.
- [X] T065 Run focused checks, Architecture, Quick, Full and browser smoke for game/DEV/house. Record evidence and version/changelog.

## Phase 11: Inventory feed and mobile controls (v0.34.1)

- [X] T066 Catalog every aquarium pack as an inventory item; group and style the DEV free shop.
- [X] T067 Add Groundbait/For aquarium checkbox filter and restore native mobile horizontal scrolling; physical-phone feel acceptance belongs to the owner.
- [X] T068 Use inventory as sole feed-stock owner, migrate old feature stock once and persist consumption/activation with recovery.
- [X] T069 Add available-only row list and centered quantity slider with immediate single-pack action, bounds, cancellation and exact consumption.
- [X] T070 Cover quantity, migration/failure recovery, catalog/filter and UI interactions; Architecture 2/2, Quick 17/17 and Full 43/43 passed. Further browser/mobile checks are delegated to the owner at their explicit request.
- [X] T071 Update v0.34.1/changelog, commit/push source and deploy verified GitHub Pages release.
