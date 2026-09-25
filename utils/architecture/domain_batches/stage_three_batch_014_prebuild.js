"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeBatchPrebuildProfile } = require("./stage_three_batch_prebuild_profile");
const { StageThreeBatchPrebuildProjector } = require("./stage_three_batch_prebuild_projector");
const { StageThreeBatchPrebuildContractValidator } = require("./stage_three_batch_prebuild_contract");
const { ControlledMetadataTransaction } = require("./controlled_metadata_transaction");
const { Batch014Planning, PLAN_PATHS } = require("./stage_three_batch_014_planning");
const { BATCH_014_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_014_preflight_profile");
const { PATHS, serialize } = require("./stage_three_live_preflight");

const PREBUILD = "architecture/migration/stage_3_batch_014_prebuild_contract.json";
const PREBUILD_PATHS = Object.freeze({
  ...PATHS,
  audit: PROFILE.executionProfile.auditPath,
  executionPlan: PROFILE.executionProfile.executionPlanPath,
  testMatrix: PROFILE.executionProfile.testMatrixPath,
  output: PREBUILD,
});
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

class Batch014Prebuild {
  constructor(root) {
    this.root = path.resolve(root);
    this.planning = new Batch014Planning(this.root);
    const approved = this.planning.json(PATHS.approvedPlan);
    const plan = this.planning.json(PLAN_PATHS.output);
    const completedPrefix = approved.batches.slice(0, 13).map(batch => batch.id);
    this.profile = new StageThreeBatchPrebuildProfile({
      schemaVersion: 1, contractSchemaVersion: 2, stageLabel: "Stage 3.14.3",
      batchId: PROFILE.batchId, completedPrefix,
      executionProfile: PROFILE.executionProfile, artifactPath: PREBUILD,
      planningStorage: "prebuild-contract-only",
      topology: {
        active: { modules: plan.cumulativeRuntime.beforeProjectModuleCount,
          activations: plan.cumulativeRuntime.beforeActivationCount,
          bridges: plan.compatibility.registryTransition.beforeCount },
        delta: { modules: plan.scope.targetCount, activations: plan.scope.activationCount,
          bridges: plan.scope.consumerRelationshipCount },
        planned: { modules: plan.cumulativeRuntime.afterProjectModuleCount,
          activations: plan.cumulativeRuntime.afterActivationCount,
          bridges: plan.compatibility.registryTransition.afterCount },
      },
      unlockCondition: "stage-3.14.4-target-source-and-build-validation",
      verdict: "eligible-for-target-source-and-build-validation",
    }).value;
  }

  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  build() {
    this.planning.preflight.verifyReplay(this.json(PROFILE.executionProfile.auditPath));
    assert.deepEqual(this.bytes(PLAN_PATHS.output), serialize(this.planning.plan()));
    assert.deepEqual(this.bytes(PROFILE.executionProfile.testMatrixPath), serialize(this.planning.matrix()));
    const projected = new StageThreeBatchPrebuildProjector({
      projectRoot: this.root, profile: this.profile, paths: PREBUILD_PATHS,
    }).build();
    const before = this.bytes(PATHS.executionState);
    const oldState = JSON.parse(before);
    const after = serialize({ ...oldState, activeBatchId: PROFILE.batchId, activeBatchPhase: "prebuild" });
    const artifact = {
      ...projected.artifact,
      stateTransition: {
        path: PATHS.executionState,
        beforeSha256: sha(before), afterSha256: sha(after),
        beforeBase64: before.toString("base64"), afterBase64: after.toString("base64"),
      },
      publication: {
        writeSet: [PREBUILD, PATHS.executionState],
        liveTopologyChanged: false, targetSourcesPublished: false,
        rollback: "restore-exact-before-state-and-remove-only-batch-014-prebuild-contract",
      },
    };
    new StageThreeBatchPrebuildContractValidator(this.profile).validate(artifact);
    assert.deepEqual([artifact.activeTopology.counts.modules, artifact.plannedTopology.counts.modules], [50, 56]);
    return { artifact, before, after };
  }

  open() {
    assert(!fs.existsSync(path.join(this.root, PREBUILD)), "batch 014 prebuild is already open");
    const { artifact, before, after } = this.build();
    const runtimeBefore = this.planning.projector.rollbackEvidence().runtimeOutput;
    const protectedPaths = [PATHS.manifest, PATHS.runtimeContract, PATHS.bridgeRegistry,
      PATHS.index, ...PROFILE.executionProfile.expectedTargets.map(target => target.currentPath)];
    const protectedBefore = protectedPaths.map(file => ({ file, sha256: sha(this.bytes(file)) }));
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: PREBUILD, bytes: serialize(artifact) },
      { relativePath: PATHS.executionState, bytes: after },
    ], () => {
      assert.deepEqual(this.bytes(PREBUILD), serialize(artifact));
      assert.deepEqual(this.bytes(PATHS.executionState), after);
      assert.deepEqual(protectedPaths.map(file => ({ file, sha256: sha(this.bytes(file)) })), protectedBefore);
      assert.deepEqual(this.planning.projector.rollbackEvidence().runtimeOutput, runtimeBefore);
    });
    assert.equal(sha(before), artifact.stateTransition.beforeSha256);
    return artifact;
  }

  validateOpen() {
    const artifact = this.json(PREBUILD);
    new StageThreeBatchPrebuildContractValidator(this.profile).validate(artifact);
    const transition = artifact.stateTransition;
    const before = Buffer.from(transition.beforeBase64, "base64");
    const after = Buffer.from(transition.afterBase64, "base64");
    assert.equal(sha(before), transition.beforeSha256);
    assert.equal(sha(after), transition.afterSha256);
    assert.deepEqual(this.bytes(PATHS.executionState), after);
    assert.equal(this.json(PATHS.executionState).activeBatchPhase, "prebuild");
    return artifact;
  }
}

module.exports = { Batch014Prebuild, PREBUILD, PREBUILD_PATHS };
