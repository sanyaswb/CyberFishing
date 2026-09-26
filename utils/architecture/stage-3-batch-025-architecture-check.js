"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_025_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_025_preflight_profile");
const { Batch025Planning } = require("./domain_batches/stage_three_batch_025_planning");
const { Batch025FocusedParityCheck } = require("./stage-3-batch-025-focused-parity-check");
const { Batch025SourceBuild } = require("./domain_batches/stage_three_batch_025_source_build");
const { Batch025CutoverProjection, Batch025AtomicCutover } =
  require("./domain_batches/stage_three_batch_025_cutover");
const { Batch025HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_025_historical_workspace");
const { Batch025LiveValidation } = require("./domain_batches/stage_three_batch_025_live_validation");
const { Batch025ObservationApplication } =
  require("./domain_batches/stage_three_batch_025_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch025ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch025HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch025Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch025FocusedParityCheck().run(prior);
      const first = audit.scope.modules[0];
      const imports = planning.plan().scope.modules[0].importsAllowed;
      const project = (overrides) => new RepresentationOnlyReviewedEsmTarget().project({
        source: planning.read(first.currentPath), currentPath: first.currentPath, targetPath: first.targetPath,
        exports: first.exports, sourceSha256: first.sourceSha256,
        contract: PROFILE.reviewedContracts[first.currentPath], imports, ...overrides });
      assert.throws(() => project({ source: `${planning.read(first.currentPath)}\n// tampered` }),
        /source changed after audit/);
      // Negative import fixtures: an unreviewed binding, an inexact specifier and an import the
      // classic source never reads are rejected.
      assert.throws(() => project({ imports: [{ ...imports[0], exportName: "PoleFightSectorFrame" }] }),
        /is not read by the classic source/);
      assert.throws(() => project({ imports: [{ ...imports[0], specifier: "./pole_fight_sector_geometry" }] }),
        /import specifier is not exact/);
      assert.throws(() => project({ imports: [...imports, { specifier: "../fish/fish.js", exportName: "Fish" }] }),
        /is not read by the classic source/);
    });
    await history.run(root, async prior => {
      const built = await new Batch025SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 86);
      assert.equal(built.report.activationOutputs.length, 94);
      assert.equal(built.validation.behavior.length, 4);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch025CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 6],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch025AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 025 rollback");
          },
        }), /injected 025 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-025 runtime-active checkpoint:
    // later batches and the 0.24.63 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch025LiveValidation(active).run(),
      observed: await new Batch025ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 86, activations: 94, bridges: 141 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.26.0–.7 PASS: audit/plan replay, 4 parity cases, 3 import fixtures, 86 evaluations once, " +
      "3 rollback fixtures, 94 live activations, 2 retired placeholders, 1 reviewed exposure, 5 retired bridges, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch025ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch025ArchitectureCheck };
