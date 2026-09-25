"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeBatchExecutionPlanProjector } =
  require("./domain_batches/stage_three_batch_execution_plan_projector");
const { StageThreeBatchExecutionPlanValidator } =
  require("./domain_batches/stage_three_batch_execution_plan");
const { StageThreeLivePreflight, PATHS } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_013_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_013_preflight_profile");

class Batch013PlanRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    const execution = PROFILE.executionProfile;
    const audit = JSON.parse(fs.readFileSync(path.join(root, execution.auditPath)));
    new StageThreeLivePreflight(root, PROFILE).verifyReplay(audit);
    const rollbackFilePaths = ["CHANGELOG.md", "architecture/build/package_contract.json",
      PATHS.bridgeRegistry, PATHS.manifest, PATHS.runtimeContract, PATHS.executionState,
      PATHS.index, "package-lock.json", "package.json", "refactor_Task.txt",
      "src/config/project_version.js", ...execution.expectedTargets.map(target => target.currentPath)];
    const projector = new StageThreeBatchExecutionPlanProjector({ projectRoot: root, profile: execution,
      paths: { ...PATHS, audit: execution.auditPath, output: execution.executionPlanPath },
      rollbackFilePaths });
    const plan = projector.buildPlan();
    new StageThreeBatchExecutionPlanValidator(execution).validate(plan);
    assert.equal(plan.compatibility.plannedBridgeRecords.length, 7);
    const bytes = projector.serialize(plan);
    const target = path.join(root, execution.executionPlanPath);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Immutable batch 013 execution plan drift");
    else new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: execution.executionPlanPath, bytes },
    ], () => assert.deepEqual(fs.readFileSync(target), bytes));
    console.log("Stage 3.13.1 plan recorded: six targets, eight exports/activations, seven bridges; live runtime unchanged.");
    return plan;
  }
}

if (require.main === module) {
  try { new Batch013PlanRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch013PlanRecorder };
