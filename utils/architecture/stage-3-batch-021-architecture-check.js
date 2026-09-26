"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_021_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_021_preflight_profile");
const { Batch021Planning } = require("./domain_batches/stage_three_batch_021_planning");
const { Batch021FocusedParityCheck } = require("./stage-3-batch-021-focused-parity-check");
const { Batch021SourceBuild } = require("./domain_batches/stage_three_batch_021_source_build");
const { Batch021CutoverProjection, Batch021AtomicCutover } =
  require("./domain_batches/stage_three_batch_021_cutover");
const { Batch021HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_021_historical_workspace");
const { Batch021LiveValidation } = require("./domain_batches/stage_three_batch_021_live_validation");
const { Batch021ObservationApplication } =
  require("./domain_batches/stage_three_batch_021_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch021ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch021HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch021Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch021FocusedParityCheck().run(prior);
      const first = audit.scope.modules[0];
      assert.throws(() => new RepresentationOnlyReviewedEsmTarget().project({
        source: `${planning.read(first.currentPath)}\n// tampered`,
        currentPath: first.currentPath, targetPath: first.targetPath,
        exports: first.exports, sourceSha256: first.sourceSha256,
        contract: PROFILE.reviewedContracts[first.currentPath],
      }), /source changed after audit/);
    });
    await history.run(root, async prior => {
      const built = await new Batch021SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 78);
      assert.equal(built.report.activationOutputs.length, 87);
      assert.equal(built.validation.behavior.length, 7);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch021CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 6],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch021AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 021 rollback");
          },
        }), /injected 021 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-021 runtime-active checkpoint:
    // later batches and the 0.24.58 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch021LiveValidation(active).run(),
      observed: await new Batch021ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 78, activations: 87, bridges: 139 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.21.0–.7 PASS: audit/plan replay, 7 parity cases, 78 evaluations once, " +
      "3 rollback fixtures, 87 live activations, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch021ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch021ArchitectureCheck };
