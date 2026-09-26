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
const { BATCH_023_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_023_preflight_profile");

class Batch023PlanRecorder {
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
    assert.equal(plan.compatibility.plannedBridgeRecords.length, 3);
    const bytes = projector.serialize(plan);
    const target = path.join(root, execution.executionPlanPath);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Immutable batch 023 execution plan drift");
    else new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: execution.executionPlanPath, bytes },
    ], () => assert.deepEqual(fs.readFileSync(target), bytes));
    console.log("Stage 3.24.1 plan recorded: three targets, three exports/activations, three superclass imports, three bridges added and three retired; live runtime unchanged.");
    return plan;
  }
}

if (require.main === module) {
  try { new Batch023PlanRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch023PlanRecorder };
