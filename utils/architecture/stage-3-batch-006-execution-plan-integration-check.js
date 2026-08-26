"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  PATHS,
  buildPlan,
  serialize,
} = require("./generate-stage-3-batch-006-execution-plan");
const {
  StageThreeBatchExecutionPlanValidator,
} = require("./domain_batches/stage_three_batch_execution_plan");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class StageThreeBatch006ExecutionPlanIntegrationCheck {
  run() {
    const protectedPaths = [
      "src/core/fishing/hold_opposition_resolver.js",
      "src/core/fishing/landing_lift_tension_calculator.js",
      "src/core/fishing/line_constraint_state_resolver.js",
      "src/core/fishing/pole_fight_sector_geometry.js",
      "src/core/fishing/rod_control_tension_mode_resolver.js",
      "src/core/float_tackle_line_budget_policy.js",
      "index.html",
      "architecture/guards/migration_bridge_registry.json",
      "architecture/migration/module_migration_manifest.json",
      "architecture/migration/stage_3_compatibility_runtime.json",
      "architecture/migration/stage_3_execution_state.json",
    ];
    const before = new Map(protectedPaths.map((relativePath) => [
      relativePath,
      this.#read(relativePath),
    ]));
    const state = JSON.parse(this.#read(
      "architecture/migration/stage_3_execution_state.json",
    ).toString("utf8"));
    const historical = state.activeBatchId === "stage-3.candidate-006-fishing-e48e70d8" ||
      state.completedBatchIds.includes("stage-3.candidate-006-fishing-e48e70d8");
    const plan = historical
      ? JSON.parse(this.#read(PATHS.output).toString("utf8"))
      : buildPlan();
    new StageThreeBatchExecutionPlanValidator().validate(plan);
    if (!historical) {
      assert.deepEqual(this.#read(PATHS.output), serialize(plan));
    }
    assert.equal(plan.runtimeMigrationAllowed, false);
    assert.equal(plan.scope.targetCount, 6);
    assert.equal(plan.scope.exportCount, 6);
    assert.equal(plan.scope.activationCount, 6);
    assert.equal(plan.scope.consumerRelationshipCount, 7);
    assert.deepEqual(
      plan.scope.modules.map((module) => module.stateClassification).sort(),
      [
        "instance-local-config-reference",
        "instance-local-derived-buffer",
        "stateless-behavior",
        "stateless-behavior",
        "stateless-behavior",
        "stateless-behavior",
      ],
    );
    assert.equal(plan.lifecycle.preState.completedBatchIds.length, 5);
    assert.equal(plan.lifecycle.openState.activeBatchId, plan.batchId);
    assert.equal(plan.lifecycle.completedState.completedBatchIds.length, 6);
    assert.equal(plan.lifecycle.completedState.activeBatchId, null);
    assert.deepEqual(
      plan.compatibility.activations.map((activation) => activation.legacyScriptIndex)
        .sort((left, right) => left - right),
      [88, 123, 126, 130, 134, 140],
    );
    const plannedConsumers = plan.compatibility.plannedBridgeRecords
      .map((record) => `${record.bridge}\0${record.source}`)
      .sort();
    assert.equal(plannedConsumers.length, 7);
    assert.equal(new Set(plannedConsumers).size, 7);
    assert.deepEqual(plan.compatibility.registryTransition, {
      beforeCount: 41,
      addCount: 7,
      afterCount: 48,
      operation: "exact-set-union-by-canonical-id",
    });
    assert.equal(plan.cumulativeRuntime.beforeProjectModuleCount, 19);
    assert.equal(plan.cumulativeRuntime.afterProjectModuleCount, 25);
    assert.equal(plan.cumulativeRuntime.beforeActivationCount, 20);
    assert.equal(plan.cumulativeRuntime.afterActivationCount, 26);
    assert.deepEqual(plan.cumulativeRuntime.expectedDependencyEdges, []);
    assert.deepEqual(plan.scriptTopology.before, {
      physicalClassicScriptCount: 426,
      logicalLegacyPositionCount: 424,
      moduleScriptCount: 0,
      cumulativeRuntimeScriptCount: 1,
      isolatedIifeScriptCount: 0,
    });
    assert.equal(plan.rollback.atomic, true);
    assert.equal(plan.rollback.partialRollbackAllowed, false);
    assert.equal(plan.rollback.preserveCompletedBatchIds.length, 5);
    assert.equal(plan.rollback.removeBatchId, plan.batchId);
    assert.equal(plan.verdict, "eligible-for-focused-test-matrix");
    for (const targetPath of plan.rollback.targetsAbsentBeforeCutover) {
      assert.equal(
        fs.existsSync(path.join(PROJECT_ROOT, targetPath)),
        historical,
      );
    }
    for (const [relativePath, bytes] of before) {
      assert.deepEqual(this.#read(relativePath), bytes, `execution plan mutated ${relativePath}`);
    }
    console.log(
      `Stage 3.6.2 atomic execution plan passed: six targets, six activations, seven canonical consumer bridges, 19→25 modules, 20→26 activations and batch-006-only rollback remain frozen${historical ? " after cutover" : " without runtime changes"}.`,
    );
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  }
}

new StageThreeBatch006ExecutionPlanIntegrationCheck().run();
