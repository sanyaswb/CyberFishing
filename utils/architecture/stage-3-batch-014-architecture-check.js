"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_014_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_014_preflight_profile");
const { Batch014Planning } = require("./domain_batches/stage_three_batch_014_planning");
const { Batch014FocusedParityCheck } = require("./stage-3-batch-014-focused-parity-check");
const { Batch014SourceBuild } = require("./domain_batches/stage_three_batch_014_source_build");
const { Batch014CutoverProjection, Batch014AtomicCutover } =
  require("./domain_batches/stage_three_batch_014_cutover");
const { Batch014HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_014_historical_workspace");
const { Batch014LiveValidation } = require("./domain_batches/stage_three_batch_014_live_validation");
const { Batch014ObservationApplication } =
  require("./domain_batches/stage_three_batch_014_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch014ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch014HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch014Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch014FocusedParityCheck().run(prior);
      const first = audit.scope.modules[0];
      assert.throws(() => new RepresentationOnlyReviewedEsmTarget().project({
        source: `${planning.read(first.currentPath)}\n// tampered`,
        currentPath: first.currentPath, targetPath: first.targetPath,
        exports: first.exports, sourceSha256: first.sourceSha256,
        contract: PROFILE.reviewedContracts[first.currentPath],
      }), /source changed after audit/);
    });
    await history.run(root, async prior => {
      const built = await new Batch014SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 56);
      assert.equal(built.report.activationOutputs.length, 59);
      assert.equal(built.validation.behavior.length, 12);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch014CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 6],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch014AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 014 rollback");
          },
        }), /injected 014 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-014 runtime-active checkpoint:
    // later batches and the 0.24.51 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch014LiveValidation(active).run(),
      observed: await new Batch014ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 56, activations: 59, bridges: 89 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.14.0–.7 PASS: audit/plan replay, 12 parity cases, 56 evaluations once, " +
      "3 rollback fixtures, 59 live activations, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch014ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch014ArchitectureCheck };
