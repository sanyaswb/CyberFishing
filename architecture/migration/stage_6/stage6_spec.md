# Stage 6 - Native Development / Production Split

Status: implementation specification; Stage 6 has not been applied.
Date: 2026-10-05. Baseline: release 0.26.1, commit `6ece75794c1f103e0bace13ad4f8a7e2b7064a11`.
Owner: Codex autonomous implementation and automated acceptance under the project owner's rules.

This specification expands `../stage_6_handoff.md` and `refactor_Task.txt` section 5. It does not reopen Stage 5. Read the immutable Stage 3/4/5 closure records, Stage 5 graph v8 and preparations 027-031 before implementation. The inventory is a measured planning baseline, not evidence that any Stage 6 module has migrated.

## Outcome

Both browser surfaces start authored ESM. Production remains `index.html -> game.entry.js -> Production Bootstrap`. Development becomes `dev.html -> dev.entry.js -> Development Bootstrap`, composing the same Engine/Game/Platform implementations plus isolated DEV diagnostics, overlay, GodMode diagnostics, watchdog and balance tools. Neither surface needs the cumulative compatibility runtime, activation scripts or classic source ordering at Stage 6 closure.

Production must contain no DEV imports, including transitive or dynamic imports. Enabled gameplay overrides still work without DEV diagnostic classes through the stateless production GameplayOverrideReader. No gameplay balance, formulas, public gameplay API, save schema, saved bytes, deltaTime semantics or hot-loop allocation regression is authorized.

## Verified starting quantities and count semantics

Counts below were read from actual authored imports, the Manifest, the live bridge registry, the runtime contract and comment-stripped `dev.html`. `stage6_module_inventory.json` pins the input bytes and lists every selected source/target, existing export provider, confirmed dependency source, bridge identity and activation identity.

| Quantity | Stage 6 starting value | Required result |
| --- | ---: | --- |
| Native production authored modules | 350 | One canonical graph, DEV/compatibility-free; measure final total |
| Production static/literal dynamic import edges | 521 | Resolve every edge; record exact final count |
| Existing source files to migrate | 96 | All accounted for by accepted native targets or a separately reviewed exact replacement |
| DEV modules among those sources | 93 | Authored ESM under `src/dev/`; absent from production graph |
| Development Bootstrap sources | 3 | Explicit native factories/startup/lifecycle under `src/bootstrap/development/` |
| Required new entrypoint | 1 | `src/entrypoints/dev.entry.js` imports only Development Bootstrap |
| Remaining bridge records | 50 | 0 active bridges |
| Distinct classic bridge reader files | 26 | 0 classic readers; migrate or retire each exact holder |
| Distinct existing bridge target modules | 25 | Reuse canonical authored ESM identity |
| Active cumulative-runtime activations | 26 | 0 active activations |
| Previously retired activations | 380 | Preserve immutable provenance; do not reactivate |
| Existing inert runtime modules | 5 | Review actual test/loader consumers before physical removal |
| Known architecture debts | 19 | Resolve the exact affected debts; no new debt/exception |
| Active external script tags in DEV HTML | 446 | 1 module entry tag; no classic runtime/source/activation tags |
| Those tags: classic `src/` sources | 412 | 0 classic source tags |
| Those tags: cumulative IIFE / activation scripts | 1 / 26 | 0 / 0 |
| Those tags: legacy Stage 2 wrapper paths | 7 | 0; review their current outputs rather than assume 7 active bridges |

The 446 HTML tags are transport/load surfaces, not 446 modules to migrate. Many are retired placeholders. The 50 bridges describe individual reader/provider relationships, not 50 new modules. The 25 bridge targets and the 350 production modules must not be added as disjoint sets. Likewise, `350 + 96 + 1` is not a promised final DEV graph count: the production entry/startup may be substituted and justified composition/data splits may add files. Measure the actual reachable DEV graph after implementation and record every count/path change.

The Manifest's historical `migrationWave: 7` for DEV is a wave classification, not an instruction to postpone native DEV to Stage 7. Stage assignment is governed by the current owner scope, handoff and exact retirement records.

Current shared production graph breakdown:

| Layer | Modules |
| --- | ---: |
| Engine | 12 |
| Game Domain | 136 |
| Game Application | 48 |
| Game Config | 27 |
| Game Presentation | 84 |
| Platform | 32 |
| Production Bootstrap | 10 |
| Production entrypoint | 1 |
| **Total** | **350** |

Development reuses the needed canonical modules in this graph. Importing `game.entry.js` as a DEV dependency is forbidden because it starts production as a side effect. Calling `startProductionGame()` and then creating a second DEV Game/Root is also forbidden.

## Target boundaries and ownership

```text
index.html -> src/entrypoints/game.entry.js
               -> src/bootstrap/production/*
                    -> src/engine/* + src/game/* + src/platform/*

dev.html   -> src/entrypoints/dev.entry.js
               -> src/bootstrap/development/*
                    -> the same authored Engine/Game/Platform modules
                    -> src/dev/*
```

Named exports and explicit `.js` imports are required. Use small constructor/factory contracts and existing injection seams. Concrete composition stays in Bootstrap. DEV may read production facts; production may only receive narrow diagnostic hooks and must not import DEV. Domain/Application cannot receive browser APIs or read raw config/browser/DEV globals.

Retain one Game, GameApplication, GameCompositionRoot, runtime-config context, override store/provider and canonical physics adapter per browser realm. Keep one active gameplay loop. Diagnostic loops already used by overlay/probe are separate resources and must retain their own lifecycle; the one-game-loop requirement is not permission to silently remove them.

Each mutable fact retains its current authoritative owner. Fish owns debuff state, LocationMap owns map revision, inventory owns item/equipment records, config owns resolved runtime values, DEV owns overlay settings and diagnostic toggles. Overlay/render/debug tools must not acquire gameplay state ownership. Any existing platform-published game/config/version handle needs a concrete reader and lifecycle review; removing compatibility does not mean every browser property can be deleted safely. Add no new permanent global API.

## Work package A - Freeze the execution graph and actual holders

1. Verify the pinned baseline and a clean tree. Inventory every static/global/property/dynamic reader and writer in production, DEV, tests, builders and evidence dispatch. Record exact target imports, evaluation order, runtime identity and state owner per module.
2. Review the 96 target mappings below against current code; they are Manifest candidates, not a license to move a mixed class blindly. `dev_tools.js`, the reel live probe, location debug provider and existing bootstrap side effects require explicit responsibility/lifecycle review.
3. Build the actual dependency order. Constants/value helpers first, then base classes/registries, modules/sections, services/tools, explicit bootstrap factories, native entry cutover. Resolve the current debug cycle through injection: console/event binder/debug bootstrap/bite ticks cannot import an eagerly constructed singleton from each other.
4. Pin every allowed side effect. Convert eager construction/publication in `debug.js`, `overlay_bootstrap.js`, settings stores and probe activation into explicit bootstrap calls. Importing a DEV class must not start listeners, a loop, DOM construction or a watchdog by accident.
5. Publish a reviewed Stage 6 graph/cluster plan using the existing ledger/evidence mechanisms. Extend their current Stage 4/5 qualification narrowly for Stage 6, with meaningful positive/negative fixtures. The current tools do not yet support Stage 6: merely passing `--stage 6` today is not a valid recipe.
6. Keep all frozen records byte-exact. Original Stage 5 source cluster 028 remains deferred with null output/verification. Record its Stage 6 successor and reference the separately verified native-production obligation; never mark the old source applied retroactively.

Acceptance: every source, bridge reader, startup side effect and state owner has a concrete destination/retirement trigger; no unresolved architecture-critical dependency is guessed.

## Work package B - Migrate the 93 DEV modules to authored ESM

Convert the exact module inventory in cohesive dependency-ordered clusters. Preserve class/method behavior, public diagnostics, event names, UI text, settings keys, sorting and update cadence. Add imports/exports and inject the already-needed dependencies; do not rename APIs or rebalance formulas.

Required groups include debug core (5), console modules and the live probe (15), GodMode (1), DevTools (1), schemas/services/watchdog (10), and overlay (55: 1 config + 4 core + 6 DOM + 36 modules/sections + 8 services). Six DEV sources currently live outside `src/debug/`; they must move as DEV rather than become production imports:

- `src/app/debug.js` -> `src/dev/runtime/debug_service.js`.
- `src/app/rendering/location_debug_render_frame_builder.js` -> `src/dev/location/location_debug_render_frame_builder.js`.
- `src/config/physics/physics_formula_map.js` -> `src/dev/physics/physics_formula_map.js`.
- `src/render/core/render_allocation_diagnostics.js` -> `src/dev/diagnostics/render_allocation_diagnostics.js`.
- `src/render/world/location_debug_map_builder.js` -> `src/dev/location/location_debug_map_builder.js`.
- `src/render/world/world_debug_renderer.js` -> `src/dev/rendering/world_debug_renderer.js`.

The current DevTools file mixes UI construction, config/catalog editing, controls and active-fish interactions. Split only where a verified ownership/dependency/lifecycle problem requires it; record new targets/counts before applying the split. Do not create a catch-all DevManager or a second config/state container. The location provider may keep cohesive read/format helpers; its printer must receive actual config/viewport/logger dependencies rather than recover them through globals.

GodMode diagnostics must read the same injected runtime config as production GameplayOverrideReader. Debug-module toggles have one DEV owner and are passed to DebugService/console/binder/tools/probe through a source/reference composed once. Keep all gameplay-affecting flags live. A missing diagnostic class must never switch off Fixed Catch, bite-sequence or enabled gameplay override effects.

Overlay DOM helpers may retain their reviewed DEV responsibilities. Inject browser/event/storage/scheduler capabilities where ownership/isolation requires them; do not reclassify dependencies or add debts merely to pass guards. Do not introduce a new broad service framework for this move.

Acceptance per cluster: actual imports resolve, exports and consumer identities match, focused API/event/UI parity passes, exact bridge removals are justified and deterministic game-cycle stdout remains unchanged.

## Work package C - Native Development Bootstrap and HTML cutover

Migrate the three existing composition sources:

| Existing source | Planned target | Responsibility |
| --- | --- | --- |
| `src/app/script.js` | `src/bootstrap/development/legacy_game_startup.js` | One native DEV game startup, factories, readiness, watchdog, disposal |
| `src/debug/debug.js` | `src/bootstrap/development/debug_console_bootstrap.js` | Compose console registry/context/loggers/event binding |
| `src/debug/overlay/overlay_bootstrap.js` | `src/bootstrap/development/debug_overlay_bootstrap.js` | Compose/start overlay and its metric/view/interaction resources |

`legacy_game_startup.js` is the current Manifest target name; its implementation must be native ESM. If Phase A reviews a clearer target filename, update the Stage 6 plan/Manifest before applying it and preserve public behavior.

Create `src/entrypoints/dev.entry.js` with only a Development Bootstrap import and startup request. Reuse existing production Game/Root/Application, BrowserGameLifecycle, native config composition, version catalog/badge, platform adapters and serial cold-loader sequence. Extract a small shared startup/lifecycle helper only if the two bootstraps actually need it; record the additional module and prove both surfaces. No second loader, generic startup framework or global fallback is allowed.

Development Bootstrap explicitly composes the existing factories: DevFlagsProvider, LocationDebugMapBuilder, ItemProgressionDebugSnapshotProvider, FixedCatchFishFactory, HookedFishProfileSynchronizer, DebugService, WorldDebugRenderer, DevTools, LocationDebugRenderFrameBuilder and RenderAllocationDiagnostics. It composes MemoryLeakWatchdog only under the existing enabled/config conditions and derives metrics from canonical GameLoop/EventLifecycle/EventBus/InputManager diagnostics.

Preserve startup ordering: config/catalog setup, browser interface/version activation, diagnostic availability before dependent subscriptions, cleanup of the previous game, root construction, publication/readiness, Game.start, watchdog conditions, pagehide cleanup and startup-error reporting. Match current DOMContentLoaded behavior for both loading and ready documents. Concurrent startup calls return the same promise and resulting Game; failed startup must retain the reviewed reporting/disposal behavior.

Replace the 446 active external script tags in `dev.html` with one versioned `type="module"` DEV entry. CSS, canvas, version badge, assets and user controls retain behavior. Neither HTML file loads classic declarations, activation shims, an isolated wrapper or the compatibility IIFE. Verify both native pages directly; a synthetic module-only fixture is not enough.

Dispose binder, overlay controller/metric bridge, probe, tools, watchdog, callbacks/timers and Game exactly once on pagehide/restart. Preserve listener/remove identity, no duplicate game loop and no orphan diagnostic animation frame or timer.

Acceptance: native production and native DEV work independently, canonical identities match inside each realm, duplicate startup does not construct a second game, production never imports DEV, and all old external script surfaces are absent from live HTML.

## Work package D - One base + override runtime-config source

Execute this as a separate reviewed transition after native composition parity. Current `createRuntimeConfigContext()` owns a frozen base and one store/provider but also writes the mutable `CONFIG` through set/reset/import; Root exposes a live facade over that raw owner. Target: immutable base plus one override store is the authoritative source, RuntimeConfig reads the resolved values, and DEV config writes go through that store/context only.

Before implementation, inventory every read/write and define exact resolution semantics. Existing `ResolvedConfigProvider.get()` only checks an exact override key. It is not yet a complete drop-in replacement for the nested mutable runtime object. Existing store reads clone values, and the immutable clone excludes the non-enumerable physics adapter. Address these facts explicitly rather than adding a Proxy or rebuilding a whole config object on each frame.

Required parity cases:

- Exact path, parent-object and child-path overrides, sibling coexistence, arrays, zero/false/null/undefined and missing-path fallback.
- Current set/reset/resetAll/export/import behavior, including omitted import paths and base-missing reset paths. Preserve current semantics unless a separate owner decision changes them; migration is not a bug-fix license.
- One stable runtime port identity and current shared catalog references where consumers depend on identity or live mutations.
- FightPhysicsConfigAdapter replacement/invalidation reaches an existing Application, Reel, water entity and fight consumer immediately, with no stale cached adapter.
- Existing item progression invalidation, location/config-updated events and hooked-fish synchronization retain ordering/effects. Create providers/cache records once, not per frame.
- Deep freeze and structuredClone/JSON fallback behavior; save keys/bytes and override export format unchanged.
- Config editing does not rebuild Game/Root or reset a live session.

Do not interpret 'DEV writes only to the override store' as permission to change every catalog/active-fish editor. DevTools currently also edits ITEM_DB/MAP_DB/FISH_DB and the active fish. Classify those owner paths separately and preserve their existing behavior through injected capabilities. Config overrides, catalog authoring edits and active-fish diagnostic commands must not become duplicate writable copies.

Acceptance: all tested runtime values and live consumers match before/after; no direct CONFIG-global dependency, duplicate config owner, new hot-loop clone/path allocation or stale adapter is introduced. Record exact production graph changes if configuration composition changes.

## Work package E - DEV-only templates and debuff presentation

1. Move `ITEM_DB.builds.debug_float_build` and `debug_feeder_build` into a DEV data overlay composed only by Development Bootstrap. These are currently two objects embedded in `src/game/config/raw/items/item_database.js`; they are data relocation, not two already-existing source modules in the 96 count.
2. Audit all catalog/template readers, enumerations, initialization, validators, fixtures and save compatibility before removal from the production shape. Preserve template IDs/content and access through the DEV-composed catalog view. Normal production builds/items retain order/values/behavior, and old saves referring to those IDs remain supported. Do not mutate a shared production catalog to attach the templates in DEV.
3. Move DEV label/format responsibility for `Fish.activeDebuffName` to the DEV display path. Today Domain returns labels and Application forwards `getActiveDebuffName()`/debug payload to four DEV readers (exhaustion, forces, debuffs overlay and fish-debuff summary). Fish remains the debuff-state owner; DEV receives read-only facts and formats them.
4. Do not rename/remove the Domain getter or Application API during this migration. Resolve the display move through compatible existing data/injection seams, with exact label and no-active/unknown-debuff parity. If a new semantic DTO/API is unavoidable, record the precise Stage 7 API transition; the safe Stage 6 display responsibility must still be explicit.

Acceptance: production graph has no DEV template/formatter imports, DEV retains both test templates and all debuff displays, no duplicated state or changed saved-item schema/bytes appears. Any additional DEV data/presentation files are recorded in the graph/count review rather than silently added to the 96 baseline.

## Work package F - Retire exact compatibility holders and obsolete surfaces

Use `remainingBridgeHolders` and `remainingActivations` in the inventory as the exact starting identity set. 50 records are held by 26 reader files; 22 readers are inside the 96 migration sources, and four remaining classic composition wrappers must reuse already-native implementations:

- `src/config/config.js`: native config/catalog/physics/context composition.
- `src/config/project_version.js`: canonical version publication.
- `src/ui/legacy/engine_interface_activation.js`: canonical browser startup interface.
- `src/ui/version_badge.js`: canonical version badge activation.

Retire a bridge only after its last actual reader uses an authored import/injected dependency and there is no other live holder. Retire an activation only after its last bridge/reader disappears. Do not delete an exported class merely because its global activation retires. The 25 existing targets are listed exactly in the JSON and all already belong to the production graph.

Remove live use of `__CYBER_FISHING_COMPAT_RUNTIME__` after the complete native cutover. Review the seven residual Stage 2 wrapper tags independently; the package reports Stage 2 runtime inputs zero, so tag count is not an active bridge count. Preserve frozen Stage 2 plan, Stage 3/4/5 ledger and historical raw-byte proofs through exact validated successor records.

Remove empty legacy placeholders/load-order slots from live runtime only with a complete source/test/build/evidence holder audit. The five inert ESM modules are ConfigSchemaValidator, ItemRarityConfigValidator, BuffManager, EventLogger and DepthMapReader. BuffManager has a real game-cycle behavior scenario and cannot be deleted merely for being runtime-inert. Any compatibility-dependent test/fixture must migrate to authored imports/test composition while retaining its scenarios and assertions.

Extend current package, build/dev-server, release, Manifest, runtime-load-order, native-graph and existing records guards to the reviewed two-native-entry topology. The server must stop building an obsolete runtime once native DEV is accepted. Reuse the existing mechanisms; do not create a second check runner/release framework. Preserve the 64 live check catalog; do not lower baselines, shrink test cases or broaden whitelists. Add only concrete successor/negative fixtures (DEV leakage, transport fallback, duplicate owner/startup, wrong source/identity, missing holder or altered historical pin).

Resolve the 19 existing debts by their exact IDs and valid target ownership, including the debug singleton cycle and old classic bootstrap browser publications. Browser access in a legitimately reviewed Platform/DEV/Bootstrap boundary is not itself a reason to invent a waiver. Any genuinely unresolved debt must name its concrete reader and Stage 7 removal condition; no unjustified bridge, activation or transport survivor is allowed at Stage 6 closure.

Acceptance: active bridges/activations/classic startup scripts/compatibility runtime readers are all zero on both live surfaces; canonical authored modules/tests still work; frozen records remain immutable and all exact successor removals validate.

## Work package G - Automated acceptance, release and closure

For each stable checkpoint: focused affected checks + direct deterministic game-cycle, Quick 24/24, Architecture 32/32, uncached Full 64/64 with an unchanged source snapshot, then built-in native/DEV browser acceptance. Extend relevant existing checks for Stage 6 topology; catalog expansion is allowed only when justified, catalog shrinkage is not. Update documentation after the verified snapshot without claiming unrun checks.

Browser acceptance must cover:

- Direct native index and native DEV, correct release badge, zero errors/unexpected warnings, zero unresolved requests/imports.
- One canonical Game/Application/Root/config context/store/provider/adapter; repeated/concurrent start does not create duplicates; pause/resume retains one gameplay loop.
- Production no DEV/transport; DEV console modules, overlay/toggles/drag/scale/settings, balance/config tools, enabled watchdog and reel probe operate and dispose.
- Enabled GodMode/Fixed Catch effects and bite-sequence remain live in both applicable config modes, including existing entities during override changes. Restore flags after probes.
- Inventory/input/cast/fight deterministic parity; two DEV test builds, schema-4 inventory saves, loadout ownership/validation, reload and old-save compatibility.
- Save every original `fishing_game_` key, compare serialized gameplay values/bytes across reload and native surfaces, then restore originals. Do not claim a successful browser loadout creation when only validation was exercised.
- Pagehide/restart leaves no managed listener, gameplay/diagnostic loop, watchdog timer, pending probe or stale published handle; close owned tabs, stop server and remove ignored probes.

Baseline direct game-cycle stdout SHA256 is `0db62de21427af5589fa5294b53dd833522298356d1d6b7a6ce0a009f2782c6f`; hash the child stdout, not PowerShell wrapper logs. If an intentional reviewed harness-composition change affects only diagnostics, record the reason and compare unchanged gameplay trace data separately; do not bless an unexplained digest change.

Record graph-derived native production and DEV modules/imports; migrated source/target counts; classic tags, bridge/activation/global/debt deltas; src/utils/architecture metrics; focused/Full/browser results; releases and remaining Stage 7 tasks. Starting src is 802 JS/JSON / 80,547 lines; utils 216 / 46,782, below the hard 70,358-line ceiling. Tools must remain lean: reuse existing helpers, archive unreachable tooling with exact-byte recovery, keep all live checks and prevent tooling growth from outpacing removed runtime transport.

Use cohesive normal-history `develop` checkpoints and reviewed release transitions/tags under current owner authorization. Record the actual release number after verification; this planning document does not reserve an unreviewed release/version change. Keep ignored CODEX/CLAUDE/local notes out of commits and preserve existing mixed line endings/raw-byte history.

Codex automated acceptance is the performer. No owner manual-play requirement and no claim that the owner played. Full/browser smoke evidence must distinguish real browser scenarios from deterministic game-cycle coverage.

## Suggested implementation milestones

| Milestone | Deliverable | Closure facts |
| --- | --- | --- |
| M1 | Reviewed dependency graph, 93 native DEV targets, three native bootstrap targets, dev entry and direct native DEV startup | Native production/DEV parity; one owner/loop; exact last classic holders resolved |
| M2 | Separate config source transition, DEV template overlay and debuff display ownership | Live overrides/adapter identity, old saves, template IDs and displays preserved |
| M3 | Exact compatibility/slot/tooling retirement, final guards/evidence/release/closure | 0 active bridges/activations/classic script tags/transport readers; accepted exact graph/metrics |

Each cluster is independently reviewable and reversible. Do not implement D/E inside a mechanical B migration commit. If the dependency audit requires smaller checkpoints or different ordering, update the graph plan with concrete reasons before applying it; no hard dates or speculative duration are part of this specification.

## Stage 7 remains outside this scope

Keep separately reviewed structural/API work: FlatInventoryItemRepository ID fallback removal after caller audit; ViewportProjector camera/world separation; LocationMap revision rename and per-frame config-string invalidation optimization with hot-loop evidence; production diagnostic naming; BuffManager/readiness API coverage review; Windows/mixed-EOL portability; archived `architecture:closure` / struct package-contract decisions. Stage 6 must not use these pending API tasks as a reason to retain an unjustified active compatibility holder.

## Definition of done

- [ ] All 96 source mappings and the new entry are accounted for by verified native targets/replacements; all extra split/data/composition files have reviewed reasons and exact counts.
- [ ] Both HTML surfaces use one native entry each; production graph has no DEV/compatibility, DEV uses canonical authored production identities.
- [ ] Runtime config has one base + override owner and live adapter/value semantics verified; DEV has no raw global config dependency.
- [ ] DEV tools/console/overlay/probe/watchdog and all enabled gameplay override effects retain behavior and cleanup.
- [ ] Both DEV test templates and debuff display ownership are migrated with exact data/API/save compatibility.
- [ ] 50 starting bridges and 26 activations retire through exact successor evidence; no active transport or classic startup/placeholder surface remains.
- [ ] Actual test/build/evidence consumers survive migration; 64-check catalog and historical guards/pins are preserved; exact debts are resolved/accounted for without new exceptions.
- [ ] Focused + game-cycle + Quick + Architecture + uncached Full + direct native/DEV browser acceptance pass; original saves restored.
- [ ] Final exact graph/metrics, release, Stage 6 closure and Stage 7 handoff agree; current task documents point to the accepted checkpoint.


## Exact module inventory (96 existing sources)

| Group | Count |
| --- | ---: |
| dev-currently-outside-debug | 6 |
| development-bootstrap | 3 |
| debug-core | 5 |
| dev-tools | 1 |
| god-mode | 1 |
| console-modules-and-probe | 15 |
| overlay-config | 1 |
| overlay-core | 4 |
| overlay-dom | 6 |
| overlay-modules-and-sections | 36 |
| overlay-services | 8 |
| dev-services-schemas-watchdog | 10 |
| **Total** | **96** |

Every path below is an inventory target already recorded in the Manifest; implementation must review actual consumers/blockers before applying it. Counts are source files, not classes. Full raw source pins, production closure and exact bridge/activation IDs are in `stage6_module_inventory.json`.

| Current source | Planned authored ESM target |
| --- | --- |
| `src/app/debug.js` | `src/dev/runtime/debug_service.js` |
| `src/app/rendering/location_debug_render_frame_builder.js` | `src/dev/location/location_debug_render_frame_builder.js` |
| `src/app/script.js` | `src/bootstrap/development/legacy_game_startup.js` |
| `src/config/physics/physics_formula_map.js` | `src/dev/physics/physics_formula_map.js` |
| `src/debug/core/debug_console.js` | `src/dev/core/debug_console.js` |
| `src/debug/core/debug_context.js` | `src/dev/core/debug_context.js` |
| `src/debug/core/debug_event_binder.js` | `src/dev/core/debug_event_binder.js` |
| `src/debug/core/debug_module_registry.js` | `src/dev/core/debug_module_registry.js` |
| `src/debug/core/null_debug_runtime.js` | `src/dev/core/null_debug_runtime.js` |
| `src/debug/debug.js` | `src/bootstrap/development/debug_console_bootstrap.js` |
| `src/debug/dev_tools.js` | `src/dev/tools/dev_tools.js` |
| `src/debug/god_mode.js` | `src/dev/god_mode.js` |
| `src/debug/modules/base_debug_module.js` | `src/dev/modules/base_debug_module.js` |
| `src/debug/modules/bite_ticks_debug_module.js` | `src/dev/modules/bite_ticks_debug_module.js` |
| `src/debug/modules/catch_time_debug_module.js` | `src/dev/modules/catch_time_debug_module.js` |
| `src/debug/modules/deviations_debug_module.js` | `src/dev/modules/deviations_debug_module.js` |
| `src/debug/modules/exhaustion_debug_module.js` | `src/dev/modules/exhaustion_debug_module.js` |
| `src/debug/modules/forces_debug_module.js` | `src/dev/modules/forces_debug_module.js` |
| `src/debug/modules/location_debug_module.js` | `src/dev/modules/location_debug_module.js` |
| `src/debug/modules/map_debug_module.js` | `src/dev/modules/map_debug_module.js` |
| `src/debug/modules/net_debug_module.js` | `src/dev/modules/net_debug_module.js` |
| `src/debug/modules/prediction_debug_module.js` | `src/dev/modules/prediction_debug_module.js` |
| `src/debug/modules/reel_hold_gate_debug_module.js` | `src/dev/modules/reel_hold_gate_debug_module.js` |
| `src/debug/modules/reel_hold_gate_live_probe.js` | `src/dev/modules/reel_hold_gate_live_probe.js` |
| `src/debug/modules/rod_stroke_debug_module.js` | `src/dev/modules/rod_stroke_debug_module.js` |
| `src/debug/modules/stamina_debug_module.js` | `src/dev/modules/stamina_debug_module.js` |
| `src/debug/modules/tension_debug_module.js` | `src/dev/modules/tension_debug_module.js` |
| `src/debug/overlay/config/overlay_modules_config.js` | `src/dev/overlay/config/overlay_modules_config.js` |
| `src/debug/overlay/core/overlay_controller.js` | `src/dev/overlay/core/overlay_controller.js` |
| `src/debug/overlay/core/overlay_module_base.js` | `src/dev/overlay/overlay_module.js` |
| `src/debug/overlay/core/overlay_module_registry.js` | `src/dev/overlay/core/overlay_module_registry.js` |
| `src/debug/overlay/core/overlay_update_loop.js` | `src/dev/overlay/core/overlay_update_loop.js` |
| `src/debug/overlay/dom/overlay_dom_adapter.js` | `src/dev/overlay/dom/overlay_dom_adapter.js` |
| `src/debug/overlay/dom/overlay_interaction_bridge.js` | `src/dev/overlay/dom/overlay_interaction_bridge.js` |
| `src/debug/overlay/dom/overlay_metric_info_bridge.js` | `src/dev/overlay/dom/overlay_metric_info_bridge.js` |
| `src/debug/overlay/dom/overlay_scale_controls.js` | `src/dev/overlay/dom/overlay_scale_controls.js` |
| `src/debug/overlay/dom/overlay_style_installer.js` | `src/dev/overlay/dom/overlay_style_installer.js` |
| `src/debug/overlay/dom/overlay_window_drag_controller.js` | `src/dev/overlay/dom/overlay_window_drag_controller.js` |
| `src/debug/overlay/modules/behavior_overlay_module.js` | `src/dev/overlay/modules/behavior_overlay_module.js` |
| `src/debug/overlay/modules/chances_detail_overlay_module.js` | `src/dev/overlay/modules/chances_detail_overlay_module.js` |
| `src/debug/overlay/modules/chum_overlay_module.js` | `src/dev/overlay/modules/chum_overlay_module.js` |
| `src/debug/overlay/modules/debuffs_overlay_module.js` | `src/dev/overlay/modules/debuffs_overlay_module.js` |
| `src/debug/overlay/modules/echo_overlay_module.js` | `src/dev/overlay/modules/echo_overlay_module.js` |
| `src/debug/overlay/modules/fight_physics/fight_auto_recovery_section.js` | `src/dev/overlay/fight_physics/fight_auto_recovery_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_drag_section.js` | `src/dev/overlay/fight_physics/fight_drag_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_fish_section.js` | `src/dev/overlay/fight_physics/fight_fish_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_line_section.js` | `src/dev/overlay/fight_physics/fight_line_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_movement_section.js` | `src/dev/overlay/fight_physics/fight_movement_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_physics_overlay_module.js` | `src/dev/overlay/modules/fight_physics/fight_physics_overlay_module.js` |
| `src/debug/overlay/modules/fight_physics/fight_reel_hold_section.js` | `src/dev/overlay/fight_physics/fight_reel_hold_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_rod_control_force_section.js` | `src/dev/overlay/fight_physics/fight_rod_control_force_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_rod_control_geometry_section.js` | `src/dev/overlay/fight_physics/fight_rod_control_geometry_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_rod_control_input_section.js` | `src/dev/overlay/fight_physics/fight_rod_control_input_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_rod_control_section.js` | `src/dev/overlay/fight_physics/fight_rod_control_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_rod_control_visual_section.js` | `src/dev/overlay/fight_physics/fight_rod_control_visual_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_rod_hold_section.js` | `src/dev/overlay/fight_physics/fight_rod_hold_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_rod_stroke_section.js` | `src/dev/overlay/fight_physics/fight_rod_stroke_section.js` |
| `src/debug/overlay/modules/fight_physics/fight_section_base.js` | `src/dev/overlay/fight_physics/fight_section_base.js` |
| `src/debug/overlay/modules/fight_physics/fight_tension_section.js` | `src/dev/overlay/fight_physics/fight_tension_section.js` |
| `src/debug/overlay/modules/fight_summary/fight_summary_overlay_module.js` | `src/dev/overlay/fight_summary/fight_summary_overlay_module.js` |
| `src/debug/overlay/modules/fight_summary/fish_movement_summary_overlay_module.js` | `src/dev/overlay/fight_summary/fish_movement_summary_overlay_module.js` |
| `src/debug/overlay/modules/fight_summary/line_and_drag_summary_overlay_module.js` | `src/dev/overlay/fight_summary/line_and_drag_summary_overlay_module.js` |
| `src/debug/overlay/modules/fight_summary/rod_control_summary_overlay_module.js` | `src/dev/overlay/fight_summary/rod_control_summary_overlay_module.js` |
| `src/debug/overlay/modules/fish_balance_overlay_module.js` | `src/dev/overlay/modules/fish_balance_overlay_module.js` |
| `src/debug/overlay/modules/fish_balance/fish_current_force_overlay_module.js` | `src/dev/overlay/fish_balance/fish_current_force_overlay_module.js` |
| `src/debug/overlay/modules/fish_balance/fish_debuffs_summary_overlay_module.js` | `src/dev/overlay/fish_balance/fish_debuffs_summary_overlay_module.js` |
| `src/debug/overlay/modules/fish_balance/fish_live_force_summary_section.js` | `src/dev/overlay/fish_balance/fish_live_force_summary_section.js` |
| `src/debug/overlay/modules/fish_balance/fish_state_force_preview_section.js` | `src/dev/overlay/fish_balance/fish_state_force_preview_section.js` |
| `src/debug/overlay/modules/fish_balance/fish_summary_overlay_module.js` | `src/dev/overlay/fish_balance/fish_summary_overlay_module.js` |
| `src/debug/overlay/modules/fish_power_overlay_module.js` | `src/dev/overlay/modules/fish_power_overlay_module.js` |
| `src/debug/overlay/modules/live_forces_overlay_module.js` | `src/dev/overlay/modules/live_forces_overlay_module.js` |
| `src/debug/overlay/modules/player_max_overlay_module.js` | `src/dev/overlay/modules/player_max_overlay_module.js` |
| `src/debug/overlay/modules/stamina_balance_overlay_module.js` | `src/dev/overlay/modules/stamina_balance_overlay_module.js` |
| `src/debug/overlay/modules/worst_case_overlay_module.js` | `src/dev/overlay/modules/worst_case_overlay_module.js` |
| `src/debug/overlay/overlay_bootstrap.js` | `src/bootstrap/development/debug_overlay_bootstrap.js` |
| `src/debug/overlay/services/overlay_console_metric_inspector.js` | `src/dev/overlay/overlay_console_metric_inspector.js` |
| `src/debug/overlay/services/overlay_html_builder.js` | `src/dev/overlay/services/overlay_html_builder.js` |
| `src/debug/overlay/services/overlay_metric_catalog.js` | `src/dev/overlay/services/overlay_metric_catalog.js` |
| `src/debug/overlay/services/overlay_metric_resolver.js` | `src/dev/overlay/overlay_metric_resolver.js` |
| `src/debug/overlay/services/overlay_settings_store.js` | `src/dev/overlay/overlay_settings_store.js` |
| `src/debug/overlay/services/overlay_value_formatter.js` | `src/dev/overlay/services/overlay_value_formatter.js` |
| `src/debug/overlay/services/overlay_view_state_store.js` | `src/dev/overlay/services/overlay_view_state_store.js` |
| `src/debug/overlay/services/worst_case_force_debug_selector.js` | `src/dev/fishing/worst_case_force_debug_selector.js` |
| `src/debug/services/active_fish_dev_tools_schema.js` | `src/dev/fishing/active_fish_dev_tools_schema.js` |
| `src/debug/services/debug_data_selectors.js` | `src/dev/services/debug_data_selectors.js` |
| `src/debug/services/debug_formatters.js` | `src/dev/formatting/debug_formatters.js` |
| `src/debug/services/dev_tools_control_binding_registry.js` | `src/dev/services/dev_tools_control_binding_registry.js` |
| `src/debug/services/dev_tools_parameter_alias_registry.js` | `src/dev/services/dev_tools_parameter_alias_registry.js` |
| `src/debug/services/hooked_fish_profile_synchronizer.js` | `src/dev/fishing/hooked_fish_profile_synchronizer.js` |
| `src/debug/services/item_progression_debug_snapshot_provider.js` | `src/dev/items/item_progression_debug_snapshot_provider.js` |
| `src/debug/services/location_debug_data_provider.js` | `src/dev/location/location_debug_data_provider.js` |
| `src/debug/services/location_dev_tools_schema.js` | `src/dev/services/location_dev_tools_schema.js` |
| `src/debug/services/memory_leak_watchdog.js` | `src/dev/services/memory_leak_watchdog.js` |
| `src/render/core/render_allocation_diagnostics.js` | `src/dev/diagnostics/render_allocation_diagnostics.js` |
| `src/render/world/location_debug_map_builder.js` | `src/dev/location/location_debug_map_builder.js` |
| `src/render/world/world_debug_renderer.js` | `src/dev/rendering/world_debug_renderer.js` |

## Existing canonical exports replacing the last global activations

These are 26 activation/export bindings from 25 already-native production modules, not additional migration source files. DevFlagsProvider and CanvasMetricsProvider share one module. Use the existing named exports/imports and injected references; do not recreate them as DEV copies. The JSON lists exact activation IDs and reader/provider bridge records.

| Current global export | Canonical authored module |
| --- | --- |
| `CacheManager` | `src/platform/browser/storage/cache_manager.js` |
| `CanvasMetricsProvider` | `src/platform/browser/runtime/legacy_runtime_adapters.js` |
| `CONFIG` | `src/game/config/runtime/game_config.js` |
| `createRuntimeConfigContext` | `src/bootstrap/production/config_context.js` |
| `DEGRADATION_COLOR_CONFIG` | `src/game/presentation/visual/degradation_color_config.js` |
| `DevFlagsProvider` | `src/platform/browser/runtime/legacy_runtime_adapters.js` |
| `EventBus` | `src/engine/events/event_bus.js` |
| `EventLifecycle` | `src/engine/events/event_lifecycle.js` |
| `FightPhysicsConfigAdapter` | `src/game/config/physics/fight_physics_config_adapter.js` |
| `FISH_DB` | `src/game/config/databases/fish_database.js` |
| `FishPhysicsProfile` | `src/game/domain/fish/fish.js` |
| `FixedCatchFishFactory` | `src/game/application/fishing/fixed_catch_fish_factory.js` |
| `Game` | `src/bootstrap/production/game.js` |
| `GameCompositionRoot` | `src/bootstrap/production/game_composition_root.js` |
| `GameLoop` | `src/platform/browser/runtime/game_loop.js` |
| `GameVersionBadge` | `src/bootstrap/production/game_version_badge.js` |
| `HookPowerPolicy` | `src/game/domain/items/hook/hook_power_policy.js` |
| `initEngineInterface` | `src/platform/browser/dom/engine_interface.js` |
| `InputManager` | `src/platform/browser/input/input_manager.js` |
| `ITEM_DB` | `src/game/config/raw/items/item_database.js` |
| `MAP_DB` | `src/game/config/raw/locations/location_database.js` |
| `PROJECT_VERSION_CONFIG` | `src/game/presentation/version/project_version.js` |
| `RARITY_VISUAL_CONFIG` | `src/game/presentation/rarity/rarity_visual_config.js` |
| `UIDraggableButton` | `src/platform/browser/dom/draggable_button.js` |
| `UIUtils` | `src/platform/browser/dom/ui_event_shield.js` |
| `Vector2` | `src/engine/math/vector2.js` |
