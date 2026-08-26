"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchExecutionPlanValidator,
} = require("./domain_batches/stage_three_batch_execution_plan");
const {
  buildPlan,
} = require("./generate-stage-3-batch-006-execution-plan");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch006ExecutionPlanFixtureCheck {
  run() {
    const validator = new StageThreeBatchExecutionPlanValidator();
    const state = JSON.parse(fs.readFileSync(path.resolve(
      __dirname,
      "../../architecture/migration/stage_3_execution_state.json",
    ), "utf8"));
    const historical = state.activeBatchId === "stage-3.candidate-006-fishing-e48e70d8" ||
      state.completedBatchIds.includes("stage-3.candidate-006-fishing-e48e70d8");
    const source = historical
      ? JSON.parse(fs.readFileSync(path.resolve(
        __dirname,
        "../../architecture/migration/stage_3_batch_006_execution_plan.json",
      ), "utf8"))
      : buildPlan();
    const valid = validator.validate(source);

    this.#reject(validator, valid, (plan) => {
      plan.runtimeMigrationAllowed = true;
    }, "early runtime unlock");
    this.#reject(validator, valid, (plan) => {
      plan.scope.partialCutoverAllowed = true;
    }, "partial cutover");
    this.#reject(validator, valid, (plan) => {
      plan.scope.modules.pop();
      plan.scope.targetCount -= 1;
    }, "incomplete scope");
    this.#reject(validator, valid, (plan) => {
      plan.lifecycle.openState.activeBatchId = "stage-3.candidate-007-fishing-bb8b3939";
    }, "wrong active batch");
    this.#reject(validator, valid, (plan) => {
      plan.lifecycle.completedState.completedBatchIds.pop();
    }, "incomplete completed prefix");
    this.#reject(validator, valid, (plan) => {
      plan.compatibility.plannedBridgeRecords.pop();
    }, "missing consumer bridge");
    this.#reject(validator, valid, (plan) => {
      plan.compatibility.plannedBridgeRecords[0].id = "bridge-deadbeef0000";
    }, "non-canonical bridge ID");
    this.#reject(validator, valid, (plan) => {
      plan.cumulativeRuntime.afterProjectModuleCount += 1;
    }, "unapproved closure addition");
    this.#reject(validator, valid, (plan) => {
      plan.cumulativeRuntime.afterActivationCount -= 1;
    }, "activation count mismatch");
    this.#reject(validator, valid, (plan) => {
      plan.scriptTopology.after.logicalLegacyPositionCount += 1;
    }, "legacy order shift");
    this.#reject(validator, valid, (plan) => {
      [plan.operations[1], plan.operations[2]] = [plan.operations[2], plan.operations[1]];
    }, "operation reorder");
    this.#reject(validator, valid, (plan) => {
      plan.rollback.partialRollbackAllowed = true;
    }, "partial rollback");
    this.#reject(validator, valid, (plan) => {
      plan.stateAndBehaviorInvariants[0].formulasApiDefaultsAndResultShapes = "may-change";
    }, "behavior mutation");
    this.#reject(validator, valid, (plan) => {
      plan.sourceEvidence.audit.sha256 = "stale";
    }, "stale source evidence");

    assert.equal(Object.isFrozen(valid), true);
    assert.equal(Object.isFrozen(valid.scope.modules[0]), true);
    console.log(
      "Stage 3.6.2 execution-plan fixtures passed: early unlock, partial scope, lifecycle, bridge, closure, ordering, rollback, behavior and stale-evidence failures are rejected.",
    );
  }

  #reject(validator, source, mutate, label) {
    const plan = clone(source);
    mutate(plan);
    assert.throws(
      () => validator.validate(plan),
      /Stage 3\.6\.2 execution-plan contract failed/u,
      label,
    );
  }
}

new StageThreeBatch006ExecutionPlanFixtureCheck().run();
