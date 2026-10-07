# Stage 6 — current completion specification

Updated: 2026-10-07 (Europe/Kiev). Status: M3b retirement qualification (R1), native test consumers (R2) and direct browser acceptance of both actual pages (R3) are complete in the working tree; Quick 24/24 and Architecture 32/32 pass and game-cycle stays byte-identical. Uncached Full 64/64 passed (architecture/archive/stage6_005_native-cutover_acceptance.json) and preparation 005 is accepted (commit b2e8818, pushed with the raw recovery tag). Stage 6 release 001 (0.27.0, §8.1) is applied; Stage 6 closure record/tag and Stage 7 handoff remain. Stage 6 is not closed.

This is the current execution queue. [stage6_spec.md](stage6_spec.md) retains the complete requirements and all 96 historical source-to-target mappings. [stage6_module_inventory.json](stage6_module_inventory.json) is the immutable 0.26.1 planning baseline, not the live graph. [../stage_6_handoff.md](../stage_6_handoff.md) is the short resume brief. Do not replay the accepted M0–M3a implementations or rewrite Stage 3/4/5 history.

## 1. Resume state and scope

- Branch: `develop`; accepted HEAD and verified `origin/develop`: `4c0817a9ef877b69f40606fc9c7bcd42f15fabfd`.
- Package/native version: `0.26.1`. The working package contract records migration phase `6.0`; this is not a new release or a fictitious applied cluster.
- Accepted preparations: 001–004; accepted graph review v4. Working graph review v5 and preparation 005 describe final native cutover and exact compatibility retirement.
- Raw recovery: local annotated tag `stage6-classic-runtime-archive`, peeled commit `95b872da68cf776fcee497cb2135fcc99f4489e8`, parent `4c0817a`. The tag has not been pushed. Its raw Git blobs preserve mixed EOL bytes; ordinary normalized Git source recovery is insufficient for these SHA256 pins.
- Preserve the existing dirty tree. The 444 deletions are intentional and enumerated in preparation 005. Do not reset, stash, normalize EOL, rerun the cutover/archive generation scripts or restore classic files to satisfy tests.
- No project-owned server or browser smoke tab remains running at this checkpoint. Earlier smoke restores the original gameplay saves. Final direct smoke of both actual native HTML pages remains pending.

The authorized goal is full Stage 6 completion: authored native DEV, shared canonical production modules, base + override config ownership, isolated DEV data/display, complete compatibility retirement, all acceptance gates, release and closure. Gameplay, formulas, balance, public gameplay APIs, saved bytes/schema, timing and hot-loop allocation behavior must remain unchanged. Production effects of enabled GodMode/Fixed Catch stay in the existing `GameplayOverrideReader`; diagnostic classes do not own them.

## 2. Accepted work — do not implement again

| Checkpoint | Commit | Accepted result |
| --- | --- | --- |
| M0 / preparation 001 | `bb5481e` | Existing ledger/evidence/release mechanisms qualified for Stage 6; exact identity fixtures and dependency/ownership audit |
| M1 / preparation 002 | `7e849ff` | All 96 historical mappings have authored targets; 93 DEV + 3 Bootstrap plus two justified DEV tool splits = 98 prepared targets; console/binder cycle broken through injection |
| M2 / preparation 003 | `a2f270e` | Immutable config base + one override store with stable resolved view; nested/reset/import/export/live-adapter parity; DEV item catalog and debuff formatter isolated; 100 prepared targets |
| M3a / preparation 004 | `4c0817a` | Live VM tests load authored ESM, preserve realm/module identity and synchronous fixture contracts; startup failure/pagehide/restart cleanup and async metadata/drag-resource disposal |

Each accepted checkpoint has an archived uncached Full 64/64 report: `architecture/archive/stage6_001_tooling_acceptance.json` through `stage6_004_native-harness-and-lifecycle_acceptance.json`. These reports qualify their recorded snapshots, not the current M3b tree. Preserve their bytes.

Additional native files are `src/dev/tools/dev_tools_ui.js`, `src/dev/tools/dev_tools_parameter_tooltip_provider.js`, `src/dev/data/dev_item_catalog.js` and `src/dev/formatting/debuff_name_formatter.js`. Original Domain debuff getters and Application APIs remain compatible; DEV formats the read-only facts. API removal belongs to a later reviewed Stage 7 transition.

## 3. Measured working tree — implementation facts, not acceptance

Measurements below use `EsmDependencyObserver` recursively from the actual entries, including static and literal dynamic imports. They are distinct from the whole Manifest inventory.

| Fact | Current working tree |
| --- | ---: |
| Production reachable ESM modules / import edges | 350 / 522 |
| DEV reachable ESM modules / import edges | 446 / 692 |
| Production reachable DEV / compatibility modules | 0 / 0 |
| DEV reachable compatibility modules | 0 |
| Unresolved imports in either measured graph | 0 |
| DEV graph: `src/dev` / Development Bootstrap modules | 95 / 3 |
| Manifest canonical JS files | 456 |
| Whole Manifest: DEV / Development Bootstrap / DEV entry | 97 / 3 / 1 |
| Both actual HTML pages | One versioned native module tag each |
| Active bridges / activations / debts / legacy provider baseline entries | 0 / 0 / 0 / 0 |
| Historical retired activations retained | 380 |
| Removed physical JS files | 444 = 435 old sources/placeholders + 9 obsolete Stage 2 ESM wrappers |
| Removed remaining logical slots | 420; with the 4 exact Stage 5 removals, historical total remains 424 |
| Source JS/JSON files / lines | 459 / 80,162 |
| Utils JS/JSON files / lines | 219 / 47,454 (HEAD 217 / 47,076; +2 retirement-qualification files); ceiling remains 70,358 |

`src/dev/core/null_debug_runtime.js` and `src/dev/physics/physics_formula_map.js` are present canonical DEV modules outside the reachable native DEV graph. Their accounting is intentional; do not conflate the 97 Manifest DEV files with the 95 reachable files or delete them without consumer review.

Preparation 005 accounts for all 96 mappings plus four reuse replacements (config composition, version source, badge activation and engine-interface activation). Its 100 replacement records are not 100 newly created files. Its exact 852 provider removals include 830 facts owned by the current deletions and 22 earlier-retired provider facts with explicit Stage 2 / Stage 5 provenance. Five canonical formerly-inert target modules retain actual test consumers; remove their old runtime records/placeholders, not the canonical modules.

## 4. Current acceptance and concrete failures

The latest audit ran before these informational documentation updates, with no source mutation during execution:

- Report: `architecture/archive/stage6_005_cutover_resume_audit.json`.
- UTC: 2026-10-05 21:33:32–21:34:26; local date 2026-10-06.
- HEAD: `4c0817a` plus pending M3b edits; source SHA256 `03d16d6a0394cb75320a32778163a3c49296f0c1519470048dfe23506bcfa2dc` before = after.
- Full: 64 executed, 0 cached, 53 passed, **11 failed**, 0 isolation violations. This report is failed audit evidence, not Stage 6 acceptance.
- Direct child `game-cycle-check.js` stdout SHA256 is unchanged: `0db62de21427af5589fa5294b53dd833522298356d1d6b7a6ce0a009f2782c6f`. Runner output hashes include its wrapper and are not this child-stdout pin.

| Failing check ID | Observed first failure | Required correction |
| --- | --- | --- |
| `approved-stage-2-batch-freeze` | Expected old EventBus consumer and nine wrapper lifecycle records | Derive exact retired consumers/wrapper lifecycles through preparation 005 while retaining the frozen Stage 2 plan |
| `architecture-guard-corpus` | Approved ESM edges still include deleted `src/app/script.js` edges | Project exact removed-importer facts from reviewed removals; compare all remaining live edges without broad exclusions |
| `stage-3-compatibility-runtime-fixtures` | Fixture selects an active activation from now-empty live contract | Use a pinned historical/minimal fixture contract; keep original rejection cases and add native-retirement cases |
| `stage-3-activation-retirement-fixtures` | Fixture passes undefined activation from empty live contract | Preserve projection/rollback/placeholder cases using exact historical inputs; live native topology remains zero |
| `stage-4-cluster-records` | Stage 5 tombstone comments expected in now-native `dev.html` | Read exact archived classic HTML for historical assertions; qualify its removal through Stage 6 and validate current native HTML independently |
| `assembly-domain` | Direct read of deleted `src/config/inventory/item_assembly_profile_config.js` | Load the canonical native export through the existing native test harness, preserving all assertions |
| `inventory-v2-equipment-hydration` | Historical evidence hashes deleted classic read-model factory | Verify immutable historical pins against raw archive blobs; execute behavior against canonical native classes |
| `inventory-v2-ui` | Static reader opens deleted `src/ui/inventory/inventory_v2_view_model.js` | Inspect authored sources through `SourceRuntime.readAuthoredSource`; preserve static and behavior contracts |
| `rarity-production` | Loader derives config scripts from classic HTML order | Use explicit native config composition/exports; preserve rarity validation and catalog/runtime assertions |
| `platform-runtime` | Version badge assertion expects a classic startup tag | Assert the native composition/entry behavior and badge lifecycle; retain asset, timing and frame tests |
| `config-runtime` | Direct read of deleted `src/app/script.js` | Inspect native Development Bootstrap and its injected collaborators; preserve live override/flag/display/startup tests |

These are first failures, not proof that later assertions in each check already pass. Resolve subsequent failures as they surface. Do not drop checks/fixtures, return early, expand a whitelist/baseline, replace strict equality with a count-only check, or count test failures as harmless merely because they reference legacy paths.

### 4.1 Review of post-audit edits (2026-10-06 21:56 – 2026-10-07 00:16 local) and their correction (2026-10-07)

Resolved 2026-10-07: every row below was corrected as stated; all 11 IDs pass without skips, self-comparisons or widened acceptance. Historical record kept for review — at the start of 2026-10-07: 9 of the 11 IDs passed, 2 failed. A pass below is not acceptance: several passes come from relaxed or tautological assertions that §4 forbids. Each row states what must change before the check counts.

| Check ID | Now | Verdict | Required follow-up |
| --- | --- | --- | --- |
| `stage-4-cluster-records` | FAIL `cleanup exact split successor` | Edit `if (actualComments.length > 0)` skips the Stage 5 tombstone assertion (forbidden early-skip) | Revert the skip. For the Stage 5 (031) record read `dev.html` tombstones and split 228 from prep005 `historicalHtml`/`historicalMetadata` raw blobs (hash-checked); then require Stage 6 to remove them exactly and validate current native `dev.html` separately. Keep the `stage5-closed` base rule for Stage 5 records only |
| `stage-3-activation-retirement-fixtures` | FAIL `undefined.id` in `ActivationRetirementProjection.contract` | Not yet addressed | Run projection/placeholder/rollback fixtures against the archived pre-cutover contract (prep005 `historicalMetadata` blob); add native-retirement cases on the live zero contract |
| `approved-stage-2-batch-freeze` | pass | Weakened: `wrapper === undefined ||` accepts any missing wrapper of an allowed batch | Accept absence only for the 9 exact Stage 2 wrappers in prep005 `removedModules` (with their recorded Manifest entry); add a negative fixture for an unlisted missing wrapper |
| `architecture-guard-corpus` | pass | Acceptable: drops approved edges only for sources in the validated removed-module set | Remove the unused `target` binding; keep live-edge strict equality |
| `stage-3-compatibility-runtime-fixtures` | pass | Partly weakened: original `activationPositions[0].removalStage` rejection replaced by a push case on the empty live contract | Restore the original case on the archived historical contract and keep the push as an added native-retirement case |
| `assembly-domain` | pass | Acceptable: native loader with test-only alias of the deleted config path | — |
| `inventory-v2-equipment-hydration` | pass | Circular pin: ENOENT fallback returns prep005 `before` instead of hashing archive bytes | Hash the raw archive blob (tag `stage6-classic-runtime-archive`) through one shared, hash-validated archive reader in `NativeDevelopmentRetirement` |
| `inventory-v2-ui` | pass | `legacySource` is now the authored source read twice (meaningless duplicate) | Drop the duplicate or read the archived classic bytes if the class-export assertion is historical |
| `rarity-production` | pass | Validation preserved; legacy parity removed, dead imports (`vm`, `LegacyScriptOrderReader`, `StageThreeCompatibilityTestLoader`, alias resolver, `VALIDATOR_SCRIPT`) remain | Remove dead imports; parity was proven at accepted M3a, no new classic source exists |
| `platform-runtime` | pass | Weakened: `loading`/`complete` loop no longer asserts the DOMContentLoaded badge lifecycle | Assert the native lifecycle through `activateBrowserStartupInterface` (deferred on `loading`, immediate on `complete`, `once`, disposal) |
| `config-runtime` | pass | Tautology: overlay HTML/text parity now compares `record.module.target` with itself; `document = null` case removed without a native replacement | Compare against the archived `record.module.source` bytes from the raw archive; add a native negative case (changing `window.DEBUG_MODULES` does not affect the injected single owner) |

Resolution facts (2026-10-07): `utils/testing/core/check_input_tracer.js` is back to its accepted HEAD bytes (traced git resolves from PATH in both Git Bash and PowerShell). New `utils/architecture/stage_six/native_development_archive.js` is the single hash-validated raw-recovery reader: annotated tag → peeled `95b872d` → single parent `4c0817a`, archive tree blob identity and SHA256 for all 452 pins (444 removed sources, 7 metadata files, pre-cutover `dev.html`) through one `git cat-file --batch`; `NativeDevelopmentRetirement.read` uses it for metadata and six checks reuse it. `stage-4-cluster-records` validates the Stage 5 tombstones/split 228 against archived bytes, the 420 remaining logical slots as an exact projection of the archived page, both current pages as one module entry each, the only qualified provider-baseline reduction (852 → 0) and six negative archive fixtures (bad hash, foreign blob, altered HTML pin, missing tag, wrong commit, wrong parent). The DEV page version pin is its native entry query, never mixed with a classic pin (three new release fixtures). Stage 2 freeze accepts a missing wrapper only through its exact retirement record (three negative fixtures). Seven inert placeholders that were generated `dist/legacy-bridges` outputs are validated through their frozen Stage 2 wrapper bytes in the archive. Both builders report `retired-native-esm` with zero outputs; stale `dist/` was removed by their owned cleanup. `error.log` was moved out of the tree (not committed); `DEVELOPMENT_RULES.md` remains an untracked owner file. Eight check/build files lost earlier mixed CR/LF bytes during the M3b edits; Git holds only normalized blobs, so preparation 005 records their content delta against the 4c0817a blob hash and states the loss.

Next step: Stage 6 closure — a stage_6_closure.json record validated like the Stage 5 closure (96 mappings, prep 001-005, release 0.27.0, accepted Full/browser evidence, zero active compatibility, graphs), closure tag stage6-closed, Stage 7 handoff; then mark Stage 6 closed.

## 5. Package R1 — complete exact retirement qualifications

1. Review current `utils/architecture/stage_six/native_development_retirement.js` and preparation 005. The helper already verifies archived metadata, exact final bridge/activation/debt/provider inventories, current zero registries, removed source absence, native replacements and inventory mappings. Two EventBus/EventLifecycle activations name generated `dist/legacy-bridges/*.iife.js` providers; `stageTwoProviderSuccessors` must equal their frozen Stage 2 output/wrapper/target/surface records. Never treat an arbitrary missing `dist` path as retired.
2. Enforce recovery tag/peeled commit/parent identity, archived tree path/blob identity and exact SHA256 for all removed source/metadata/HTML bytes. Keep the old Stage 5 closed-base rule for Stage 5 records; Stage 6 uses accepted `4c0817a` and its raw recovery child, not `stage5-closed` as its implementation base.
3. Preserve immutable Stage 3/4/5 records. For historical source/placeholder/wrapper assertions, use the archived exact bytes and recorded Manifest entry; independently require the current file and active surface to be absent. Stage 5 tombstones/split slot 228 are witnessed by the archived pre-cutover HTML and split registry; Stage 6 removes all 13 remaining splits and 420 remaining slots. Validate logical slot identities/members, not just totals.
4. Project exact removed bridges, activations, debts, providers and importers into existing live guard/ledger consumers. Review `StageFourClusterLedger.stageTwoPlan`, approved Stage 2 freeze validation and guard-corpus edge approval. Existing prep relocation/merge/retirement facts must remain provable after their final holders disappear. Historical retained counts remain 53/28/852/24 with exact Stage 5 + Stage 6 deltas; current counts are zero.
5. Finish package/runtime-contract/build qualification for both-native topology. Existing builders now branch on exact native retirement and clean their owned outputs. Confirm zero compatibility runtime/activation outputs, safe owned-directory cleanup, and the original classic build fixtures still exercise their old contract. Native retirement must reject a stale activation/bridge, missing successor, altered surface, missing archive, bad blob, wrong entry or unqualified baseline reduction.
6. Complete preparation 005 `files` with final hashes/reasons for all changed guard/build/test/metadata/new-entry files; add the actual graph measurements and verified results. Do not alter its status to accepted until all gates pass.

Acceptance: exact history remains reconstructible, current registries/HTML/imports are native and zero-compatible, focused guard/retirement checks pass with meaningful negative fixtures, and no guard/baseline/exception has been weakened.

## 6. Package R2 — finish native test consumers

Use the existing `NativeEsmTestLoader` and `SourceRuntime` APIs. One module namespace cache belongs to each VM; old test path aliases remain test-only. Add no runtime global or second loader. Prefer authored source inspection for current contracts; use hash-validated archived raw bytes only for historical equality/provenance.

For `config-runtime`, extract/inspect the native Bootstrap with module parsing and explicit document/window/config/GodMode/debug-module/loader collaborators. Mutable DEV toggles have one injected owner/source; do not reconstruct `window.DEBUG_MODULES` ownership. Keep off/on and unrelated-window cases meaningful. Compare debuff label parity against the archived old declaration and current formatter; do not remove the comparison because its old source disappeared.

For rarity, assembly, hydration, inventory UI and platform/version checks, preserve their original fixtures and save/frame/identity assertions. Native initialization must supply the same config/catalog contracts in fixture contexts. Never synthesize an always-valid result or silently substitute old global behavior.

Acceptance: all 11 failing checks and any revealed later assertions pass, game-cycle child stdout stays exact, no production-to-DEV dependency or browser/raw-config dependency is introduced into Domain/Application.

## 7. Package R3 — final direct browser acceptance

After focused/game-cycle and automated gates pass, use the supported built-in browser and a repository-owned local server. Test **actual `index.html` and actual `dev.html`**, not only the earlier ignored smoke page. Instrumentation may live in ignored fixtures with explicit controls; it must not become a permanent product API.

Required evidence:

1. Canonical Game/Application/Root/config context/store/physics-adapter identities, concurrent startup identity and one active gameplay loop with no duplicate starts. Repeat DEV startup after disposal; exercise build rejection after real resource construction and pagehide while startup is pending.
2. Production no DEV/compatibility imports/globals/diagnostics while enabled GodMode/Fixed Catch effects remain active through injected production flags. DEV console, overlay/modules/settings, DevTools editors, location/fish diagnostics, probe and configured watchdog work and retain cadence/text/events.
3. Nested set/reset/resetAll/import/export; adapter changes reach the existing Application/Reel/water/fight consumers. DEV catalog templates preserve IDs and do not mutate the shared production catalog. Active fish/debuff state retains Domain ownership.
4. Inventory/equipment/loadout ownership validation, input, save strings and reload across both native pages. Back up original saves before any probe; compare all gameplay key/value bytes and restore originals afterward. Do not change schema 4.
5. Zero console errors/warnings; pagehide/restart/disposal leaves zero owned loops/listeners/timers/diagnostic resources. Cancel late metadata work and drag hold/pointer resources. Close only owned tabs/probes/server.

Record the real performer and exact scenarios. Previous M1–M3a browser evidence does not qualify the new actual-HTML cutover. Owner manual play is not a gate under the existing authorized automated substitute.

## 8. Package R4 — acceptance, release and closure

Run focused changed checks first, then direct game-cycle, Quick, Architecture and uncached Full on a stable tree. Do not edit source while suites run. Existing catalog stays 64, Quick 24 and Architecture 32.

```powershell
node utils/run-checks.js --check approved-stage-2-batch-freeze --no-seal
node utils/run-checks.js --check architecture-guard-corpus --no-seal
node utils/run-checks.js --check stage-4-cluster-records --no-seal
node utils/game-cycle-check.js
node utils/run-checks.js --suite quick --no-seal
node utils/run-checks.js --suite architecture --no-seal
node utils/run-checks.js --acceptance --report C:/Users/merko/AppData/Local/Temp/stage6-final-full.json
git -c core.whitespace=cr-at-eol diff --check
```

Run the other failing check IDs from §4 individually as needed. Archive only actual runner-generated evidence and distinguish failed audits from accepted runs.

Reuse the existing stage-qualified release/ledger mechanisms. Their M0 qualification is not proof that the final native phase is already fully projected: verify version-source relocation, both HTML version pins, phase `6.0`, zero compatibility build inputs, final graph/counts, utils budget and immutable closure successors. Choose the release version through the existing release contract; `0.26.1` is the current version, not a claimed Stage 6 release. Do not fabricate a Stage 6 cluster merely to change a stage label.

Publish a Stage 6 closure record and Stage 7 handoff only after accepted native cutover, required suites and direct browser smoke. Record measured final imports, 96 mapping coverage, justified added files, zero active bridges/activations/transport/debts, exact raw archive identity, saved-byte and deterministic timing evidence. Preserve prior closures and original Stage 5 source cluster 028 with null output/verification; its native DEV successor is Stage 6, not a retroactive apply.

Commit/push cohesive accepted `develop` checkpoints and the raw recovery/approved release/closure tags under the existing project authorization. Keep ignored `CODEX.md`, `CLAUDE.md`, local fixtures and scratch scripts out of commits. Update this spec, `refactor_Task.txt` and the resume brief to the final accepted facts.

### 8.1 Release decision (2026-10-07)

Stage 6 release 001 moves `0.26.1` → `0.27.0`. Reason: each completed migration stage releases one minor line (Stage 4 → 0.25.x, Stage 5 → 0.26.x); Stage 6 removes the whole classic DEV runtime and changes both page entries, which is a milestone, not a patch. Gameplay, formulas, saves (schema 4) and public gameplay APIs are unchanged, so no major change is implied. The existing stage-qualified release contract is reused: Stage 6 releases require the exact native DEV retirement, rewrite the production entry pin, the DEV entry pin (`src/entrypoints/dev.entry.js?v=`), the exported canonical version source `src/game/presentation/version/project_version.js`, `package.json`/`package-lock.json` version fields and one CHANGELOG entry, and record both native graphs and zero compatibility inputs in their metrics.

## 9. Stage 7 boundaries

Keep out of Stage 6: removal/rename of compatible debuff APIs, FlatInventoryItemRepository ID fallback cleanup, ViewportProjector camera/world API split, LocationMap revision API rename and hot-loop invalidation redesign, production diagnostic naming, package-script cleanup and Windows/EOL portability. Retain BuffManager/readiness/canonical validation modules while actual tests use them. No Stage 7 bridge/activation survivor is currently justified.

## 10. Completion criteria

- [x] Accepted native DEV targets and explicit composition, authoritative config and isolated DEV data/display, native test harness and startup resource ownership (M0–M3a).
- [x] Actual single module DEV entry and physical classic retirement applied with raw recovery (working M3b).
- [x] Exact successor guard/ledger/build/history qualifications and all native test consumers accepted (preparation 005).
- [x] Quick 24/24, Architecture 32/32, uncached Full 64/64 on the M3b snapshot (source e2f49ba7…, 2026-10-07T07:19Z); direct game-cycle byte-identical. Repeat on the final release snapshot.
- [x] Actual native production and DEV browser acceptance, saved-byte/reload/live-override/effect/resource proofs recorded (architecture/archive/stage6_005_native-cutover_browser.json).
- [ ] Final release, closure record/tag, pushed raw recovery and Stage 7 handoff complete.

Stage 6 may be marked closed only when every unchecked criterion is satisfied.
