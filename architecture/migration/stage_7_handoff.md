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

## First: Stage 6 post-closure cleanup (closure spec C5, patch 0.27.1)

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
- If C5 leaves it: replace the per-frame `currentDebugState` string in `LocationMap.update()` with a config-changed flag from the override store.
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
2. In C5 (0.27.1), with your approval of the exact list: remove only the inert package scripts `build:legacy-bridges` and
   `build:stage-3-compat-runtime` through the package-contract transition (and decide `architecture:closure`, whose target is already
   missing). This keeps the catalog at 64 and the cleanup low-risk; the builder files stay until their checks go.
3. Archive the tools and history-only checks as their own transition right after C5, as the first Stage 7 step: before the EOL
   renormalization (fewer files to renormalize; some of the eight lost-EOL utils files are candidates) and before the API renames.
   Inside it: decouple the live importers listed above (history facts read from the raw archive tags or frozen JSON, never a weaker
   assertion), archive tools and checks under one recovery tag with an `ARCHIVED_CHECKS.md` entry, record the new catalog size, and
   close with an uncached Full on the reduced catalog. A script must never point at a deleted file, so scripts go before or with their targets.
4. Doing everything inside C5 is possible but mixes a catalog change into the patch cleanup; keep it separate unless you prefer one release.

## Known pre-existing defects (owner decisions, not migration work)

Found during the closure browser run and byte-identical since before Stage 6 (details in `architecture/archive/stage6_closure_browser.json`):

- `fixed-catch-active-lure-bite-sequence`: with the base-config `debug.fixedCatch` (fish `crucian_stalker`, passive bite mechanics only), any
  spinner/wobbler/jig bite reads `runtimeConfig.float.biteSequence`, a key that never existed, and throws; the game loop stops on both pages.
  Fixing it changes gameplay, so it needs an owner decision.
- `depth-selector-dispose-raf-race`: `DepthSelectorUI.show()/updateMax()` schedule a frame callback that throws if `dispose()` runs in the same
  frame. A real unload never reaches it; an in-page restart within one frame does. Lifecycle hardening candidate.
