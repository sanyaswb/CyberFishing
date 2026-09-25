"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_020_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_020_preflight_profile");
const { Batch020Planning } = require("./domain_batches/stage_three_batch_020_planning");
const { Batch020FocusedParityCheck } = require("./stage-3-batch-020-focused-parity-check");
const { Batch020SourceBuild } = require("./domain_batches/stage_three_batch_020_source_build");
const { Batch020CutoverProjection, Batch020AtomicCutover } =
  require("./domain_batches/stage_three_batch_020_cutover");
const { Batch020HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_020_historical_workspace");
const { Batch020LiveValidation } = require("./domain_batches/stage_three_batch_020_live_validation");
const { Batch020ObservationApplication } =
  require("./domain_batches/stage_three_batch_020_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch020ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch020HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch020Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch020FocusedParityCheck().run(prior);
      const first = audit.scope.modules[0];
      assert.throws(() => new RepresentationOnlyReviewedEsmTarget().project({
        source: `${planning.read(first.currentPath)}\n// tampered`,
        currentPath: first.currentPath, targetPath: first.targetPath,
        exports: first.exports, sourceSha256: first.sourceSha256,
        contract: PROFILE.reviewedContracts[first.currentPath],
      }), /source changed after audit/);
    });
    await history.run(root, async prior => {
      const built = await new Batch020SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 76);
      assert.equal(built.report.activationOutputs.length, 81);
      assert.equal(built.validation.behavior.length, 7);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch020CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 6],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch020AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 020 rollback");
          },
        }), /injected 020 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-020 runtime-active checkpoint:
    // later batches and the 0.24.57 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch020LiveValidation(active).run(),
      observed: await new Batch020ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 76, activations: 81, bridges: 135 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.20.0–.7 PASS: audit/plan replay, 7 parity cases, 76 evaluations once, " +
      "3 rollback fixtures, 81 live activations, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch020ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch020ArchitectureCheck };
