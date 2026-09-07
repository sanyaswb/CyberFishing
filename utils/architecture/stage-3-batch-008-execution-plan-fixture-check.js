"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_008_EXECUTION_PROFILE,
} = require("./domain_batches/stage_three_batch_008_execution_profile");
const {
  StageThreeBatchExecutionPlanValidator,
} = require("./domain_batches/stage_three_batch_execution_plan");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch008ExecutionPlanFixtureCheck {
  run() {
    const validator = new StageThreeBatchExecutionPlanValidator(BATCH_008_EXECUTION_PROFILE);
    const valid = validator.validate(JSON.parse(fs.readFileSync(path.join(
      PROJECT_ROOT,
      BATCH_008_EXECUTION_PROFILE.executionPlanPath,
    ), "utf8")));

    this.#reject(validator, valid, (plan) => { plan.runtimeMigrationAllowed = true; },
      "early runtime unlock");
    this.#reject(validator, valid, (plan) => { plan.scope.partialCutoverAllowed = true; },
      "partial cutover");
    this.#reject(validator, valid, (plan) => {
      plan.scope.modules.pop();
      plan.scope.targetCount -= 1;
    }, "incomplete scope");
    this.#reject(validator, valid, (plan) => { plan.lifecycle.preState.completedBatchIds.pop(); },
      "incomplete completed prefix");
    this.#reject(validator, valid, (plan) => { plan.lifecycle.openState.activeBatchPhase = "runtime-active"; },
      "open phase drift");
    this.#reject(validator, valid, (plan) => { plan.lifecycle.openState.projectModuleCount = 34; },
      "early runtime topology");
    this.#reject(validator, valid, (plan) => { plan.lifecycle.runtimeActiveState.activeBatchPhase = "prebuild"; },
      "runtime phase drift");
    this.#reject(validator, valid, (plan) => { plan.lifecycle.runtimeActiveState.bridgeRecordCount = 59; },
      "runtime bridge topology drift");
    this.#reject(validator, valid, (plan) => { plan.lifecycle.completedState.releaseVersion = "0.24.44"; },
      "completion release drift");
    this.#reject(validator, valid, (plan) => { plan.lifecycle.completedState.activeBatchPhase = "completed"; },
      "stale completed phase");
    this.#reject(validator, valid, (plan) => { plan.compatibility.activations[0].legacyScriptIndex += 1; },
      "activation drift");
    this.#reject(validator, valid, (plan) => { plan.compatibility.plannedBridgeRecords.pop(); },
      "missing consumer bridge");
    this.#reject(validator, valid, (plan) => {
      plan.compatibility.plannedBridgeRecords[0].id = "bridge-deadbeef0000";
    }, "non-canonical bridge");
    this.#reject(validator, valid, (plan) => { plan.cumulativeRuntime.afterProjectModuleCount += 1; },
      "module topology drift");
    this.#reject(validator, valid, (plan) => { plan.cumulativeRuntime.expectedDependencyEdges.push({}); },
      "unexpected dependency");
    this.#reject(validator, valid, (plan) => { plan.scope.modules[0].directTransportReadAllowed = true; },
      "transport read");
    this.#reject(validator, valid, (plan) => { plan.stateAndBehaviorInvariants[0].resultShape = null; },
      "result shape removal");
    this.#reject(validator, valid, (plan) => {
      plan.stateAndBehaviorInvariants[0].additionalMigrationAllocationsAllowed = 1;
    }, "hot-loop allocation drift");
    this.#reject(validator, valid, (plan) => { plan.rollback.partialRollbackAllowed = true; },
      "partial rollback");
    this.#reject(validator, valid, (plan) => { plan.rollback.removeBatchId = "batch-007"; },
      "cross-batch rollback");
    this.#reject(validator, valid, (plan) => { plan.rollback.baselineEvidence.files.pop(); },
      "incomplete rollback evidence");
    this.#reject(validator, valid, (plan) => {
      plan.rollback.baselineEvidence.runtimeOutput.fingerprint = "0".repeat(64);
    }, "runtime output fingerprint drift");
    this.#reject(validator, valid, (plan) => { plan.sourceEvidence.scmCheckpoint.tag = "v0.24.43"; },
      "SCM tag drift");
    this.#reject(validator, valid, (plan) => {
      [plan.operations[1], plan.operations[2]] = [plan.operations[2], plan.operations[1]];
    }, "operation reorder");

    assert.equal(Object.isFrozen(valid), true);
    assert.equal(Object.isFrozen(valid.lifecycle.runtimeActiveState), true);
    console.log(
      "Stage 3.8.1 execution-plan fixtures passed: exact lifecycle phases/topology, atomic scope, " +
      "canonical compatibility, state/performance gates, rollback evidence and SCM checkpoint fail closed.",
    );
  }

  #reject(validator, source, mutate, label) {
    const plan = clone(source);
    mutate(plan);
    assert.throws(
      () => validator.validate(plan),
      /Stage 3\.8\.1 execution-plan contract failed/u,
      label,
    );
  }
}

new StageThreeBatch008ExecutionPlanFixtureCheck().run();
