"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeExecutionStateValidator,
} = require("./domain_batches/domain_approved_prefix");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");
const {
  StageThreeBatchPrebuildProjector,
} = require("./domain_batches/stage_three_batch_prebuild_projector");
const {
  ControlledMetadataTransaction,
} = require("./domain_batches/controlled_metadata_transaction");
const {
  readRuntimeFacts,
} = require("./generate-stage-3-approved-prefix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  audit: BATCH_007_PREBUILD_PROFILE.executionProfile.auditPath,
  executionPlan: BATCH_007_PREBUILD_PROFILE.executionProfile.executionPlanPath,
  testMatrix: BATCH_007_PREBUILD_PROFILE.executionProfile.testMatrixPath,
  executionState: "architecture/migration/stage_3_execution_state.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  runtimeContract: "architecture/migration/stage_3_compatibility_runtime.json",
  bridgeRegistry: "architecture/guards/migration_bridge_registry.json",
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
  output: BATCH_007_PREBUILD_PROFILE.artifactPath,
});

class StageThreeBatch007PrebuildApplication {
  #failureInjector;

  constructor({ failureInjector = null } = {}) {
    this.#failureInjector = failureInjector;
  }

  run() {
    const projector = new StageThreeBatchPrebuildProjector({
      projectRoot: PROJECT_ROOT,
      profile: BATCH_007_PREBUILD_PROFILE,
      paths: PATHS,
    });
    const projected = projector.build();
    const nextState = Object.freeze({
      ...projected.inputs.executionState.document,
      activeBatchId: BATCH_007_PREBUILD_PROFILE.batchId,
      activeBatchPhase: "prebuild",
    });
    this.#validateFutureState(projected.artifact, nextState, projected.inputs);
    const protectedBefore = this.#protectedHashes();
    new ControlledMetadataTransaction({
      projectRoot: PROJECT_ROOT,
      failureInjector: this.#failureInjector,
    }).commit([
      { relativePath: PATHS.output, bytes: projector.serialize(projected.artifact) },
      { relativePath: PATHS.executionState, bytes: projector.serialize(nextState) },
    ], () => this.#validatePersisted(projected.artifact, nextState, protectedBefore));
    return Object.freeze({ artifact: projected.artifact, state: nextState });
  }

  #validateFutureState(artifact, state, inputs) {
    new StageThreeBatchPrebuildContractValidator(BATCH_007_PREBUILD_PROFILE).validate(artifact);
    const approvedBytes = fs.readFileSync(this.#absolute(PATHS.approvedPlan));
    new StageThreeExecutionStateValidator().validate({
      approvedPlan: JSON.parse(approvedBytes.toString("utf8")),
      approvedPlanSha256: this.#sha256(approvedBytes),
      state,
      runtimeFacts: readRuntimeFacts(),
    });
    assert.equal(inputs.manifest.document.preliminaryMigration, undefined,
      "Manifest must not retain preliminary target metadata");
    assert.equal(inputs.runtimeContract.document.plannedActivationPositions, undefined,
      "Active runtime contract must not contain planned activations");
    assert.equal(inputs.bridgeRegistry.document.plannedBridges, undefined,
      "Active bridge registry must not contain planned bridges");
  }

  #validatePersisted(artifact, state, protectedBefore) {
    assert.deepEqual(this.#json(PATHS.output), artifact);
    assert.deepEqual(this.#json(PATHS.executionState), state);
    assert.deepEqual(this.#protectedHashes(), protectedBefore,
      "Prebuild open changed executable or active-runtime truth");
  }

  #protectedHashes() {
    const files = [
      PATHS.manifest,
      PATHS.runtimeContract,
      PATHS.bridgeRegistry,
      "index.html",
      ...BATCH_007_PREBUILD_PROFILE.executionProfile.expectedTargets.map((item) => item.currentPath),
    ];
    const distRoot = this.#absolute("dist/stage-3-compat-runtime");
    const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const item = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(item) : [item];
      });
    files.push(...walk(distRoot).map((absolutePath) =>
      path.relative(PROJECT_ROOT, absolutePath).replaceAll("\\", "/")));
    return Object.freeze(Object.fromEntries(files.sort().map((relativePath) => [
      relativePath,
      this.#sha256(fs.readFileSync(this.#absolute(relativePath))),
    ])));
  }

  #json(relativePath) {
    return JSON.parse(fs.readFileSync(this.#absolute(relativePath), "utf8"));
  }

  #absolute(relativePath) {
    return path.join(PROJECT_ROOT, relativePath);
  }

  #sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}

if (require.main === module) {
  const result = new StageThreeBatch007PrebuildApplication().run();
  console.log(
    `Stage 3.7.3 prebuild opened: ${result.artifact.batchId}; active runtime remains ` +
      `${result.artifact.activeTopology.counts.modules} modules / ` +
      `${result.artifact.activeTopology.counts.activations} activations / ` +
      `${result.artifact.activeTopology.counts.bridges} bridges.`,
  );
}

module.exports = { PATHS, StageThreeBatch007PrebuildApplication };
