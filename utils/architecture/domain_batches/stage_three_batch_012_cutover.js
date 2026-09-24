"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { Batch012SourceBuild, OUTPUT: SOURCE_BUILD } = require("./stage_three_batch_012_source_build");
const { Batch012Prebuild, PREBUILD } = require("./stage_three_batch_012_prebuild");
const { BATCH_012_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_012_preflight_profile");
const { PATHS } = require("./stage_three_live_preflight");
const { sha, serialize } = require("./stage_three_batch_012_planning");
const { PendingTargetManifestTransition } = require("./stage_three_pending_target_manifest");
const { ControlledMetadataTransaction } = require("./controlled_metadata_transaction");
const { ActivationShimRenderer } = require("../../build/compat_runtime/activation_shim");
const { MigrationBridgeRegistryValidator } = require("../guards/contracts/guard_artifact_repository");
const { CumulativeRuntimeContractValidator } = require("../../build/compat_runtime/cumulative_runtime_contract");

const CUTOVER = "architecture/migration/stage_3_batch_012_runtime_cutover.json";

class Batch012CutoverProjection {
  async prepare(root) {
    const prebuild = new Batch012Prebuild(root).validateOpen();
    const builder = new Batch012SourceBuild(root);
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
    const future = { ...runtime, activationPositions: [
      ...runtime.activationPositions, ...prebuild.preliminaryMetadata.plannedActivationPositions,
    ].sort((a, b) => a.id.localeCompare(b.id)) };
    new CumulativeRuntimeContractValidator().validate(future);
    const oldRegistry = app.json(PATHS.bridgeRegistry);
    const registry = { ...oldRegistry, bridges: [
      ...oldRegistry.bridges, ...prebuild.preliminaryMetadata.plannedBridges,
    ].sort((a, b) => a.id.localeCompare(b.id)) };
    new MigrationBridgeRegistryValidator().validate(registry);
    const pending = new PendingTargetManifestTransition({
      policy: app.json("architecture/module_architecture.json"), prebuild,
      approvedBatch: app.json(PATHS.approvedPlan).batches.find(batch => batch.id === PROFILE.batchId),
    });
    const manifest = JSON.parse(pending.add(app.bytes(PATHS.manifest)));
    const writes = [];
    for (const projection of builder.projections()) {
      writes.push({ relativePath: projection.targetPath, bytes: Buffer.from(projection.targetSource) });
    }
    let index = app.read(PATHS.index);
    for (const activation of prebuild.preliminaryMetadata.plannedActivationPositions) {
      const source = manifest.modules.find(module => module.currentPath === activation.sourceProvider);
      const target = manifest.modules.find(module => module.currentPath === activation.targetModule);
      assert(source && target, "Pending provider/target records missing");
      source.architecture.roles = ["compatibility-bridge"];
      source.observed = { ...structuredClone(target.observed), legacyLoadOrder: source.observed.legacyLoadOrder };
      source.analysis.dependencies = structuredClone(target.analysis.dependencies);
      writes.push({ relativePath: activation.sourceProvider,
        bytes: Buffer.from(new ActivationShimRenderer().render(activation, runtime.transport.symbol)) });
      const oldMarker = `src="${activation.sourceProvider}"`;
      assert.equal(index.split(oldMarker).length - 1, 1);
      index = index.replace(oldMarker,
        `src="${runtime.output.directory}${activation.shimFile}"`);
      const tag = `<script src="${runtime.output.directory}${activation.shimFile}"></script>`;
      index = index.replace(`${tag}\r\n`, `${tag}\n`);
    }
    for (const [relativePath, bytes] of generated) writes.push({ relativePath, bytes });
    const packageContract = app.json("architecture/build/package_contract.json");
    packageContract.stage.current = "3.12";
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
    const changed = writes.filter(write => !fs.existsSync(path.join(root, write.relativePath)) ||
      !fs.readFileSync(path.join(root, write.relativePath)).equals(write.bytes));
    assert.equal(new Set(changed.map(write => write.relativePath)).size, changed.length);
    const records = changed.map(write => {
      const file = path.join(root, write.relativePath);
      const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
      return {
        path: write.relativePath, beforeSha256: before ? sha(before) : null,
        afterSha256: sha(write.bytes), beforeBase64: before?.toString("base64") ?? null,
        afterBase64: write.bytes.toString("base64"),
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
        finalReconciliationStage: "3.12.7",
      },
      writes: records,
      rollback: {
        scope: "batch-012-only", restorePhase: "prebuild",
        restoreTopology: prebuild.activeTopology.counts,
        preserveCompletedBatchIds: prebuild.lifecycle.completedBatchIds,
      },
      nextGate: "stage-3.12.6-live-validation",
    };
    return { artifact, writes: changed.concat({ relativePath: CUTOVER, bytes: serialize(artifact) }) };
  }
}

class Batch012PublicationGate {
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

class Batch012AtomicCutover {
  constructor(root) { this.root = path.resolve(root); }

  commit(prepared, { failureInjector = null } = {}) {
    const newDirectories = [];
    try {
      for (const write of prepared.writes) {
        const parent = path.dirname(path.join(this.root, write.relativePath));
        if (!fs.existsSync(parent)) {
          const pending = [];
          for (let directory = parent; !fs.existsSync(directory); directory = path.dirname(directory)) {
            const relative = path.relative(this.root, directory).replaceAll("\\", "/");
            assert(relative === "src/game/domain/assemblies",
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
            assert.deepEqual(fs.readFileSync(path.join(this.root, write.relativePath)), write.bytes);
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
    assert(!fs.existsSync(path.join(this.root, CUTOVER)), "Batch 012 cutover is already published");
    const prepared = await new Batch012CutoverProjection().prepare(this.root);
    return new Batch012PublicationGate().run(() => {
      new Batch012Prebuild(this.root).validateOpen();
      this.commit(prepared);
      return prepared.artifact;
    });
  }
}

module.exports = { Batch012CutoverProjection, Batch012AtomicCutover, Batch012PublicationGate, CUTOVER };
