# Prior Stage 5 handoff — current execution queue link

Stage 5 A-F closed at 0.26.0; package G verified at 0.26.1; this prior handoff is historical.
Current implementation queue: ../stage_6_handoff.md; completed A-G provenance: stage5_next_chat_spec.md.


The current authoritative queue is [stage5_next_chat_spec.md](stage5_next_chat_spec.md).
The owner renewed autonomous execution on 2026-10-05. Current facts and progress are
maintained in plan_v2.md and stage5_continuation_spec.md; the prior handoff below
preserves its recorded baseline and must not be mistaken for new acceptance.

# CyberFishing — next-chat execution specification

## Objective and latest owner instructions

Date: 2026-10-05. Language: English. Workspace: `D:\dev\code\cyber-fishing`.

Finish the remaining Stage 5 architecture work, produce its verified release and closure, and then perform the separately authorized dead-code cleanup in small, independently verified changes. Native production is already implemented. Native DEV belongs to Stage 6.

The owner explicitly requires autonomous testing through the existing game-cycle scenarios and the Codex built-in browser, without their participation. Do not wait for owner play, ask the owner to operate the game, or make manual testing a closure gate. Perform the tests yourself, report their actual coverage and limitations, and identify the performer as Codex automated acceptance. Historical records saying owner manual play is pending remain historical facts; do not claim that the owner performed those sessions.

The purpose is an architecturally correct refactor with unchanged gameplay. Give particular attention to deleting unnecessary code, obsolete tooling and compatibility bridges whose last consumer is gone. Keep source and tooling growth under control. An abstraction or wrapper must solve a concrete ownership, dependency, lifecycle, platform-isolation or testability problem; deletion and reuse of existing mechanisms are preferred where sufficient.

Continue autonomously within the existing authorized scope, including cohesive commits and pushing develop. Do not ask for renewed permission for already authorized reversible implementation, testing or cleanup. If a genuinely missing architecture-critical decision cannot be resolved from code or existing instructions, state the missing fact and continue independent work while seeking that specific clarification.

## Authority and documents to read

Follow the latest human instructions and the current AGENTS.md/development rules. This document is the current next-chat queue. Use the existing continuation specification for detailed migration mechanics and historical provenance; its old pending-manual-play wording does not override the latest automatic-testing instruction.

Read these sources once, then inspect actual code and consumers before structural changes:

1. [Current plan](D:/dev/code/cyber-fishing/architecture/migration/stage_5/plan_v2.md), [continuation specification](D:/dev/code/cyber-fishing/architecture/migration/stage_5/stage5_continuation_spec.md), and [overall refactor plan](D:/dev/code/cyber-fishing/refactor_Task.txt).
2. [Owner topology decision](D:/dev/code/cyber-fishing/architecture/migration/stage_5/native_production_owner_decision.md), [authoritative graph v8](D:/dev/code/cyber-fishing/architecture/migration/stage_5/graph_review_v8.json), original cluster 028 and preparations 027–029.
3. [Native cutover acceptance](D:/dev/code/cyber-fishing/architecture/archive/stage5_native_production_cutover_acceptance.json) and [saved visual-field audit](D:/dev/code/cyber-fishing/architecture/migration/stage_5/saved_visual_fields_audit.md).
4. [Architecture policy](D:/dev/code/cyber-fishing/architecture/module_architecture.json), [migration manifest](D:/dev/code/cyber-fishing/architecture/migration/module_migration_manifest.json), [bridge registry](D:/dev/code/cyber-fishing/architecture/guards/migration_bridge_registry.json), and [cumulative runtime contract](D:/dev/code/cyber-fishing/architecture/migration/stage_3_compatibility_runtime.json).
5. [Check pipeline](D:/dev/code/cyber-fishing/utils/testing/CHECKS.md), existing stage-qualified cluster/evidence/ledger/release mechanisms, and [archived-check policy](D:/dev/code/cyber-fishing/architecture/archive/ARCHIVED_CHECKS.md).
6. [Compact tooling archival candidate audit](D:/dev/code/cyber-fishing/architecture/migration/stage_5/tooling_archive_candidates.json). It records a hypothetical, read-only deletion audit; it is not evidence that cleanup or post-cleanup tests have happened.

Earlier loader proposals are historical alternatives. Do not implement them. Local `CLAUDE.md` and `CODEX.md`, if present, are excluded resume notes and must never be committed. Agent coordination follows the current session instructions, not obsolete local no-delegation guidance.

## Verified starting point

Check the branch, working tree, HEAD and origin/develop first. Preserve unrelated user changes. The handoff is based on these pushed commits; a later documentation-only handoff commit may follow them:

| Fact | Verified baseline |
| --- | --- |
| Branch | develop |
| Native production implementation | `aac62f615e1e709460680e7eab71b861871d9c1b` |
| Prior documentation checkpoint | `a33c6804c9e974c4fd251defb0672c5b44c08335` |
| Release / migration label | 0.25.2 / 5.29 |
| Stage 5 migrations | 29 applied clusters, 102 recorded ESM targets; preparations 001–029 |
| Native startup additions | Four reviewed modules in preparation 029; not an apply of original cluster 028 |
| Original cluster 028 | Development Bootstrap source deferred to Stage 6; output and verification remain null; nativeProduction checkpoint verified separately |
| Retained DEV runtime | 28 active activations, 380 retired, 7 inert; 53 bridges |
| Outstanding retirement metadata | Transport, 14 bridges and 11 activations still marked Stage 5 |
| Historical baseline / known debts | 852 global-provider entries / 24 debts |
| Acceptance | Quick 24/24, Architecture 32/32, uncached Full 64/64; zero failures, cached results or isolation violations |
| Native graph audit | 350 modules / 521 import edges, no DEV/compatibility/unresolved imports; re-observe after changes |
| Source size at this checkpoint | src: 810 tracked JS/JSON files / 82,056 newline-counted lines |
| Tooling size / ceiling | utils: 478 JS/JSON files / 71,797 lines; ceiling 70,358; excess 1,439 |
| Stage 5 release / closure | Not created; no Stage 5 version/name chosen, version bump or closure tag |

The archived Full ran on 2026-10-05 03:24:06–03:24:42 UTC, on HEAD `194da01` plus the pending cutover. All three suites shared unchanged snapshot `98ed225a3598aa8e5a1ca10ad66cd9b34613efb84f09c6973e8faa93c153f86d`. Archival and informational checkpoint edits followed that run. This is accurate provenance, not acceptance of future cleanup changes.

The semantic game-cycle stdout SHA256 remains:

```text
0db62de21427af5589fa5294b53dd833522298356d1d6b7a6ce0a009f2782c6f
```

Use the existing cluster-path capture method: hash the Node child process's stdout directly. Do not hash PowerShell-formatted logs, elapsed test-runner output, or a differently normalized representation and then treat that difference as gameplay drift.

## Architecture and behavior invariants

```text
index.html -> game.entry -> Production Bootstrap -> Engine / Game / Platform
dev.html   -> retained classic scripts + cumulative IIFE until Stage 6
Stage 6: dev.entry -> Development Bootstrap -> production modules + DEV
```

- Production has one native ESM graph and does not depend on DEV, compatibility runtime, activation shims or a new legacy loader.
- Engine contains reusable mechanisms and knows no CyberFishing domain rules. Domain depends only on domain and engine. Application uses domain, engine and application ports. Browser capabilities belong to Platform; rendering/UI belong to Presentation. Bootstrap composes concrete implementations.
- Domain/Application have no direct DOM, Canvas, localStorage, Audio API, browser-global or DEV dependency. Runtime configuration is injected; do not import raw CONFIG globals into those layers.
- Each mutable fact has one authoritative owner. UI, render, debug and caches must not become additional writable gameplay owners. This does not require one giant GameState.
- Preserve formulas, probabilities, balances, seeds, APIs, receivers, errors, state transitions, save schema and bytes, clock semantics, update/render order, assets and performance. No opportunistic gameplay redesign, rebalance, camera change or API rename.
- Fixed Catch stays an injected production dependency. The production GodMode reader remains stateless over the same CONFIG and preserves enabled effects, defaults, truthiness and clamping. Do not silently disable effects when diagnostics are absent.
- Diagnostic overlay, renderer, lifecycle, frame/service and watchdog may be absent under preparation 027's explicit contracts. Supplied implementations must still be validated. Do not conceal required gameplay dependencies with fake no-op implementations.
- Keep one startup promise, Game, config context/store and physics adapter per canonical production realm. Preserve the single-shot startup contract, serial cold-loader order and idempotent cleanup. Do not add a restart API.
- Avoid unnecessary hot-loop allocations, repeated DOM queries, transport/global lookups, speculative pools, god objects, broad managers and duplicate catalogs. Use composition, small contracts, named exports and explicit `.js` imports; avoid cycles and mass barrels.
- Compatibility bridges expose existing exports only. They own no business logic, state or configuration, and new permanent code must not depend on them.
- Do not weaken guards, baselines, debts, whitelists, strict import evidence or negative fixtures to pass tests. Preserve immutable Stage 3/4 records and completed Stage 5 evidence.

## Work package A — final architecture and retirement reconciliation

1. Re-observe the actual production import closure, ownership and consumers. Confirm no DEV/transport reachability, one config/state owner, injected live settings and one game loop. Record reviewed findings using existing architecture mechanisms.
2. Audit every surviving bridge and activation against authored native imports, classic DEV slots/getters, composition, tests, builds and live evidence dispatch. Production independence alone does not prove a classic DEV consumer is gone.
3. Reconcile the retained transport and the 14 bridges / 11 activations still assigned Stage 5. Legitimate retained consumers require exact Stage 6 retirement conditions; retain a separately justified Stage 7 survivor only with its actual consumer and removal trigger.
4. The current Stage 5 bridge holders are these repository module IDs: `src/config/config.js` (five catalog/config/context readers); `src/ui/ui.js` (three UI readers); version alias, version badge mount and engine-interface activation; `src/app/script.js` (EventBus/EventLifecycle); and the location debug frame builder (Vector2). Derive precise paths/identities from the live registries rather than making a new duplicate catalog.
5. Keep the existing owner, source/target identity, export/global surface and introduction history. State the exact condition: remove only after the last listed classic DEV consumer migrates to native DEV and no other live holder remains.
6. The runtime validator currently hardcodes transport removalStage = stage-5 in [cumulative_runtime_contract.js](D:/dev/code/cyber-fishing/utils/build/compat_runtime/cumulative_runtime_contract.js). Implement a narrowly decision-qualified lifecycle transition for the approved native-production/classic-DEV phase. Preserve historical Stage 5 expectations and reject arbitrary stage values, missing decisions and invalid phase combinations. Merely changing JSON is insufficient.
7. `bridge-583ef0b7fc62` overlaps a frozen Stage 4 retirement update. Preserve that historical record and validate the exact subsequent Stage 5 transition; do not rewrite history to fit current metadata.
8. Remove a bridge/activation only when all actual holders are gone. If retained DEV still needs it, record the dependency and removal condition. Do not claim success by forcing bridge counts to zero or by moving their implementation into an untracked loader/global.
9. Extend the existing cumulative-runtime/retirement/cluster-record fixtures with meaningful positive and negative lifecycle cases. No new per-cluster check catalog or parallel validation framework.

Deliverable: reviewed current registry/contract transitions, exact surviving consumers and triggers, preserved historical pins, focused checks and game-cycle parity. Counts may remain 53 bridges / 28 activations if all still have legitimate DEV consumers; explain any actual removals.

## Work package B — historical tooling archival and non-growth budget

The compact candidate audit persists the exact 262-path list, working-tree SHA256 values, native/archive Git blobs, roots, metrics and five later variants. Revalidate it at next-chat HEAD before deletion; it is a candidate audit, not applied cleanup or post-removal acceptance.

The audited proposal removes only the unused three-line `verifyBatch007PostHydrationManifestEvidence` import from [inventory-v2-equipment-hydration-check.js](D:/dev/code/cyber-fishing/utils/inventory-v2-equipment-hydration-check.js). That disconnects 262 historical replay/planning utility files totaling 25,470 lines. Hypothetical resulting utils size: 216 JS/JSON files / 46,324 lines. Current hydration behavior and repair-evidence checks stay intact.

Required steps:

1. Rebuild the reachable utility closure from all 64 catalog checks, existing package targets, three Stage 4 CLIs, native ESM fixtures, and current Stage 4/5 evidence commands/scenarios. Inspect dynamic dispatch and literal path references as well as imports. Confirm no incoming live edge reaches any candidate.
2. Verify all candidate hashes and Git blobs. All 262 current blobs are preserved at native commit `aac62f615e1e709460680e7eab71b861871d9c1b`; 257 also match archive tag `stage3-evidence-archive`, commit `4487fe1c43d7080ddf9f7f7b441a41580b7b2154`. The five later variants are listed in the candidate audit; the old archive tag alone does not preserve their current versions.
3. Keep archive refs and existing historical evidence files. The 26 external historical/documentary reference sources are not live utility roots and must not be erased to justify deletion. Document recovery through the appropriate preserved Git commit/path.
4. Distinguish normalized Git blob hashes from mixed-line-ending working-tree byte hashes. If frozen evidence requires exact working-tree bytes, preserve those bytes through the existing archival approach before removing them. Do not claim a normalized Git restore is automatically byte-identical.
5. Apply only the explicit reviewed candidates after reachability verification, and record actual before/after paths, counts, lines and preserved references. Verify absolute deletion targets remain inside the intended workspace; use literal paths and one native shell for filesystem operations.
6. Preserve every live check, fixture case, scenario dispatcher, package dependency and build/release path. Do not shrink the catalog, delete negative cases, minify, remove blank lines artificially, hide files through extensions/ignore rules, or move live code elsewhere to evade the budget.
7. The existing package `architecture:closure` target names an absent archived Stage 1 check. This is a pre-existing deferred package-contract fact, not a new failure caused by this cleanup. Do not restore that archived check or use the obsolete command as the Stage 5 closure gate.
8. Run affected hydration/runtime/cluster-record checks, game-cycle, Quick and Architecture, then uncached Full and automatic native/DEV browser acceptance at the stable cleanup checkpoint.

Measure tracked plus pending JS/JSON files using the established newline-count method. At every stable checkpoint, utils must be at or below 70,358 lines. Record src and utils files/lines and explain any growth. The baseline src size is a comparison point, not permission to fill a new numeric allowance. Keep additions minimal and offset replaceable code with real deletion; do not introduce a second release/closure framework.

Deliverable: safely archived obsolete tooling, unchanged live coverage, actual metrics within the ceiling, recoverable history, and new acceptance evidence. General gameplay dead-code cleanup belongs to work package G after Stage 5 closure.

## Work package C — boundary-tool evaluation

Evaluate dependency-cruiser or ESLint Boundaries after inspecting the working native graph and existing guard coverage. Use current primary documentation if external tool facts are needed.

Record the useful gap, expected maintenance/code/dependency cost and a decision. Retaining the existing guards with a justified decision is valid; installing a tool is not itself a completion criterion. Do not add dependencies merely to satisfy this evaluation or change frozen package decisions incidentally.

Existing guards cover layer/role restrictions, qualified dependencies, cycles, browser capabilities, globals, bridge identity, migration evidence and native closure. A standard static-import tool does not replace all those contracts. Any adopted replacement must prove equivalent or stricter enforcement with meaningful negative cases before overlapping guards are removed. Keep exact migration/state/transport enforcement where the standard tool cannot express it.

Deliverable: a concise recorded evaluation and any justified minimal integration, preserving all existing guarantees and budget.

## Work package D — reviewed Stage 5 release projection

No Stage 5 release record, version/name, bump or tag exists at this baseline. Define version/name in a reviewed release input before applying changes, using established project conventions and the owner's scope. Do not describe an invented version as already approved.

Reuse [release_path.js](D:/dev/code/cyber-fishing/utils/architecture/stage_four/release_path.js), the existing release CLI and stage-qualified ledger/evidence mechanisms. The current class/CLI still use Stage 4 release selection, edits and metrics. Only currentVersion's native policy support is already present; do not mistake that for a completed Stage 5 release path.

The reviewed transition must address:

- Stage-qualified record identity/directory/selection and release chaining while preserving Stage 4 defaults and historical pins.
- The canonical ESM version source and its exported declaration; exact metadata-only statement edits preserving every other byte and each statement's line endings.
- Agreement between package.json, package-lock.json including the root package entry, canonical version config, production game.entry query and retained DEV project_version alias query.
- Exact page-specific version edits. Do not broadly rewrite every script/CSS query or alter either startup topology.
- CHANGELOG insertion and any explicitly reviewed trim; preserve unrelated historical entries.
- Current metrics for native production and retained classic DEV separately: actual physical script tags versus logical DEV slots, stage-qualified applied/deferred clusters, activations/bridges/retirement paths, src/utils lines and debts. Do not report index's zero classic scripts as removal of classic DEV.
- Strict positive/negative fixtures for stage identity, source representation, mismatched/duplicate/missing version pins, unrelated file changes, line endings, historical releases and metrics.
- Release-only package edits. No incidental dependency/script/lock churn or gameplay changes.

Keep original cluster 028's deferred source and null output/verification intact. Its separate verified nativeProduction checkpoint satisfies the native startup obligation; do not manufacture an applied source migration to close the ledger.

Deliverable: one reviewed release-projection preparation through the existing mechanism, focused fixture acceptance, consistent metadata-only applied release and recorded metrics. Do not apply or tag the release until the closure prerequisites and relevant verification pass.

## Work package E — autonomous test and browser acceptance

The agent owns all test execution. Owner interaction/manual play is not required. Use the current computer-use skill and supported built-in browser APIs when browser work begins; do not substitute an external browser or an unsupported automation/evaluation channel.

### Automated code and game-cycle checks

Use existing focused checks for the changed responsibility. In particular, retain actual gameplay/config/startup coverage in game-cycle, fish-rarity, config-runtime, rarity-production, inventory lifecycle/save, runtime/retirement/cluster-record and Vite/package fixtures. Extend existing cases only where a meaningful gap exists.

Commands, run from the workspace:

```powershell
node utils/game-cycle-check.js
node utils/run-checks.js --check game-cycle --no-seal
node utils/run-checks.js --suite quick --no-seal --report "$env:TEMP/cyber-fishing-stage5-quick.json"
node utils/run-checks.js --suite architecture --no-seal --report "$env:TEMP/cyber-fishing-stage5-architecture.json"
node utils/run-checks.js --acceptance --report "$env:TEMP/cyber-fishing-stage5-full.json"
git -c core.whitespace=cr-at-eol diff --check
```

`--quick` is not the Quick selector. Acceptance uses the complete catalog with no suite/check filter, zero cached results, zero failures/isolation violations and unchanged before/after source. Freeze source throughout the run. Reports must be outside the project or in the permitted runner cache; archive the accepted report afterward and record exact commit, pending delta, snapshot, timestamps and artifact hash.

Compare game-cycle stdout with the established digest. Preserve deterministic cast/hook/fight/land/break behavior, state and resource ownership, deltaTime, loop callback reuse and relevant save/hot-loop traces. Diagnostics-on/off and GodMode cases must test actual injected production classes, not only getters or test doubles. Existing repeated bite-environment/chum queries cover specific scenarios; do not claim universal purity or untested state-machine paths from that limited proof.

At stable implementation/cleanup checkpoints require Quick 24/24, Architecture 32/32 and uncached Full 64/64, unless a separately justified catalog change is explicitly authorized. Do not add per-cluster catalog entries. A strictly verified metadata-only release delta may reuse runtime acceptance according to CHECKS.md; changes to source, dependencies, check implementations or scenarios require fresh relevant acceptance.

### Built-in browser procedure

1. Close task-owned game/DevTools tabs and stop the prior server before rebuilding generated directories. Start the normal `node utils/dev-server.js` pipeline; default local URLs are `http://127.0.0.1:4173/index.html` and `http://127.0.0.1:4173/dev.html`.
2. Test the actual production index and retained DEV document separately. The normal server rebuild must pass; a static-server bypass alone does not certify the build pipeline. If Windows holds dist open, release owned browser/server handles and retry. Never weaken the builder or add a loader to work around the lock.
3. Inspect rendered startup, assets, styles, version badge and inventory through the built-in browser. Use current DOM/UI evidence and snapshots. If an ignored temporary fixture is needed for identity, loop, console or save facts, derive it from the current real page and canonical modules; also verify direct index startup independently.
4. Wait for publication/start readiness before identity assertions. Verify canonical Game/Root/Application, CONFIG/catalog/context/store/physics identity; same repeated/concurrent production startup promise; one active loop and zero duplicate starts.
5. Verify production has no DEV globals or compatibility transport and accepts absent diagnostics/watchdog. Verify retained DEV still uses its legitimate classic/IIFE transport and diagnostics without duplicate instances.
6. Verify active Fixed Catch and GodMode through injected production dependencies and current expected flag values, including ordinary/off and enabled effects covered by focused scenarios. Do not label a comparison with expected false as an enabled true flag.
7. Exercise inventory open/close, representative input transitions, pause/resume and lifecycle cleanup where supported. Preserve the actual API/state contract. Validate reload/restoration and all three saved strings or the current authoritative save-key set if independently verified to have changed.
8. Capture saves before any mutating fixture scenario and restore the original user data after isolated tests as appropriate. Avoid contaminating player progress with test-only data. Compare native and DEV gameplay UI under the same selector/setup, accounting only for legitimate diagnostic controls.
9. The prior accepted role-button comparison was native 50 gameplay texts versus DEV 52 including its two leading diagnostic controls. Historical 030 used a different selector and counted 64; do not compare those counts as a regression. Derive controls by their verified position/role rather than globally filtering gear-symbol texts that also occur in inventory items.
10. Require zero unexpected console warnings/errors, identical relevant save values after reload, one loop, and correct pagehide/dispose cleanup of listeners, scheduled work and published handles. Capture screenshots and meaningful facts; distinguish observed browser behavior from unit/game-cycle coverage.
11. Record Codex as performer, the actual URLs/build, cases, warnings/errors, loop/identity/save facts, relevant screenshot paths and limitations. Do not claim owner play or an unexecuted long gameplay session.
12. Close owned tabs, stop the server, and remove owned temporary fixtures/probes. If a failed build removed generated legacy placeholders, restore them through `node utils/build/build_stage_3_compat_runtime.js`; bridge-only building is insufficient.

Use SourceRuntime/StageThreeCompatibilityTestLoader for classic fixtures against native targets, loading one cumulative runtime per realm. Request retired/inert exports test-only rather than reactivating globals. Do not add native/IIFE mixtures to production, permanent diagnostic globals, permanent test loaders or new runtime dependency scanners.

## Work package F — Stage 5 closure and Stage 6 handoff

After A–E pass:

1. Reconcile approved scope, graph v8, preparations/cluster counts, exact surviving bridges/activations, metrics and current plans. Every Stage 5 obligation must be completed or explicitly and correctly assigned later with its dependency/removal condition.
2. Adapt the existing ledger/closure projection with a written reason before new fields or validation behavior. Produce a Stage 5 closure record linked to the actual accepted source/report and release. Do not create another large framework or restore archived checks.
3. Confirm utils <= 70,358 lines, unchanged gameplay/save/state contracts, no new forbidden edges/debts/globals and valid current native/DEV launches. Saved visual fields already need no schema transition; do not reopen that completed audit without new evidence.
4. Produce the reviewed release and closure tags only on the appropriate verified, committed clean milestone. Preserve existing tags and immutable Stage 3/4 history. Push the authorized develop checkpoint using normal history; no force push or evidence rewriting.
5. Update the current plan, continuation specification, refactor_Task and relevant current records. Clearly separate completed facts, deferred source work, automatic test coverage and historical manual-play status. Do not relabel four preparation modules as an additional applied cluster.
6. Write an English Stage 6 handoff: native dev.entry/Development Bootstrap composition; reuse production modules; migrate exact classic DEV consumers; remove the old transport and remaining bridges after their last holders disappear; retain legitimate Stage 7 work with exact reasons. Include current config/override sourcing work and any surviving cleanup dependencies.
7. Finish with clean pushed develop, no owned temporary runtime artifacts and a concise outcome describing what changed, why, how it was verified, actual metrics and remaining scope.

Stage 5 is complete when native production and the architecture/retirement/release/budget contracts above are verified and recorded. Native DEV is a Stage 6 obligation. Owner manual play is not a gate under the latest instruction.

## Work package G — separately verified dead-code cleanup after closure

The owner explicitly emphasizes unnecessary-code and bridge removal. After the immutable Stage 5 closure, continue that already authorized cleanup as small separate changes, preserving the closed release evidence and tracking the new cleanup checkpoint.

Audit candidates include the legacy InventoryUI/saveBuild API in `src/ui/ui.js`, unread fish profile helpers, BuffManager, unused gameplay-bridge methods, obsolete placeholders and remaining tooling. Candidate names are leads, not proof. Absence of a construction site alone is insufficient: a latent classic API, DEV reader, fixture, build projection or evidence dispatcher may still hold the code.

For each removal:

1. Search all authored source, production imports, retained DEV/classic surfaces, tests, build/release mechanisms and live evidence dispatch. Identify actual reads, writes, constructor/method callers, globals, reflective keys and registration paths.
2. Prove zero remaining consumers, or migrate the actual consumer to the canonical implementation first without changing its behavior. If it depends on native DEV conversion, record an exact Stage 6/7 condition rather than expanding Stage 5 into that migration or deleting required compatibility.
3. Delete the unused code and redundant bridge/activation/placeholder completely when safe. Do not retain empty wrapper files, redundant exports, unused managers or a new permanent compatibility API to preserve the appearance of the old structure.
4. Keep state/config ownership and save format intact. Do not remove a derived cache without verifying timing/performance/identity implications. Do not change gameplay/camera APIs or formulas under a cleanup label.
5. Preserve historical evidence and archive recovery. Update only live manifests/registries/projections whose current contract actually changes; do not rewrite historical releases or widen debt/baseline exceptions.
6. If an obsolete source-shape assertion blocks removal, replace it in the existing check with meaningful current behavior/ownership coverage. Do not delete coverage or force implementation details into production to satisfy an obsolete fixture.
7. Run affected focused tests and game-cycle, Quick and Architecture. At each stable cleanup checkpoint run uncached Full and automatic built-in browser production/DEV acceptance without owner participation. Record the actual code/bridge reductions and any justified additions.
8. Commit/push each cohesive cleanup. Keep utils below its ceiling and avoid unjustified source growth. Report retained code with exact consumers and future removal triggers, rather than saying cleanup is complete while known candidates were not audited.

Cleanup is complete when audited unreachable code is removed, legitimate survivors have concrete consumer/removal conditions, all required automatic checks/browser scenarios pass, behavior is preserved, and the repository is clean and pushed with accurate remaining-work documents.

## Execution discipline and final checklist

Use `rg`/`rg --files` first. Inspect before redesigning. Keep parallel work read-only or assign disjoint file ownership; no source edits during acceptance. Reuse current helpers/checks instead of duplicated catalogs, per-cluster scripts or a new orchestration layer.

Preserve existing mixed CRLF/LF source bytes. Do not stash, mass-normalize, indiscriminately resave or checkout-reset migration sources. Use targeted edits and PowerShell fail-fast handling; inspect every command result. Temporary reports belong outside source. Do not blindly replay old Temp scripts that assumed obsolete numeric cluster order or browser/config facts.

- [ ] Native production remains independent, canonical and behavior-preserving.
- [ ] Every retained bridge/activation/transport has actual consumers and a valid removal trigger; every proven redundant one is removed.
- [ ] Historical tooling archival is applied and verified; 64 live checks and evidence dispatch remain.
- [ ] utils <= 70,358 lines; src/utils changes are measured and justified; no unnecessary framework or wrappers.
- [ ] Boundary-tool decision and strict guard coverage are recorded.
- [ ] Stage 5 release projection, metadata, closure record/tags and English Stage 6 handoff agree.
- [ ] Game-cycle parity plus Quick/Architecture/uncached Full and built-in browser acceptance are performed automatically.
- [ ] Post-closure dead-code cleanup is separately audited, applied where safe, tested and documented.
- [ ] No gameplay/save/state/API/timing/performance redesign is hidden in migration or cleanup.
- [ ] Clean pushed develop; no owned server, tab or temporary runtime fixture; truthful evidence and remaining work.
