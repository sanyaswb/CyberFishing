# Stage 3.9.5–3.9.6 — runtime cutover and validation complete

## Current state

Batch `stage-3.candidate-009-fish-444e8034` is **runtime-active**.
Release remains **0.24.45**, completed prefix remains **001–008**.
These two substages are complete; batch acceptance and release closure are not.

- `FishRarityResolver` and `FishAnomalyVariantResolver` are named ESM exports under `src/game/domain/fish/`.
- One cumulative runtime contains **36 project modules**, exposed through **37 activation contracts** and **62 bridge records**. No isolated IIFE was added.
- The runtime loads immediately before logical position **42**. The new exports appear at exact positions **42** and **43**; the previous 35 exposure positions are preserved.
- Target implementations are representation-only conversions. Formula, rounding, defaults, result shape, state ownership and save semantics are not redesigned.

## Responsibilities

```text
utils/architecture/domain_batches/
  stage_three_batch_009_cutover.js              projection, publication gate, transaction
  stage_three_batch_009_cutover_history.js      exact SHA-anchored before/after history
  stage_three_batch_009_historical_workspace.js isolated historical filesystem replay
  stage_three_batch_009_live_validation.js      actual published runtime validation

architecture/migration/
  stage_3_batch_009_runtime_cutover.json         atomic write set and rollback before-images
  stage_3_batch_009_live_runtime_validation.json identity, timing, state and allocation evidence
  stage_3_batch_009_runtime_stage_verification.json final suite results and evidence SHA-256
```

Historical corpus checks run against an exact restored filesystem in temporary workspaces, not a mixture of old metadata and new sources. This does not replace current-source enforcement: the live architecture corpus, exact publication replay and runtime validation still inspect the current checkout.

## Verification

- Architecture **119/119**, Quick **69/69**, Full **147/147 PASS**.
- Rollback: **16 injected transaction failure boundaries**, occupied publication gate rejected, **14 live-byte/repeated-evaluation mutations** rejected.
- **28 behavior cases**, **6 production-shaped FixedCatch DI cases**, and **37 activation timing checks** pass against the published bundle.
- Both newly migrated modules initialize exactly once in the test-instrumented live bundle. Earlier candidate evidence separately proves one evaluation across all 36 modules. Instrumented code is never published.
- Namespace/class references, instance-local caches, immutable result shapes and allocation sites are preserved. Post-activation Domain transport reads are **0**.
- Performance evidence is allocation/source equivalence, **not** a frame-time benchmark.
- Published runtime SHA-256 remains the approved candidate SHA `217a4d97bc3ccd9e85a3167a09280c2c79542109114a54e076a212457a413177`.
- `git diff --check` passes. Only the two newly replaced activation tag line endings were normalized to LF during finalization. Cutover after-image and dependent fingerprint updates were atomic; historical evidence and before-images were preserved.

## Rollback boundary

Rollback is batch **009 only**: restore recorded before-images and remove exact newly introduced files. This returns to the 3.9.4 prebuild state, **34 modules / 35 activations / 60 bridges**, with the cumulative runtime before logical position 86. Batches 001–008 remain active; release stays 0.24.45. Failure fixtures prove restoration rather than relying only on a documented rollback plan.

## Next: Stage 3.9.7

Four Manifest entries deliberately remain observation-pending: the two new ESM targets and their two replaced classic provider paths. Stage 3.9.7 must mechanically reconcile observations, dependency resolutions and derived consumers without changing the verified runtime topology.

Fresh `npm ci` and manual browser acceptance belong to **3.9.8**. Neither is claimed here. Batch 009 remains active until **3.9.9** release closure.

`refactor_Task.txt` remains byte-identical to the accepted release checkpoint because it participates in historical release SHA evidence. This handoff records current progress without rewriting that history. No commit, tag or version bump is performed by these substages.

## Re-run

```powershell
node utils/architecture/stage-3-batch-009-cutover-fixture-check.js
node utils/architecture/stage-3-batch-009-live-runtime-check.js
node utils/run-checks.js --suite architecture
node utils/run-checks.js --suite quick
node utils/run-checks.js --suite all
& 'C:\Program Files\Git\cmd\git.exe' -c core.safecrlf=false diff --check
```
