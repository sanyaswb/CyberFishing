"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_019_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_019_preflight_profile");
const { Batch019Planning } = require("./domain_batches/stage_three_batch_019_planning");
const { Batch019FocusedParityCheck } = require("./stage-3-batch-019-focused-parity-check");
const { Batch019SourceBuild } = require("./domain_batches/stage_three_batch_019_source_build");
const { Batch019CutoverProjection, Batch019AtomicCutover } =
  require("./domain_batches/stage_three_batch_019_cutover");
const { Batch019HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_019_historical_workspace");
const { Batch019LiveValidation } = require("./domain_batches/stage_three_batch_019_live_validation");
const { Batch019ObservationApplication } =
  require("./domain_batches/stage_three_batch_019_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch019ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch019HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch019Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch019FocusedParityCheck().run(prior);
      const first = audit.scope.modules[0];
      assert.throws(() => new RepresentationOnlyReviewedEsmTarget().project({
        source: `${planning.read(first.currentPath)}\n// tampered`,
        currentPath: first.currentPath, targetPath: first.targetPath,
        exports: first.exports, sourceSha256: first.sourceSha256,
        contract: PROFILE.reviewedContracts[first.currentPath],
      }), /source changed after audit/);
    });
    await history.run(root, async prior => {
      const built = await new Batch019SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 73);
      assert.equal(built.report.activationOutputs.length, 77);
      assert.equal(built.validation.behavior.length, 6);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch019CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 6],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch019AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 019 rollback");
          },
        }), /injected 019 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-019 runtime-active checkpoint:
    // later batches and the 0.24.56 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch019LiveValidation(active).run(),
      observed: await new Batch019ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 73, activations: 77, bridges: 130 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.19.0–.7 PASS: audit/plan replay, 6 parity cases, 73 evaluations once, " +
      "3 rollback fixtures, 77 live activations, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch019ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch019ArchitectureCheck };
