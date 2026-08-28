"use strict";

const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  ActivationShimContractValidator,
  ActivationShimRenderer,
} = require("../build/compat_runtime/activation_shim");
const {
  CumulativeRuntimeContractValidator,
  EXACT_TRANSPORT_GLOBAL,
} = require("../build/compat_runtime/cumulative_runtime_contract");
const {
  StageThreeCompatibilityBuildApplication,
} = require("../build/build_stage_3_compat_runtime");
const {
  MigrationBridgeRegistryValidator,
} = require("./guards/contracts/guard_artifact_repository");
const {
  BATCH_007_APPROVED_VIRTUAL_MODULES,
} = require("./domain_batches/stage_three_batch_007_candidate_build");
const {
  StageThreeBatch007CutoverContractValidator,
} = require("./domain_batches/stage_three_batch_007_cutover_contract");
const {
  StageThreeBatch007SourceBuildContractValidator,
} = require("./domain_batches/stage_three_batch_007_source_build_contract");
const {
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  StageThreeRuntimeScriptAliasResolver,
} = require("./migration/stage_three_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = BATCH_007_PREBUILD_PROFILE.batchId;
const PATHS = Object.freeze({
  prebuild: "architecture/migration/stage_3_batch_007_prebuild_contract.json",
  sourceBuild: "architecture/migration/stage_3_batch_007_source_build_validation.json",
  output: "architecture/migration/stage_3_batch_007_runtime_cutover.json",
  state: "architecture/migration/stage_3_execution_state.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  runtime: "architecture/migration/stage_3_compatibility_runtime.json",
  registry: "architecture/guards/migration_bridge_registry.json",
  index: "index.html",
});

class ExactRuntimeOutputSnapshot {
  constructor(projectRoot, relativeRoot = "dist/stage-3-compat-runtime") {
    this.projectRoot = path.resolve(projectRoot);
    this.relativeRoot = relativeRoot;
    this.outputRoot = path.resolve(this.projectRoot, relativeRoot);
    const distRoot = path.resolve(this.projectRoot, "dist");
    if (path.dirname(this.outputRoot) !== distRoot ||
      path.basename(this.outputRoot) !== "stage-3-compat-runtime") {
      throw new Error("Stage 3.7.5 output snapshot path is not the exact runtime directory");
    }
  }

  capture() {
    if (!fs.existsSync(this.outputRoot)) return Object.freeze([]);
    const records = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else records.push(Object.freeze({
          path: path.relative(this.outputRoot, absolute).replaceAll("\\", "/"),
          bytes: fs.readFileSync(absolute),
        }));
      }
    };
    walk(this.outputRoot);
    return Object.freeze(records.sort((left, right) => left.path.localeCompare(right.path)));
  }

  restore(records) {
    this.#assertExactRoot();
    if (fs.existsSync(this.outputRoot)) fs.rmSync(this.outputRoot, { recursive: true, force: true });
    if (records.length === 0) return;
    for (const record of records) {
      const absolute = path.resolve(this.outputRoot, record.path);
      const relative = path.relative(this.outputRoot, absolute);
      if (relative.startsWith("..") || path.isAbsolute(relative) || relative.replaceAll("\\", "/") !== record.path) {
        throw new Error(`Stage 3.7.5 snapshot entry escaped output root: ${record.path}`);
      }
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, record.bytes);
    }
  }

  #assertExactRoot() {
    const expected = path.resolve(this.projectRoot, "dist/stage-3-compat-runtime");
    if (this.outputRoot !== expected || path.dirname(this.outputRoot) !== path.resolve(this.projectRoot, "dist") ||
      path.basename(this.outputRoot) !== "stage-3-compat-runtime") {
      throw new Error("Stage 3.7.5 refused unsafe recursive output operation");
    }
  }
}

class StageThreeBatch007AtomicRuntimeCutover {
  async run() {
    const transition = this.#prepare();
    const backups = this.#backup(transition.writes);
    const outputSnapshot = new ExactRuntimeOutputSnapshot(PROJECT_ROOT);
    const previousOutput = outputSnapshot.capture();
    try {
      this.#writeAll(transition.writes);
      this.#persistObservations();
      const report = await new StageThreeCompatibilityBuildApplication({
        projectRoot: PROJECT_ROOT,
      }).run();
      this.#validateBuild(report, transition);
      const artifact = this.#artifact({ transition, report });
      new StageThreeBatch007CutoverContractValidator().validate(artifact);
      fs.writeFileSync(this.#absolute(PATHS.output), this.#serialize(artifact));
      return Object.freeze({
        status: artifact.status,
        moduleCount: report.moduleCount,
        activationCount: report.activationCount,
        bridgeCount: transition.nextRegistry.bridges.length,
      });
    } catch (error) {
      this.#restore(backups);
      outputSnapshot.restore(previousOutput);
      throw error;
    }
  }

  #prepare() {
    const prebuild = this.#json(PATHS.prebuild);
    const sourceBuild = this.#json(PATHS.sourceBuild);
    new StageThreeBatchPrebuildContractValidator(BATCH_007_PREBUILD_PROFILE).validate(prebuild);
    new StageThreeBatch007SourceBuildContractValidator().validate(sourceBuild);
    this.#verifySourceBuildEvidence(sourceBuild);
    const state = this.#json(PATHS.state);
    const runtime = this.#json(PATHS.runtime);
    const registry = this.#json(PATHS.registry);
    const manifest = this.#json(PATHS.manifest);
    this.#require(state.activeBatchId === BATCH_ID && state.activeBatchPhase === "prebuild",
      "batch 007 is not open in prebuild phase");
    this.#require(runtime.activationPositions.length === 26, "active activation baseline differs");
    this.#require(registry.bridges.length === 48, "active bridge baseline differs");
    this.#require(sourceBuild.verdict === "eligible-for-atomic-runtime-cutover",
      "source/build gate is not eligible");

    const activations = prebuild.preliminaryMetadata.plannedActivationPositions;
    const bridges = prebuild.preliminaryMetadata.plannedBridges;
    const targets = sourceBuild.sources.map((record) => this.#prepareTarget(record, activations));
    const nextRuntime = structuredClone(runtime);
    nextRuntime.activationPositions = [...runtime.activationPositions, ...activations]
      .sort((left, right) => left.id.localeCompare(right.id));
    nextRuntime.approvedVirtualModules = [...new Set([
      ...runtime.approvedVirtualModules,
      ...BATCH_007_APPROVED_VIRTUAL_MODULES,
    ])].sort();
    new CumulativeRuntimeContractValidator().validate(nextRuntime);
    const nextRegistry = structuredClone(registry);
    nextRegistry.bridges = [...registry.bridges, ...bridges]
      .sort((left, right) => left.id.localeCompare(right.id));
    new MigrationBridgeRegistryValidator().validate(nextRegistry);
    const nextState = { ...state, activeBatchPhase: "runtime-active" };
    const nextManifest = this.#projectManifest(manifest, targets);
    const nextIndex = this.#renderIndex(this.#read(PATHS.index), activations, nextRuntime.output.directory);
    const writes = new Map([
      [PATHS.state, this.#serialize(nextState)],
      [PATHS.runtime, this.#serialize(nextRuntime)],
      [PATHS.registry, this.#serialize(nextRegistry)],
      [PATHS.manifest, this.#serialize(nextManifest)],
      [PATHS.index, Buffer.from(nextIndex, "utf8")],
    ]);
    for (const target of targets) writes.set(target.currentPath, Buffer.from(target.shimCode, "utf8"));
    return Object.freeze({ prebuild, sourceBuild, targets, activations, bridges,
      nextRuntime, nextRegistry, nextState, writes });
  }

  #verifySourceBuildEvidence(sourceBuild) {
    for (const evidence of Object.values(sourceBuild.evidence)) {
      this.#require(this.#sha256(this.#bytes(evidence.path)) === evidence.sha256,
        `Stage 3.7.4 evidence changed: ${evidence.path}`);
    }
  }

  #prepareTarget(record, activations) {
    this.#require(this.#sha256(this.#bytes(record.currentPath)) === record.sourceSha256,
      `classic source fingerprint changed: ${record.currentPath}`);
    this.#require(this.#sha256(this.#bytes(record.targetPath)) === record.targetSha256,
      `ESM target fingerprint changed: ${record.targetPath}`);
    const activation = activations.find((item) => item.sourceProvider === record.currentPath);
    this.#require(activation?.targetModule === record.targetPath &&
      activation.exportName === record.exportName, `activation differs: ${record.currentPath}`);
    const shimCode = new ActivationShimRenderer().render(activation, EXACT_TRANSPORT_GLOBAL);
    new ActivationShimContractValidator().validate({ code: shimCode, activation,
      transportSymbol: EXACT_TRANSPORT_GLOBAL });
    return Object.freeze({ ...record, activation, shimCode });
  }

  #projectManifest(manifest, targets) {
    const next = structuredClone(manifest);
    const entries = new Map(next.modules.map((record) => [record.currentPath, record]));
    for (const target of targets) {
      const source = entries.get(target.currentPath);
      const esm = entries.get(target.targetPath);
      this.#require(source && esm, `Manifest pair is incomplete: ${target.currentPath}`);
      source.architecture = { ...source.architecture, roles: ["compatibility-bridge"],
        targetBoundary: "game-domain", targetPath: target.targetPath };
      esm.architecture = { ...esm.architecture, migrationStatus: "esm",
        roles: ["domain-behavior"], targetBoundary: "game-domain", targetPath: target.targetPath };
    }
    return next;
  }

  #renderIndex(html, activations, outputDirectory) {
    let result = html;
    for (const activation of activations) {
      const escaped = activation.sourceProvider.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const pattern = new RegExp(`(<script\\b[^>]*\\bsrc=["'])${escaped}(["'][^>]*><\\/script>)`, "gu");
      this.#require([...result.matchAll(pattern)].length === 1,
        `index provider position differs: ${activation.sourceProvider}`);
      result = result.replace(pattern, `$1${outputDirectory}${activation.shimFile}$2`);
    }
    const scripts = [...result.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/giu)];
    this.#require(scripts.length === 426, "physical classic script topology changed");
    this.#require(scripts.every((match) => !/\btype=["']module["']/iu.test(match[1])),
      "module scripts are forbidden");
    return result;
  }

  #persistObservations() {
    const result = spawnSync(process.execPath,
      [this.#absolute("utils/architecture/persist-migration-observations.js")],
      { cwd: PROJECT_ROOT, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`Stage 3.7.5 observation persistence failed:\n${result.stdout}\n${result.stderr}`);
    }
  }

  #validateBuild(report, transition) {
    const candidate = transition.sourceBuild.candidateBuild;
    this.#require(report.status === "built", "cumulative build did not complete");
    this.#require(report.moduleCount === 31 && report.activationCount === 32,
      "runtime topology differs from the approved 31/32 result");
    this.#require(this.#same(report.selectedBatchIds,
      transition.prebuild.lifecycle.completedBatchIds.concat(BATCH_ID)),
    "selected batch prefix differs");
    const runtime = report.outputs.find((record) => record.kind === "cumulative-runtime");
    this.#require(runtime?.sha256 === candidate.runtimeSha256,
      "active runtime differs byte-for-byte from Stage 3.7.4 candidate evidence");
    this.#require(this.#same(runtime?.projectModules, candidate.projectModules),
      "active project module graph differs from candidate evidence");
    this.#require(this.#same(runtime?.virtualBuildModules, candidate.virtualBuildModules),
      "active virtual helper set differs from candidate evidence");
    const outputs = report.outputs.filter((record) => record.kind === "activation-shim")
      .map((record) => ({ activationId: record.activationId, path: record.path,
        sha256: record.sha256, targetModule: record.targetModule,
        exportName: record.exportName, legacyScriptIndex: record.legacyScriptIndex }))
      .sort((left, right) => left.activationId.localeCompare(right.activationId));
    this.#require(this.#same(outputs, candidate.activationOutputs),
      "activation outputs differ from candidate evidence");
    const aliases = new StageThreeRuntimeScriptAliasResolver().resolve(transition.nextRuntime);
    const logical = new LegacyScriptOrderReader(this.#absolute(PATHS.index), { scriptAliases: aliases }).read();
    this.#require(logical.length === 424, "logical legacy order differs");
  }

  #artifact({ transition, report }) {
    const runtime = report.outputs.find((record) => record.kind === "cumulative-runtime");
    const scripts = [...this.#read(PATHS.index).matchAll(
      /<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/giu,
    )];
    return {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-runtime-cutover",
      status: "runtime-active-verified",
      batchId: BATCH_ID,
      releaseVersion: transition.nextState.releaseVersion,
      evidence: {
        prebuildContract: this.#evidence(PATHS.prebuild),
        sourceBuildValidation: this.#evidence(PATHS.sourceBuild),
        executionStateAfter: this.#evidence(PATHS.state),
        manifestAfterMechanicalObservation: this.#evidence(PATHS.manifest),
        runtimeContractAfter: this.#evidence(PATHS.runtime),
        bridgeRegistryAfter: this.#evidence(PATHS.registry),
        indexAfter: this.#evidence(PATHS.index),
      },
      lifecycle: { completedBatchIds: [...transition.nextState.completedBatchIds],
        activeBatchId: transition.nextState.activeBatchId,
        activeBatchPhase: transition.nextState.activeBatchPhase,
        compatibilityRuntimeActivated: true, batchCompleted: false },
      topology: { counts: structuredClone(BATCH_007_PREBUILD_PROFILE.topology.planned),
        projectModules: [...runtime.projectModules],
        activationIds: transition.nextRuntime.activationPositions.map((record) => record.id).sort(),
        bridgeIds: transition.nextRegistry.bridges.map((record) => record.id).sort() },
      build: { status: report.status, moduleCount: report.moduleCount,
        activationCount: report.activationCount, runtimeSha256: runtime.sha256,
        candidateRuntimeSha256: transition.sourceBuild.candidateBuild.runtimeSha256,
        virtualBuildModules: [...runtime.virtualBuildModules],
        previousOutputPreservedUntilValidation: true },
      sourceTransition: { targetCount: transition.targets.length,
        shimCount: transition.activations.length, representationOnly: true,
        partialCutoverAllowed: false,
        targets: transition.targets.map((record) => ({ currentPath: record.currentPath,
          targetPath: record.targetPath, exportName: record.exportName,
          targetSha256: record.targetSha256, activationId: record.activation.id })) },
      dependencyObservation: {
        confirmedInterFileEdgesBefore: 771,
        confirmedInterFileEdgesAfter: 772,
        confirmedEdgeDelta: 1,
        newlyConfirmedEdges: [{
          source: "src/ui/inventory/inventory_v2_balance_parameter_resolver.js",
          target: "src/core/fishing/reel_retrieve_speed_calculator.js",
          symbols: ["ReelRetrieveSpeedCalculator"],
          reason: "Exact approved guarded compatibility consumer became mechanically resolvable after activation.",
        }],
      },
      scriptTopology: { physicalClassicScriptCount: scripts.length,
        logicalLegacyPositionCount: 424,
        moduleScriptCount: scripts.filter((match) => /\btype=["']module["']/iu.test(match[1])).length },
      rollback: { scope: "batch-007-only",
        preserveCompletedBatchesThrough: BATCH_007_PREBUILD_PROFILE.completedPrefix.at(-1),
        partialRollbackAllowed: false,
        restoreTopology: { modules: 25, activations: 26, bridges: 48 } },
      nextGate: "stage-3.7.6-post-build-identity-and-timing-validation",
    };
  }

  #backup(writes) {
    const paths = [...writes.keys(), PATHS.output];
    return new Map(paths.map((relativePath) => [relativePath,
      fs.existsSync(this.#absolute(relativePath)) ? this.#bytes(relativePath) : null]));
  }

  #writeAll(writes) {
    for (const [relativePath, bytes] of writes) {
      const absolute = this.#absolute(relativePath);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, bytes);
    }
  }

  #restore(backups) {
    for (const [relativePath, bytes] of backups) {
      const absolute = this.#absolute(relativePath);
      if (bytes === null) {
        if (fs.existsSync(absolute)) fs.rmSync(absolute, { force: true });
      } else fs.writeFileSync(absolute, bytes);
    }
  }

  #evidence(relativePath) { return { path: relativePath, sha256: this.#sha256(this.#bytes(relativePath)) }; }
  #json(relativePath) { return JSON.parse(this.#read(relativePath)); }
  #read(relativePath) { return this.#bytes(relativePath).toString("utf8"); }
  #bytes(relativePath) { return fs.readFileSync(this.#absolute(relativePath)); }
  #absolute(relativePath) {
    const absolute = path.resolve(PROJECT_ROOT, relativePath);
    const relative = path.relative(PROJECT_ROOT, absolute);
    this.#require(!relative.startsWith("..") && !path.isAbsolute(relative),
      `path escaped project root: ${relativePath}`);
    return absolute;
  }
  #serialize(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"); }
  #sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
  #same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
  #require(condition, message) {
    if (!condition) throw new Error(`Stage 3.7.5 atomic runtime cutover failed: ${message}`);
  }
}

if (require.main === module) {
  new StageThreeBatch007AtomicRuntimeCutover().run().then((result) => {
    console.log(`Stage 3.7.5 cutover passed: ${result.moduleCount} modules, ` +
      `${result.activationCount} activations, ${result.bridgeCount} bridges.`);
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { ExactRuntimeOutputSnapshot, StageThreeBatch007AtomicRuntimeCutover };
