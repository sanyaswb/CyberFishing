"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeBatchPrebuildProfile } = require("../../domain_batches/stage_three_batch_prebuild_profile");
const { StageThreeBatchPrebuildProjector } = require("../../domain_batches/stage_three_batch_prebuild_projector");
const { StageThreeBatchPrebuildContractValidator } = require("../../domain_batches/stage_three_batch_prebuild_contract");
const { ControlledMetadataTransaction } = require("../../domain_batches/controlled_metadata_transaction");
const { StageThreeApprovedPlanSource } = require("../../domain_batches/stage_three_approved_plan_source");
const { PATHS, serialize } = require("../../domain_batches/stage_three_live_preflight");
const { StageThreeBatchPlanning, sha } = require("./planning");

// Opens the batch: records the prebuild contract and moves the execution state to phase prebuild
// without touching the live topology (Stage 3.N.3).
class StageThreeBatchPrebuild {
  constructor(root, definition) {
    this.root = path.resolve(root);
    this.definition = definition;
    const context = definition.context;
    this.path = context.paths.prebuild;
    this.planning = new StageThreeBatchPlanning(this.root, definition);
    const execution = definition.execution;
    const approved = new StageThreeApprovedPlanSource({ read: file => this.planning.bytes(file) })
      .load(this.planning.json(PATHS.executionState), { adopting: execution.continuationPlan }).document;
    const plan = this.planning.json(execution.executionPlanPath);
    this.profile = new StageThreeBatchPrebuildProfile({
      schemaVersion: 1, contractSchemaVersion: 2, stageLabel: context.label(3),
      batchId: definition.id, completedPrefix: approved.batches.slice(0, context.completedBefore).map(batch => batch.id),
      executionProfile: execution, artifactPath: this.path,
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
      unlockCondition: `stage-${context.step(4)}-target-source-and-build-validation`,
      verdict: "eligible-for-target-source-and-build-validation",
    }).value;
  }

  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  json(file) { return JSON.parse(this.bytes(file)); }

  build() {
    const execution = this.definition.execution;
    this.planning.preflight.verifyReplay(this.json(execution.auditPath));
    assert.deepEqual(this.bytes(execution.executionPlanPath), serialize(this.planning.plan()));
    assert.deepEqual(this.bytes(execution.testMatrixPath), serialize(this.planning.matrix()));
    const projected = new StageThreeBatchPrebuildProjector({
      projectRoot: this.root, profile: this.profile,
      paths: { ...PATHS, audit: execution.auditPath, executionPlan: execution.executionPlanPath,
        testMatrix: execution.testMatrixPath, output: this.path },
    }).build();
    const before = this.bytes(PATHS.executionState);
    const oldState = JSON.parse(before);
    // The Stage 3.22 approved prefix is already adopted; opening the batch only activates it.
    assert.deepEqual(oldState.continuationPlan, execution.continuationPlan);
    const after = serialize({ ...oldState, activeBatchId: this.definition.id, activeBatchPhase: "prebuild" });
    const artifact = {
      ...projected.artifact,
      stateTransition: {
        path: PATHS.executionState,
        beforeSha256: sha(before), afterSha256: sha(after),
        beforeBase64: before.toString("base64"), afterBase64: after.toString("base64"),
      },
      publication: {
        writeSet: [this.path, PATHS.executionState],
        liveTopologyChanged: false, targetSourcesPublished: false,
        rollback: `restore-exact-before-state-and-remove-only-batch-${this.definition.context.number}-prebuild-contract`,
      },
    };
    new StageThreeBatchPrebuildContractValidator(this.profile).validate(artifact);
    const topology = execution.expectedTopology;
    assert.deepEqual([artifact.activeTopology.counts.modules, artifact.plannedTopology.counts.modules],
      [topology.beforeProjectModuleCount, topology.afterProjectModuleCount]);
    assert.deepEqual([artifact.activeTopology.counts.bridges, artifact.plannedTopology.counts.bridges],
      [topology.beforeBridgeCount, topology.afterBridgeCount]);
    return { artifact, before, after };
  }

  open() {
    assert(!fs.existsSync(path.join(this.root, this.path)), `batch ${this.definition.context.number} prebuild is already open`);
    const { artifact, before, after } = this.build();
    const runtimeBefore = this.planning.projector.rollbackEvidence().runtimeOutput;
    const protectedPaths = [PATHS.manifest, PATHS.runtimeContract, PATHS.bridgeRegistry,
      PATHS.index, ...this.definition.execution.expectedTargets.map(target => target.currentPath)];
    const protectedBefore = protectedPaths.map(file => ({ file, sha256: sha(this.bytes(file)) }));
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: this.path, bytes: serialize(artifact) },
      { relativePath: PATHS.executionState, bytes: after },
    ], () => {
      assert.deepEqual(this.bytes(this.path), serialize(artifact));
      assert.deepEqual(this.bytes(PATHS.executionState), after);
      assert.deepEqual(protectedPaths.map(file => ({ file, sha256: sha(this.bytes(file)) })), protectedBefore);
      assert.deepEqual(this.planning.projector.rollbackEvidence().runtimeOutput, runtimeBefore);
    });
    assert.equal(sha(before), artifact.stateTransition.beforeSha256);
    return artifact;
  }

  validateOpen() {
    const artifact = this.json(this.path);
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

module.exports = { StageThreeBatchPrebuild };
