"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_007_EXECUTION_PROFILE,
} = require("./domain_batches/stage_three_batch_execution_profile");
const {
  StageThreeBatchExecutionPlanValidator,
} = require("./domain_batches/stage_three_batch_execution_plan");
const {
  PATHS,
  buildPlan,
  serialize,
} = require("./generate-stage-3-batch-007-execution-plan");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const EXPECTED_ACTIVATIONS = Object.freeze([
  "activation-00287f399f05",
  "activation-a63204f0676b",
  "activation-ccddea60d16c",
  "activation-da8d3f6d370f",
  "activation-dcb3cecb345c",
  "activation-f5eefdd6e6e2",
]);
const EXPECTED_BRIDGES = Object.freeze([
  "bridge-1975df3eebf9",
  "bridge-292102f00c09",
  "bridge-9987d14a6b96",
  "bridge-c5b20a842e06",
  "bridge-d88e995bce27",
  "bridge-dcceaaf04a57",
  "bridge-dd65f33afb4a",
  "bridge-ddf61a64424b",
  "bridge-f20190e70bbd",
]);

class StageThreeBatch007ExecutionPlanIntegrationCheck {
  run() {
    const protectedPaths = [
      "src/core/fishing/line_constrained_fish_motion_resolver.js",
      "src/core/fishing/line_radial_movement_splitter.js",
      "src/core/fishing/reel_retrieve_speed_calculator.js",
      "src/core/fishing/rod_pull_state.js",
      "src/core/fishing/rod_stroke_state.js",
      "src/core/fishing/simple_fight_force_calculator.js",
      "index.html",
      "architecture/guards/migration_bridge_registry.json",
      "architecture/migration/module_migration_manifest.json",
      "architecture/migration/stage_3_compatibility_runtime.json",
      "architecture/migration/stage_3_execution_state.json",
    ];
    const before = new Map(protectedPaths.map((relativePath) => [relativePath, this.#read(relativePath)]));
    const plan = buildPlan();
    new StageThreeBatchExecutionPlanValidator(BATCH_007_EXECUTION_PROFILE).validate(plan);
    assert.deepEqual(this.#read(PATHS.output), serialize(plan));
    assert.deepEqual(plan.scope, {
      ...plan.scope,
      atomic: true,
      partialCutoverAllowed: false,
      targetCount: 6,
      exportCount: 6,
      activationCount: 6,
      consumerRelationshipCount: 9,
    });
    assert.deepEqual(plan.compatibility.activations.map((record) => record.id), EXPECTED_ACTIVATIONS);
    assert.deepEqual(plan.compatibility.plannedBridgeRecords.map((record) => record.id), EXPECTED_BRIDGES);
    assert.deepEqual(plan.compatibility.registryTransition, {
      beforeCount: 48,
      addCount: 9,
      afterCount: 57,
      operation: "exact-set-union-by-canonical-id",
    });
    assert.equal(plan.cumulativeRuntime.beforeProjectModuleCount, 25);
    assert.equal(plan.cumulativeRuntime.afterProjectModuleCount, 31);
    assert.equal(plan.cumulativeRuntime.beforeActivationCount, 26);
    assert.equal(plan.cumulativeRuntime.afterActivationCount, 32);
    assert.deepEqual(plan.cumulativeRuntime.expectedDependencyEdges, []);
    assert.equal(plan.lifecycle.preState.completedBatchIds.length, 6);
    assert.equal(plan.lifecycle.openState.activeBatchId, plan.batchId);
    assert.equal(plan.lifecycle.runtimeActiveState.activeBatchId, plan.batchId);
    assert.equal(plan.lifecycle.runtimeActiveState.projectModuleCount, 31);
    assert.equal(plan.lifecycle.completedState.completedBatchIds.length, 7);
    assert.equal(plan.lifecycle.completedState.activeBatchId, null);
    assert.equal(plan.rollback.fromRelease, "0.24.44");
    assert.equal(plan.rollback.toRelease, "0.24.43");
    assert.equal(plan.rollback.preserveCompletedBatchIds.length, 6);
    assert.equal(plan.rollback.removeBatchId, plan.batchId);
    assert.equal(plan.sourceEvidence.scmCheckpoint.tag, "v0.24.43");
    assert.equal(plan.sourceEvidence.scmCheckpoint.tagType, "tag");
    assert.equal(plan.runtimeMigrationAllowed, false);
    assert.equal(plan.verdict, "eligible-for-focused-test-matrix");
    for (const module of plan.scope.modules) {
      assert.deepEqual(module.importsAllowed, []);
      assert.equal(module.behaviorChangeAllowed, false);
      assert.equal(module.directTransportReadAllowed, false);
      assert.equal(fs.existsSync(path.join(PROJECT_ROOT, module.targetPath)), false);
    }
    for (const [relativePath, bytes] of before) {
      assert.deepEqual(this.#read(relativePath), bytes, `execution-plan generation mutated ${relativePath}`);
    }
    console.log(
      "Stage 3.7.1 atomic execution plan passed: exact SCM-tagged v0.24.43 baseline, pre/open/runtime-active/completed lifecycle, 25→31 modules, 26→32 activations, 48→57 bridges and batch-007-only rollback are frozen read-only.",
    );
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  }
}

new StageThreeBatch007ExecutionPlanIntegrationCheck().run();
