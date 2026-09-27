"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { serialize } = require("./domain_batches/stage_three_live_preflight");
const { StageThreeLivePreflight } = require("./domain_batches/stage_three_live_preflight");
const { Batch025HistoricalWorkspace } = require("./domain_batches/stage_three_batch_025_historical_workspace");
const { StageThreeBatchDefinition, StageThreeBatchRegistry } = require("./stage_three_batches/core/batch_definition");
const { BATCH_025_DEFINITION } = require("./stage_three_batches/equivalence/batch_025_definition");
const { StageThreeBatchPlanning } = require("./stage_three_batches/lifecycle/planning");
const { StageThreeBatchPrebuild } = require("./stage_three_batches/lifecycle/prebuild");
const { StageThreeBatchSourceBuild } = require("./stage_three_batches/lifecycle/source_build");
const { StageThreeSideEffectReview } = require("./stage_three_batches/lifecycle/side_effect_review");
const { StageThreeBatchLiveValidation } = require("./stage_three_batches/lifecycle/live_validation");
const { StageThreeKnownDebtResolution } = require("./stage_three_batches/lifecycle/known_debt");
const { StageThreeBatchObservationApplication } = require("./stage_three_batches/lifecycle/observation_application");
const { StageThreeBatchReleaseProjection, StageThreeBatchReleaseCheck } = require("./stage_three_batches/lifecycle/release");

const ROOT = path.resolve(__dirname, "../..");
const deepFreeze = value => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
};

// Shared continuation-batch tooling:
//   --mode negative     definitions and preflight reject wrong or incomplete batch data
//   --mode equivalence  the shared lifecycle reproduces every accepted batch-025 artifact
class StageThreeSharedBatchToolingCheck {
  // Rebuilds a definition from plain data with one field changed.
  variant(definition, mutate) {
    const profile = structuredClone(definition.profile);
    const release = structuredClone(definition.release);
    const matrix = structuredClone(definition.matrix);
    const cases = { ...definition.cases };
    mutate({ profile, execution: profile.executionProfile, release, matrix, cases });
    return new StageThreeBatchDefinition({ number: definition.context.number,
      profile: { PREFLIGHT_PROFILE: deepFreeze(profile), RELEASE: release, RESOLVED_DEBT_IDS: definition.resolvedDebtIds },
      behavior: { EXECUTABLE_CASES: cases, MATRIX: matrix } });
  }

  negative() {
    const base = BATCH_025_DEFINITION;
    const rejects = (mutate, pattern) => assert.throws(() => this.variant(base, mutate), pattern);
    let count = 0;
    rejects(({ cases }) => { delete cases.FishRetrieveSystem; }, /Missing behavior cases|Cases name/u); count++;
    rejects(({ matrix }) => { matrix.behaviorCases.FishRetrieveSystem = ["unknown-case"]; },
      /Matrix cases differ/u); count++;
    rejects(({ execution }) => { execution.auditStageLabel = "Stage 3.99.0"; }, /Expected values/u); count++;
    rejects(({ execution }) => { execution.auditPath = "architecture/migration/other_audit.json"; }, /Expected values/u); count++;
    rejects(({ execution }) => { execution.targetReleaseVersion = "0.24.99"; }, /Expected values/u); count++;
    rejects(({ execution }) => { delete execution.informationalDocumentsExcluded; }, /informational/u); count++;
    rejects(({ release }) => { delete release.codename; }, /release\.codename/u); count++;
    rejects(({ release }) => { release.notes = []; }, /release\.notes/u); count++;
    // Preflight rejections at the pre-025 checkpoint: stale evidence, wrong topology, wrong
    // activation positions, an unmet state prerequisite and an unknown prerequisite kind.
    const preflightRejects = (root, mutate, pattern) => assert.throws(
      () => new StageThreeLivePreflight(root, this.variant(base, mutate).profile).build(), pattern);
    return { count, preflightRejects };
  }

  async runNegative() {
    const { count, preflightRejects } = this.negative();
    let preflight = 0;
    await new Batch025HistoricalWorkspace().run(ROOT, async prior => {
      preflightRejects(prior, ({ profile }) => { profile.sideEffectEvidence.sha256 = "0".repeat(64); },
        /side-effect review evidence drift/u); preflight++;
      preflightRejects(prior, ({ execution }) => { execution.expectedTopology.afterBridgeCount += 1; },
        /preflight profile failed/u); preflight++;
      preflightRejects(prior, ({ execution }) => { execution.expectedActivationPositions = [105, 135, 217]; },
        /activation positions differ/u); preflight++;
      preflightRejects(prior, ({ execution }) => {
        execution.expectedRetiredActivationIds = [];
        execution.expectedTopology.afterActivationCount += 2;
      }, /retiring activation set differs/u); preflight++;
      preflightRejects(prior, ({ execution }) => { execution.expectedImports = execution.expectedImports.slice(1); },
        /differs from its reviewed imports/u); preflight++;
      const source = "src/core/fishing/pole_fight_sector_constraint.js";
      preflightRejects(prior, ({ profile }) => { delete profile.reviewedContracts[source].compositionIdentityReview; },
        /state audit is stale/u); preflight++;
      // A source modified after the reviewed evidence invalidates the batch.
      fs.appendFileSync(path.join(prior, source), "\n// modified after review\n");
      assert.throws(() => new StageThreeLivePreflight(prior, BATCH_025_DEFINITION.profile).build(),
        /side-effect source drift/u); preflight++;
    });
    assert.equal(StageThreeBatchRegistry.has("025"), false, "Batch 025 must never join the shared registry");
    return count + preflight;
  }

  async runEquivalence() {
    const D = BATCH_025_DEFINITION;
    const recorded = file => fs.readFileSync(path.join(ROOT, file));
    const history = new Batch025HistoricalWorkspace();
    await history.run(ROOT, async prior => {
      assert.deepEqual(serialize(new StageThreeSideEffectReview(prior, D).build()), recorded(D.context.paths.sideEffectReview));
      const planning = new StageThreeBatchPlanning(prior, D);
      assert.deepEqual(serialize(planning.audit()), recorded(D.execution.auditPath));
      assert.deepEqual(serialize(planning.plan()), recorded(D.execution.executionPlanPath));
      assert.deepEqual(serialize(planning.matrix()), recorded(D.execution.testMatrixPath));
      assert.deepEqual(serialize(new StageThreeBatchPrebuild(prior, D).build().artifact), recorded(D.context.paths.prebuild));
    });
    await history.run(ROOT, async prior => {
      assert.deepEqual(serialize(await new StageThreeBatchSourceBuild(prior, D).prepare()), recorded(D.context.paths.sourceBuild));
    }, { keepPrebuild: true });
    await history.run(ROOT, async active => {
      await new StageThreeBatchLiveValidation(active, D, StageThreeBatchRegistry).run();
      await new StageThreeBatchObservationApplication(active, D, StageThreeBatchRegistry).check();
      const debt = JSON.parse(recorded(D.context.paths.knownDebt));
      fs.writeFileSync(path.join(active, debt.registry.path), Buffer.from(debt.registry.beforeBase64, "base64"));
      const projected = new StageThreeKnownDebtResolution(active, D).project();
      assert.equal(projected.after.toString("base64"), debt.registry.afterBase64);
      fs.writeFileSync(path.join(active, debt.registry.path), Buffer.from(debt.registry.afterBase64, "base64"));
      const release = new StageThreeBatchReleaseProjection(D).run(active);
      assert.deepEqual(serialize(release.transition), recorded(D.context.paths.releaseTransition));
    }, { keepCutover: true });
    // The batch-025 release is checked right after it: a newer batch is reversed first.
    const next = D.context.next();
    const newer = StageThreeBatchRegistry.has(next.number) &&
      (fs.existsSync(path.join(ROOT, next.paths.prebuild)) || fs.existsSync(path.join(ROOT, next.paths.cutover)));
    if (newer) {
      const { StageThreeHistoricalWorkspace } = require("./stage_three_batches/lifecycle/historical_workspace");
      await new StageThreeHistoricalWorkspace(StageThreeBatchRegistry.load(next.number), StageThreeBatchRegistry)
        .run(ROOT, released => new StageThreeBatchReleaseCheck(D).run(released));
    } else {
      new StageThreeBatchReleaseCheck(D).run(ROOT);
    }
    return 11;
  }
}

if (require.main === module) {
  const mode = process.argv[process.argv.indexOf("--mode") + 1];
  const check = new StageThreeSharedBatchToolingCheck();
  const run = mode === "equivalence" ? check.runEquivalence() : mode === "negative" ? check.runNegative()
    : Promise.reject(new Error("--mode negative|equivalence is required"));
  run.then(count => console.log(mode === "equivalence"
    ? `Shared batch tooling equivalence PASS: ${count} batch-025 artifacts reproduced byte-for-byte.`
    : `Shared batch tooling negative PASS: ${count} rejected definitions and preflight inputs.`))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { StageThreeSharedBatchToolingCheck };
