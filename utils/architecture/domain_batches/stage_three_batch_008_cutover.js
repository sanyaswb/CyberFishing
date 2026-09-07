"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeBatch008SourceBuild, PATHS: INPUT } = require("./stage_three_batch_008_source_build");
const { BATCH_008_PREBUILD_PROFILE: PROFILE } = require("./stage_three_batch_prebuild_profile");
const { ControlledMetadataTransaction } = require("./controlled_metadata_transaction");
const { canonicalBytes, fingerprint } = require("./stage_three_pending_target_manifest");
const { ActivationShimRenderer, ActivationShimContractValidator } = require("../../build/compat_runtime/activation_shim");
const { CumulativeRuntimeContractValidator } = require("../../build/compat_runtime/cumulative_runtime_contract");
const { MigrationBridgeRegistryValidator } = require("../guards/contracts/guard_artifact_repository");
const { immutableRecord } = require("../guards/core/guard_models");
const { LegacyScriptOrderReader } = require("../migration/legacy_script_order_reader");
const { StageThreeRuntimeScriptAliasResolver } = require("../migration/stage_three_runtime_script_alias_resolver");

const OUTPUT = "architecture/migration/stage_3_batch_008_runtime_cutover.json";

class StageThreeBatch008CutoverProjection {
  project({ prebuild, sourceBuild, state, runtime, registry, manifest, index }) {
    assert.equal(state.activeBatchId, PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "prebuild");
    assert.equal(state.releaseVersion, PROFILE.executionProfile.sourceReleaseVersion);
    assert.deepEqual(state.completedBatchIds, PROFILE.completedPrefix);
    assert.deepEqual(sourceBuild.plannedTopology, prebuild.plannedTopology);
    assert.equal(fingerprint(canonicalBytes(manifest)), sourceBuild.manifestTransition.afterSha256);
    assert.equal(fingerprint(canonicalBytes(runtime)), prebuild.evidence.runtimeContractBefore.sha256);
    assert.equal(fingerprint(canonicalBytes(registry)), prebuild.evidence.bridgeRegistryBefore.sha256);
    assert.equal(fingerprint(Buffer.from(index)), sourceBuild.evidence.index.sha256);
    const activations = prebuild.preliminaryMetadata.plannedActivationPositions;
    const bridges = prebuild.preliminaryMetadata.plannedBridges;
    const nextRuntime = structuredClone(runtime);
    nextRuntime.activationPositions.push(...structuredClone(activations));
    nextRuntime.activationPositions.sort((a, b) => a.id.localeCompare(b.id));
    new CumulativeRuntimeContractValidator().validate(nextRuntime);
    const nextRegistry = structuredClone(registry);
    nextRegistry.bridges.push(...structuredClone(bridges));
    nextRegistry.bridges.sort((a, b) => a.id.localeCompare(b.id));
    new MigrationBridgeRegistryValidator().validate(nextRegistry);
    const nextState = { ...state, activeBatchPhase: "runtime-active" };
    const nextManifest = structuredClone(manifest);
    const previousProviders = [];
    const shims = [];
    let nextIndex = index;
    for (const activation of activations) {
      const source = nextManifest.modules.find((item) => item.currentPath === activation.sourceProvider);
      const target = nextManifest.modules.find((item) => item.currentPath === activation.targetModule);
      assert(source && target, "Missing exact Manifest source/target pair");
      assert.equal(target.architecture.migrationStatus, "migrating");
      previousProviders.push(structuredClone(source));
      source.architecture = { ...source.architecture, roles: ["compatibility-bridge"] };
      // Do not retain verified facts describing the removed classic implementation.
      source.observed = { ...structuredClone(target.observed), legacyLoadOrder: source.observed.legacyLoadOrder };
      source.analysis.dependencies = structuredClone(target.analysis.dependencies);
      const code = new ActivationShimRenderer().render(activation, runtime.transport.symbol);
      new ActivationShimContractValidator().validate({ code, activation, transportSymbol: runtime.transport.symbol });
      shims.push({ relativePath: activation.sourceProvider, bytes: Buffer.from(code) });
      const before = `src="${activation.sourceProvider}"`;
      const after = `src="${runtime.output.directory}${activation.shimFile}"`;
      assert.equal(nextIndex.split(before).length - 1, 1, "Expected one exact provider script tag");
      nextIndex = nextIndex.replace(before, after);
    }
    assert.deepEqual(nextRuntime.activationPositions.map((x) => x.id).sort(), prebuild.plannedTopology.activationIds);
    assert.deepEqual(nextRegistry.bridges.map((x) => x.id).sort(), prebuild.plannedTopology.bridgeIds);
    const logical = new LegacyScriptOrderReader(null, { scriptAliases:
      new StageThreeRuntimeScriptAliasResolver().resolve(nextRuntime) }).parse(nextIndex);
    const beforeLogical = new LegacyScriptOrderReader(null, { scriptAliases:
      new StageThreeRuntimeScriptAliasResolver().resolve(runtime) }).parse(index);
    assert.deepEqual(logical.map(({ source, ...item }) => item), beforeLogical.map(({ source, ...item }) => item),
      "Cutover changed logical script order");
    for (const activation of activations) {
      assert.equal(logical.find((item) => item.legacyLoadOrder === activation.legacyScriptIndex)?.source,
        `${runtime.output.directory}${activation.shimFile}`, "Activation is not at its approved position");
    }
    return { nextRuntime, nextRegistry, nextState, nextManifest, nextIndex, shims, previousProviders };
  }
}

class StageThreeBatch008AtomicCutover {
  constructor(projectRoot, { failureInjector, viteLoader } = {}) {
    this.root = path.resolve(projectRoot);
    this.failureInjector = failureInjector;
    this.viteLoader = viteLoader;
  }

  async prepare({ replay = false } = {}) {
    const generated = new Map();
    const builder = new StageThreeBatch008SourceBuild(this.root, {
      viteLoader: this.viteLoader,
      verifyOutput: ({ report, contract, readOutput }) => {
        for (const relative of [`${contract.output.directory}${contract.output.runtimeFile}`,
          ...report.activationOutputs.map((item) => item.path)]) generated.set(relative, Buffer.from(readOutput(relative)));
      },
    });
    const proof = await builder.prepare();
    assert.deepEqual(builder.bytes(INPUT.output), canonicalBytes(proof.artifact), "Source/build evidence is stale");
    const existing = fs.existsSync(path.join(this.root, OUTPUT)) ? builder.json(OUTPUT) : null;
    assert(!existing || replay, "Cutover already recorded; use read-only validation");
    const read = (key) => builder.json(INPUT[key]);
    const prebuild = read("prebuild");
    const transition = new StageThreeBatch008CutoverProjection().project({ prebuild,
      sourceBuild: proof.artifact, state: read("state"), runtime: read("runtime"),
      registry: read("registry"), manifest: read("manifest"), index: builder.bytes(INPUT.index).toString("utf8") });
    const packagePath = "architecture/build/package_contract.json";
    const nextPackage = JSON.parse(builder.bytes(packagePath));
    assert.equal(fingerprint(builder.bytes(packagePath)), read("plan").rollback.baselineEvidence.files
      .find((item) => item.path === packagePath).sha256);
    nextPackage.stage.current = "3.8";
    nextPackage.stage.cumulativeRuntimeBuild.runtimeInputs = prebuild.plannedTopology.counts.modules;
    nextPackage.stage.cumulativeRuntimeBuild.activationInputs = prebuild.plannedTopology.counts.activations;
    const writes = [...generated].map(([relativePath, bytes]) => ({ relativePath, bytes }))
      .concat(transition.shims, [
        { relativePath: INPUT.runtime, bytes: canonicalBytes(transition.nextRuntime) },
        { relativePath: INPUT.registry, bytes: canonicalBytes(transition.nextRegistry) },
        { relativePath: INPUT.manifest, bytes: canonicalBytes(transition.nextManifest) },
        { relativePath: INPUT.index, bytes: Buffer.from(transition.nextIndex) },
        { relativePath: packagePath, bytes: canonicalBytes(nextPackage) },
        // Phase is the last runtime metadata write, after all executable content.
        { relativePath: INPUT.state, bytes: canonicalBytes(transition.nextState) },
      ]);
    assert.equal(new Set(writes.map((x) => x.relativePath)).size, writes.length);
    const writeEvidence = writes.map((item) => ({ path: item.relativePath,
      beforeSha256: existing ? existing.writes.find((entry) => entry.path === item.relativePath)?.beforeSha256 :
        (fs.existsSync(path.join(this.root, item.relativePath)) ? fingerprint(builder.bytes(item.relativePath)) : null),
      afterSha256: fingerprint(item.bytes) }));
    const artifact = {
      // v2 separates the publication proof from later observation acceptance.
      // Historical v1 cutovers and their validators remain unchanged.
      schemaVersion: 2, kind: "cyber-fishing-stage-3-runtime-cutover", batchId: PROFILE.batchId,
      status: "runtime-active-verified", releaseVersion: transition.nextState.releaseVersion,
      evidence: { sourceBuild: { path: INPUT.output, sha256: fingerprint(builder.bytes(INPUT.output)) },
        prebuild: { path: INPUT.prebuild, sha256: fingerprint(builder.bytes(INPUT.prebuild)) } },
      lifecycle: { completedBatchIds: transition.nextState.completedBatchIds,
        activeBatchId: PROFILE.batchId, activeBatchPhase: "runtime-active", batchCompleted: false },
      topology: prebuild.plannedTopology, build: proof.artifact.candidateBuild,
      scriptTopology: read("plan").scriptTopology.after,
      manifestTransition: { observations: "pending", finalReconciliationStage: "3.8.7",
        previousProviders: transition.previousProviders },
      writes: writeEvidence,
      rollback: { scope: "batch-008-only", partialRollbackAllowed: false,
        preserveCompletedBatchIds: PROFILE.completedPrefix, restoreTopology: prebuild.activeTopology },
      nextGate: "stage-3.8.6-live-identity-timing-state-performance-validation",
    };
    const validated = validateCutoverArtifact(artifact, prebuild, proof.artifact);
    return { artifact: validated, writes: writes.concat({ relativePath: OUTPUT, bytes: canonicalBytes(validated) }), protectedBefore: proof.before };
  }

  async run() {
    assert.equal(JSON.parse(fs.readFileSync(path.join(this.root, INPUT.state))).activeBatchPhase, "prebuild",
      "Completed cutover replay is read-only");
    const prepared = await this.prepare();
    for (const item of prepared.artifact.writes) {
      const absolute = path.join(this.root, item.path);
      const current = fs.existsSync(absolute) ? fingerprint(fs.readFileSync(absolute)) : null;
      assert.equal(current, item.beforeSha256, `Cutover input changed after preparation: ${item.path}`);
    }
    // All Vite output and source gates have passed before staging live writes.
    new ControlledMetadataTransaction({ projectRoot: this.root, failureInjector: this.failureInjector }).commit(
      prepared.writes, () => {
        for (const item of prepared.writes) assert.deepEqual(fs.readFileSync(path.join(this.root, item.relativePath)), item.bytes);
        for (const evidence of prepared.protectedBefore) {
          if (prepared.writes.some((item) => item.relativePath === evidence.path)) continue;
          assert.equal(fingerprint(fs.readFileSync(path.join(this.root, evidence.path))), evidence.sha256,
            `Unrelated protected input changed: ${evidence.path}`);
        }
      });
    return prepared.artifact;
  }
}

function validateCutoverArtifact(artifact, prebuild, sourceBuild) {
  assert.equal(artifact.schemaVersion, 2);
  assert.equal(artifact.kind, "cyber-fishing-stage-3-runtime-cutover");
  assert.equal(artifact.batchId, PROFILE.batchId);
  assert.equal(artifact.status, "runtime-active-verified");
  assert.equal(artifact.releaseVersion, PROFILE.executionProfile.sourceReleaseVersion);
  assert.deepEqual(artifact.lifecycle, { completedBatchIds: PROFILE.completedPrefix,
    activeBatchId: PROFILE.batchId, activeBatchPhase: "runtime-active", batchCompleted: false });
  assert.deepEqual(artifact.topology, prebuild.plannedTopology);
  assert.deepEqual(artifact.build, sourceBuild.candidateBuild);
  assert.equal(artifact.manifestTransition.observations, "pending");
  assert.equal(artifact.manifestTransition.finalReconciliationStage, "3.8.7");
  assert.deepEqual(artifact.manifestTransition.previousProviders.map((item) => item.currentPath).sort(),
    PROFILE.executionProfile.expectedTargets.map((item) => item.currentPath).sort());
  assert.deepEqual(artifact.rollback, { scope: "batch-008-only", partialRollbackAllowed: false,
    preserveCompletedBatchIds: PROFILE.completedPrefix, restoreTopology: prebuild.activeTopology });
  assert.equal(new Set(artifact.writes.map((item) => item.path)).size, artifact.writes.length);
  for (const item of artifact.writes) {
    assert.match(item.afterSha256, /^[a-f0-9]{64}$/u);
    assert(item.beforeSha256 === null || /^[a-f0-9]{64}$/u.test(item.beforeSha256));
  }
  assert.equal(artifact.nextGate, "stage-3.8.6-live-identity-timing-state-performance-validation");
  return immutableRecord(artifact);
}

module.exports = { StageThreeBatch008AtomicCutover, StageThreeBatch008CutoverProjection, validateCutoverArtifact, OUTPUT };
