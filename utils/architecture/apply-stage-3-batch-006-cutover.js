"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const estraverse = require("estraverse");
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
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");
const {
  BATCH_006_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-3.candidate-006-fishing-e48e70d8";
const PATHS = Object.freeze({
  prebuild: "architecture/migration/stage_3_batch_006_prebuild_contract.json",
  plan: "architecture/migration/stage_3_batch_006_execution_plan.json",
  state: "architecture/migration/stage_3_execution_state.json",
  manifest: "architecture/migration/module_migration_manifest.json",
  runtime: "architecture/migration/stage_3_compatibility_runtime.json",
  registry: "architecture/guards/migration_bridge_registry.json",
  index: "index.html",
});

class StageThreeBatch006AtomicCutover {
  async run() {
    const transition = this.#prepare();
    const backups = this.#backup(transition.writes);
    try {
      this.#writeAll(transition.writes);
      const report = await new StageThreeCompatibilityBuildApplication({
        projectRoot: PROJECT_ROOT,
      }).run();
      this.#validateBuildReport(report, transition);
      return Object.freeze({
        status: "cutover-built",
        targetCount: transition.targets.length,
        activationCount: transition.activations.length,
        bridgeCount: transition.bridges.length,
        report,
      });
    } catch (error) {
      this.#restore(backups);
      throw error;
    }
  }

  #prepare() {
    const prebuild = this.#json(PATHS.prebuild);
    const plan = this.#json(PATHS.plan);
    const state = this.#json(PATHS.state);
    const manifest = this.#json(PATHS.manifest);
    const runtime = this.#json(PATHS.runtime);
    const registry = this.#json(PATHS.registry);
    new StageThreeBatchPrebuildContractValidator(BATCH_006_PREBUILD_PROFILE).validate(prebuild);
    this.#require(state.activeBatchId === BATCH_ID, "batch 006 is not active");
    this.#require(state.activeBatchPhase === "prebuild", "batch 006 is not in prebuild phase");
    this.#require(runtime.activationPositions.length === 20, "active activation baseline differs");
    this.#require(runtime.plannedActivationPositions?.length === 6, "planned activation set differs");
    this.#require(registry.bridges.length === 41, "active bridge baseline differs");
    this.#require(registry.plannedBridges?.length === 7, "planned bridge set differs");
    this.#require(manifest.preliminaryMigration?.batchId === BATCH_ID, "Manifest preliminary batch differs");
    this.#require(manifest.preliminaryMigration?.observationsFinal === false, "Manifest observations are already final");

    const activations = prebuild.preliminaryMetadata.plannedActivationPositions;
    const bridges = prebuild.preliminaryMetadata.plannedBridges;
    const targets = prebuild.preliminaryMetadata.targets.map((record) =>
      this.#prepareTarget(record, activations));
    const nextRuntime = structuredClone(runtime);
    nextRuntime.activationPositions = [
      ...runtime.activationPositions,
      ...runtime.plannedActivationPositions,
    ].sort((left, right) => left.id.localeCompare(right.id));
    delete nextRuntime.plannedActivationPositions;
    new CumulativeRuntimeContractValidator().validate(nextRuntime);
    const nextRegistry = structuredClone(registry);
    nextRegistry.bridges = [
      ...registry.bridges,
      ...registry.plannedBridges,
    ].sort((left, right) => left.id.localeCompare(right.id));
    delete nextRegistry.plannedBridges;
    new MigrationBridgeRegistryValidator().validate(nextRegistry);
    const nextState = {
      ...state,
      activeBatchPhase: "runtime-active",
    };
    const nextManifest = structuredClone(manifest);
    nextManifest.preliminaryMigration.status = "cutover-sources-created";
    nextManifest.preliminaryMigration.observationsFinal = false;
    const nextIndex = this.#renderIndex(
      this.#read(PATHS.index),
      activations,
      nextRuntime.output.directory,
    );
    const writes = new Map([
      [PATHS.state, this.#serialize(nextState)],
      [PATHS.manifest, this.#serialize(nextManifest)],
      [PATHS.runtime, this.#serialize(nextRuntime)],
      [PATHS.registry, this.#serialize(nextRegistry)],
      [PATHS.index, Buffer.from(nextIndex, "utf8")],
    ]);
    for (const target of targets) {
      writes.set(target.targetPath, Buffer.from(target.targetCode, "utf8"));
      writes.set(target.currentPath, Buffer.from(target.shimCode, "utf8"));
    }
    return Object.freeze({
      writes,
      targets,
      activations,
      bridges,
      expectedProjectModules: plan.cumulativeRuntime.projectModulesAfter,
      expectedActivationCount: plan.cumulativeRuntime.afterActivationCount,
    });
  }

  #prepareTarget(record, activations) {
    const sourceBytes = this.#bytes(record.currentPath);
    this.#require(this.#sha256(sourceBytes) === record.sourceSha256,
      `source fingerprint changed: ${record.currentPath}`);
    this.#require(!fs.existsSync(this.#absolute(record.targetPath)),
      `target already exists: ${record.targetPath}`);
    const source = sourceBytes.toString("utf8");
    const activation = activations.find((candidate) =>
      candidate.sourceProvider === record.currentPath);
    this.#require(activation, `activation is missing: ${record.currentPath}`);
    const declaration = `class ${activation.exportName}`;
    const occurrences = source.split(declaration).length - 1;
    this.#require(occurrences === 1, `classic declaration is not exact: ${record.currentPath}`);
    const targetCode = source.replace(declaration, `export class ${activation.exportName}`);
    this.#validateTarget(targetCode, activation);
    const shimCode = new ActivationShimRenderer().render(
      activation,
      EXACT_TRANSPORT_GLOBAL,
    );
    new ActivationShimContractValidator().validate({
      code: shimCode,
      activation,
      transportSymbol: EXACT_TRANSPORT_GLOBAL,
    });
    return Object.freeze({
      currentPath: record.currentPath,
      targetPath: record.targetPath,
      targetCode,
      shimCode,
    });
  }

  #validateTarget(code, activation) {
    const tree = espree.parse(code, { ecmaVersion: "latest", sourceType: "module" });
    const exports = tree.body.filter((node) => node.type === "ExportNamedDeclaration");
    this.#require(exports.length === 1, `${activation.targetModule} must have one named export`);
    this.#require(
      exports[0].declaration?.type === "ClassDeclaration" &&
        exports[0].declaration.id?.name === activation.exportName,
      `${activation.targetModule} export differs`,
    );
    const forbidden = [];
    estraverse.traverse(tree, {
      fallback: "iteration",
      enter(node) {
        if (node.type === "ImportDeclaration") forbidden.push("import");
        if (node.type === "ExportDefaultDeclaration" || node.type === "ExportAllDeclaration") {
          forbidden.push(node.type);
        }
        if (node.type === "Identifier" && [
          "CONFIG",
          "document",
          "window",
          "globalThis",
          "localStorage",
          "Audio",
          "CanvasRenderingContext2D",
          "__CYBER_FISHING_COMPAT_RUNTIME__",
        ].includes(node.name)) forbidden.push(node.name);
      },
    });
    this.#require(forbidden.length === 0,
      `${activation.targetModule} has forbidden dependencies: ${forbidden.join(", ")}`);
  }

  #renderIndex(html, activations, outputDirectory) {
    let result = html;
    for (const activation of activations) {
      const oldSource = activation.sourceProvider;
      const newSource = `${outputDirectory}${activation.shimFile}`;
      const escaped = oldSource.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const pattern = new RegExp(`(<script\\b[^>]*\\bsrc=["'])${escaped}(["'][^>]*><\\/script>)`, "gu");
      const matches = [...result.matchAll(pattern)];
      this.#require(matches.length === 1, `index provider position differs: ${oldSource}`);
      result = result.replace(pattern, `$1${newSource}$2`);
    }
    const scripts = [...result.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/giu)];
    this.#require(scripts.length === 426, "physical classic script topology changed");
    this.#require(scripts.every((match) => !/\btype=["']module["']/iu.test(match[1])),
      "module scripts are forbidden");
    return result;
  }

  #validateBuildReport(report, transition) {
    this.#require(report.status === "built", "cumulative build did not complete");
    this.#require(report.moduleCount === 25, "cumulative graph must contain 25 project modules");
    this.#require(report.activationCount === transition.expectedActivationCount,
      "cumulative graph must contain 26 activations");
    this.#require(report.selectedBatchIds.at(-1) === BATCH_ID,
      "cumulative graph did not select batch 006");
    const runtime = report.outputs.find((record) => record.kind === "cumulative-runtime");
    this.#require(runtime, "cumulative runtime output is missing");
    this.#require(this.#same(runtime.projectModules, transition.expectedProjectModules),
      "actual bundled modules differ from the frozen plan");
    this.#require(new Set(runtime.projectModules).size === 25,
      "cumulative graph contains duplicate project modules");
  }

  #backup(writes) {
    return new Map([...writes.keys()].map((relativePath) => [
      relativePath,
      fs.existsSync(this.#absolute(relativePath))
        ? this.#bytes(relativePath)
        : null,
    ]));
  }

  #writeAll(writes) {
    for (const [relativePath, bytes] of writes) {
      const target = this.#absolute(relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
    }
  }

  #restore(backups) {
    for (const [relativePath, bytes] of backups) {
      const target = this.#absolute(relativePath);
      if (bytes === null) {
        if (fs.existsSync(target)) fs.rmSync(target, { force: true });
      } else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
    }
  }

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return this.#bytes(relativePath).toString("utf8");
  }

  #bytes(relativePath) {
    return fs.readFileSync(this.#absolute(relativePath));
  }

  #absolute(relativePath) {
    const absolute = path.resolve(PROJECT_ROOT, relativePath);
    const relative = path.relative(PROJECT_ROOT, absolute);
    this.#require(!relative.startsWith("..") && !path.isAbsolute(relative),
      `path escaped project root: ${relativePath}`);
    return absolute;
  }

  #serialize(value) {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  #sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  #require(condition, message) {
    if (!condition) throw new Error(`Stage 3.6.5/3.6.6 atomic cutover failed: ${message}`);
  }
}

if (require.main === module) {
  new StageThreeBatch006AtomicCutover().run().then((result) => {
    console.log(
      `Stage 3.6.5/3.6.6 cutover built: ${result.targetCount} targets, ` +
        `${result.report.moduleCount} project modules, ${result.report.activationCount} activations.`,
    );
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { StageThreeBatch006AtomicCutover };
