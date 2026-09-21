# Stage 3.9.0–3.9.2 — Fish Resolvers preparation

## Scope and current truth

Batch: `stage-3.candidate-009-fish-444e8034`.

Source release remains `v0.24.45`; completed prefix remains `001–008`;
`activeBatchId = null`, `activeBatchPhase` absent. No source/provider, index,
Manifest, policy, runtime registry, build contract or release metadata changes.

| Stage | Artifact | Outcome |
| --- | --- | --- |
| 3.9.0 | `stage_3_batch_009_audit.json` | Exact live dependency/state audit and whole-closure earlier-evaluation proof |
| 3.9.1 | `stage_3_batch_009_execution_plan.json` | Atomic candidate/publish plan, exact consumers, source-tag rollback |
| 3.9.2 | `stage_3_batch_009_test_matrix.json` | Executable classic/native-ESM behavior and compatibility matrix |

The adjacent planning validation record captures actual checks. `verified` in
the matrix describes its contract, not completion of future post-build phases.

## Exact scope

| Classic provider | Named ESM target | Logical position | Legacy consumer |
| --- | --- | --- | --- |
| `src/core/fish/fish_rarity_resolver.js` | `src/game/domain/fish/fish_rarity_resolver.js` / `FishRarityResolver` | 42 | `src/app/bootstrap.js` |
| `src/core/fish/fish_anomaly_variant_resolver.js` | `src/game/domain/fish/fish_anomaly_variant_resolver.js` / `FishAnomalyVariantResolver` | 43 | `src/app/bootstrap.js` |

Two files, two exports, two activations, two bridge relationships, **one distinct
classic consumer file**. Bootstrap injects instances into further consumers;
those DI uses are not additional global-provider bridge records.

No internal or external project dependency edges for either target. No new
config/platform/dev/browser/transport dependency. The eventual expected topology
is derived from the current graph plus the approved batch: `34 → 36` modules,
`35 → 37` activations, `60 → 62` bridges; no isolated IIFE. Counts are batch
acceptance anchors, not global policy constants.

## Earlier evaluation, unchanged exposure

The current sole cumulative runtime is immediately before logical position 86.
The eventual cutover must move that same script immediately before position 42,
derived as the earliest activation across the existing and added contracts.
Do not add a second runtime or expose existing symbols early. Infrastructure
script remains excluded from logical numbering; physical count stays unchanged.

The audit rechecks all 36 source modules: 31 safe, five exact previously reviewed
private WeakMap initializations. Primitive counters and private storage remain
module-local and are initialized once. Class constructors and ordinary methods
do not execute merely because the module is evaluated earlier. Unknown eager
initializers, static effects, superclass dependencies or new imports fail this
batch's conservative gate and require re-audit. The candidate builder must
revalidate all source fingerprints, the actual bundled closure and helper set.

## State and semantics

- `FishRarityResolver`: constructor-owned normalized scalars and a private Set;
  constructor inputs are snapshotted. No module-global cache, setter or shared
  instance state. Resolve produces fresh nested frozen result objects.
- `FishAnomalyVariantResolver`: a normalized none ID and one frozen none-result
  per instance. All none paths reuse that exact object; successful calls produce
  fresh frozen results. Separate resolver instances must not share this cache.
- Mechanical historical owner lists include private method names. They are
  preserved as historical observations, not misrepresented as mutable fields.
- Allocation baselines count static source sites, not allocations per frame.
  AST representation parity forbids adding allocation sites or transport reads.
- Preserve chance comparison `roll >= chance`, range-gap ties favouring the upper
  level, inclusive weight-unit bands, existing coercions, rounding, config
  precedence, result keys, error cases and constructor/cache lifetimes.

## Proof already executable

- 28 explicit behavior cases, run on classic classes and temporary native `.js`
  ESM modules in an isolated local `type: module` boundary.
- Six parity scenarios using the real FixedCatchFishFactory and visual resolver
  with injected classic versus ESM rarity/anomaly instances.
- Exact named exports, AST parity and repeat-import namespace/class identity.
- Simulated full logical timeline using accepted existing runtime exports plus
  temporary new namespaces: every symbol absent before its approved activation,
  equal to its exact export afterwards; all existing activation positions kept.
- Negative contract/effect fixtures, including deliberately mutated chance and
  range-gap formulas that must fail the behavior baselines.
- Source, metadata and generated live output remain byte-identical around checks.

This is **not** evidence that the future 36-module generated IIFE has been built,
that its evaluation counter has been measured, or that batch 009 passed browser
acceptance. Those are required in subsequent stages, not inferred here.

## Next: Stage 3.9.3 — Pre-build Contract

1. Verify this evidence, current source SHAs, release checkpoint and no active batch.
2. Define the exact prebuild transaction and candidate-only metadata topology.
3. Only an explicitly opened `prebuild` lifecycle may mark batch 009 active;
   completed prefix and live topology remain unchanged.
4. Prepare 3.9.4 source/candidate build checks including full-closure early
   evaluation and runtime-position projection. No live shim/registry/index edits.
5. Actual 3.9.5 publication requires a verified candidate and identity/timing
   results; the matrix's prebuild eligibility alone does not authorize cutover.

Multi-file publication is not a filesystem-atomic rename. It needs verified
before-images, a no-partial-serving boundary and restoration of **all** affected
files and the previous valid output on failure. Rollback keeps batches 001–008,
restores runtime placement before 86 and topology `34/35/60`; it never returns to
isolated Stage 2 IIFEs. Proposed release is `v0.24.46`, not released by this work.

`refactor_Task.txt` remains the exact historical v0.24.45 release artifact. This
handoff records the preparation progress without invalidating its accepted SHA
transition. A future plan/release update needs its own exact transition; do not
rewrite previous release evidence or weaken the old guard to make it pass.

## Commands

```text
node utils/architecture/generate-stage-3-batch-009-planning.js
node utils/architecture/stage-3-batch-009-planning-fixture-check.js
node utils/architecture/stage-3-batch-009-planning-check.js
node utils/run-checks.js --suite architecture
node utils/run-checks.js --suite quick
node utils/run-checks.js --suite all
```

The generator is deterministic and refuses replacement of differing evidence.
The two new top-level checks reuse the existing shared builders and harnesses.
Browser smoke and fresh-install release acceptance remain mandatory at 3.9.8;
no browser request is needed for this runtime-unchanged planning stage.
