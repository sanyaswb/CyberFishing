"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_022_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_022_preflight_profile");
const { Batch022Planning } = require("./domain_batches/stage_three_batch_022_planning");
const { Batch022FocusedParityCheck } = require("./stage-3-batch-022-focused-parity-check");
const { Batch022SourceBuild } = require("./domain_batches/stage_three_batch_022_source_build");
const { Batch022CutoverProjection, Batch022AtomicCutover } =
  require("./domain_batches/stage_three_batch_022_cutover");
const { Batch022HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_022_historical_workspace");
const { Batch022LiveValidation } = require("./domain_batches/stage_three_batch_022_live_validation");
const { Batch022ObservationApplication } =
  require("./domain_batches/stage_three_batch_022_observation_application");
const { RepresentationOnlyReviewedEsmTarget } =
  require("./domain_batches/stage_three_reviewed_representation_target");

class Batch022ArchitectureCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const history = new Batch022HistoricalWorkspace();
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(audit));
      const planning = new Batch022Planning(prior);
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.executionPlanPath),
        serialize(planning.plan()));
      assert.deepEqual(planning.bytes(PROFILE.executionProfile.testMatrixPath),
        serialize(planning.matrix()));
      await new Batch022FocusedParityCheck().run(prior);
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
      assert.throws(() => project({ imports: [{ ...imports[0], exportName: "InventoryItemLocationKind" }] }),
        /is not read by the classic source/);
      assert.throws(() => project({ imports: [{ ...imports[0], specifier: "../inventory/inventory_item_location" }] }),
        /import specifier is not exact/);
      assert.throws(() => project({ imports: [...imports, { specifier: "../fish/fish.js", exportName: "Fish" }] }),
        /is not read by the classic source/);
    });
    await history.run(root, async prior => {
      const built = await new Batch022SourceBuild(prior).run();
      assert.equal(built.report.projectModules.length, 79);
      assert.equal(built.report.activationOutputs.length, 89);
      assert.equal(built.validation.behavior.length, 4);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new Batch022CutoverProjection().prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", 6],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new Batch022AtomicCutover(prior).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected 022 rollback");
          },
        }), /injected 022 rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed frozen prefix");
      }
    }, { keepPrebuild: true });
    // Live/observation evidence is replayed at the batch-022 runtime-active checkpoint:
    // later batches and the 0.24.60 release metadata are reversed in an isolated copy.
    const { live, observed } = await history.run(root, async active => ({
      live: await new Batch022LiveValidation(active).run(),
      observed: await new Batch022ObservationApplication(active).check(),
    }), { keepCutover: true });
    assert.deepEqual(live.topology, { modules: 79, activations: 89, bridges: 142 });
    assert.equal(observed.artifact.guards.failureCount, 0);
    console.log("Stage 3.23.0–.7 PASS: audit/plan replay, 4 parity cases, 3 import fixtures, 79 evaluations once, " +
      "3 rollback fixtures, 89 live activations, 1 retired bridge, Manifest and guards.");
    return { live, observed };
  }
}

if (require.main === module) new Batch022ArchitectureCheck().run()
  .catch(error => { console.error(error.stack); process.exitCode = 1; });

module.exports = { Batch022ArchitectureCheck };
