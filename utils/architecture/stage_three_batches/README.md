# Shared Stage 3 batch tooling (continuation batches 026+)

One shared lifecycle migrates every continuation batch of the Stage 3.22 approved prefix. A batch is
defined by at most three files; all lifecycle code, command wrappers and checks are shared.

## Layout

```text
utils/architecture/stage-3-batch.js                one command for every lifecycle step
utils/architecture/stage-3-batch-check-runner.js   shared check entrypoint (catalog args)
utils/architecture/stage_three_batches/
  core/batch_context.js        batch-derived names: artifact paths, kinds, stage labels, releases
  core/batch_definition.js     definition validation and the definitions registry
  lifecycle/                   shared components (planning, prebuild, source build, cutover,
                               live validation, known debt, observations, acceptance, release,
                               rollback, history, historical workspace, architecture check)
  definitions/NNN/profile.js         reviewed expectations of batch NNN
  definitions/NNN/behavior_cases.js  executable behavior cases and the focused matrix
  definitions/NNN/fixtures.js        optional batch-specific architecture fixtures
  equivalence/batch_025_definition.js  batch 025 as a definition, used only to prove that the shared
                                       lifecycle reproduces the accepted batch-025 artifacts
```

Batch N is Stage 3.(N+1) and releases 0.24.(38+N) from 0.24.(37+N). Artifacts are
`architecture/migration/stage_3_batch_NNN_<name>.json`; see `core/batch_context.js`.

## Command sequence

Run each step explicitly; a step verifies its predecessor artifacts and never proceeds to cutover or
release on its own. Existing evidence is immutable: re-running a recording step must reproduce it
byte-for-byte.

```text
node utils/architecture/stage-3-batch.js --batch NNN --step side-effect-review
  (pin the printed review SHA-256 in profile.js sideEffectEvidence)
node utils/architecture/stage-3-batch.js --batch NNN --step audit
node utils/architecture/stage-3-batch.js --batch NNN --step plan
node utils/architecture/stage-3-batch.js --batch NNN --step matrix
node utils/architecture/stage-3-batch.js --batch NNN --step parity
node utils/architecture/stage-3-batch.js --batch NNN --step prebuild
node utils/architecture/stage-3-batch.js --batch NNN --step source-build
node utils/architecture/stage-3-batch.js --batch NNN --step cutover
node utils/architecture/stage-3-batch.js --batch NNN --step live
node utils/architecture/stage-3-batch.js --batch NNN --step known-debt
node utils/architecture/stage-3-batch.js --batch NNN --step reconcile
  register the batch check in utils/testing/suites/check_manifest.js:
    file: "utils/architecture/stage-3-batch-check-runner.js",
    args: ["--batch", "NNN", "--mode", "architecture"], suites: ["quick", "architecture", "history"]
  run Architecture and Quick, then the release gate of the complete catalog (history replays may reuse
  a proven PASS, everything else executes; see utils/testing/CHECKS.md):
  node utils/run-checks.js --release-gate --report <abs path under node_modules/.cache or outside the project>
node utils/architecture/stage-3-batch.js --batch NNN --step automated-acceptance --check-report <that report>
  the owner plays the batch checklist in the browser and reports console counts (--performed-by owner),
  or, only under the owner's authorization, the automated substitute runs game-cycle without seals and
  reads the browser console (--performed-by automated-substitute --authorization "<owner's words>")
node utils/architecture/stage-3-batch.js --batch NNN --step browser-acceptance --performed-by owner \
  --statement "<owner's words>" --console "<owner's words>" --errors 0 --warnings 0
node utils/architecture/stage-3-batch.js --batch NNN --step release-transition            (dry run)
node utils/architecture/stage-3-batch.js --batch NNN --step release-transition --publish
node utils/architecture/stage-3-batch.js --batch NNN --step release-closure
  guard handover: the previous batch check moves to suites ["history"]
  post-release Quick/Architecture and the release gate, then commit and annotated tag vX.Y.Z
```

`--step rollback --confirm` restores an unreleased batch from its recorded before-images (writes,
creations and removals) in one transaction and removes only that batch's artifacts.
`--step history` replays the batch at every checkpoint (same as the architecture check).

## Authoring profile.js

Export `PREFLIGHT_PROFILE` (a `StageThreeBatchPreflightProfile` wrapping a
`StageThreeBatchExecutionProfile`), `RELEASE`, and optionally `RESOLVED_DEBT_IDS`.

- Derive every fact from the approved plan and the live graph, never from the output being
  validated: targets and exports, reviewed imports (`expectedImports` with the activation that
  exposes each imported export), activation ids and legacy positions, canonical bridge ids
  (`CanonicalBridgeIdentity.id({ bridge, source, target, owner })`), retired bridges (bridges whose
  source is migrated), retired activations (Stage 3 activations whose every holding bridge is
  migrated by the batch), topology before/after, allocation baselines
  (`StageThreeBatchSourceObserver`) and call-site markers.
- Stage labels, artifact paths and release versions must match `core/batch_context.js`; the
  definition validator rejects any mismatch. `informationalDocumentsExcluded` must be `true`.
- `reviewedContracts` describe state, results and effects per source. Supported evaluation effects:
  none, one legacy class exposure (`legacyExposure` with `window-property` or `global-this-property`)
  private static literal Sets (`privateStaticSets`) and, since batch 042, a data source made only of
  top-level deeply frozen tables (`frozenDataConstants`: exact bindings in source order with their
  Object.freeze locations and values). Other shapes fail explicitly until the shared side-effect review
  is extended for them.
- `RELEASE` holds the title, codename, project-version notes, changelog bullets, a one-line summary and
  the browser checklist context.

## Authoring behavior_cases.js

Export `EXECUTABLE_CASES` (`{ ExportName: { caseId: Class => result } }`) and `MATRIX`
(`behaviorCases` per export, which must name exactly the executable cases, and
`compatibilityCases`). Each case runs on the classic baseline, the temporary ESM target and the
published runtime; results must be deep-equal. Cover missing and boundary inputs, state and
identity, caller-input mutation and repeated calls. A candidate is never its own baseline.

## Historical compatibility

Batch 025 and earlier keep their original tooling and evidence. The batch-025 history layer delegates
to the shared history of batch 026 when that batch exists, so every earlier checkpoint is still
reconstructed byte-for-byte. The shared history chain itself delegates from batch N to N+1.
