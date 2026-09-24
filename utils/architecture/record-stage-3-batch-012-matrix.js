"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { BATCH_012_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_012_preflight_profile");
const { Batch012Planning } = require("./domain_batches/stage_three_batch_012_planning");

class Batch012MatrixRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    const output = PROFILE.executionProfile.testMatrixPath;
    assert(!fs.existsSync(path.join(root, output)), "Focused matrix is immutable");
    const matrix = new Batch012Planning(root).matrix();
    assert.equal(matrix.behaviorCases.length, 6);
    const bytes = Buffer.from(`${JSON.stringify(matrix, null, 2)}\n`, "utf8");
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: output, bytes },
    ], () => assert.deepEqual(fs.readFileSync(path.join(root, output)), bytes));
    console.log("Stage 3.12.2 focused matrix recorded: 6 behavior cases and 7 compatibility gates; runtime unchanged.");
    return matrix;
  }
}

if (require.main === module) {
  try { new Batch012MatrixRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch012MatrixRecorder };
