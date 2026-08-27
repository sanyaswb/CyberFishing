"use strict";

const assert = require("node:assert/strict");
const {
  StageThreeBatchFocusedTestMatrixValidator,
} = require("./domain_batches/stage_three_batch_focused_test_matrix");
const {
  buildMatrix,
  matrixDependencies,
} = require("./generate-stage-3-batch-007-test-matrix");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch007TestMatrixFixtureCheck {
  run() {
    const validator = new StageThreeBatchFocusedTestMatrixValidator(matrixDependencies());
    const valid = validator.validate(buildMatrix());
    this.#reject(validator, valid, (matrix) => matrix.behaviorCases.pop(), "missing behavior case");
    this.#reject(validator, valid, (matrix) => matrix.compatibilityCases.pop(), "missing compatibility case");
    this.#reject(validator, valid, (matrix) => {
      matrix.behaviorCases[0].phases = ["classic-baseline", "post-cutover-esm"];
    }, "missing temporary ESM phase");
    this.#reject(validator, valid, (matrix) => {
      matrix.identityContract.moduleEvaluationCount = 2;
    }, "duplicate evaluation");
    this.#reject(validator, valid, (matrix) => {
      matrix.consumerContract.exactRelationshipCount = 8;
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
      matrix.statePerformanceContract.transportSurfaceSource = "hardcoded.exports";
    }, "transport schema duplication");
    this.#reject(validator, valid, (matrix) => {
      matrix.runtimeCutoverAllowed = true;
    }, "early runtime cutover");
    this.#reject(validator, valid, (matrix) => {
      matrix.sourceExecutionPlan.sha256 = "stale";
    }, "stale execution-plan evidence");
    assert.equal(Object.isFrozen(valid), true);
    assert.equal(Object.isFrozen(valid.statePerformanceContract.modules[0]), true);
    console.log(
      "Stage 3.7.2 focused-matrix fixtures passed: exact behavior/compatibility phases, identity, nine consumers, zero allocation/transport budgets, contract-derived transport surface and prebuild-only permission are enforced.",
    );
  }

  #reject(validator, source, mutate, label) {
    const matrix = clone(source);
    mutate(matrix);
    assert.throws(
      () => validator.validate(matrix),
      /Stage 3\.7\.2 focused-matrix contract failed/u,
      label,
    );
  }
}

new StageThreeBatch007TestMatrixFixtureCheck().run();
