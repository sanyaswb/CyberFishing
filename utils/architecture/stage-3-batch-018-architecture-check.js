"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_018_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_018_preflight_profile");
const { Batch018Planning } = require("./domain_batches/stage_three_batch_018_planning");
const { Batch018FocusedParityCheck } = require("./stage-3-batch-018-focused-parity-check");
const { Batch018SourceBuild } = require("./domain_batches/stage_three_batch_018_source_build");
const { Batch018CutoverProjection, Batch018AtomicCutover } =
  require("./domain_batches/stage_three_batch_018_cutover");
const { Batch018HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_018_historical_workspace");
const { Batch018LiveValidation } = require("./domain_batches/stage_three_batch_018_live_validation");
const { Batch018ObservationApplication } =
  require("./domain_batches/stage_three_batch_018_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch018ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch018HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch018Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch018FocusedParityCheck().run(prior);
      const first = audit.scope.modules[0];
      assert.throws(() => new RepresentationOnlyReviewedEsmTarget().project({
        source: `${planning.read(first.currentPath)}\n// tampered`,
        currentPath: first.currentPath, targetPath: first.targetPath,
        exports: first.exports, sourceSha256: first.sourceSha256,
        contract: PROFILE.reviewedContracts[first.currentPath],
      }), /source changed after audit/);
    });
    await history.run(root, async prior => {
      const built = await new Batch018SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 70);
      assert.equal(built.report.activationOutputs.length, 74);
      assert.equal(built.validation.behavior.length, 14);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch018CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 6],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch018AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 018 rollback");
          },
        }), /injected 018 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-018 runtime-active checkpoint:
    // later batches and the 0.24.55 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch018LiveValidation(active).run(),
      observed: await new Batch018ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 70, activations: 74, bridges: 123 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.18.0–.7 PASS: audit/plan replay, 14 parity cases, 70 evaluations once, " +
      "3 rollback fixtures, 74 live activations, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch018ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch018ArchitectureCheck };
