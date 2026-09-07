"use strict";

const path = require("node:path");
const {
  BATCH_008_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  StageThreeBatchPrebuildApplication,
} = require("./domain_batches/stage_three_batch_prebuild_application");
const {
  readRuntimeFacts,
} = require("./generate-stage-3-approved-prefix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  audit: BATCH_008_PREBUILD_PROFILE.executionProfile.auditPath,
  executionPlan: BATCH_008_PREBUILD_PROFILE.executionProfile.executionPlanPath,
  testMatrix: BATCH_008_PREBUILD_PROFILE.executionProfile.testMatrixPath,
  executionState: "architecture/migration/stage_3_execution_state.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  runtimeContract: "architecture/migration/stage_3_compatibility_runtime.json",
  bridgeRegistry: "architecture/guards/migration_bridge_registry.json",
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
  output: BATCH_008_PREBUILD_PROFILE.artifactPath,
});

class StageThreeBatch008PrebuildApplication {
  #application;

  constructor({ failureInjector = null } = {}) {
    this.#application = new StageThreeBatchPrebuildApplication({
      projectRoot: PROJECT_ROOT,
      profile: BATCH_008_PREBUILD_PROFILE,
      paths: PATHS,
      readRuntimeFacts,
      failureInjector,
    });
  }

  run() {
    return this.#application.run();
  }
}

if (require.main === module) {
  const result = new StageThreeBatch008PrebuildApplication().run();
  console.log(
    `Stage 3.8.3 prebuild opened: ${result.artifact.batchId}; active runtime remains ` +
      `${result.artifact.activeTopology.counts.modules} modules / ` +
      `${result.artifact.activeTopology.counts.activations} activations / ` +
      `${result.artifact.activeTopology.counts.bridges} bridges.`,
  );
}

module.exports = { PATHS, StageThreeBatch008PrebuildApplication };
