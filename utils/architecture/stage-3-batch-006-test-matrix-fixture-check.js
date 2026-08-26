"use strict";

const assert = require("node:assert/strict");
const {
  StageThreeBatchFocusedTestMatrixValidator,
} = require("./domain_batches/stage_three_batch_focused_test_matrix");
const { buildMatrix } = require("./generate-stage-3-batch-006-test-matrix");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch006TestMatrixFixtureCheck {
  run() {
    const valid = buildMatrix();
    const validator = new StageThreeBatchFocusedTestMatrixValidator();
    assert.doesNotThrow(() => validator.validate(valid));
    this.#reject(validator, valid, (matrix) => matrix.behaviorCases.pop(), "missing behavior case");
    this.#reject(validator, valid, (matrix) => matrix.compatibilityCases.pop(), "missing compatibility case");
    this.#reject(validator, valid, (matrix) => {
      matrix.behaviorCases[0].phases = ["post-cutover-esm"];
    }, "missing baseline phase");
    this.#reject(validator, valid, (matrix) => {
      matrix.identityContract.moduleEvaluationCount = 2;
    }, "duplicate evaluation");
    this.#reject(validator, valid, (matrix) => {
      matrix.consumerContract.exactRelationshipCount = 6;
    }, "partial consumer set");
    this.#reject(validator, valid, (matrix) => {
      matrix.consumerContract.directTransportReadsAllowed = true;
    }, "transport dependency");
    this.#reject(validator, valid, (matrix) => {
      matrix.runtimeCutoverAllowed = true;
    }, "early runtime cutover");
    this.#reject(validator, valid, (matrix) => {
      matrix.sourceExecutionPlan.sha256 = "stale";
    }, "stale execution plan");
    assert.equal(Object.isFrozen(valid), true);
    assert.equal(Object.isFrozen(valid.behaviorCases[0]), true);
    console.log(
      "Stage 3.6.3 focused-matrix fixtures passed: incomplete behavior/compatibility coverage, duplicate identity, partial consumers, transport leakage, early cutover and stale evidence are rejected.",
    );
  }

  #reject(validator, source, mutate, label) {
    const matrix = clone(source);
    mutate(matrix);
    assert.throws(
      () => validator.validate(matrix),
      /Stage 3\.6\.3 focused-matrix contract failed/u,
      label,
    );
  }
}

new StageThreeBatch006TestMatrixFixtureCheck().run();
