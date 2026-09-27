"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { StageThreeBatchSourceBuild } = require("./source_build");
const { StageThreeBatchPrebuild } = require("./prebuild");
const { PATHS } = require("../../domain_batches/stage_three_live_preflight");
const { sha, serialize } = require("./planning");
const { PendingTargetManifestTransition } = require("../../domain_batches/stage_three_pending_target_manifest");
const { ControlledMetadataTransaction } = require("../../domain_batches/controlled_metadata_transaction");
const { ActivationShimRenderer } = require("../../../build/compat_runtime/activation_shim");
const { MigrationBridgeRegistryValidator } = require("../../guards/contracts/guard_artifact_repository");
const { CumulativeRuntimeContractValidator } = require("../../../build/compat_runtime/cumulative_runtime_contract");
const { StageThreeApprovedPlanSource } = require("../../domain_batches/stage_three_approved_plan_source");
const { ActivationRetirementProjection, RetiredActivationPlaceholder } =
  require("../../../build/compat_runtime/activation_retirement");
const { retiredActivationsOf } = require("./candidate_workspace");

// Projects the exact write/remove set of the atomic runtime cutover (Stage 3.N.5) from the approved
// candidate: targets, activation shims, retired placeholders, metadata and generated output.
class StageThreeCutoverProjection {
  constructor(definition) { this.definition = definition; }

  async prepare(root) {
    const PROFILE = this.definition.profile;
    const context = this.definition.context;
    const SOURCE_BUILD = context.paths.sourceBuild;
    const PREBUILD = context.paths.prebuild;
    const CUTOVER = context.paths.cutover;
    const prebuild = new StageThreeBatchPrebuild(root, this.definition).validateOpen();
    const builder = new StageThreeBatchSourceBuild(root, this.definition);
    const app = builder.app;
    const generated = new Map();
    const candidate = await builder.candidate({ captureOutput: ({ contract, report, readOutput }) => {
      for (const file of [contract.output.directory + contract.output.runtimeFile,
        ...report.activationOutputs.map(output => output.path)]) generated.set(file, Buffer.from(readOutput(file)));
    } });
    const approvedBuild = app.json(SOURCE_BUILD);
    for (const key of ["report", "validation", "effects", "sources", "candidateMetadata"]) {
      assert.deepEqual(candidate[key], approvedBuild[key], `Candidate drift: ${key}`);
    }
    const runtime = app.json(PATHS.runtimeContract);
    // Consumer-less activations retire in this transaction as inert classic placeholders.
    const retiredActivations = retiredActivationsOf(runtime, prebuild);
    assert.deepEqual(retiredActivations.map(activation => activation.id),
      PROFILE.executionProfile.expectedRetiredActivationIds || []);
    const retirement = new ActivationRetirementProjection();
    const future = retirement.contract({ ...runtime, sideEffectReviews: [
      ...runtime.sideEffectReviews, ...builder.targetSideEffectReviews(),
    ], activationPositions: [
      ...runtime.activationPositions, ...prebuild.preliminaryMetadata.plannedActivationPositions,
    ].sort((a, b) => a.id.localeCompare(b.id)) }, retiredActivations, PROFILE.batchId);
    new CumulativeRuntimeContractValidator().validate(future);
    const oldRegistry = app.json(PATHS.bridgeRegistry);
    // A migrated source no longer reads legacy globals: the bridges it held retire.
    const retired = new Set(prebuild.plannedDelta.retiredBridgeIds || []);
    assert.deepEqual([...retired], PROFILE.executionProfile.expectedRetiredBridgeIds || []);
    const registry = { ...oldRegistry, bridges: [
      ...oldRegistry.bridges.filter(record => !retired.has(record.id)), ...prebuild.preliminaryMetadata.plannedBridges,
    ].sort((a, b) => a.id.localeCompare(b.id)) };
    new MigrationBridgeRegistryValidator().validate(registry);
    const pending = new PendingTargetManifestTransition({
      policy: app.json("architecture/module_architecture.json"), prebuild,
      approvedBatch: new StageThreeApprovedPlanSource({ read: file => app.bytes(file) })
        .load(app.json(PATHS.executionState)).document.batches.find(batch => batch.id === PROFILE.batchId),
    });
    const manifest = JSON.parse(pending.add(app.bytes(PATHS.manifest)));
    const writes = [];
    for (const projection of builder.projections()) {
      writes.push({ relativePath: projection.targetPath, bytes: Buffer.from(projection.targetSource) });
    }
    let index = app.read(PATHS.index);
    const activationsByProvider = new Map();
    for (const activation of prebuild.preliminaryMetadata.plannedActivationPositions) {
      const records = activationsByProvider.get(activation.sourceProvider) || [];
      records.push(activation);
      activationsByProvider.set(activation.sourceProvider, records);
    }
    for (const [provider, activations] of activationsByProvider) {
      const source = manifest.modules.find(module => module.currentPath === provider);
      const target = manifest.modules.find(module => module.currentPath === activations[0].targetModule);
      assert(source && target, "Pending provider/target records missing");
      source.architecture.roles = ["compatibility-bridge"];
      source.observed = { ...structuredClone(target.observed), legacyLoadOrder: source.observed.legacyLoadOrder };
      source.analysis.dependencies = structuredClone(target.analysis.dependencies);
      writes.push({ relativePath: provider,
        bytes: Buffer.from(activations.map(activation =>
          new ActivationShimRenderer().render(activation, runtime.transport.symbol)).join("")) });
      const oldTag = new RegExp(`<script src="${provider.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:\\?[^\"]*)?"></script>`, "gu");
      assert.equal([...index.matchAll(oldTag)].length, 1);
      const tags = activations.map(activation =>
        `<script src="${runtime.output.directory}${activation.shimFile}"></script>`).join("\n");
      index = index.replace(oldTag, tags);
    }
    // In retirement order: a classic source gets its placeholder (one line per retired activation it
    // served) at its first retired activation; every generated shim is removed and restored on rollback.
    const placeholders = new Map(RetiredActivationPlaceholder.byProvider(retiredActivations)
      .map(({ sourceProvider, activations }) => [sourceProvider, activations]));
    for (const activation of retiredActivations) {
      if (placeholders.has(activation.sourceProvider)) {
        writes.push({ relativePath: activation.sourceProvider,
          bytes: Buffer.from(new RetiredActivationPlaceholder().renderProvider(placeholders.get(activation.sourceProvider))) });
        placeholders.delete(activation.sourceProvider);
      }
      writes.push({ relativePath: runtime.output.directory + activation.shimFile, bytes: null });
    }
    index = retirement.index(index, runtime.output.directory, retiredActivations);
    for (const [relativePath, bytes] of generated) writes.push({ relativePath, bytes });
    const packageContract = app.json("architecture/build/package_contract.json");
    packageContract.stage.current = context.stage;
    packageContract.stage.cumulativeRuntimeBuild.runtimeInputs = prebuild.plannedTopology.counts.modules;
    packageContract.stage.cumulativeRuntimeBuild.activationInputs = prebuild.plannedTopology.counts.activations;
    writes.push(...[
      [PATHS.manifest, serialize(manifest)],
      [PATHS.runtimeContract, serialize(future)],
      [PATHS.bridgeRegistry, serialize(registry)],
      [PATHS.index, Buffer.from(index)],
      ["architecture/build/package_contract.json", serialize(packageContract)],
      [PATHS.executionState, serialize({ ...app.json(PATHS.executionState), activeBatchPhase: "runtime-active" })],
    ].map(([relativePath, bytes]) => ({ relativePath, bytes })));
    const changed = writes.filter(write => write.bytes === null
      ? fs.existsSync(path.join(root, write.relativePath))
      : !fs.existsSync(path.join(root, write.relativePath)) ||
        !fs.readFileSync(path.join(root, write.relativePath)).equals(write.bytes));
    assert.equal(changed.filter(write => write.bytes === null).length, retiredActivations.length);
    assert.equal(new Set(changed.map(write => write.relativePath)).size, changed.length);
    const records = changed.map(write => {
      const file = path.join(root, write.relativePath);
      const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
      return {
        path: write.relativePath, beforeSha256: before ? sha(before) : null,
        afterSha256: write.bytes === null ? null : sha(write.bytes), beforeBase64: before?.toString("base64") ?? null,
        afterBase64: write.bytes === null ? null : write.bytes.toString("base64"),
      };
    });
    const artifact = {
      schemaVersion: 3, kind: "cyber-fishing-stage-3-runtime-cutover",
      batchId: PROFILE.batchId, status: "runtime-active-verified",
      releaseVersion: PROFILE.executionProfile.targetReleaseVersion,
      evidence: {
        prebuild: { path: PREBUILD, sha256: sha(app.bytes(PREBUILD)) },
        sourceBuild: { path: SOURCE_BUILD, sha256: sha(app.bytes(SOURCE_BUILD)) },
      },
      lifecycle: {
        completedBatchIds: prebuild.lifecycle.completedBatchIds,
        activeBatchId: PROFILE.batchId, activeBatchPhase: "runtime-active", batchCompleted: false,
      },
      topology: prebuild.plannedTopology,
      build: candidate.report,
      scriptTopology: app.json(PROFILE.executionProfile.executionPlanPath).scriptTopology.after,
      manifestTransition: {
        observations: "pending",
        pendingPaths: [...prebuild.plannedDelta.projectModules,
          ...prebuild.preliminaryMetadata.targets.map(target => target.currentPath)].sort(),
        finalReconciliationStage: context.step(7),
      },
      writes: records,
      rollback: {
        scope: `batch-${context.number}-only`, restorePhase: "prebuild",
        restoreTopology: prebuild.activeTopology.counts,
        preserveCompletedBatchIds: prebuild.lifecycle.completedBatchIds,
      },
      nextGate: `stage-${context.step(6)}-live-validation`,
    };
    return { artifact, writes: changed.concat({ relativePath: CUTOVER, bytes: serialize(artifact) }) };
  }
}

class StageThreePublicationGate {
  constructor({ port = Number(process.env.PORT || 4173), host = process.env.HOST || "127.0.0.1" } = {}) {
    this.port = port;
    this.host = host;
  }
  async run(action) {
    const server = net.createServer(socket => socket.destroy());
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen({ port: this.port, host: this.host, exclusive: true }, resolve);
    });
    try { return await action(); }
    finally { await new Promise(resolve => server.close(resolve)); }
  }
}

class StageThreeAtomicCutover {
  constructor(root, definition) {
    this.root = path.resolve(root);
    this.definition = definition;
  }

  // New directories may only be ancestors of the batch's reviewed target paths.
  #allowedDirectories() {
    const allowed = new Set();
    for (const target of this.definition.execution.expectedTargets) {
      for (let directory = path.posix.dirname(target.targetPath); directory !== "."; directory = path.posix.dirname(directory)) {
        allowed.add(directory);
      }
    }
    return allowed;
  }

  commit(prepared, { failureInjector = null } = {}) {
    const newDirectories = [];
    try {
      for (const write of prepared.writes) {
        const parent = path.dirname(path.join(this.root, write.relativePath));
        if (!fs.existsSync(parent)) {
          const pending = [];
          for (let directory = parent; !fs.existsSync(directory); directory = path.dirname(directory)) {
            const relative = path.relative(this.root, directory).replaceAll("\\", "/");
            assert(this.#allowedDirectories().has(relative),
              `Unexpected target directory: ${relative}`);
            pending.push(directory);
          }
          for (const directory of pending.reverse()) {
            fs.mkdirSync(directory);
            newDirectories.push(directory);
          }
        }
      }
      new ControlledMetadataTransaction({ projectRoot: this.root, failureInjector }).commit(
        prepared.writes, () => {
          for (const write of prepared.writes) {
            const target = path.join(this.root, write.relativePath);
            if (write.bytes === null) assert(!fs.existsSync(target), `Removal survived: ${write.relativePath}`);
            else assert.deepEqual(fs.readFileSync(target), write.bytes);
          }
        });
    } catch (error) {
      for (const directory of newDirectories.reverse()) {
        if (fs.existsSync(directory) && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
      }
      throw error;
    }
  }

  async run() {
    assert(!fs.existsSync(path.join(this.root, this.definition.context.paths.cutover)),
      `Batch ${this.definition.context.number} cutover is already published`);
    const prepared = await new StageThreeCutoverProjection(this.definition).prepare(this.root);
    return new StageThreePublicationGate().run(() => {
      new StageThreeBatchPrebuild(this.root, this.definition).validateOpen();
      this.commit(prepared);
      return prepared.artifact;
    });
  }
}

module.exports = { StageThreeCutoverProjection, StageThreeAtomicCutover, StageThreePublicationGate };
