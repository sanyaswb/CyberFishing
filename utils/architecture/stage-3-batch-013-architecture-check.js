"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_013_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_013_preflight_profile");
const { Batch013Planning } = require("./domain_batches/stage_three_batch_013_planning");
const { Batch013FocusedParityCheck } = require("./stage-3-batch-013-focused-parity-check");
const { Batch013SourceBuild } = require("./domain_batches/stage_three_batch_013_source_build");
const { Batch013CutoverProjection, Batch013AtomicCutover } =
  require("./domain_batches/stage_three_batch_013_cutover");
const { Batch013HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_013_historical_workspace");
const { Batch013LiveValidation } = require("./domain_batches/stage_three_batch_013_live_validation");
const { Batch013ObservationApplication } =
  require("./domain_batches/stage_three_batch_013_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch013ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch013HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch013Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch013FocusedParityCheck().run(prior);
      const first = audit.scope.modules[0];
      assert.throws(() => new RepresentationOnlyReviewedEsmTarget().project({
        source: `${planning.read(first.currentPath)}\n// tampered`,
        currentPath: first.currentPath, targetPath: first.targetPath,
        exports: first.exports, sourceSha256: first.sourceSha256,
        contract: PROFILE.reviewedContracts[first.currentPath],
      }), /source changed after audit/);
    });
    await history.run(root, async prior => {
      const built = await new Batch013SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 50);
      assert.equal(built.report.activationOutputs.length, 53);
      assert.equal(built.validation.behavior.length, 9);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch013CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 7],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch013AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 013 rollback");
          },
        }), /injected 013 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-013 runtime-active checkpoint:
    // later batches and the 0.24.50 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch013LiveValidation(active).run(),
      observed: await new Batch013ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 50, activations: 53, bridges: 83 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.13.0–.7 PASS: audit/plan replay, 9 parity cases, 50 evaluations once, " +
      "3 rollback fixtures, 53 live activations, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch013ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch013ArchitectureCheck };
