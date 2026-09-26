"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeBatchExecutionPlanValidator } =
  require("./domain_batches/stage_three_batch_execution_plan");
const { StageThreeLivePreflight } = require("./domain_batches/stage_three_live_preflight");
const { Batch025Planning } = require("./domain_batches/stage_three_batch_025_planning");
const { BATCH_025_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_025_preflight_profile");

class Batch025PlanRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    const execution = PROFILE.executionProfile;
    const audit = JSON.parse(fs.readFileSync(path.join(root, execution.auditPath)));
    new StageThreeLivePreflight(root, PROFILE).verifyReplay(audit);
    const projector = new Batch025Planning(root).projector;
    const plan = projector.buildPlan();
    new StageThreeBatchExecutionPlanValidator(execution).validate(plan);
    assert.equal(plan.compatibility.plannedBridgeRecords.length, 4);
    assert.equal(plan.compatibility.activationRetirement.retireCount, 2);
    const bytes = projector.serialize(plan);
    const target = path.join(root, execution.executionPlanPath);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Immutable batch 025 execution plan drift");
    else new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: execution.executionPlanPath, bytes },
    ], () => assert.deepEqual(fs.readFileSync(target), bytes));
    console.log("Stage 3.26.1 plan recorded: three targets, three exports/activations, five prefix imports, four bridges added and five retired, two activations retired as placeholders; live runtime unchanged.");
    return plan;
  }
}

if (require.main === module) {
  try { new Batch025PlanRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch025PlanRecorder };
