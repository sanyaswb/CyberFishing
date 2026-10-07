# Stage 7 structural hardening — handoff

Written: 2026-10-07 (Europe/Kiev). Stage 6 is closed at release 0.27.0 with tag `stage6-closed`; Stage 7 has not started.
Closure facts: [stage_6_closure.json](stage_6_closure.json). Stage 6 history: [stage_6/stage6_continuation_spec.md](stage_6/stage6_continuation_spec.md),
[stage_6/stage6_closure_spec.md](stage_6/stage6_closure_spec.md); requirements and the 96 mappings: [stage_6/stage6_spec.md](stage_6/stage6_spec.md).

## Resume facts

- Both actual pages load one native module entry: `index.html` → `src/entrypoints/game.entry.js`, `dev.html` →
  `src/entrypoints/dev.entry.js` → `src/bootstrap/development/legacy_game_startup.js`. `dist/` is absent; both builders report `retired-native-esm`.
- Authored import graphs: production 350 modules / 522 edges, DEV 446 / 692 (95 `src/dev`, 3 Development Bootstrap); zero unresolved,
  zero compatibility, production reaches no DEV module. Measure with `StageFourRelease#nativeGraph` (both entries).
- Live registries are zero: bridges, activations, inert modules, side-effect reviews, known debts, global-provider baseline. 380 retired
  activations stay as historical provenance. Raw classic recovery: annotated tag `stage6-classic-runtime-archive` → `95b872d` (parent `4c0817a`).
- Check catalog 64 (Quick 24, Architecture 32); utils ceiling 70,358 lines. Direct game-cycle child stdout SHA256
  `0db62de21427af5589fa5294b53dd833522298356d1d6b7a6ce0a009f2782c6f`; gameplay save key `fishing_game_player_inventory_v2`, schema 4.
- Closure evidence: uncached Full `architecture/archive/stage6_closure_acceptance.json`, browser `architecture/archive/stage6_closure_browser.json`.

## Rules that carry over

- CLAUDE.md "Development rules", the decomposition decision framework and `DEVELOPMENT_RULES.md` stay in force. Behavior preservation is
  absolute: formulas, production APIs, state semantics, save format, timing and hot-loop allocations.
- Every Stage 7 change is a reviewed transition with focused parity, guards, game-cycle, Quick, Architecture and an uncached Full on one stable
  snapshot. Never weaken a guard, baseline, whitelist or fixture to make a check pass.
- Historical evidence is immutable; new facts get new versioned evidence. Byte-preserving edits only until the EOL transition below lands.
- A change to the check catalog, package scripts, globals or save format is an owner decision.

## Stage 6 post-closure cleanup (closure spec C5, patch 0.27.1) — done 2026-10-07

Done in preparation 006 / v0.27.1 (`stage6-dead-code-archive`): 73 dead import guards, the two unreachable DEV modules, the three package
scripts and 85 empty directories removed; see [stage_6/post_closure_cleanup_audit.md](stage_6/post_closure_cleanup_audit.md).
Still open from its list: the `LocationMap.currentDebugState` optimization (decided 2026-10-07: per-field comparison, see
"Owner decisions 2026-10-07" below) and the test-loader aliases (first Stage 7 step). Original plan:

Owner rule 2026-10-07: every stage closure is followed by a separate cleanup preparation and patch release. Run C5 of
[stage_6/stage6_closure_spec.md](stage_6/stage6_closure_spec.md) before any Stage 7 transition. Its candidates (audit first, exact-byte
recovery tag `stage6-dead-code-archive`):

- dead `typeof X !== "undefined"` guards whose `X` is an imported or local binding (keep real browser-capability checks);
- the unreachable DEV modules `src/dev/core/null_debug_runtime.js` and `src/dev/physics/physics_formula_map.js` (confirm with both graphs);
- the test-only classic path aliases in `NativeEsmTestLoader` (move test consumers to canonical paths first);
- the per-frame `currentDebugState` string in `LocationMap.update()` (config-changed flag, hot-loop evidence before/after);
- owner decision with the exact list: history-only compatibility tooling/checks and the inert `build:*` scripts (see the archival order below).

The C2b utils analysis found no unreachable utils file (all 219 reached from 84 live roots); net growth since 0.26.1 is +3 files, each with
at least two live uses (see `toolingArchive` in the closure record).

## Stage 7 queue

### 1. Deferred API / behavior-neutral transitions

- Retire the compatible debuff getters once DEV and tests read the Domain debuff facts directly (prep003 kept them).
- Remove the `FlatInventoryItemRepository` optional id fallback after proving every caller injects the factory and clock.
- Split `ViewportProjector` world-perspective facts from camera state, with hot-loop evidence (allocation sites, call counts, frame traces).
- Rename `LocationMap.getDebugRevision` → `getRevision` (owned source-data revision).
- Replace the per-frame `currentDebugState` string in `LocationMap.update()` by the per-field comparison decided 2026-10-07 (below).
- Rename the production "debug" diagnostic snapshots in `FishForceSystem` / `TackleStressSystem` to diagnostics.
- Coverage/API review of `BuffManager`, `InventoryV2GameplayBridge.evaluateBiteReadiness` / `evaluateChumBonus` and
  `FishingReadinessPolicy.evaluateChumBonus`; keep the contracts until equivalent coverage or an explicit obsolete-API decision.

### 2. Infrastructure

- Repository portability: `.gitattributes` review, one reviewed renormalization of the exact mixed CRLF/LF bytes, fresh-clone hash proof
  (`core.autocrlf=false`) plus Quick, and identification of Windows-only fixtures (`D:`/escape paths). It includes the eight utils files whose
  mixed EOL was lost in the M3b edits (recorded in preparation 005).
- Package scripts through the package-contract transition: the `struct` decision (CLAUDE.md "Deferred decisions"), the archived
  `architecture:closure` script and the now-inert `build:legacy-bridges` / `build:stage-3-compat-runtime` scripts.

### 3. Native leftovers

- Unless done in C5: archive the history-only compatibility tooling under a recovery tag, as Stage 3 did: `utils/build/compat_runtime/*` (8 files),
  `utils/build/build_legacy_bridges.js`, `utils/build/build_stage_3_compat_runtime.js`, `utils/build/legacy_bridge_build_config.js` and the
  Stage 2/3 runtime fixture checks (candidates: `stage-3-compatibility-runtime-fixtures`, `stage-3-runtime-load-order`,
  `stage-3-activation-retirement-fixtures`; review `approved-stage-2-batch-freeze`, `legacy-slot-split` and the legacy scanner
  fixtures/corpus checks by their actual assertions). This changes the 64-check catalog: owner decision with the exact list.
  Live importers to decouple first: `stage-4-cluster-records-check.js`, `stage_four/cluster_ledger.js`, `stage_four/cluster_path.js`,
  `stage_four/esm_target_projector.js`, `stage_six/native_development_retirement.js`, `migration/stage_two_runtime_script_alias_resolver.js`,
  `classification/approved_stage_two_batch_validator.js`, `domain_batches/stage_three_batch_execution_plan.js`,
  `package_contract/root_package_validator.js`, `verify-fresh-package-install.js` and `utils/dev-server.js`.
- If C5 leaves them: migrate tests off the deleted classic paths, then remove the test-only aliases in `NativeEsmTestLoader`.
- `legacy_*` names in canonical modules (for example `legacy_game_startup.js`, `legacy_runtime_adapters.js`): rename transitions.
- If C5 keeps them: consumer review of the unreachable DEV modules `src/dev/core/null_debug_runtime.js` and `src/dev/physics/physics_formula_map.js`.
- Relocate `src/config/metadata/*.json` and `src/ui/styles/*.css` into their target boundaries.

### 4. General hardening

- Decompose classes with mixed responsibilities (for example the inventory command service and facade), finish the engine / game /
  platform / dev separation, clean up the legacy `systems/services/app` structure, production hardening.

## Recommended order for the compatibility tooling and `build:*` scripts (owner question 2026-10-07)

1. Not inside the Stage 6 closure: the closure Full must run on the same 64-check catalog the Stage 6 evidence uses.
2. Done in C5 (0.27.1), owner-approved: remove only the inert package scripts `build:legacy-bridges` and
   `build:stage-3-compat-runtime` through the package-contract transition (and decide `architecture:closure`, whose target is already
   missing). This keeps the catalog at 64 and the cleanup low-risk; the builder files stay until their checks go.
3. Archive the tools and history-only checks as their own transition right after C5, as the first Stage 7 step: before the EOL
   renormalization (fewer files to renormalize; some of the eight lost-EOL utils files are candidates) and before the API renames.
   Inside it: decouple the live importers listed above (history facts read from the raw archive tags or frozen JSON, never a weaker
   assertion), archive tools and checks under one recovery tag with an `ARCHIVED_CHECKS.md` entry, record the new catalog size, and
   close with an uncached Full on the reduced catalog. A script must never point at a deleted file, so scripts go before or with their targets.
4. Doing everything inside C5 is possible but mixes a catalog change into the patch cleanup; keep it separate unless you prefer one release.

## Known pre-existing defects

Found during the closure browser run and byte-identical since before Stage 6 (details in `architecture/archive/stage6_closure_browser.json`):

- `fixed-catch-active-lure-bite-sequence`: with the base-config `debug.fixedCatch` (fish `crucian_stalker`, passive bite mechanics only), any
  spinner/wobbler/jig bite reads `runtimeConfig.float.biteSequence`, a key that never existed, and throws; the game loop stops on both pages.
  Fixing it changes gameplay; decided 2026-10-07 (below).
- `depth-selector-dispose-raf-race`: `DepthSelectorUI.show()/updateMax()` schedule a frame callback that throws if `dispose()` runs in the same
  frame. A real unload never reaches it; an in-page restart within one frame does. Decided 2026-10-07 (below).

## Owner decisions 2026-10-07 (supersede earlier wording)

Execute as three separate steps (one commit each, own evidence), then one patch release 0.27.2. They are not migration work and
must not be mixed with the Stage 7 tooling archive or API renames.

### D1 — `LocationMap.update()` per-frame string: per-field comparison (not the override-store flag)

Supersedes the 2026-09-29 "config-changed flag from the override store" wording. Reason: the store flag needs a new Domain port wired
through Bootstrap and is not behavior-equivalent — the store revision changes on any override (fish physics, GodMode, …), so it would
add `recalculateZones()` calls and `#debugRevision` increments (DEV render-cache invalidation), and it misses changes that bypass the
store (base config, location config replacement). The per-field comparison keeps the current trigger exactly.

- Seven private fields for `debugGrid`, `debugDepthText`, `debugZones`, `enableCastable`, `enableCollisions`, `enableSnags`,
  `enableDynamicZones`, plus an "initialized" flag so the first `update()` always recalculates (today `""` never equals the template).
- Compare in the same order with `!==`; on any difference assign all seven, then `#debugRevision += 1`, then
  `recalculateZones(null, locCfg.cellSize)` — same side effects in the same order. Remove `#lastDebugState`.
- Equivalence proof to record in the transition: every writer produces booleans (base literals in `game_config.js`, DevTools checkbox
  schema `location_dev_tools_schema.js`, override export/import round-trip). String coercion differences (`true` vs `"true"`, `NaN`,
  `_` inside values) are unreachable from existing writers; say so explicitly.
- Evidence: hot-loop tooling before/after — the template-string allocation site disappears; `recalculateZones` call count and
  `getDebugRevision()` values identical over a scenario that toggles each flag through the config context and through DevTools and
  replaces the location config; game-cycle stdout `0db62de2…` unchanged. `getDebugRevision` → `getRevision` rename stays a Stage 7 API step.

### D2 — `fixed-catch-active-lure-bite-sequence`: fix now (gameplay bugfix, scoped to the failing path)

Base config ships `debug.fixedCatch.enabled: true`, so every player with a spinner/wobbler/jig crashes the loop on a bite.

- Fix in the Application fixed-catch branch of `game_state_machine.js`: when `rules.bite.selectBiteSequence(template, baitTypes)` returns
  `null` (the fixed fish has no mechanic for this bait), do not override — keep the naturally hooked fish. This respects the fish's own
  bite mechanics (crucian does not take lures) and leaves every currently working path byte-for-byte identical.
- Do not change `selectBiteSequence`, spawn rules or `tackle.js` in this step. The dead fallback `runtimeConfig.float.biteSequence`
  (key never existed) is recorded as a Stage 7 cleanup candidate (explicit contract instead of a silent fallback).
- Evidence: a focused regression in an existing gameplay check (spinner + fixed catch → no throw, natural fish hooked; float + fixed
  catch → unchanged fixed fish); game-cycle stdout must stay identical (do not add the scenario to game-cycle); browser smoke with a
  spinner bite on both pages, saves unchanged.
- Separate owner question, not decided here: whether production defaults should keep `fixedCatch` / GodMode enabled.

### D3 — `depth-selector-dispose-raf-race`: fix now (lifecycle hardening)

- `DepthSelectorUI` records the id of every frame it schedules in `show()`/`updateMax()` and forgets it when that frame runs (every
  scheduled callback still runs, as today), cancels the pending ids in `dispose()`, and `#updateInputPosition()` returns when disposed.
  No other behavior change; scheduling stays in Platform.
- Evidence: focused case in `platform-runtime` (dispose before the frame runs → no throw, frame cancelled; normal show/updateMax position
  unchanged), browser in-page restart while a float rig shows the selector → 0 errors.
