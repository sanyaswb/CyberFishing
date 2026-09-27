"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("../../domain_batches/stage_three_live_preflight");
const { RepresentationOnlyReviewedEsmTarget } = require("../../domain_batches/stage_three_reviewed_representation_target");
const { StageThreeBatchPlanning } = require("./planning");
const { reviewedTargetEvaluation } = require("./target_evaluation");
const { StageThreeFocusedParityCheck } = require("./parity_check");
const { StageThreeBatchSourceBuild } = require("./source_build");
const { StageThreeCutoverProjection, StageThreeAtomicCutover } = require("./cutover");
const { StageThreeHistoricalWorkspace } = require("./historical_workspace");
const { StageThreeBatchLiveValidation } = require("./live_validation");
const { StageThreeBatchObservationApplication } = require("./observation_application");

// Replays one batch at every checkpoint: audit/plan/matrix and parity before the batch, the
// candidate build and injected cutover failures at prebuild, live and observation evidence at the
// runtime-active checkpoint. Negative fixtures prove tampered sources and unreviewed imports fail.
class StageThreeBatchArchitectureCheck {
  constructor(definition, registry) {
    this.definition = definition;
    this.registry = registry;
  }

  async run(root) {
    const definition = this.definition;
    const PROFILE = definition.profile;
    const execution = definition.execution;
    const history = new StageThreeHistoricalWorkspace(definition, this.registry);
    await history.run(root, async prior => {
      const preflight = new StageThreeLivePreflight(prior, PROFILE);
      const audit = preflight.json(execution.auditPath);
      preflight.verifyReplay(audit);
      assert.deepEqual(preflight.bytes(execution.auditPath), serialize(audit));
      const planning = new StageThreeBatchPlanning(prior, definition);
      assert.deepEqual(planning.bytes(execution.executionPlanPath), serialize(planning.plan()));
      assert.deepEqual(planning.bytes(execution.testMatrixPath), serialize(planning.matrix()));
      await new StageThreeFocusedParityCheck(definition).run(prior);
      this.#sourceFixtures(planning, audit);
      if (definition.fixtures.architecture) await definition.fixtures.architecture({ root: prior, planning, definition });
    });
    await history.run(root, async prior => {
      const built = await new StageThreeBatchSourceBuild(prior, definition).run();
      const topology = execution.expectedTopology;
      assert.equal(built.report.projectModules.length, topology.afterProjectModuleCount);
      assert.equal(built.report.activationOutputs.length, topology.afterActivationCount);
      assert(Object.values(built.evaluationProof.counts).every(count => count === 1));
      const prepared = await new StageThreeCutoverProjection(definition).prepare(prior);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const file = path.join(prior, write.relativePath);
        return [write.relativePath, fs.existsSync(file) ? fs.readFileSync(file) : null];
      }));
      const before = snapshot();
      const middle = Math.floor(prepared.writes.length / 2);
      for (const [phase, count] of [["after-staging", 0], ["after-replacement", middle],
        ["after-final-validation", prepared.writes.length]]) {
        assert.throws(() => new StageThreeAtomicCutover(prior, definition).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected batch rollback");
          },
        }), /injected batch rollback/);
        assert.deepEqual(snapshot(), before, "Batch-only rollback changed the frozen prefix");
      }
    }, { keepPrebuild: true });
    // A hot-loop batch re-runs the game-cycle trace in the replay, which needs the project tooling.
    const { live, observed } = await history.run(root, async active => ({
      live: await new StageThreeBatchLiveValidation(active, definition, this.registry).run(),
      observed: await new StageThreeBatchObservationApplication(active, definition, this.registry).check(),
    }), { keepCutover: true, copyTools: Object.values(PROFILE.reviewedContracts)
      .some(contract => (contract.hotLoopCallSites || []).length > 0) });
    const topology = execution.expectedTopology;
    assert.deepEqual(live.topology, { modules: topology.afterProjectModuleCount,
      activations: topology.afterActivationCount, bridges: topology.afterBridgeCount });
    assert.equal(observed.artifact.guards.failureCount, 0);
    return { live, observed };
  }

  // A tampered classic source and unreviewed or inexact imports must be rejected.
  #sourceFixtures(planning, audit) {
    const plan = planning.plan();
    for (const module of audit.scope.modules) {
      const imports = plan.scope.modules.find(item => item.currentPath === module.currentPath).importsAllowed;
      const project = overrides => new RepresentationOnlyReviewedEsmTarget().project({
        source: planning.read(module.currentPath), currentPath: module.currentPath, targetPath: module.targetPath,
        exports: module.exports, sourceSha256: module.sourceSha256,
        contract: this.definition.profile.reviewedContracts[module.currentPath], imports,
        targetEvaluation: reviewedTargetEvaluation(this.definition, file => planning.json(file), module.targetPath),
        ...overrides });
      assert.throws(() => project({ source: `${planning.read(module.currentPath)}\n// tampered` }),
        /source changed after audit/);
      assert.throws(() => project({ imports: [...imports, { specifier: "./unreviewed_import.js",
        exportName: "UnreviewedImport" }] }), /is not read by the classic source/);
      if (imports.length === 0) continue;
      assert.throws(() => project({ imports: [{ ...imports[0], exportName: `${imports[0].exportName}Unreviewed` },
        ...imports.slice(1)] }), /is not read by the classic source/);
      assert.throws(() => project({ imports: [{ ...imports[0], specifier: imports[0].specifier.replace(/\.js$/u, "") },
        ...imports.slice(1)] }), /import specifier is not exact/);
    }
  }
}

module.exports = { StageThreeBatchArchitectureCheck };
