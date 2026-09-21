# Stage 3.9.3–3.9.4 — candidate-only handoff

## Scope

Stage 3.9.3 opens exact batch `stage-3.candidate-009-fish-444e8034` in `prebuild`.
Stage 3.9.4 validates two representation-only ESM targets in disposable workspaces:

- `src/core/fish/fish_rarity_resolver.js` → `src/game/domain/fish/fish_rarity_resolver.js`;
- `src/core/fish/fish_anomaly_variant_resolver.js` → `src/game/domain/fish/fish_anomaly_variant_resolver.js`.

Live release remains **0.24.45**, completed prefix **001–008**. Live topology stays
**34 project modules / 35 activations / 60 bridges**. No actual target source files,
provider replacement, index relocation, Manifest updates or runtime publication occur.

## Tooling responsibilities

`utils/architecture/domain_batches/`

- `stage_three_batch_009_prebuild.js`: exact protected inputs and two-file metadata transaction.
- `stage_three_batch_009_prebuild_history.js`: SHA-anchored reversal of only the execution-state delta, for historical checks.
- `stage_three_batch_009_candidate_workspace.js`: isolated filesystem, pending metadata and candidate-only relocation before logical position 42.
- `stage_three_batch_009_source_build.js`: existing shared cumulative builder orchestration, two-root reproducibility and evidence publication.
- `stage_three_batch_009_candidate_validation.js`: actual generated IIFE behavior, export identity and exposure timing.

No new runtime architecture or dependencies are introduced. Existing shared builders,
validators and transaction primitives are reused. Classic and ESM outputs have one
canonical class reference inside each candidate runtime; no Domain code reads transport.

## Evidence and verification

- `stage_3_batch_009_prebuild_contract.json`: exact before/after state bytes, protected SHA set, active versus planned topology.
- `stage_3_batch_009_source_build_validation.json`: candidate **36 / 37 / 62** design, actual bundled project/virtual modules, 28 behavior cases and 6 production-shaped FixedCatch DI cases.
- Two builds in distinct absolute roots produce identical reports and runtime SHA-256.
- An additional test-only transform counts all 36 module evaluations exactly once. Its output SHA is separate from the unmodified candidate SHA; instrumented code is never published.
- All 37 generated shims match the renderer, retain their approved positions, and expose exact namespace exports. The former 35 activation contracts and bundled export implementations remain unchanged.
- Pending Manifest entries exist only in the temporary candidate. Existing provider observations there remain historical, explicitly not reconciled. Final live observation persistence belongs to Stage 3.9.7.
- Failure fixtures preserve a non-empty previous-output sentinel and actual live files; temporary directories are cleaned with exact allocated-root checks.

Two historical batch-008 writer entrypoints were hardened to check **both** batch ID
and phase. A new batch's `prebuild` phase can no longer reopen those old writers.
Historical JSON evidence is unchanged. Historical tests see an exact reversed state;
the new guard independently checks the real live `009 / prebuild` state.

## Commands

```powershell
node utils/architecture/generate-stage-3-batch-009-source-build.js
node utils/architecture/stage-3-batch-009-source-build-fixture-check.js
node utils/architecture/stage-3-batch-009-source-build-check.js
node utils/run-checks.js --suite architecture
node utils/run-checks.js --suite quick
node utils/run-checks.js --suite all
```

The generator is idempotent and rejects differing existing evidence. Checks are read-only.
Browser acceptance is not claimed: this stage does not activate candidate artifacts.

Final verification: **Architecture 117/117, Quick 68/68, Full 145/145 PASS**;
31 negative fixtures, `git diff --check` PASS. Command-output hashes and environment
are recorded in `stage_3_batch_009_prebuild_validation.json`.

## Next boundary

**Stage 3.9.5 — Atomic Runtime Cutover**, only after separate approval. Publish the two
targets, exact provider shims, candidate runtime, registry/Manifest/contract changes,
runtime script relocation **before logical 42**, and `runtime-active` phase together.
Before publication, revalidate current hashes against this evidence and require the
unmodified candidate SHA. Keep release 0.24.45 and completed 001–008 until full acceptance
and release closure. Rollback restores only batch 009; previous batches remain active.

`refactor_Task.txt` remains byte-identical to the released checkpoint because its bytes
are part of the frozen Stage 3.8.9 release transition. This handoff records current progress
without rewriting historical release evidence.
