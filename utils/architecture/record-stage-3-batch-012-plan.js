"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { Batch012Planning, PLAN_PATHS } = require("./domain_batches/stage_three_batch_012_planning");

class Batch012PlanRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    assert(!fs.existsSync(path.join(root, PLAN_PATHS.output)), "Execution plan is immutable");
    const planning = new Batch012Planning(root);
    const plan = planning.plan();
    const bytes = planning.projector.serialize(plan);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: PLAN_PATHS.output, bytes },
    ], () => assert.deepEqual(fs.readFileSync(path.join(root, PLAN_PATHS.output)), bytes));
    console.log("Stage 3.12.1 plan recorded: exact 2-target atomic migration, 2 bridges, batch-only rollback; live runtime unchanged.");
    return plan;
  }
}

if (require.main === module) {
  try { new Batch012PlanRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch012PlanRecorder };
