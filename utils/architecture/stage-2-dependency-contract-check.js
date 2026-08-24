const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-2.2-engine-dependency-contract";
const SOURCE_PATH = "src/app/core/dependency_contract_validator.js";
const TARGET_PATH = "src/engine/di/dependency_contract_validator.js";
const WRAPPER_PATH =
  "src/engine/compat/stage_2/dependency_contract_validator_legacy_bridge.js";
const OUTPUT_PATH = "dist/legacy-bridges/dependency_contract_validator.iife.js";
const CONSUMER_PATH = "src/app/bootstrap.js";

class DependencyContractSourceLoader {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  loadLegacy() {
    const context = vm.createContext({});
    vm.runInContext(
      `${this.#read(SOURCE_PATH)}\nglobalThis.__contract = DependencyContractValidator;`,
      context,
      { filename: SOURCE_PATH },
    );
    return context.__contract;
  }

  async loadMigrated() {
    const source = this.#read(TARGET_PATH);
    const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
    const module = await import(`${url}#stage-2.2-dependency-contract`);
    assert.deepEqual(Object.keys(module), ["DependencyContractValidator"]);
    return module.DependencyContractValidator;
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8");
  }
}

class DependencyContractBehaviorVerifier {
  verify(DependencyContractValidator) {
    const defaults = new DependencyContractValidator();
    assert.equal(defaults.stage, "bootstrap");
    assert.equal(defaults.consumer, "composition");

    const contract = new DependencyContractValidator({
      stage: "fixture",
      consumer: "GameCompositionRoot.create",
    });
    const dependency = Object.create({ inherited: true });
    dependency.load = () => "loaded";
    dependency.save = () => "saved";
    dependency.own = 1;

    assert.equal(
      contract.requireMethods(dependency, "storage", ["load", "save"]),
      dependency,
    );
    assert.equal(
      contract.requireProperties(dependency, "storage", ["own", "inherited"]),
      dependency,
    );
    assert.throws(
      () => contract.requireMethods(null, "clock", ["now"]),
      /\[fixture\] GameCompositionRoot\.create requires clock\.now/,
    );
    assert.throws(
      () => contract.requireMethods({}, "clock", ["now"]),
      /requires clock\.now/,
    );
    assert.throws(
      () => contract.requireProperties({}, "config", ["locations"]),
      /requires config\.locations/,
    );
    assert.throws(
      () => contract.requireProperties(null, "config", []),
      /requires config\.value/,
    );
  }
}

class StageTwoDependencyContractCheck {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.paths = Object.freeze({
      approved: "architecture/migration/stage_2_approved_batches.json",
      manifest: "architecture/migration/module_migration_manifest.json",
      state: "architecture/migration/stage_2_execution_state.json",
      registry: "architecture/guards/migration_bridge_registry.json",
      index: "index.html",
      source: SOURCE_PATH,
      target: TARGET_PATH,
      wrapper: WRAPPER_PATH,
      consumer: CONSUMER_PATH,
    });
  }

  async run() {
    const before = this.#readTrackedBytes();
    const approvedPlan = this.#readJson(this.paths.approved);
    const manifest = this.#readJson(this.paths.manifest);
    const state = this.#readJson(this.paths.state);
    const registry = this.#readJson(this.paths.registry);
    const batch = approvedPlan.batches.find((item) => item.id === BATCH_ID);
    this.#verifyFrozenBatch(batch);

    const migrated =
      state.completedBatchIds.includes(BATCH_ID) || state.activeBatchId === BATCH_ID;
    if (migrated) {
      this.#verifyMigrated({ manifest, state, registry });
    } else {
      this.#verifyPreflight({ manifest, state, registry });
    }

    const loader = new DependencyContractSourceLoader(this.projectRoot);
    const Contract = migrated ? await loader.loadMigrated() : loader.loadLegacy();
    new DependencyContractBehaviorVerifier().verify(Contract);
    assert.deepEqual(
      this.#readTrackedBytes(),
      before,
      "Stage 2.2 dependency contract check must be read-only",
    );
    console.log(
      `Stage 2.2 dependency contract passed (${migrated ? "migrated" : "preflight"}): ` +
        "1 dependency-free engine contract, 1 exact classic consumer, " +
        "load order and behavior verified; read-only.",
    );
  }

  #verifyFrozenBatch(batch) {
    assert.ok(batch, "Approved Stage 2.2 batch is missing");
    assert.equal(batch.order, 2);
    assert.equal(batch.status, "approved");
    assert.equal(batch.targetBoundary, "engine");
    assert.deepEqual(batch.dependencyOrdering.batchPrerequisites, [
      "stage-2.1-engine-asset-contracts",
    ]);
    assert.deepEqual(batch.modules, [
      {
        currentPath: SOURCE_PATH,
        targetPath: TARGET_PATH,
        providers: ["DependencyContractValidator"],
        legacyConsumers: [CONSUMER_PATH],
      },
    ]);
    const bridge = batch.bridgeStrategy.bridges[0];
    assert.equal(batch.bridgeStrategy.owner, BATCH_ID);
    assert.equal(batch.bridgeStrategy.removalStage, "stage-5");
    assert.equal(bridge.wrapperPath, WRAPPER_PATH);
    assert.equal(bridge.outputPath, OUTPUT_PATH);
    assert.deepEqual(bridge.globalProviders, [
      {
        symbol: "DependencyContractValidator",
        mechanism: "global-this-property",
        availability: "program-init",
      },
    ]);
  }

  #verifyPreflight({ manifest, state, registry }) {
    assert.deepEqual(state.completedBatchIds, ["stage-2.1-engine-asset-contracts"]);
    assert.equal(state.activeBatchId, null);
    assert.equal(state.esmRuntimeIntegrationStarted, true);
    assert.equal(registry.bridges.some((item) => item.owner === BATCH_ID), false);
    const entry = this.#entry(manifest, SOURCE_PATH);
    assert.equal(entry.observed.legacyLoadOrder, 395);
    assert.equal(entry.architecture.migrationStatus, "classified");
    assert.deepEqual(entry.architecture.roles, ["engine-utility"]);
    assert.equal(entry.architecture.targetBoundary, "engine");
    assert.equal(entry.architecture.targetPath, TARGET_PATH);
    assert.deepEqual(entry.observed.environment.browserApis, []);
    assert.deepEqual(entry.analysis.dependencies.confirmed, []);
    assert.deepEqual(entry.analysis.blockers.items, []);
    assert.equal(this.#exists(SOURCE_PATH), true);
    assert.equal(this.#exists(TARGET_PATH), false);
    this.#verifyConsumer(manifest, SOURCE_PATH);
    this.#assertRuntimePosition(SOURCE_PATH);
  }

  #verifyMigrated({ manifest, state, registry }) {
    assert.equal(state.esmRuntimeIntegrationStarted, true);
    assert.ok(
      state.completedBatchIds.includes(BATCH_ID) || state.activeBatchId === BATCH_ID,
      "Stage 2.2 must be active or completed",
    );
    const entry = this.#entry(manifest, TARGET_PATH);
    assert.ok(["migrating", "esm", "verified"].includes(
      entry.architecture.migrationStatus,
    ));
    assert.equal(entry.observed.legacyLoadOrder, null);
    assert.deepEqual(entry.observed.environment.browserApis, []);
    assert.deepEqual(entry.analysis.dependencies.confirmed, []);
    assert.equal(this.#exists(SOURCE_PATH), false);
    assert.equal(this.#exists(TARGET_PATH), true);
    assert.equal(this.#exists(WRAPPER_PATH), true);
    assert.equal(
      registry.bridges.filter((item) => item.owner === BATCH_ID).length,
      1,
    );
    this.#verifyConsumer(manifest, WRAPPER_PATH);
    this.#assertRuntimePosition(WRAPPER_PATH);
  }

  #verifyConsumer(manifest, expectedTarget) {
    const consumers = manifest.modules
      .filter((entry) => entry.analysis.dependencies.items.some(
        (dependency) => dependency.target === expectedTarget &&
          Array.isArray(dependency.symbols) &&
          dependency.symbols.includes("DependencyContractValidator"),
      ))
      .map((entry) => entry.currentPath)
      .sort();
    assert.deepEqual(consumers, [CONSUMER_PATH]);
    const consumer = this.#entry(manifest, CONSUMER_PATH);
    assert.equal(consumer.observed.legacyLoadOrder, 422);
    const facts = consumer.observed.consumers.items.filter(
      (item) => item.symbol === "DependencyContractValidator",
    );
    assert.deepEqual(facts, [
      {
        symbol: "DependencyContractValidator",
        mechanism: "identifier",
        accessRequirement: "required",
        executionPhase: "deferred",
      },
    ]);
  }

  #assertRuntimePosition(expectedProvider) {
    const scriptAliases = new StageTwoRuntimeScriptAliasResolver().loadProject(
      this.projectRoot,
    );
    const scripts = new LegacyScriptOrderReader(
      path.join(this.projectRoot, this.paths.index),
      { scriptAliases },
    ).read().map((script) => script.currentPath);
    assert.equal(scripts[394], expectedProvider);
    assert.equal(scripts[421], CONSUMER_PATH);
  }

  #entry(manifest, currentPath) {
    const entry = manifest.modules.find((item) => item.currentPath === currentPath);
    assert.ok(entry, `Manifest entry is missing: ${currentPath}`);
    return entry;
  }

  #readTrackedBytes() {
    return Object.fromEntries(Object.entries(this.paths).map(([id, relativePath]) => [
      id,
      this.#exists(relativePath) ? this.#read(relativePath) : null,
    ]));
  }

  #readJson(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8");
  }

  #exists(relativePath) {
    return fs.existsSync(path.join(this.projectRoot, relativePath));
  }
}

new StageTwoDependencyContractCheck(PROJECT_ROOT).run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
