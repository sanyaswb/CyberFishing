"use strict";

const path = require("node:path");
const {
  BATCH_008_EXECUTION_PROFILE,
} = require("./domain_batches/stage_three_batch_008_execution_profile");
const {
  StageThreeBatchExecutionPlanProjector,
} = require("./domain_batches/stage_three_batch_execution_plan_projector");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  audit: BATCH_008_EXECUTION_PROFILE.auditPath,
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
  executionState: "architecture/migration/stage_3_execution_state.json",
  runtimeContract: "architecture/migration/stage_3_compatibility_runtime.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  bridgeRegistry: "architecture/guards/migration_bridge_registry.json",
  index: "index.html",
  runtimeOutput: "dist/stage-3-compat-runtime",
  output: BATCH_008_EXECUTION_PROFILE.executionPlanPath,
});

const ROLLBACK_FILE_PATHS = Object.freeze([
  "CHANGELOG.md",
  "architecture/build/package_contract.json",
  "architecture/guards/migration_bridge_registry.json",
  "architecture/migration/module_migration_manifest.json",
  "architecture/migration/stage_3_compatibility_runtime.json",
  "architecture/migration/stage_3_execution_state.json",
  "index.html",
  "package-lock.json",
  "package.json",
  "refactor_Task.txt",
  "src/config/project_version.js",
  "src/core/fishing/reel_hold_load_policy.js",
  "src/core/fishing/rod_stroke_distance_tracker.js",
  "src/core/line/line_spool_state.js",
]);

const projector = new StageThreeBatchExecutionPlanProjector({
  projectRoot: PROJECT_ROOT,
  profile: BATCH_008_EXECUTION_PROFILE,
  paths: PATHS,
  rollbackFilePaths: ROLLBACK_FILE_PATHS,
});

function buildPlan() {
  return projector.buildPlan();
}

function serialize(plan) {
  return projector.serialize(plan);
}

function writePlan(plan) {
  projector.writePlan(plan);
}

if (require.main === module) {
  const plan = buildPlan();
  writePlan(plan);
  console.log(
    `Stage 3.8.1 execution plan generated: ${plan.scope.targetCount} targets, ` +
      `${plan.scope.activationCount} activations, ${plan.scope.consumerRelationshipCount} consumer bridges; ` +
      `${plan.cumulativeRuntime.beforeProjectModuleCount} → ${plan.cumulativeRuntime.afterProjectModuleCount} project modules; ` +
      `${plan.verdict}.`,
  );
}

module.exports = {
  PATHS,
  ROLLBACK_FILE_PATHS,
  buildPlan,
  serialize,
  writePlan,
};
