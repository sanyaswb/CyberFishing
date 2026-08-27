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

const PROJECT_ROOT = path.resolve(__dirname, "../..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch007ExecutionPlanFixtureCheck {
  run() {
    const validator = new StageThreeBatchExecutionPlanValidator(BATCH_007_EXECUTION_PROFILE);
    const valid = validator.validate(JSON.parse(fs.readFileSync(path.join(
      PROJECT_ROOT,
      BATCH_007_EXECUTION_PROFILE.executionPlanPath,
    ), "utf8")));
    this.#reject(validator, valid, (plan) => { plan.runtimeMigrationAllowed = true; }, "early runtime unlock");
    this.#reject(validator, valid, (plan) => { plan.scope.partialCutoverAllowed = true; }, "partial cutover");
    this.#reject(validator, valid, (plan) => { plan.scope.modules.pop(); plan.scope.targetCount -= 1; }, "incomplete scope");
    this.#reject(validator, valid, (plan) => { plan.lifecycle.openState.activeBatchId = null; }, "missing open batch");
    this.#reject(validator, valid, (plan) => { delete plan.lifecycle.runtimeActiveState; }, "missing runtime-active phase");
    this.#reject(validator, valid, (plan) => { plan.lifecycle.runtimeActiveState.completedBatchIds.push(plan.batchId); }, "early completion");
    this.#reject(validator, valid, (plan) => { plan.compatibility.activations[0].legacyScriptIndex += 1; }, "activation drift");
    this.#reject(validator, valid, (plan) => { plan.compatibility.plannedBridgeRecords.pop(); }, "missing consumer bridge");
    this.#reject(validator, valid, (plan) => { plan.compatibility.plannedBridgeRecords[0].id = "bridge-deadbeef0000"; }, "non-canonical bridge");
    this.#reject(validator, valid, (plan) => { plan.compatibility.registryTransition.afterCount -= 1; }, "registry topology drift");
    this.#reject(validator, valid, (plan) => { plan.cumulativeRuntime.afterProjectModuleCount += 1; }, "module topology drift");
    this.#reject(validator, valid, (plan) => { plan.cumulativeRuntime.afterActivationCount -= 1; }, "activation topology drift");
    this.#reject(validator, valid, (plan) => { plan.cumulativeRuntime.expectedDependencyEdges.push({}); }, "unexpected dependency");
    this.#reject(validator, valid, (plan) => { plan.scope.modules[0].directTransportReadAllowed = true; }, "transport read");
    this.#reject(validator, valid, (plan) => { plan.stateAndBehaviorInvariants[0].duplicateStateCopies = "allowed"; }, "duplicate state");
    this.#reject(validator, valid, (plan) => { plan.rollback.removeBatchId = "stage-3.candidate-006-fishing-e48e70d8"; }, "cross-batch rollback");
    this.#reject(validator, valid, (plan) => { plan.sourceEvidence.scmCheckpoint.tag = "v0.24.42"; }, "SCM tag drift");
    this.#reject(validator, valid, (plan) => { [plan.operations[1], plan.operations[2]] = [plan.operations[2], plan.operations[1]]; }, "operation reorder");
    assert.equal(Object.isFrozen(valid), true);
    assert.equal(Object.isFrozen(valid.lifecycle.runtimeActiveState), true);
    console.log(
      "Stage 3.7.1 execution-plan fixtures passed: lifecycle, exact scope, activation/consumer sets, canonical bridges, topology, SCM checkpoint, state/performance and batch-only rollback failures are rejected.",
    );
  }

  #reject(validator, source, mutate, label) {
    const plan = clone(source);
    mutate(plan);
    assert.throws(
      () => validator.validate(plan),
      /Stage 3\.7\.1 execution-plan contract failed/u,
      label,
    );
  }
}

new StageThreeBatch007ExecutionPlanFixtureCheck().run();
