"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchPrebuildContractBuilder,
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");
const {
  CumulativeRuntimeContractValidator,
} = require("../build/compat_runtime/cumulative_runtime_contract");
const {
  MigrationBridgeRegistryValidator,
} = require("./guards/contracts/guard_artifact_repository");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  audit: "architecture/migration/stage_3_batch_006_audit.json",
  executionPlan: "architecture/migration/stage_3_batch_006_execution_plan.json",
  testMatrix: "architecture/migration/stage_3_batch_006_test_matrix.json",
  executionState: "architecture/migration/stage_3_execution_state.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  runtimeContract: "architecture/migration/stage_3_compatibility_runtime.json",
  bridgeRegistry: "architecture/guards/migration_bridge_registry.json",
  output: "architecture/migration/stage_3_batch_006_prebuild_contract.json",
});

function absolute(relativePath) {
  return path.join(PROJECT_ROOT, relativePath);
}

function read(relativePath) {
  const bytes = fs.readFileSync(absolute(relativePath));
  return { bytes, document: JSON.parse(bytes.toString("utf8")) };
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function serialize(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildTransition() {
  const audit = read(PATHS.audit);
  const plan = read(PATHS.executionPlan);
  const matrix = read(PATHS.testMatrix);
  const state = read(PATHS.executionState);
  const manifest = read(PATHS.manifest);
  const runtime = read(PATHS.runtimeContract);
  const registry = read(PATHS.bridgeRegistry);
  const artifact = new StageThreeBatchPrebuildContractBuilder().build({
    audit: audit.document,
    auditSha256: sha256(audit.bytes),
    executionPlan: plan.document,
    executionPlanSha256: sha256(plan.bytes),
    testMatrix: matrix.document,
    testMatrixSha256: sha256(matrix.bytes),
    executionState: state.document,
    executionStateSha256: sha256(state.bytes),
    manifestSha256: sha256(manifest.bytes),
    runtimeContractSha256: sha256(runtime.bytes),
    bridgeRegistrySha256: sha256(registry.bytes),
  });
  new StageThreeBatchPrebuildContractValidator().validate(artifact);

  const nextState = {
    ...state.document,
    activeBatchId: artifact.batchId,
    activeBatchPhase: "prebuild",
  };
  const nextManifest = {
    ...manifest.document,
    preliminaryMigration: {
      schemaVersion: 1,
      kind: "cyber-fishing-preliminary-migration-metadata",
      status: "prebuild-open",
      batchId: artifact.batchId,
      targets: artifact.preliminaryMetadata.targets,
      bridgeRecordIds: artifact.preliminaryMetadata.plannedBridges
        .map((record) => record.id),
      activationIds: artifact.preliminaryMetadata.plannedActivationPositions
        .map((record) => record.id),
      observationsFinal: false,
    },
  };
  const nextRuntime = {
    ...runtime.document,
    plannedActivationPositions:
      artifact.preliminaryMetadata.plannedActivationPositions,
  };
  const nextRegistry = {
    ...registry.document,
    plannedBridges: artifact.preliminaryMetadata.plannedBridges,
  };
  new CumulativeRuntimeContractValidator().validate(nextRuntime);
  new MigrationBridgeRegistryValidator().validate(nextRegistry);
  return Object.freeze({ artifact, nextState, nextManifest, nextRuntime, nextRegistry });
}

function writeTransition(transition) {
  const writes = [
    [PATHS.output, transition.artifact],
    [PATHS.executionState, transition.nextState],
    [PATHS.manifest, transition.nextManifest],
    [PATHS.runtimeContract, transition.nextRuntime],
    [PATHS.bridgeRegistry, transition.nextRegistry],
  ];
  for (const [relativePath, value] of writes) {
    fs.writeFileSync(absolute(relativePath), serialize(value));
  }
}

if (require.main === module) {
  const transition = buildTransition();
  writeTransition(transition);
  console.log(
    "Stage 3.6.4 prebuild opened: batch 006 reserved, six planned activations, seven planned bridges and six pending target metadata records; active runtime remains batch 005.",
  );
}

module.exports = { PATHS, buildTransition, serialize, writeTransition };
