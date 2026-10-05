# Current owner decision: native production now; native DEV in Stage 6

Current verified progress (2026-10-05): work package B tooling archival is complete.
262 obsolete utilities / 25,470 lines and the unused three-line import were removed;
utils now 216 JS/JSON files / 46,324 lines, src unchanged at 810 / 82,056.
Quick 24/24, Architecture 32/32 and uncached Full 64/64 passed with identical
game-cycle stdout; native and retained DEV browser acceptance passed, one loop,
zero console issues, identical gameplay controls/saves/reload and complete cleanup.
Exact working bytes are recoverable at pushed tag stage5-tools-archive.
Evidence: tooling_archive_applied.json and ../../archive/stage5_tooling_archival_{acceptance,browser}.json.
Next: packages A/C/D/E/F, then separately verified G; Stage 5 release/closure remains pending.

Current execution authority (2026-10-05): the owner requests autonomous completion under
`stage5_next_chat_spec.md`, including verified post-closure cleanup. Re-observed develop
`a3e2551` matches origin/develop; native graph 350 modules / 521 imports; current
utils 71,797 lines. These are read-only starting facts, not acceptance of future edits.

Stage 5 delivers full index.html -> game.entry.js -> Production Bootstrap, with
no DEV/compatibility runtime/legacy loader. dev.html retains exact classic/IIFE
startup until Stage 6 delivers dev.entry.js and retires its old transport.
Enabled Fixed Catch/GodMode effects remain injected production dependencies.
Diagnostic overlay/render/watchdog may be explicitly absent and must satisfy their
contracts when supplied. Graph v8 is authoritative for the revised 028 browser scope
and Fixed Catch prerequisite 030; prior graphs and completed evidence remain historical
provenance. All architecture/save/state gates remain unchanged. See
`native_production_owner_decision.md`.

The current next-chat execution brief is [stage5_next_chat_spec.md](D:/dev/code/cyber-fishing/architecture/migration/stage_5/stage5_next_chat_spec.md). It details Stage 5 closure and subsequent proven cleanup. The owner's 2026-10-05 instruction requires autonomous game-cycle and built-in browser acceptance without owner participation; historical pending-manual-play statements are not new completion gates.

# CyberFishing: Stage 5 continuation execution specification

Date: 2026-10-05. Language: English. Workspace: `D:\dev\code\cyber-fishing`.
Implementation resumed from the historical handoff below. The owner has now explicitly
chosen native production in Stage 5 and native DEV in Stage 6. Finish Stage 5, verify
the overall architecture goal, then
perform the separately authorized dead-code removal and final cleanup. Do not start
from the older cluster-012 handoff and do not repeat completed migrations.

## Read and verify before editing

1. The owner's development instructions and local `CLAUDE.md` / `CODEX.md` if present.
   Those local files are excluded from Git and must never be committed.
2. `refactor_Task.txt`, this specification and `plan_v2.md`.
3. Authoritative `graph_review_v8.json`, `native_production_owner_decision.md`, applied
   Stage 5 cluster/preparation records and 028 nativeProduction checkpoint. Clusters
   027/030 and native production are complete; original DEV source 028 remains Stage 6.
   Previous graph versions remain immutable provenance.
4. The original acceptance requirements in `../stage_4/stage5_handoff.md`, architecture
   policy/Manifest, guard registries, `../stage_3_compatibility_runtime.json`, and the
   closed Stage 4 release/closure records. Do not reopen Stage 3/4 history.
5. `utils/testing/CHECKS.md` and existing cluster, evidence, cumulative runtime and
   release implementations. Reuse the existing mechanisms instead of another framework.

Check `git status --short`, branch and HEAD, then compare with origin/develop. The
committed production/migration checkpoint is
`aac62f615e1e709460680e7eab71b861871d9c1b` (native production cutover, already pushed).
Preparations 027–029 complete substeps 028.1–028.5; Stage 5 closure is still pending. The original
handoff base `a66eee5dcf7e719ca7dde7e061047bce8c2267ce` and its lifecycle fixture
remain historical provenance; do not use that base as the current implementation state.

## Current continuation checkpoint: native production verified; Stage 5 closure pending

Commit `aac62f6` delivers index.html -> game.entry -> Production Bootstrap with one
canonical ESM graph/config/context and injected Fixed Catch/live GodMode dependencies.
The former index.html is retained byte-for-byte as classic/IIFE dev.html; native DEV
and retirement of its old transport remain Stage 6. Preparation 027 accepted gameplay
overrides/optional diagnostic contracts; preparation 028 accepted dual-page tooling;
preparation 029 records the native startup composition and browser cutover. The
original Development Bootstrap source in cluster 028 remains deferred with null
output/verification; nativeProduction is a separate verified checkpoint, not a body
parity claim or an additional applied migration cluster.

Quick 24/24, Architecture 32/32 and uncached Full 64/64 passed, zero cached/failures/
isolation violations, with one unchanged frozen source snapshot:
`98ed225a3598aa8e5a1ca10ad66cd9b34613efb84f09c6973e8faa93c153f86d`.
Full ran 2026-10-05 03:24:06–03:24:42 UTC on HEAD `194da01` plus the pending native
cutover; the report precedes archival, final preparation evidence and these informational
checkpoint edits. Report: `../../archive/stage5_native_production_cutover_acceptance.json`.
The semantic game-cycle digest remains
`0db62de21427af5589fa5294b53dd833522298356d1d6b7a6ce0a009f2782c6f`.

Browser acceptance: Codex automated substitute checked actual native index and retained
DEV separately. Production: 16 identity/config facts, no DEV globals or compatibility
runtime, absent watchdog, one loop, zero duplicate starts/warnings/errors. DEV: nine
identity/config facts, retained classic/IIFE, one loop, zero duplicate starts/warnings/
errors. Native 50 gameplay button texts match DEV 52 after its two leading diagnostic
controls are excluded; three save strings match between pages and after reload. The
standard dev-server rebuild/start passed after a transient generated-directory lock
was released. Tabs/server stopped and ignored fixtures removed; full owner play remains
pending. This certifies startup/config/render/inventory/save smoke; gameplay effects
also have focused fish-rarity/game-cycle coverage, not a claimed full manual session.

Totals: 29 applied clusters / 102 recorded ESM targets, preparations 001–029, label
5.29. Retained DEV runtime: 28 active / 380 retired / 7 inert, 53 bridges, 852 historical
globals and 24 debts. Four native startup modules are preparation 029 additions;
release remains 0.25.2. Next: exact retirement reconciliation, boundary-tool evaluation,
utils budget, reviewed release projection/closure/tag and English Stage 6 handoff.

## Historical continuation checkpoint: 030 complete; 028 in preparation

Preparation 026 records the owner's native production / Stage 6 DEV decision under
graph v8. Cluster 030 then moved the existing injected `FixedCatchFishFactory` intact
to `src/game/application/fishing/fixed_catch_fish_factory.js`. API parity digest
`0940ece9dd18106ed1df3393bf245b202797a3cae84b038d7ae34410631bce91` and the
semantic game-cycle digest are unchanged. Quick 24/24, Architecture 32/32 and
uncached Full 64/64 passed, with zero failures/cache/isolation violations and unchanged
source. Report: `../../archive/stage5_030_fixed_catch_acceptance.json`.

Browser 030: Codex automated substitute on the actual current classic DEV graph,
five Game/Root/Fixed Catch/CONFIG/context identities, one loop, zero warnings/errors,
64 currently visible button texts and three save strings identical after reload.
This did not certify native production startup. Tab/server stopped and temporary
fixture removed; owner play pending. Totals at that checkpoint: 29 applied clusters /
102 ESM targets, preparations 001–026, label 5.29, 28 active / 380 retired / 7 inert,
53 bridges, 852 historical globals and 24 debts; release remains 0.25.2.

The next step at that checkpoint was optional diagnostic contracts and policy-selected
legacy tooling, followed by production entry/Bootstrap and separate native/retained DEV
acceptance. Preparations 027–029 now complete that work. Stage 5 native production is
verified; Stage 6 native DEV remains an explicit completion obligation.

## Historical continuation checkpoint: 027 complete

The new session applied Game 027 through the existing stage-qualified mechanism.
Its immutable API parity capture and real-Game lifecycle fixture passed; class member
bytes and traced calls, readiness/receiver/return/error identities, early no-op behavior
and the semantic game-cycle digest are unchanged. Quick 24/24, Architecture 32/32 and
uncached Full 64/64 passed with zero failures/cache/isolation violations and unchanged
source. Report: `../../archive/stage5_027_game_acceptance.json` (source HEAD 4793948
plus the pending 027 migration; before informational checkpoint/evidence edits).
Browser: Codex automated substitute, 27 export identities, nine config facts, one loop,
zero warnings/errors, 52 inventory button texts and three save strings identical after
reload. Tab/server stopped and temporary smoke fixture removed; owner play pending.
Totals at that checkpoint: 28 applied clusters / 101 ESM targets, label 5.28, 27 active / 380
retired / 7 inert, 52 bridges, 852 historical globals, 24 debts; release 0.25.2.
The Game activation/bridge is held by classic Development Bootstrap until Stage 6.
Its next step was native production startup and canonical browser cutover design/implementation.
The original checkpoint below is retained as provenance; do not recapture/reapply 027.

## Historical saved visual-field audit checkpoint

Audit on runtime base `6429876b7bb1c208eb6e3fa80daa8ab0502330e5`: all four historical
top-level rating/power color/gradient fields are excluded by the current raw factory,
V2 mapper, legacy/current/previous-schema normalization and stacking/signature
writers. No additional save-schema transition is needed; no production or save
timing change was made. Existing item-progression and migration scenarios now cover
those fields and source-fact preservation under schemas 2/3/4. See
`saved_visual_fields_audit.md`. Quick 24/24, Architecture 32/32, uncached Full 64/64,
zero failures/cache/isolation violations and unchanged source. Full report:
`../../archive/stage5_visual_field_audit_acceptance.json`, 2026-10-04
19:27:38–19:28:17 UTC; source HEAD 6429876 plus pending test additions/audit/proposal,
before informational checkpoint/evidence edits. Native topology was still a pending
owner choice at that audit. The current owner decision and graph v8 now supersede
the earlier loader proposal; the audit itself did not apply a cutover.

## Historical original verified checkpoint

| Fact | State at the original handoff |
| --- | --- |
| Release | 0.25.2; no Stage 5 release or closure/tag |
| Migration label | 5.27 (27 applied Stage 5 clusters) |
| Stage 5 migrations | 001–026 plus prerequisite 029; 100 ESM target modules |
| Preparations | 001–025 complete |
| Next migration | 027 Game, tier B; output/verification still null |
| 028 original source | Development Bootstrap deferred to Stage 6; native production cutover still required in Stage 5 |
| Runtime | 26 active / 380 retired activations, 7 inert modules |
| Compatibility | 51 bridges; 852 historical global-provider baseline entries |
| Known debts | 24 |
| Latest guard corpus | 800 actual modules, 760 confirmed edges |
| Domain | 139 modules, Domain/Engine imports only; no forbidden/free globals |
| Shared Stage 4/5 ledger | 63 applied clusters, 196 ESM targets |

The native Root is `src/bootstrap/production/game_composition_root.js`, importing
153 reviewed named dependencies. It has no direct DEV/raw-config/browser-global
dependency. Its config and browser/DEV capabilities come from constructor ports.
Its four inventory loaders retain the original serial await order. The actual
DEV factories and watchdog remain in classic `src/app/script.js`.

`GameApplication` and its four existing facades are native Bootstrap declarations.
Their exercised hot-loop/member/allocation traces remain equal to the frozen 025
evidence; the Root's 026 hot-loop and save-round-trip evidence also passes.
`SeededRng` is native Engine (`src/engine/random/seeded_rng.js`), migrated as 029
before 026. Graph v7 preserved 001–028 membership and this execution order at the
original handoff. Current graph v8 additionally places prerequisite 030 before cutover
028; never assume numeric order equals migration order.

Loadout clock propagation is already complete in preparation 017. Production paths
pass the existing clock through create/restore/reconstruction/migration. Original
truthy timestamp preservation, read counts and public Date fallback remain intact.
Do not redo it or remove the compatible optional fallback opportunistically.

## Historical original handoff acceptance

The newly preserved real-Game fixture is
`utils/testing/runtime/game_facade_test_composition.js`, called by the existing
`utils/inventory-lifecycle-check.js`. It verifies one build/readiness promise, original
canvas and receivers, awaited start, false/true return forwarding, void stop/dispose,
early no-op semantics, sync build values/throws and async rejection/error identity.
It uses `SourceRuntime` and will follow the recorded target when 027 migrates.
No production API or behavior changed in this checkpoint.

Quick: 24/24. Architecture: 32/32. Full: 64/64, all executed, zero cached/failures/
isolation violations, source unchanged. The complete pre-commit Full report is
`../../archive/stage5_026_game_facade_acceptance.json`; its source commit is a66eee5
and its source snapshot includes the pending lifecycle fixture changes. It ran
2026-10-04 16:54:37–16:55:16 UTC. The report predates these informational handoff
edits; it must not be described as a run against the later committed documentation.
The focused inventory-lifecycle and frozen 025 hot-loop comparisons also passed.

Browser evidence at the original handoff is in 026's verification: Codex automated
substitute, 26 export identities, nine config/version facts, one active game loop,
zero warnings/errors, identical 52 inventory button texts and equipment/inventory
save strings after reload. ITEM_DB's GameConfig facade is the exact raw owner object;
the retired SLOT_CONFIG global is absent and its native config export remains usable.
The production game-cycle digest remains
`0db62de21427af5589fa5294b53dd833522298356d1d6b7a6ce0a009f2782c6f`.
Runner stdout hashes are separate values and may include timing; do not confuse them
with this semantic game-cycle digest.

Owner manual play remains pending for Stage 3 batches 046–051 and the Stage 4 list:
cast/hook/fight/land/line-break/chum, equipment/refill/loadouts, rarity/progression,
long press, input transitions, pause/resume and reload. Existing authorization:
“якщо game-cycle-check.js проходить дозволяю пропустити візуальну перевірку і в PASS
написати данні з перевірки якщо game-cycle-check.js  якщо треба можеш додати деякі
сценарії які критично важливі”. Record Codex as performer; never claim the owner played.

## Historical completed cluster 027 recipe — do not rerun capture/apply

Preserve `src/app/game.js` exactly plus the reviewed export/provider relocation to
`src/bootstrap/production/game.js`. It owns readiness and forwards to the injected
application; it must not regain hidden Root construction or DEV/browser dependencies.
Early dispose currently does not cancel pending build or queue disposal. Preserve
that behavior during migration, even if a later lifecycle change might be desirable.

Capture API evidence once before apply:

```powershell
node utils/architecture/stage-4-evidence.js --stage 5 --cluster 027 --kind api-parity --classes Game --scenarios utils/inventory-lifecycle-check.js --capture
node utils/architecture/stage-4-cluster.js --stage 5 --cluster 027 --step plan
node utils/architecture/stage-4-cluster.js --stage 5 --cluster 027 --step apply
node utils/architecture/stage-4-cluster.js --stage 5 --cluster 027 --step verify
```

Read actual record/output before staging. Do not stage generated ignored dist files
listed in transition outputs. Run focused + Quick + Architecture + uncached Full and
browser smoke, update checkpoint facts, commit and push this migration separately.

## Native startup and canonical browser graph: implemented contract

Preparation 029 implements the owner's two-page decision recorded in graph v8.
Preserve this contract through closure and Stage 6; do not repeat the cutover:

```text
index.html -> game.entry -> Production Bootstrap -> Engine / Game / Platform
dev.html   -> existing classic scripts + IIFE                  (until Stage 6)
Stage 6: dev.entry -> Development Bootstrap -> production modules + DEV
```

Production has one native module graph and one authoritative owner of each config
and mutable state fact. It must neither instantiate the compatibility IIFE nor reach
DEV, compatibility transport or legacy-loader code. Separate page realms have separate
runtime instances; this requirement does not mean shared writable objects between
production and DEV pages. In Stage 6 DEV imports the authored production modules.

Deliver `src/entrypoints/game.entry.js` importing only production Bootstrap. Replace
the entire current `index.html` script list with that single module entry and preserve
the current classic/IIFE startup intact in `dev.html`, including URLs, evaluation order
and split slots. No new legacy loader or temporary mixed runtime. Required Fixed Catch
remains injected production Application behavior. The injected stateless GodMode
reader reads the sole CONFIG and preserves current flag/default/value semantics; it
does not own another config or depend on DEV.

Optional diagnostic overlay/render/watchdog may be absent under explicit contracts.
Validate supplied factories/results and coherent collaborator groups, retaining valid
DEV call order, receivers and behavior. Analyze actual calls/default behavior before
omission; do not create fake no-op diagnostics to conceal required gameplay effects.
Domain/Application continue to use injected config/ports and have no browser or DEV
dependencies. DEV-only tools remain in the retained classic composition until Stage 6.

028 completed through these bounded substeps and recorded acceptance. They refine
the cutover work and are not new migration clusters:

| Substep | Deliverable / completion condition | Status at this checkpoint |
| --- | --- | --- |
| 028.1 | Required injected gameplay dependencies: Fixed Catch and stateless GodMode reader; enabled effects and CONFIG identity preserved. | Complete: Fixed Catch 030 and preparation 027 accepted. |
| 028.2 | Explicitly optional diagnostic contracts with malformed-input coverage, valid DEV equivalence and absence coverage. | Complete: preparation 027 accepted. |
| 028.3 | Policy-selected legacy document for build/VM order and separate native production graph/page validation, with meaningful negative fixtures. | Complete: preparation 028 accepted. |
| 028.4 | Coherent atomic production Bootstrap/entry/index cutover plus exact retained classic/IIFE dev.html. | Complete: preparation 029, commit aac62f6. |
| 028.5 | Focused evidence, Architecture, Quick, uncached Full, native production and retained DEV browser acceptance, gameplay and save/reload checks. | Complete: preparation 029 acceptance; owner manual play pending. |

028.1/028.2 share accepted preparation 027 with distinct results; preparation 028
accepted tooling and preparation 029 delivered the atomic cutover. Preserve the
separate original DEV-source deferment, applied counts and absence of a new loader.

The compatibility transport and exact surviving DEV bridges/activations must receive
reviewed Stage 6 retirement conditions before Stage 5 closure. Current metadata still
assigns the retained transport, 14 bridges and 11 activations to Stage 5; reconcile
actual holders and exact conditions without changing their export/global surfaces. Preserve any separately
justified Stage 7 survivor with its exact consumer/removal condition. Retention for the
DEV page does not make transport a production dependency. Remove the old DEV transport
after Stage 6 migrates every listed consumer; do not erase it while classic DEV needs it.

Review these retained activation phases before changing script topology:

- `src/config/config.js`: attach rarity visual and degradation catalogs; define the
  nonenumerable fightPhysicsConfig adapter; create the sole config context/base/store/
  provider; preserve the existing conditional CYBER_FISHING_CONFIG_RUNTIME alias.
- `src/ui/legacy/engine_interface_activation.js`: preserve eager styles/listeners,
  interface exceptions, contextmenu/touch behavior and original activation timing.
- `src/config/project_version.js`: preserve the conditional version alias identity.
- `src/ui/version_badge.js`: preserve DOMContentLoaded once versus immediate mounting.
- `src/app/script.js` plus `BrowserGameLifecycle`: prior cleanup, Root/Game creation,
  publish game, awaited start, watchdog create/start/publication, idempotent pagehide
  cleanup, original error logging and final storage-usage output. Watchdog creation
  remains in retained DEV; native production may omit it by the approved diagnostic
  contract while preserving game lifecycle cleanup.

Graph v8 retains these activation follow-ups in native cutover. Deferring the original
DEV Script in 028 does not waive them. The page topology is now approved; inspect
actual consumers and record implementation reasoning and meaningful negative fixtures
before apply. Preserve the retained DEV document's classic evaluation order,
lexical/global surface, receivers, errors and strict-mode-sensitive behavior. Preserve
production activation conditions and lifecycle semantics through Bootstrap/Platform;
document natural module-loading timing instead of simulating classic script events.
No runtime dependency scanner, eval/new Function, new global API or script loader.

The cumulative runtime builder rejects dynamic imports inside selected native IIFE
modules. A prior trial moving the inventory loaders into native Inventory Bootstrap
passed guards/tests but failed the real dev-server build and was fully reverted.
The committed DEV solution keeps the original dynamic imports as injected cold
callbacks in classic Script. Native production supplies equivalent canonical native
loader callbacks from production composition, preserving the serial await order.
Do not restore the rejected inventory-IIFE trial. The strict import-relocation ledger
records exact before/after edges and rejects unverified replacements.

Test native production boot separately from DEV boot. Verify canonical Root/Game/App
constructors, CONFIG/ITEM_DB/SLOT_CONFIG/context identity, live overrides where
supported, exactly one loop, inventory open/close/input/pause/cleanup, badge/styles,
zero console warnings/errors, save strings and reload. Legacy IIFE VM tests alone
cannot certify native browser identity or startup.

## Architecture verification, closure and cleanup

Use `plan_v2.md` for the ordered checklist. Re-audit actual readers/writers and
dependency direction, including production independence from DEV and config/transport
globals in Domain/Application. Each mutable fact must keep one authoritative owner;
UI/debug/render remain readers. Retire exact bridges only after every classic holder
is gone, including DEV. Keep legitimate survivors with explicit Stage 6/7 conditions.

Saved visual-field audit completed: current item factory/V2 snapshot mapper and all
verified old/current/previous-schema writers, readers, stacking/refill/signatures and
migrations already exclude the four historical top-level derived fields. No separate
save transition is necessary; see `saved_visual_fields_audit.md`. No silent
save-field/schema change may be bundled into an ESM cluster.

After native startup, evaluate dependency-cruiser or eslint-plugin-boundaries as agreed.
Retain existing guards unless replacement proves equivalent or stricter enforcement.
No baseline/debt/whitelist expansion to make tests pass and no removal of live checks.

At the saved visual-field audit checkpoint the utils budget was not satisfied:
478 JS/JSON files, 71,303 newline-counted lines including the added visual-field
scenarios, versus the Stage 4 M2 ceiling of 70,358 (+945). Native-cutover tooling
growth must be reconciled; this historical count is not acceptance of the current tree.
At the native checkpoint: 478 JS/JSON files / 71,797 lines, 1,439 above the ceiling.
Measured with the release metrics method (`git ls-files`, JS/JSON, newline count).
The lifecycle fixture is already tracked; these new scenarios add 24 lines. Recheck
after each milestone. Offset growth through proven unreachable tooling or justified
consolidation; preserve the 64 live checks and immutable evidence. Do not restore
archived Stage 3 replay/planning checks. Stage 5 closure must meet the agreed budget.

Update the current release projection through the existing mechanism with strict
fixtures; historical Stage 4 release pins remain immutable. No Stage 5 release record,
version bump or tag exists yet. Review the existing mechanism's stage-qualified release
selection, native version source, both page queries and metrics before applying a release. Reconcile scope/metrics/plans, execute acceptance, create the
reviewed release/closure/tag, and write an English Stage 6 handoff with remaining work
and automatic Codex acceptance; historical owner play is not a closure gate. A release name/version must come from the reviewed record.

After Stage 5 is completed, perform the owner's authorized dead-code/final cleanup as
separate reviewable changes. Candidates to audit, not automatic deletion permission:
unused legacy `src/ui/ui.js` InventoryUI/saveBuild API, unread fish profile helpers,
BuffManager, unused gameplay-bridge methods and obsolete tooling/placeholder paths.
Check production, DEV, tests, static checks, build projections and historical pins.
Do not erase required Stage 6/7 compatibility or alter gameplay/camera APIs under
cleanup. Replace obsolete source-shape tests only with meaningful current behavior
coverage. Final state: required checks/browser pass, no task-owned temporary runtime
artifacts, clean working tree, pushed develop and accurate remaining-work documents.

## Workspace and verification protocol

Use PowerShell fail-fast native command handling. Preserve mixed CRLF/LF bytes;
never stash, normalize, mass-resave or use checkout -- on migration sources. Package
changes are restricted to reviewed release version fields. One cohesive preparation,
migration or cleanup per commit; push develop under existing authorization.
Do not edit project files during acceptance. Local resume files stay excluded.

```powershell
node utils/run-checks.js --suite quick --no-seal --report <absolute-temp-report>
node utils/run-checks.js --suite architecture --no-seal --report <absolute-temp-report>
node utils/run-checks.js --acceptance --report <absolute-temp-report>
git -c core.whitespace=cr-at-eol diff --check
```

`--quick` does not select Quick; use the exact suite flags above. Full must execute
all 64 current checks with zero cached/failures/isolation violations and unchanged
source. Close task-owned game tabs/DevTools and stop the server before rebuilds:
Windows browser handles can lock dist. Failed builds may remove legacy placeholders;
`node utils/build/build_stage_3_compat_runtime.js` restores them. Running only
build_legacy_bridges.js does not restore the retired placeholder set.

Use SourceRuntime/StageThreeCompatibilityTestLoader for classic tests against native
targets. Load the runtime once per realm; request retired/inert exports explicitly
test-only instead of reactivating production globals. Production SLOT_CONFIG's global
absence after 026 is expected. Browser harnesses must await game publication before
inspection because Script has a cold import before publication.

No task-owned dev server or game tab remains open. The ignored browser smoke fixture
was removed. Temporary scripts under the prior session's Temp directory are not
authoritative deliverables and must not be blindly rerun: several assume an obsolete
contiguous numeric prefix or older config-fact counts. Reconstruct required harnesses
from the current production/DEV documents, contract and committed evidence. Agent
coordination follows the live session instructions; the former handoff's local
coordination notes do not override current session rules.
