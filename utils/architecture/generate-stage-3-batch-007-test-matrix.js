"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_007_EXECUTION_PROFILE,
} = require("./domain_batches/stage_three_batch_execution_profile");
const {
  BATCH_007_BEHAVIOR_CASES,
  BATCH_007_COMPATIBILITY_CASES,
} = require("./domain_batches/stage_three_batch_007_focused_test_catalog");
const {
  StageThreeBatchFocusedTestMatrixBuilder,
  StageThreeBatchFocusedTestMatrixValidator,
} = require("./domain_batches/stage_three_batch_focused_test_matrix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  executionPlan: BATCH_007_EXECUTION_PROFILE.executionPlanPath,
  output: BATCH_007_EXECUTION_PROFILE.testMatrixPath,
});

function absolute(relativePath) {
  return path.join(PROJECT_ROOT, relativePath);
}

function matrixDependencies() {
  return {
    profile: BATCH_007_EXECUTION_PROFILE,
    behaviorCases: BATCH_007_BEHAVIOR_CASES,
    compatibilityCases: BATCH_007_COMPATIBILITY_CASES,
  };
}

function buildMatrix() {
  const planBytes = fs.readFileSync(absolute(PATHS.executionPlan));
  const executionPlan = JSON.parse(planBytes.toString("utf8"));
  const dependencies = matrixDependencies();
  const matrix = new StageThreeBatchFocusedTestMatrixBuilder(dependencies).build({
    executionPlan,
    executionPlanSha256: crypto.createHash("sha256").update(planBytes).digest("hex"),
  });
  new StageThreeBatchFocusedTestMatrixValidator(dependencies).validate(matrix);
  return matrix;
}

function serialize(matrix) {
  return Buffer.from(`${JSON.stringify(matrix, null, 2)}\n`, "utf8");
}

function writeMatrix(matrix) {
  fs.writeFileSync(absolute(PATHS.output), serialize(matrix));
}

if (require.main === module) {
  const matrix = buildMatrix();
  writeMatrix(matrix);
  console.log(
    `Stage 3.7.2 focused matrix generated: ${matrix.behaviorCases.length} behavior cases, ` +
      `${matrix.compatibilityCases.length} compatibility cases; ${matrix.verdict}.`,
  );
}

module.exports = {
  PATHS,
  buildMatrix,
  matrixDependencies,
  serialize,
  writeMatrix,
};
