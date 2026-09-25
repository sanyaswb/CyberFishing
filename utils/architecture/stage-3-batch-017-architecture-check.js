"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_017_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_017_preflight_profile");
const { Batch017Planning } = require("./domain_batches/stage_three_batch_017_planning");
const { Batch017FocusedParityCheck } = require("./stage-3-batch-017-focused-parity-check");
const { Batch017SourceBuild } = require("./domain_batches/stage_three_batch_017_source_build");
const { Batch017CutoverProjection, Batch017AtomicCutover } =
  require("./domain_batches/stage_three_batch_017_cutover");
const { Batch017HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_017_historical_workspace");
const { Batch017LiveValidation } = require("./domain_batches/stage_three_batch_017_live_validation");
const { Batch017ObservationApplication } =
  require("./domain_batches/stage_three_batch_017_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch017ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch017HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch017Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch017FocusedParityCheck().run(prior);
      const first = audit.scope.modules[0];
      assert.throws(() => new RepresentationOnlyReviewedEsmTarget().project({
        source: `${planning.read(first.currentPath)}\n// tampered`,
        currentPath: first.currentPath, targetPath: first.targetPath,
        exports: first.exports, sourceSha256: first.sourceSha256,
        contract: PROFILE.reviewedContracts[first.currentPath],
      }), /source changed after audit/);
    });
    await history.run(root, async prior => {
      const built = await new Batch017SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 64);
      assert.equal(built.report.activationOutputs.length, 68);
      assert.equal(built.validation.behavior.length, 3);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch017CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 6],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch017AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 017 rollback");
          },
        }), /injected 017 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-017 runtime-active checkpoint:
    // later batches and the 0.24.54 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch017LiveValidation(active).run(),
      observed: await new Batch017ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 64, activations: 68, bridges: 111 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.17.0–.7 PASS: audit/plan replay, 3 parity cases, 64 evaluations once, " +
      "3 rollback fixtures, 68 live activations, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch017ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch017ArchitectureCheck };
