"use strict";

const assert = require("node:assert/strict");
const {
  StageThreeBatchFocusedTestMatrixValidator,
} = require("./domain_batches/stage_three_batch_focused_test_matrix");
const {
  buildMatrix,
  matrixDependencies,
} = require("./generate-stage-3-batch-008-test-matrix");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch008TestMatrixFixtureCheck {
  run() {
    const validator = new StageThreeBatchFocusedTestMatrixValidator(matrixDependencies());
    const valid = validator.validate(buildMatrix());
    this.#reject(validator, valid, (matrix) => matrix.behaviorCases.pop(),
      "missing behavior case");
    this.#reject(validator, valid, (matrix) => matrix.compatibilityCases.pop(),
      "missing compatibility case");
    this.#reject(validator, valid, (matrix) => {
      matrix.behaviorCases[0].phases = ["classic-baseline", "post-cutover-esm"];
    }, "missing temporary ESM phase");
    this.#reject(validator, valid, (matrix) => {
      matrix.identityContract.moduleEvaluationCount = 2;
    }, "duplicate evaluation");
    this.#reject(validator, valid, (matrix) => {
      matrix.identityContract.globalAbsentBeforeActivation = false;
    }, "early global exposure");
    this.#reject(validator, valid, (matrix) => {
      matrix.consumerContract.exactRelationshipCount = 2;
    }, "partial consumer set");
    this.#reject(validator, valid, (matrix) => {
      matrix.consumerContract.consumerSetSource = "guessed-consumers";
    }, "consumer source drift");
    this.#reject(validator, valid, (matrix) => {
      matrix.statePerformanceContract.additionalMigrationAllocationsAllowed = 1;
    }, "allocation budget expansion");
    this.#reject(validator, valid, (matrix) => {
      matrix.statePerformanceContract.transportLookupsAllowed = 1;
    }, "transport lookup budget expansion");
    this.#reject(validator, valid, (matrix) => {
      matrix.statePerformanceContract.modules[0].resultShape = null;
    }, "result shape removal");
    this.#reject(validator, valid, (matrix) => {
      matrix.runtimeCutoverAllowed = true;
    }, "early runtime cutover");
    this.#reject(validator, valid, (matrix) => {
      matrix.sourceExecutionPlan.sha256 = "stale";
    }, "stale execution-plan evidence");
    assert.equal(Object.isFrozen(valid), true);
    assert.equal(Object.isFrozen(valid.statePerformanceContract.modules[0]), true);
    console.log(
      "Stage 3.8.2 focused-matrix fixtures passed: exact 36-case behavior coverage, " +
      "identity/timing, three consumers, state/result shapes and zero allocation/transport budgets fail closed.",
    );
  }

  #reject(validator, source, mutate, label) {
    const matrix = clone(source);
    mutate(matrix);
    assert.throws(
      () => validator.validate(matrix),
      /Stage 3\.8\.2 focused-matrix contract failed/u,
      label,
    );
  }
}

new StageThreeBatch008TestMatrixFixtureCheck().run();
