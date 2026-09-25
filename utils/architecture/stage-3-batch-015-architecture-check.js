"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_015_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_015_preflight_profile");
const { Batch015Planning } = require("./domain_batches/stage_three_batch_015_planning");
const { Batch015FocusedParityCheck } = require("./stage-3-batch-015-focused-parity-check");
const { Batch015SourceBuild } = require("./domain_batches/stage_three_batch_015_source_build");
const { Batch015CutoverProjection, Batch015AtomicCutover } =
  require("./domain_batches/stage_three_batch_015_cutover");
const { Batch015HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_015_historical_workspace");
const { Batch015LiveValidation } = require("./domain_batches/stage_three_batch_015_live_validation");
const { Batch015ObservationApplication } =
  require("./domain_batches/stage_three_batch_015_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch015ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch015HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch015Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch015FocusedParityCheck().run(prior);
      const first = audit.scope.modules[0];
      assert.throws(() => new RepresentationOnlyReviewedEsmTarget().project({
        source: `${planning.read(first.currentPath)}\n// tampered`,
        currentPath: first.currentPath, targetPath: first.targetPath,
        exports: first.exports, sourceSha256: first.sourceSha256,
        contract: PROFILE.reviewedContracts[first.currentPath],
      }), /source changed after audit/);
    });
    await history.run(root, async prior => {
      const built = await new Batch015SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 62);
      assert.equal(built.report.activationOutputs.length, 65);
      assert.equal(built.validation.behavior.length, 12);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch015CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 6],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch015AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 015 rollback");
          },
        }), /injected 015 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-015 runtime-active checkpoint:
    // later batches and the 0.24.52 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch015LiveValidation(active).run(),
      observed: await new Batch015ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 62, activations: 65, bridges: 95 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.15.0–.7 PASS: audit/plan replay, 12 parity cases, 62 evaluations once, " +
      "3 rollback fixtures, 65 live activations, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch015ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch015ArchitectureCheck };
