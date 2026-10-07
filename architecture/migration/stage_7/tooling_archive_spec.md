# Stage 7.1 — native test paths and compatibility tooling archive

Written: 2026-10-07 (Europe/Kiev). Implementation baseline: pushed `v0.27.2`,
`e80d983ba8b9c891c2e504115a1f39cbfe22ab70`. D1-D4 and the patch release are complete.
This specification covers the first Stage 7 transition only; it does not reopen Stage 6.

Status: preparations 001 and 002 accepted; the exact three-check catalog change awaits the owner's decision.
Canonical test paths/config composition: [001_native-test-paths.json](preparations/001_native-test-paths.json),
[uncached Full 64/64](../../archive/stage7_native_paths_acceptance.json). Raw recovery tag
`stage7-compat-tools-archive` -> `aeb43037f4d4963cc4b8ccabfcb2bc96b6ab1cd0`, parent `a33c7ca`.
Preparation 001 changed no runtime/HTML/package/catalog. Preparation 002 (2026-10-08):
[native server/fresh installer](preparations/002_native-server-and-fresh-install.json),
[uncached Full 64/64](../../archive/stage7_native_server_acceptance.json),
[direct native browser smoke](../../archive/stage7_native_server_browser.json). Server validates native retirement
before listen; fresh install verifies native sources without classic dist/builders. Remaining live validator
consumers are the next preparation; no check/tool archive or closure claimed.
Inventory: [tooling_archive_inventory.json](tooling_archive_inventory.json). Current queue and
owner rules: [stage_7_handoff.md](../stage_7_handoff.md). Accepted release evidence:
[Full 64/64](../../archive/pre_stage7_0272_acceptance.json),
[native browser smoke](../../archive/pre_stage7_0272_browser.json).

## 1. Scope and invariants

Remove classic test-path indirection and history-only compatibility builders/checks after moving
their live consumers to explicit native or provenance contracts. Production and DEV source modules,
formulas, APIs, config policy, timing, save bytes/schema, gameplay effects and runtime identity remain
unchanged. No gameplay refactor, EOL normalization, API rename, package-script change, new global,
new boundary exception or historical evidence rewrite belongs to this transition.

Baseline: production 350 modules / 522 import edges; DEV 446 / 692; Manifest 454 JS modules.
Active bridges, activations, inert modules, side-effect reviews, debts and global providers are zero;
380 retired activations remain immutable provenance. The catalog contains Full 64, Quick 24,
Architecture 32 and gameplay 12. The inventory scans 218 `utils/*.js` files recursively; this differs
from the existing JS/JSON utility metric and is not a replacement for its milestone budget.

Authoritative config policy after D4: both production masters are false, DEV initializes both true
before base freeze, reset restores DEV defaults and restart preserves overrides in the same context.
Retain all existing focused D1-D4 regressions. Game-cycle stdout SHA256 must remain
`0db62de21427af5589fa5294b53dd833522298356d1d6b7a6ce0a009f2782c6f`.

## 2. Exact catalog proposal

Archive only these three check definitions and their source files:

| Check ID | Source | Current suites |
| --- | --- | --- |
| `stage-3-compatibility-runtime-fixtures` | `utils/architecture/stage-3-compatibility-runtime-fixture-check.js` | Architecture |
| `stage-3-runtime-load-order` | `utils/architecture/stage-3-runtime-load-order-check.js` | Quick, Architecture |
| `stage-3-activation-retirement-fixtures` | `utils/architecture/stage-3-activation-retirement-fixtures-check.js` | Quick, Architecture |

Result after approval and removal: Full **61**, Quick **22**, Architecture **29**, gameplay **12**.
Do not add a replacement catalog entry merely to preserve the old count. Transfer current-runtime
assertions into the existing native/records checks before removing their former hosts.

Retain `approved-stage-2-batch-freeze`, `legacy-slot-split`, both legacy symbol-provider checks and
both external-consumer checks. Their reviewed metadata, tombstones, scanner fixtures and current
workspace assertions still guard native architecture. Retain every gameplay, package, native ESM,
Domain boundary and Stage 4-6 release/closure check. Names alone do not establish obsolescence.

If the owner keeps the catalog at 64, do not delete these three files or the builders they still use.
Native path and live-consumer preparations may proceed independently, with the unchanged catalog.

## 3. Eleven build-tool candidates and retained responsibilities

These are candidates, not a declaration that they are already unreachable. Exact current bytes,
exports and literal incoming `require` edges are recorded in the inventory:

1. `utils/build/build_legacy_bridges.js`
2. `utils/build/build_stage_3_compat_runtime.js`
3. `utils/build/legacy_bridge_build_config.js`
4. `utils/build/compat_runtime/activation_retirement.js`
5. `utils/build/compat_runtime/activation_shim.js`
6. `utils/build/compat_runtime/cumulative_graph_planner.js`
7. `utils/build/compat_runtime/cumulative_runtime_builder.js`
8. `utils/build/compat_runtime/cumulative_runtime_contract.js`
9. `utils/build/compat_runtime/cumulative_runtime_load_slot.js`
10. `utils/build/compat_runtime/cumulative_runtime_output_manager.js`
11. `utils/build/compat_runtime/cumulative_side_effect_gate.js`

Move a cohesive pure validation responsibility only when a live consumer needs it. Preserve its
body, canonical serialization, ID/hash semantics, errors and negative cases. Do not retain a new
builder facade or load executable builder modules from Git archives at runtime. Frozen JSON and
the existing raw archive reader may supply historical facts; they must not weaken their validation.

| Live consumer | Required final responsibility |
| --- | --- |
| `utils/dev-server.js` | Validate current native retirement and absent generated outputs, then serve native files; remove both builder invocations. Preserve startup failure handling, MIME, methods, paths and cache headers. |
| `utils/architecture/verify-fresh-package-install.js` | Isolated fresh npm ci verifies current native output absence and native sources, without a removed build command or attempting to read missing classic dist files. |
| `stage_four/esm_target_projector.js` | Keep the complete `ModuleEvaluationEffectObserver` and its current module-evaluation rejection behavior; this is an active ESM guard. |
| `stage_six/native_development_retirement.js` | Keep schema, canonical bridge/activation identities, exact raw archive pins, source absence, current target identity and all zero-live-registry assertions. |
| `stage_four/cluster_ledger.js`, `domain_batches/stage_three_batch_execution_plan.js` | Preserve deterministic bridge/activation identity and historical ledger validation. |
| `classification/approved_stage_two_batch_validator.js`, `migration/stage_two_runtime_script_alias_resolver.js` | Preserve reviewed-prefix closure and exact alias metadata validation; do not drop the live freeze and scanner gates. |
| `stage_four/cluster_path.js` | Separate current native projection/verification from obsolete classic output/shim building. Review its dynamic compatibility-builder command as well as static imports. Historical record verification stays exact. |
| `stage-4-cluster-records-check.js` | Retain reconstruction/hash assertions and every Stage 4-6 release/cleanup/native closure fixture; separate provenance validation from build machinery. |
| `package_contract/root_package_validator.js` | Keep the explicit rejection of retired package scripts; remove an obsolete command branch only after proving no live contract uses it. |

Preparation 002 resolved the fresh-install helper's historical dist-path read. Its source copy retains
isolated raw recovery refs/objects for strict provenance guards, with no source checkout/filtering,
shared writable Git directory or generated outputs. Native preflight and actual fresh npm ci/suites
pass; the existing 0.27.2 release record stays immutable.

## 4. Assertions that must survive the three-check archive

| Existing host | Preserve in live native/records checks before removal |
| --- | --- |
| Runtime load-order | `dev.html` has exactly one external native module entry, no classic/transport/activation source and no executable inline startup. Keep equivalent production-page assertions. |
| Activation retirement fixtures | Native retirement is valid; active/inert/side-effect lists are empty; retired identities and archived source hashes match; removed classic sources remain absent; unknown or altered archive pins fail. |
| Compatibility runtime fixtures | The evaluation observer rejects unsafe authored module effects and preserves allowed declaration behavior. Retain any case used by current native projection; archive only classic bundle/activation/transaction cases. |

Every transferred assertion gets an original-to-new mapping in the applied evidence. A passing
smaller Full is insufficient if a live rejection case disappeared. Do not edit old evidence files
or update a whitelist/baseline to make the archive pass.

## 5. Native test-path preparation

Audit actual `SourceRuntime`, `NativeEsmTestLoader` and
`StageThreeCompatibilityTestLoader` consumers. Replace deleted classic source paths with their
canonical authored ESM paths in test load/read operations; historical metadata stays historical.
An alias can map to multiple ESM targets: preserve every target, publication order and needed
export before dropping the alias. A first-target-only string replacement is not equivalent.

Move the special `src/config/config.js` test composition to an explicitly named test helper or
method. Preserve caller-supplied config, visual catalogs, physics adapter/context/store identities,
per-VM isolation and existing fixture publication behavior. This remains a test adapter; production
loads through its native Bootstrap. Do not introduce a second runtime config owner.

Only after all consumers are canonical, remove metadata-built aliases, deleted-path resolution and
the obsolete `StageThreeCompatibilityTestLoader` wrapper. Keep synchronous ESM cache identity,
named `.js` import validation, cycle detection, module stubs, dynamic imports, trace registration
and deliberately missing export behavior covered by existing positive/negative fixtures.

## 6. Execution and recovery order

1. Commit this audited specification/inventory and update task/resume files. Record the exact catalog
   owner decision separately; until it arrives the catalog remains 64.
2. Prepare canonical test paths and explicit test config composition; run focused parity, game-cycle,
   Quick, Architecture and uncached Full on the unchanged 64-check catalog. Separate commit.
3. Decouple live build-tool consumers and retain current-native/provenance assertions with negative
   fixtures. Keep candidate tools/checks available while their old tests still run. Separate commit.
4. Before deletion, create an annotated raw recovery tag `stage7-compat-tools-archive`: record its
   commit/parent and SHA256 of every removed byte blob. Verify recovery through binary `git cat-file`;
   an autocrlf-filtered checkout does not prove exact recovery. Preserve any modified intermediate
   candidate bytes too. Verify absolute deletion paths stay in this workspace.
5. With the exact catalog approval, remove the three definitions, obsolete read-only/cache-policy
   entries and their files, then remove only tools unreachable from all remaining checks, package
   scripts, native server, CLIs and dynamic command consumers. Record any still-needed cohesive
   validator instead of pretending all eleven files can simply disappear.
6. Add an `ARCHIVED_CHECKS.md` entry with check IDs/suites, raw tag and reproduction limits; preserve
   the accepted old 64-check reports. Run the acceptance gates below on one stable source snapshot.
7. Commit/push the accepted transition and replace resume files. A subsequent release uses the
   existing release mechanism and an explicit version decision; this specification invents no
   Stage 7 release number or completed closure.

## 7. Acceptance

- Exact before/after check IDs and suite counts; no dead package/CLI target or incoming build-tool
  dependency. AST literal require inventory is supplemented by dynamic command and path review.
- Retained canonical IDs, source reconstruction/hash checks, unsafe module-evaluation rejection,
  archive-pin negatives, native page/source absence and retirement validation all pass.
- Native test-path parity, config context/adapter isolation and all D1-D4 regressions pass. Game-cycle
  digest stays unchanged; runtime graphs, Manifest, ownership and zero compatibility facts match.
- Native server GET/HEAD/method/path/MIME/startup-failure behavior and isolated fresh npm ci pass;
  package/lock bytes stay unchanged. Fresh-copy verification must not restore dist or dependencies.
- Focused checks, Quick 22/22, Architecture 29/29 and uncached Full 61/61 after approval (24/32/64
  during preparations), zero cached acceptance results, failures, isolation violations or source drift.
- Direct native `index.html` and `dev.html` smoke: production switches off, DEV balance controls,
  one loop, unchanged saves/reload and complete cleanup; zero console errors/warnings. Record the
  actual automated/manual method and limits. Clean owned tabs/server/temporary fixtures afterward.
- Milestone utility file/line accounting includes retained validators and proves the net reduction.
  New evidence is versioned; no old Stage 1-6 source pin, report, history hash or catalog is rewritten.
