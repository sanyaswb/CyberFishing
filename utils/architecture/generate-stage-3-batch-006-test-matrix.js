"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchFocusedTestMatrixBuilder,
  StageThreeBatchFocusedTestMatrixValidator,
} = require("./domain_batches/stage_three_batch_focused_test_matrix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  executionPlan: "architecture/migration/stage_3_batch_006_execution_plan.json",
  output: "architecture/migration/stage_3_batch_006_test_matrix.json",
});

function absolute(relativePath) {
  return path.join(PROJECT_ROOT, relativePath);
}

function buildMatrix() {
  const planBytes = fs.readFileSync(absolute(PATHS.executionPlan));
  const executionPlan = JSON.parse(planBytes.toString("utf8"));
  const matrix = new StageThreeBatchFocusedTestMatrixBuilder().build({
    executionPlan,
    executionPlanSha256: crypto.createHash("sha256").update(planBytes).digest("hex"),
  });
  new StageThreeBatchFocusedTestMatrixValidator().validate(matrix);
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
    `Stage 3.6.3 focused matrix generated: ${matrix.behaviorCases.length} behavior cases, ` +
      `${matrix.compatibilityCases.length} compatibility cases; ${matrix.verdict}.`,
  );
}

module.exports = { PATHS, buildMatrix, serialize, writeMatrix };
