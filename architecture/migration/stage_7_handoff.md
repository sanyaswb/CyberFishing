# Stage 7 structural hardening — handoff

Written: 2026-10-07 (Europe/Kiev). Stage 6 is closed at release 0.27.0 with tag `stage6-closed`; Stage 7.1 native preparations 001-003 are accepted; catalog archival awaits the exact owner decision.
Closure facts: [stage_6_closure.json](stage_6_closure.json). Stage 6 history: [stage_6/stage6_continuation_spec.md](stage_6/stage6_continuation_spec.md),
[stage_6/stage6_closure_spec.md](stage_6/stage6_closure_spec.md); requirements and the 96 mappings: [stage_6/stage6_spec.md](stage_6/stage6_spec.md).

## Resume facts

- D1-D4 completed in three separate pushed commits: D1 `83bc8fe`, D2/D4 `ab96d35`, D3 `7d6614c`.
- Patch `0.27.2`: release record [003_pre-stage7-fixes.json](stage_6/releases/003_pre-stage7-fixes.json). Release commit/tag: `e80d983` / `v0.27.2`, pushed. Stage 7.1 native preparations 001-003 accepted; exact catalog/tool archival follows after the owner decision.
- D1 original/current public traces match (167 updates, 24 recalculations, 44 revision reads); the template allocation is gone.
  Actual DevTools callbacks, set/reset/import, unrelated overrides and location replacement are covered.
- D2 preserves natural spinner/wobbler/jig catches when the fixed fish has no sequence. D4 sets both production masters false;
  Development Bootstrap initializes its base defaults true before freezing the same single context/store. Reset restores DEV defaults;
  restart preserves overrides. No formula/API/save change. Both D2 and D3 regression cases fail on the original archived source.
- D3 tracks every frame ID, removes completed IDs, cancels pending IDs and ignores late callbacks/events/public operations.
  Scheduling and cancellation use the cached owning document window; disposal inside onChange prevents further scheduling.
- Each step passed focused checks and uncached Full 64/64; release Quick 24/24, Architecture 32/32, uncached Full 64/64.
  Reports: [D1 evidence](../archive/pre_stage7_d1_evidence.json), [D1 Full](../archive/pre_stage7_d1_acceptance.json),
  [D2 evidence](../archive/pre_stage7_d2_evidence.json), [D2 Full](../archive/pre_stage7_d2_acceptance.json),
  [D3 evidence](../archive/pre_stage7_d3_evidence.json), [D3 Full](../archive/pre_stage7_d3_acceptance.json),
  [release Full](../archive/pre_stage7_0272_acceptance.json), [browser](../archive/pre_stage7_0272_browser.json).
- Direct native pages and deterministic real-tackle browser probes pass: production masters off, DEV controls toggle/reset,
  one loop/no duplicate starts, identical save bytes/reload, zero final errors/warnings. DEV in-page restart releases listeners;
  production keeps its existing one-startup-per-realm policy and restarts by reload. Owned tabs/server/ignored fixtures cleaned.
- Raw source recovery: `pre-stage7-fixes-archive` -> `643a8dbc` (parent decision baseline `ee53295`).
- Current Stage 7.1 specification: [tooling_archive_spec.md](stage_7/tooling_archive_spec.md), exact raw-byte/dependency
  [inventory](stage_7/tooling_archive_inventory.json). Proposal archives only three Stage 3 runtime checks: Full 61 / Quick 22 /
  Architecture 29 / gameplay 12. The exact catalog owner decision is pending; all 64 checks remain during independent preparations.
  Eleven builder candidates have live consumers to decouple; retain native/provenance/evaluation assertions first. History stays immutable.
- Stage 7.1 [preparation 001](stage_7/preparations/001_native-test-paths.json) accepted: canonical native test paths, explicit
  config test composition, no metadata aliases or old loader wrapper. Quick 24/24, Architecture 32/32,
  [uncached Full 64/64](../archive/stage7_native_paths_acceptance.json), game-cycle unchanged; no runtime/HTML/package change.
  Exact raw tooling recovery: `stage7-compat-tools-archive` -> `aeb43037` (parent audited spec checkpoint `a33c7ca`).
- Stage 7.1 [preparation 002](stage_7/preparations/002_native-server-and-fresh-install.json) accepted (2026-10-08): native server
  validates retirement before listen; fresh installer copies native source plus isolated recovery Git metadata and performs fresh npm ci,
  with no classic build/dist reads. Fresh Architecture 32/32, Quick 24/24, Full 64/64; final workspace uncached
  [Full 64/64](../archive/stage7_native_server_acceptance.json), [browser/HTTP smoke](../archive/stage7_native_server_browser.json).
  Source/lock and game-cycle unchanged; caller Git index isolation checked; owned server/tabs closed. Runtime/HTML/package/catalog unchanged.
  Contract extraction accepted in preparation 003 below; exact catalog approval remains pending.
- Stage 7.1 [preparation 003](stage_7/preparations/003_native-provenance-contracts.json) accepted (2026-10-08): 13 unchanged class
  bodies in eight architecture contracts; retained native HTML/retirement/archive/evaluation assertions, 21 module-evaluation cases.
  Classic apply fails before workspace access; historical plan/records/game-cycle verification remains exact. Only the three proposed
  checks still import build modules (nine incoming edges). Quick 24/24, Architecture 32/32,
  [uncached Full 64/64](../archive/stage7_validator_contracts_acceptance.json), fresh npm ci and
  [direct native smoke](../archive/stage7_validator_contracts_browser.json); game-cycle unchanged, console 0/0, no source drift.
  Utils temporarily 228 JS/JSON / 47,858 lines while old checks/wrappers remain; final file reduction awaits archival.
  Prepared raw recovery: `stage7-compat-tools-prepared-archive` -> `ef814939` (parent `d7eebb3`), 230 exact utils files.
  Next: exact catalog decision, then approved archive and 61/22/29 acceptance. No catalog/check/tool deletion yet.

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
The LocationMap allocation is resolved by D1 / 0.27.2. Test-loader aliases and the history-only tooling archive remain the first Stage 7 transition. Original plan:

Owner rule 2026-10-07: every stage closure is followed by a separate cleanup preparation and patch release. Run C5 of
[stage_6/stage6_closure_spec.md](stage_6/stage6_closure_spec.md) before any Stage 7 transition. Its candidates (audit first, exact-byte
recovery tag `stage6-dead-code-archive`):

- dead `typeof X !== "undefined"` guards whose `X` is an imported or local binding (keep real browser-capability checks);
- the unreachable DEV modules `src/dev/core/null_debug_runtime.js` and `src/dev/physics/physics_formula_map.js` (confirm with both graphs);
- the test-only classic path aliases in `NativeEsmTestLoader` (move test consumers to canonical paths first);
- the per-frame `currentDebugState` string in `LocationMap.update()` (original flag proposal superseded by D1's seven-field comparison);
- owner decision with the exact list: history-only compatibility tooling/checks and the inert `build:*` scripts (see the archival order below).

The C2b utils analysis found no unreachable utils file (all 219 reached from 84 live roots); net growth since 0.26.1 is +3 files, each with
at least two live uses (see `toolingArchive` in the closure record).

## Stage 7 queue

### 1. Deferred API / behavior-neutral transitions

- Retire the compatible debuff getters once DEV and tests read the Domain debuff facts directly (prep003 kept them).
- Remove the `FlatInventoryItemRepository` optional id fallback after proving every caller injects the factory and clock.
- Split `ViewportProjector` world-perspective facts from camera state, with hot-loop evidence (allocation sites, call counts, frame traces).
- Rename `LocationMap.getDebugRevision` → `getRevision` (owned source-data revision).
- Done before Stage 7 (D1 / 0.27.2): replace the LocationMap per-frame string by seven private-field comparisons; evidence above.
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

Execute D1–D3 as three separate steps (one commit each, own evidence), then one patch release 0.27.2. Apply the final production-default
decision D4 with D2's Fixed Catch/config work, with separate focused assertions; it does not add an archival/API transition or change
the three-step order. These changes are not migration work and must not be mixed with the Stage 7 tooling archive or API renames.

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

At decision commit `ee53295`, shared base config still ships `debug.fixedCatch.enabled: true`, so the failure also affects production.
D4 changes production defaults; the D2 regression remains required for DEV balance testing with Fixed Catch enabled.

- Fix in the Application fixed-catch branch of `game_state_machine.js`: when `rules.bite.selectBiteSequence(template, baitTypes)` returns
  `null` (the fixed fish has no mechanic for this bait), do not override — keep the naturally hooked fish. This respects the fish's own
  bite mechanics (crucian does not take lures) and leaves every currently working path byte-for-byte identical.
- Do not change `selectBiteSequence`, spawn rules or `tackle.js` in this step. The dead fallback `runtimeConfig.float.biteSequence`
  (key never existed) is recorded as a Stage 7 cleanup candidate (explicit contract instead of a silent fallback).
- Evidence: a focused regression in an existing gameplay check (spinner + fixed catch → no throw, natural fish hooked; float + fixed
  catch → unchanged fixed fish); game-cycle stdout must stay identical (do not add the scenario to game-cycle); browser smoke with a
  spinner bite on both pages, saves unchanged.
- Production-default question resolved by the owner's final answer: **no**. Apply D4 below; do not omit the enabled-DEV regression
  merely because production starts with Fixed Catch disabled.

### D3 — `depth-selector-dispose-raf-race`: fix now (lifecycle hardening)

- `DepthSelectorUI` records the id of every frame it schedules in `show()`/`updateMax()` and forgets it when that frame runs (every
  scheduled callback still runs, as today), cancels the pending ids in `dispose()`, and `#updateInputPosition()` returns when disposed.
  No other behavior change; scheduling stays in Platform.
- Evidence: focused case in `platform-runtime` (dispose before the frame runs → no throw, frame cancelled; normal show/updateMax position
  unchanged), browser in-page restart while a float rig shows the selector → 0 errors.

### D4 — production GodMode / Fixed Catch defaults: off; balance controls belong to DEV

Final owner answer (2026-10-07): **NO** to leaving GodMode and Fixed Catch enabled in production; they are only for balance testing during
development. This resolves D2's open question and authorizes the scoped configuration behavior change. Implemented with D2 at `ab96d35`, released in 0.27.2; the following records the accepted requirements.

- `index.html` / Production Bootstrap must start with `debug.godMode.enabled === false` and `debug.fixedCatch.enabled === false`.
  The current shared `src/game/config/runtime/game_config.js` has both `true`; changing just the diagnostic class or the production
  `DevFlagsProvider` would not cover the direct config readers in BiteSystem, fishing runtime services and the state machine.
- Use safe production base defaults. Compose any desired DEV defaults/overrides explicitly in Development Bootstrap before gameplay
  starts, through the existing config context/ownership seams. Development currently calls `createProductionConfigContext()` too;
  switching shared defaults alone must not silently remove its balance controls or create a second config context/store.
- DEV (`dev.html`) retains GodMode / Fixed Catch controls and the existing editable parameters for balance testing, including live
  overrides. Keep catalog/fish editing ownership and one Game/Application/Root/config context/store/loop. No production import of DEV,
  hostname/URL detection in Domain, new global, copied config owner or gameplay-formula rewrite.
- Preserve the injected `GameplayOverrideReader` / flags contracts and FixedCatchFishFactory; this decision changes startup policy,
  not gameplay APIs. It does not authorize deleting the reader or weakening enabled-mode tests preserved during ESM migration.
- Focused evidence in the existing config/gameplay checks: actual production composition disables both main switches on startup/reload;
  DEV can enable/toggle them and the existing live consumers react; relevant reset/import/export behavior is explicit and tested;
  settings from DEV do not silently enable the production page. Preserve every unrelated config value, save bytes/schema and timing.
- Browser smoke: actual native `index.html` with both switches off and `dev.html` with enabled balance controls, plus D2's active-lure
  fallback regression. Capture the intended normal production behavior; do not claim production startup behavior is unchanged.
  Keep the deterministic game-cycle baseline stable with explicit scenario inputs; do not bless a digest change caused only by
  inheriting the new production defaults in a test that requires enabled flags.
