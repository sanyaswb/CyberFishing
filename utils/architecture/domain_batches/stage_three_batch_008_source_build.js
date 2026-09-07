"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_008_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");
const { StageThreeBatchPrebuildContractValidator } = require("./stage_three_batch_prebuild_contract");
const { RepresentationOnlyNamedEsmTarget } = require("./stage_three_representation_target");
const { RepresentationEquivalenceGuard } = require("./stage_three_batch_focused_harness");
const { StageThreeBatch008CandidateBuild } = require("./stage_three_batch_008_candidate_build");
const { readPendingTargetTransition, canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { ControlledMetadataTransaction } = require("./controlled_metadata_transaction");

const PATHS = Object.freeze({ prebuild: PROFILE.artifactPath,
  plan: PROFILE.executionProfile.executionPlanPath, matrix: PROFILE.executionProfile.testMatrixPath,
  output: "architecture/migration/stage_3_batch_008_source_build_validation.json",
  state: "architecture/migration/stage_3_execution_state.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  runtime: "architecture/migration/stage_3_compatibility_runtime.json",
  registry: "architecture/guards/migration_bridge_registry.json",
  approvedPlan: "architecture/migration/stage_3_approved_batches.json",
  stageTwoPlan: "architecture/migration/stage_2_approved_batches.json",
  stageTwoState: "architecture/migration/stage_2_execution_state.json",
  index: "index.html" });

class StageThreeBatch008SourceBuild {
  constructor(projectRoot, { viteLoader, failureInjector, verifyOutput } = {}) {
    this.root = path.resolve(projectRoot);
    this.options = { viteLoader, verifyOutput };
    this.failureInjector = failureInjector;
  }

  async prepare() {
    const before = this.snapshot();
    const prebuild = this.json(PATHS.prebuild);
    new StageThreeBatchPrebuildContractValidator(PROFILE).validate(prebuild);
    const state = this.json(PATHS.state);
    assert.equal(state.activeBatchId, PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "prebuild");
    assert.equal(state.releaseVersion, PROFILE.executionProfile.sourceReleaseVersion);
    assert.deepEqual(state.completedBatchIds, PROFILE.completedPrefix);
    const preState = { ...state, activeBatchId: null };
    delete preState.activeBatchPhase;
    assert.equal(fingerprint(canonicalBytes(preState)), prebuild.evidence.executionStateBefore.sha256);
    for (const key of ["audit", "executionPlan", "testMatrix", "runtimeContractBefore", "bridgeRegistryBefore"]) {
      const evidence = prebuild.evidence[key];
      assert.equal(fingerprint(this.bytes(evidence.path)), evidence.sha256, `Stale prebuild ${key}`);
    }
    const plan = this.json(PATHS.plan);
    const baseline = plan.rollback.baselineEvidence;
    assert.equal(fingerprint(this.bytes(PATHS.index)), baseline.files.find((item) => item.path === PATHS.index).sha256);
    assert.deepEqual(this.outputSnapshot(), baseline.runtimeOutput.files, "Live dist changed from prebuild baseline");
    const sources = prebuild.preliminaryMetadata.targets.map((target) => {
      const activation = prebuild.preliminaryMetadata.plannedActivationPositions
        .find((item) => item.sourceProvider === target.currentPath);
      const classic = this.bytes(target.currentPath).toString("utf8");
      const projection = new RepresentationOnlyNamedEsmTarget().project({ source: classic,
        currentPath: target.currentPath, targetPath: target.targetPath,
        exportName: activation.exportName, sourceSha256: target.sourceSha256 });
      const candidate = this.bytes(target.targetPath).toString("utf8");
      assert.equal(candidate, projection.targetSource, "Target differs beyond the export token");
      new RepresentationEquivalenceGuard().validate({ classicSource: classic, candidateSource: candidate,
        exportName: activation.exportName, transportSymbol: this.json(PATHS.runtime).transport.symbol });
      const { targetSource, ...record } = projection;
      return record;
    });
    const transition = readPendingTargetTransition(this.root);
    assert(transition, "Source build requires the exact active pending transition");
    const previous = transition.reverse(this.bytes(PATHS.manifest));
    const nextManifest = transition.add(previous);
    const candidateBuild = await new StageThreeBatch008CandidateBuild(this.root, this.options).run({
      prebuild, approvedPlan: this.json(PATHS.approvedPlan), executionState: state,
      runtimeContract: this.json(PATHS.runtime), stageTwoApprovedPlan: this.json(PATHS.stageTwoPlan),
      stageTwoExecutionState: this.json(PATHS.stageTwoState),
    });
    const evidence = Object.fromEntries(["prebuild", "plan", "matrix", "state", "runtime", "registry", "index"]
      .map((key) => [key, { path: PATHS[key], sha256: fingerprint(this.bytes(PATHS[key])) }]));
    const artifact = immutableRecord({ schemaVersion: 1, kind: "cyber-fishing-stage-3-source-build-validation",
      status: "candidate-build-verified", batchId: PROFILE.batchId,
      sourceReleaseVersion: PROFILE.executionProfile.sourceReleaseVersion,
      targetReleaseVersion: PROFILE.executionProfile.targetReleaseVersion,
      evidence, sources, plannedTopology: prebuild.plannedTopology, candidateBuild,
      manifestTransition: { beforeSha256: fingerprint(previous), afterSha256: fingerprint(nextManifest),
        addedRecords: transition.records, operation: "exact-pending-target-addition",
        observations: "pending", migrationStatus: "migrating" },
      activeRuntimeLocks: { projectModules: prebuild.activeTopology.projectModules,
        activations: prebuild.activeTopology.activationIds, bridges: prebuild.activeTopology.bridgeIds,
        protectedFiles: before, runtimeCutoverAllowed: false },
      nextGate: "stage-3.8.5-atomic-runtime-cutover", verdict: "eligible-for-atomic-runtime-cutover" });
    new StageThreeBatch008SourceBuildValidator().validate(artifact, { prebuild, plan,
      pendingRecords: transition.records, runtimeContract: this.json(PATHS.runtime) });
    assert.deepEqual(this.snapshot(), before, "Candidate preparation changed protected runtime/evidence");
    return { artifact, nextManifest, before };
  }

  async run() {
    assert.equal(JSON.parse(fs.readFileSync(this.absolute(PATHS.state))).activeBatchPhase, "prebuild",
      "Source/build historical replay is read-only after cutover");
    const { artifact, nextManifest, before } = await this.prepare();
    new ControlledMetadataTransaction({ projectRoot: this.root, failureInjector: this.failureInjector }).commit([
      { relativePath: PATHS.manifest, bytes: nextManifest },
      { relativePath: PATHS.output, bytes: canonicalBytes(artifact) },
    ], () => {
      assert.deepEqual(this.bytes(PATHS.manifest), nextManifest);
      assert.deepEqual(this.bytes(PATHS.output), canonicalBytes(artifact));
      assert.deepEqual(this.snapshot(), before);
    });
    return artifact;
  }

  snapshot() {
    return [PATHS.state, PATHS.runtime, PATHS.registry, PATHS.index, PATHS.prebuild, PATHS.plan, PATHS.matrix,
      "package.json", "package-lock.json", "src/config/project_version.js",
      ...PROFILE.executionProfile.expectedTargets.map((item) => item.currentPath)]
      .map((relative) => ({ path: relative, sha256: fingerprint(this.bytes(relative)) }))
      .concat(this.outputSnapshot()).sort((a, b) => a.path.localeCompare(b.path));
  }

  outputSnapshot() {
    const walk = (relative) => fs.readdirSync(this.absolute(relative), { withFileTypes: true }).flatMap((entry) => {
      const child = `${relative}/${entry.name}`;
      assert(!entry.isSymbolicLink(), "Runtime output symlinks are unsupported");
      return entry.isDirectory() ? walk(child) : [{ path: child, sha256: fingerprint(this.bytes(child)) }];
    });
    const { Batch008CutoverHistory } = require("./stage_three_batch_008_cutover_history");
    const history = new Batch008CutoverHistory(this.root);
    let records = walk("dist/stage-3-compat-runtime");
    if (history.active()) {
      const paths = new Set(this.json(PATHS.plan).rollback.baselineEvidence.runtimeOutput.files.map((item) => item.path));
      records = records.filter((item) => paths.has(item.path));
    }
    return records.sort((a, b) => a.path.localeCompare(b.path));
  }
  json(relative) { return JSON.parse(this.bytes(relative)); }
  bytes(relative) {
    const { historicalCutoverBytes } = require("./stage_three_batch_008_cutover_history");
    return historicalCutoverBytes(relative, fs.readFileSync(this.absolute(relative)), this.root);
  }
  absolute(relative) {
    assert(typeof relative === "string" && !path.isAbsolute(relative) && !relative.includes("\\") &&
      !relative.split("/").some((part) => ["", ".", ".."].includes(part)), "Invalid source/build path");
    return path.resolve(this.root, relative);
  }
}

class StageThreeBatch008SourceBuildValidator {
  validate(artifact, { prebuild, plan, pendingRecords, runtimeContract }) {
    assert.equal(artifact.schemaVersion, 1);
    assert.equal(artifact.kind, "cyber-fishing-stage-3-source-build-validation");
    assert.equal(artifact.status, "candidate-build-verified");
    assert.equal(artifact.batchId, PROFILE.batchId);
    assert.equal(artifact.sourceReleaseVersion, PROFILE.executionProfile.sourceReleaseVersion);
    assert.equal(artifact.targetReleaseVersion, PROFILE.executionProfile.targetReleaseVersion);
    assert.deepEqual(artifact.plannedTopology, prebuild.plannedTopology);
    assert.deepEqual(artifact.sources.map(({ currentPath, targetPath, exportName }) => ({ currentPath, targetPath, exportName }))
      .sort((a, b) => a.currentPath.localeCompare(b.currentPath)), PROFILE.executionProfile.expectedTargets
      .map(({ currentPath, targetPath, exports }) => ({ currentPath, targetPath, exportName: exports[0] })));
    for (const source of artifact.sources) {
      const approved = plan.scope.modules.find((item) => item.currentPath === source.currentPath);
      assert.equal(source.sourceSha256, approved.sourceSha256);
      assert.match(source.targetSha256, /^[a-f0-9]{64}$/u);
      assert.deepEqual(source.validation, { representation: "classic-class-declaration-to-named-esm-export-only",
        importCount: 0, exportCount: 1, dynamicImportCount: 0, forbiddenDependencyCount: 0,
        behaviorDelta: "none", stateOwnershipDelta: "none", allocationDelta: "none",
        currentPath: source.currentPath, targetPath: source.targetPath, exportName: source.exportName });
    }
    const build = artifact.candidateBuild;
    assert.equal(build.status, "candidate-build-verified");
    assert.equal(build.moduleCount, prebuild.plannedTopology.counts.modules);
    assert.equal(build.activationCount, prebuild.plannedTopology.counts.activations);
    assert.deepEqual(build.projectModules, prebuild.plannedTopology.projectModules);
    assert.deepEqual(build.selectedBatchIds, PROFILE.completedPrefix.concat(PROFILE.batchId));
    assert.deepEqual(build.activationOutputs.map((item) => item.activationId).sort(), prebuild.plannedTopology.activationIds);
    assert.equal(build.candidateOutputPersisted, false);
    assert.match(build.runtimeSha256, /^[a-f0-9]{64}$/u);
    assert.deepEqual(build.virtualBuildModules, [...new Set(build.virtualBuildModules)].sort());
    assert(build.virtualBuildModules.every((item) => runtimeContract.approvedVirtualModules.includes(item)),
      "Candidate introduced an unapproved virtual helper");
    const { BATCH_008_EXECUTABLE_CASES: cases } = require("./stage_three_batch_008_behavior_cases");
    assert.deepEqual(build.validation.behaviorCases.map((item) => `${item.exportName}/${item.caseName}`).sort(),
      Object.entries(cases).flatMap(([name, records]) => Object.keys(records).map((key) => `${name}/${key}`)).sort());
    assert(build.validation.behaviorCases.every((item) => item.outcome === "equivalent"));
    assert.equal(build.validation.identities.length, PROFILE.topology.delta.activations);
    for (const activation of prebuild.preliminaryMetadata.plannedActivationPositions) {
      assert.deepEqual(build.validation.identities.find((item) => item.activationId === activation.id), {
        targetPath: activation.targetModule, exportName: activation.exportName, activationId: activation.id,
        legacyScriptIndex: activation.legacyScriptIndex, globalAbsentBeforeActivation: true,
        exactExportAfterActivation: true, classNamePreserved: true });
    }
    assert.equal(build.validation.transportOwnsGameState, false);
    assert.equal(build.validation.topology, "single-cumulative-module-graph");
    assert.equal(artifact.manifestTransition.beforeSha256, prebuild.evidence.manifestBefore.sha256);
    assert.equal(artifact.manifestTransition.operation, "exact-pending-target-addition");
    assert.deepEqual(artifact.manifestTransition.addedRecords, pendingRecords);
    assert.match(artifact.manifestTransition.afterSha256, /^[a-f0-9]{64}$/u);
    assert.equal(artifact.manifestTransition.observations, "pending");
    assert.equal(artifact.manifestTransition.migrationStatus, "migrating");
    assert.equal(artifact.activeRuntimeLocks.runtimeCutoverAllowed, false);
    assert.deepEqual(artifact.activeRuntimeLocks.projectModules, prebuild.activeTopology.projectModules);
    assert.deepEqual(artifact.activeRuntimeLocks.activations, prebuild.activeTopology.activationIds);
    assert.deepEqual(artifact.activeRuntimeLocks.bridges, prebuild.activeTopology.bridgeIds);
    assert.equal(artifact.nextGate, "stage-3.8.5-atomic-runtime-cutover");
    assert.equal(artifact.verdict, "eligible-for-atomic-runtime-cutover");
    return immutableRecord(artifact);
  }
}

module.exports = { StageThreeBatch008SourceBuild, StageThreeBatch008SourceBuildValidator, PATHS };
