"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeBatchFocusedTestMatrixBuilder, StageThreeBatchFocusedTestMatrixValidator } =
  require("./domain_batches/stage_three_batch_focused_test_matrix");
const { BATCH_013_EXECUTION_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_013_preflight_profile");
const { BATCH_013_MATRIX_DEPENDENCIES: CASES } =
  require("./domain_batches/stage_three_batch_013_focused_test_catalog");

class Batch013MatrixRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    const planBytes = fs.readFileSync(path.join(root, PROFILE.executionPlanPath));
    const matrix = new StageThreeBatchFocusedTestMatrixBuilder(CASES).build({
      executionPlan: JSON.parse(planBytes),
      executionPlanSha256: crypto.createHash("sha256").update(planBytes).digest("hex"),
    });
    new StageThreeBatchFocusedTestMatrixValidator(CASES).validate(matrix);
    const bytes = Buffer.from(`${JSON.stringify(matrix, null, 2)}\n`, "utf8");
    const target = path.join(root, PROFILE.testMatrixPath);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Immutable batch 013 matrix drift");
    else new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: PROFILE.testMatrixPath, bytes },
    ], () => assert.deepEqual(fs.readFileSync(target), bytes));
    console.log(`Stage 3.13.2 matrix recorded: ${matrix.behaviorCases.length} behavior cases, ` +
      `${matrix.compatibilityCases.length} compatibility cases; runtime unchanged.`);
    return matrix;
  }
}

if (require.main === module) {
  try { new Batch013MatrixRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch013MatrixRecorder };
