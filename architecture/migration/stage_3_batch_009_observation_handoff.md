# Stage 3.9.7 — observation reconciliation complete

## Result

The architectural inventory now matches the published batch-009 runtime.
The full actual corpus was scanned: **460 source modules**, **772 confirmed
legacy edges**, **772 derived reverse links** and **808 unified edges**.
These are observed checkpoint counts, not policy constants.

Exactly four Manifest records were reconciled:

- `src/core/fish/fish_anomaly_variant_resolver.js`: compatibility provider;
- `src/core/fish/fish_rarity_resolver.js`: compatibility provider;
- `src/game/domain/fish/fish_anomaly_variant_resolver.js`: verified ESM target;
- `src/game/domain/fish/fish_rarity_resolver.js`: verified ESM target.

Only the two ESM target migration statuses changed from `migrating` to
`verified`. Source ownership, target paths, roles, waves and blockers were not
reclassified. The old providers retain their compatibility-bridge roles.
No pending observation groups remain.

Both exact classic consumer relationships still originate from
`src/app/bootstrap.js`. The persisted legacy graph points to the classic
provider paths; the unified graph additionally links those providers to the
ESM targets through the existing approved registry. Reverse consumers remain
derived, not authoritative Manifest fields.

The two shim references to the compatibility transport are intentionally
unresolved in the src-only legacy graph: the transport is produced in dist.
They are not speculative project edges or new Domain dependencies.

## Safety and tooling

- No new globals, unexpected consumers, config/platform/dev/browser dependencies
  or guard failures. The two global mechanism transitions are covered by the
  existing exact activation/bridge records; the global baseline was not enlarged.
- Guard debt remains **203**. No exception or bridge was added.
- Shared observation transition/reconciliation classes are reused by batches
  008 and 009. Batch-008 adapters retain their original contract and evidence.
- Publication writes only the current Manifest and the new reconciliation
  evidence, using the existing two-file transaction with rollback.
- The new evidence reverses exactly to the SHA-anchored pending cutover Manifest.
  Historical readers use this validated reversal; current scanners inspect
  actual current sources and persisted facts with no pending substitution.
- Runtime sources, index, registry, cumulative output, release metadata,
  execution state and historical evidence are unchanged. The approved cutover
  plus the exact observation delta matches **518 protected file hashes**.

## Verification

Architecture **121/121**, Quick **70/70**, Full **149/149 PASS**.
The fixture matrix rejects **55** invalid input/evidence/transaction cases,
including all four two-file rollback boundaries. Mechanical replay is
deterministic, persisted facts are current, and repeat publication is read-only.
`git diff --check` passes.

Detailed facts and reversal:
`stage_3_batch_009_observation_reconciliation.json`.
Final suite results and SHA-256 anchors:
`stage_3_batch_009_observation_verification.json`.

## Current boundary and next step

- Release: **0.24.45**.
- Completed: **001–008**.
- Active: **009 / runtime-active**.
- Runtime: **36 modules / 37 activations / 62 bridges**, unchanged.
- Verdict: **eligible-for-full-acceptance**, not release approval.

Next is **3.9.8 — Full Acceptance**: fresh npm ci, suites in the clean install,
generated-output verification and user-performed browser smoke for launch,
Canvas, inventory, cast/wait/fight, fish rarity/anomaly and console cleanliness.
This stage does not claim fresh-install or browser acceptance.
Only 3.9.9 may complete batch 009 and release v0.24.46.

The release-frozen `refactor_Task.txt` and earlier handoffs are not rewritten.
This document records the current stage. No commit, tag or version bump was
performed as part of reconciliation.

## Commands

```powershell
node utils/architecture/stage-3-batch-009-observation-fixture-check.js
node utils/architecture/stage-3-batch-009-observation-integration-check.js
node utils/architecture/migration-observation-persistence-corpus-check.js
node utils/run-checks.js --suite architecture
node utils/run-checks.js --suite quick
node utils/run-checks.js --suite all
```

The explicit writer is
`node utils/architecture/finalize-stage-3-batch-009-observations.js`.
When evidence already exists, it validates/replays instead of rewriting it.
