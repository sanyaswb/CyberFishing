"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_016_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_016_preflight_profile");
const { Batch016Planning } = require("./domain_batches/stage_three_batch_016_planning");
const { Batch016FocusedParityCheck } = require("./stage-3-batch-016-focused-parity-check");
const { Batch016SourceBuild } = require("./domain_batches/stage_three_batch_016_source_build");
const { Batch016CutoverProjection, Batch016AtomicCutover } =
  require("./domain_batches/stage_three_batch_016_cutover");
const { Batch016HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_016_historical_workspace");
const { Batch016LiveValidation } = require("./domain_batches/stage_three_batch_016_live_validation");
const { Batch016ObservationApplication } =
  require("./domain_batches/stage_three_batch_016_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch016ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch016HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch016Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch016FocusedParityCheck().run(prior);
      const first = audit.scope.modules[0];
      assert.throws(() => new RepresentationOnlyReviewedEsmTarget().project({
        source: `${planning.read(first.currentPath)}\n// tampered`,
        currentPath: first.currentPath, targetPath: first.targetPath,
        exports: first.exports, sourceSha256: first.sourceSha256,
        contract: PROFILE.reviewedContracts[first.currentPath],
      }), /source changed after audit/);
    });
    await history.run(root, async prior => {
      const built = await new Batch016SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 63);
      assert.equal(built.report.activationOutputs.length, 66);
      assert.equal(built.validation.behavior.length, 2);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch016CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 6],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch016AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 016 rollback");
          },
        }), /injected 016 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-016 runtime-active checkpoint:
    // later batches and the 0.24.53 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch016LiveValidation(active).run(),
      observed: await new Batch016ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 63, activations: 66, bridges: 96 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.16.0–.7 PASS: audit/plan replay, 2 parity cases, 63 evaluations once, " +
      "3 rollback fixtures, 66 live activations, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch016ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch016ArchitectureCheck };
