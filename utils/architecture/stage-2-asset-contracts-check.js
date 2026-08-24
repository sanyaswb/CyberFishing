const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-2.1-engine-asset-contracts";
const CONSUMER_PATH = "src/assets/asset_preload_coordinator.js";

class AssetContractSourceLoader {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  loadLegacy() {
    const context = vm.createContext({});
    const sources = [
      "src/assets/asset_manifest.js",
      "src/assets/asset_load_result.js",
      CONSUMER_PATH,
    ].map((relativePath) => this.#read(relativePath));
    vm.runInContext(
      `${sources.join("\n")}\n` +
        "globalThis.__assetContracts = { " +
        "AssetManifest, AssetLoadResult, AssetPreloadCoordinator };",
      context,
      { filename: "stage-2.1-legacy-asset-contracts.js" },
    );
    return context.__assetContracts;
  }

  async loadMigrated() {
    const [manifestModule, resultModule] = await Promise.all([
      this.#importDependencyFreeModule("src/engine/assets/asset_manifest.js"),
      this.#importDependencyFreeModule("src/engine/assets/asset_load_result.js"),
    ]);
    return {
      AssetManifest: manifestModule.AssetManifest,
      AssetLoadResult: resultModule.AssetLoadResult,
      AssetPreloadCoordinator: this.#loadCoordinatorWith({
        AssetManifest: manifestModule.AssetManifest,
        AssetLoadResult: resultModule.AssetLoadResult,
      }),
    };
  }

  #loadCoordinatorWith({ AssetManifest, AssetLoadResult }) {
    const context = vm.createContext({ AssetManifest, AssetLoadResult });
    vm.runInContext(
      `${this.#read(CONSUMER_PATH)}\n` +
        "globalThis.__coordinator = AssetPreloadCoordinator;",
      context,
      { filename: CONSUMER_PATH },
    );
    return context.__coordinator;
  }

  async #importDependencyFreeModule(relativePath) {
    const source = this.#read(relativePath);
    const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
    return import(`${url}#stage-2.1-contract`);
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8");
  }
}

class AssetContractBehaviorVerifier {
  async verify({ AssetManifest, AssetLoadResult, AssetPreloadCoordinator }) {
    this.#verifyManifest(AssetManifest);
    this.#verifyLoadResult(AssetLoadResult);
    await this.#verifyClassicConsumer({
      AssetManifest,
      AssetLoadResult,
      AssetPreloadCoordinator,
    });
  }

  #verifyManifest(AssetManifest) {
    const manifest = new AssetManifest();
    assert.equal(manifest.count, 0);
    assert.equal(manifest.getAt(-1), null);
    assert.equal(manifest.getAt(0), null);
    assert.equal(manifest.add("", "ignored.webp"), manifest);
    assert.equal(manifest.add("ignored", "   "), manifest);
    assert.equal(manifest.count, 0);

    assert.equal(manifest.add(" fish ", " fish.webp "), manifest);
    assert.equal(
      manifest.add("depth", "depth.webp", { critical: false }),
      manifest,
    );
    assert.equal(manifest.count, 2);
    assert.deepEqual(this.#plain(manifest.getAt(0)), {
      id: "fish",
      src: "fish.webp",
      critical: true,
    });
    assert.deepEqual(this.#plain(manifest.getAt(1)), {
      id: "depth",
      src: "depth.webp",
      critical: false,
    });
    assert.equal(manifest.getAt(2), null);
    assert.deepEqual(this.#plain(manifest.toProviderManifest()), {
      fish: "fish.webp",
      depth: "depth.webp",
    });
  }

  #verifyLoadResult(AssetLoadResult) {
    const sourceRecords = [
      { id: "fish", critical: true, loaded: true },
      { id: "depth", critical: false, loaded: false },
    ];
    const ready = new AssetLoadResult(sourceRecords);
    sourceRecords.push({ id: "late", critical: true, loaded: false });
    assert.equal(ready.count, 2, "AssetLoadResult must snapshot its record array");
    assert.equal(ready.ok, true, "Non-critical failure must not fail the result");
    assert.equal(ready.assertCriticalReady("ready"), ready);
    assert.equal(ready.getAt(-1), null);
    assert.equal(ready.getAt(2), null);

    const failed = new AssetLoadResult([
      { id: "critical", critical: true, loaded: false },
    ]);
    assert.equal(failed.ok, false);
    assert.throws(
      () => failed.assertCriticalReady("victory"),
      /victory critical assets failed to load/,
    );
  }

  async #verifyClassicConsumer({
    AssetManifest,
    AssetLoadResult,
    AssetPreloadCoordinator,
  }) {
    const requested = [];
    const coordinator = new AssetPreloadCoordinator({
      imageAssets: {
        isReady: () => false,
        preload: async (providerManifest) => {
          requested.push(this.#plain(providerManifest));
        },
      },
      locationsConfig: {},
    });
    const emptyResult = await coordinator.preloadApplicationAssets();
    assert.equal(emptyResult instanceof AssetLoadResult, true);
    assert.equal(emptyResult.count, 0);

    const manifest = new AssetManifest()
      .add("fish", "fish.webp")
      .add("depth", "depth.webp", { critical: false });
    const result = await coordinator.preloadManifest(manifest, "fixture");
    assert.equal(result instanceof AssetLoadResult, true);
    assert.equal(result.ok, true);
    assert.deepEqual(requested, [
      { fish: "fish.webp" },
      { depth: "depth.webp" },
    ]);
  }

  #plain(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class StageTwoAssetContractsCheck {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.paths = Object.freeze({
      approved: "architecture/migration/stage_2_approved_batches.json",
      manifest: "architecture/migration/module_migration_manifest.json",
      state: "architecture/migration/stage_2_execution_state.json",
      registry: "architecture/guards/migration_bridge_registry.json",
      index: "index.html",
      manifestSource: "src/assets/asset_manifest.js",
      resultSource: "src/assets/asset_load_result.js",
      consumer: CONSUMER_PATH,
      manifestTarget: "src/engine/assets/asset_manifest.js",
      resultTarget: "src/engine/assets/asset_load_result.js",
      manifestBridge:
        "src/engine/compat/stage_2/asset_manifest_legacy_bridge.js",
      resultBridge:
        "src/engine/compat/stage_2/asset_load_result_legacy_bridge.js",
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
      this.#verifyMigratedStructure({ batch, manifest, state, registry });
    } else {
      this.#verifyFoundationPreflight({ batch, manifest, state, registry });
    }

    const contracts = migrated
      ? await new AssetContractSourceLoader(this.projectRoot).loadMigrated()
      : new AssetContractSourceLoader(this.projectRoot).loadLegacy();
    await new AssetContractBehaviorVerifier().verify(contracts);
    assert.deepEqual(
      this.#readTrackedBytes(),
      before,
      "Stage 2.1 asset contract check must be read-only",
    );

    console.log(
      `Stage 2.1 asset contracts passed (${migrated ? "migrated" : "preflight"}): ` +
        "2 dependency-free engine contracts, 1 exact classic consumer, " +
        "load order and behavior verified; read-only.",
    );
  }

  #verifyFrozenBatch(batch) {
    assert.ok(batch, "Approved Stage 2.1 batch is missing");
    assert.equal(batch.order, 1);
    assert.equal(batch.status, "approved");
    assert.equal(batch.targetBoundary, "engine");
    assert.equal(batch.bridgeStrategy.kind, "vite-built-classic-iife");
    assert.equal(batch.bridgeStrategy.activation, "same-commit-as-module-cutover");
    assert.deepEqual(
      batch.modules.map((item) => item.currentPath),
      [this.paths.resultSource, this.paths.manifestSource],
    );
    assert.deepEqual(
      batch.modules.map((item) => item.targetPath),
      [
        "src/engine/assets/asset_load_result.js",
        "src/engine/assets/asset_manifest.js",
      ],
    );
    for (const module of batch.modules) {
      assert.deepEqual(module.legacyConsumers, [CONSUMER_PATH]);
    }
  }

  #verifyFoundationPreflight({ batch, manifest, state, registry }) {
    assert.equal(state.status, "foundation-verified");
    assert.equal(state.esmRuntimeIntegrationStarted, false);
    assert.equal(state.activeBatchId, null);
    assert.deepEqual(state.completedBatchIds, []);
    assert.deepEqual(registry.bridges, []);

    const expectedLoadOrder = new Map([
      [this.paths.manifestSource, 352],
      [this.paths.resultSource, 353],
      [this.paths.consumer, 354],
    ]);
    for (const module of batch.modules) {
      const entry = manifest.modules.find(
        (candidate) => candidate.currentPath === module.currentPath,
      );
      assert.ok(entry, `Manifest entry is missing: ${module.currentPath}`);
      assert.equal(entry.observed.legacyLoadOrder, expectedLoadOrder.get(module.currentPath));
      assert.equal(entry.architecture.migrationStatus, "classified");
      assert.equal(entry.architecture.targetBoundary, "engine");
      assert.equal(entry.architecture.targetPath, module.targetPath);
      assert.deepEqual(entry.architecture.roles, ["engine-runtime"]);
      assert.deepEqual(entry.observed.environment.browserApis, []);
      assert.deepEqual(entry.observed.environment.dynamicConstructs, []);
      assert.deepEqual(entry.analysis.dependencies.confirmed, []);
      assert.deepEqual(entry.analysis.blockers.items, []);
      assert.equal(this.#exists(module.currentPath), true);
      assert.equal(this.#exists(module.targetPath), false);
    }

    const consumers = manifest.modules
      .filter((entry) =>
        entry.analysis.dependencies.confirmed.some((dependency) =>
          batch.modules.some((module) => dependency.target === module.currentPath)))
      .map((entry) => entry.currentPath)
      .sort();
    assert.deepEqual(consumers, [CONSUMER_PATH]);
    this.#assertScriptSequence([
      this.paths.manifestSource,
      this.paths.resultSource,
      this.paths.consumer,
    ]);
  }

  #verifyMigratedStructure({ batch, manifest, state, registry }) {
    assert.equal(state.esmRuntimeIntegrationStarted, true);
    assert.ok(
      state.activeBatchId === BATCH_ID || state.completedBatchIds.includes(BATCH_ID),
      "Stage 2.1 must be active or completed",
    );
    assert.equal(
      registry.bridges.filter((item) => item.owner === BATCH_ID).length,
      2,
    );
    for (const module of batch.modules) {
      const entry = manifest.modules.find(
        (candidate) => candidate.currentPath === module.targetPath,
      );
      assert.ok(entry, `Migrated manifest entry is missing: ${module.targetPath}`);
      assert.ok(["migrating", "esm", "verified"].includes(
        entry.architecture.migrationStatus,
      ));
      assert.equal(this.#exists(module.currentPath), false);
      assert.equal(this.#exists(module.targetPath), true);
    }
    this.#assertScriptSequence([
      this.paths.manifestBridge,
      this.paths.resultBridge,
      this.paths.consumer,
    ]);
  }

  #assertScriptSequence(expected) {
    const scriptAliases = new StageTwoRuntimeScriptAliasResolver().loadProject(
      this.projectRoot,
    );
    const scripts = new LegacyScriptOrderReader(
      path.join(this.projectRoot, this.paths.index),
      { scriptAliases },
    ).read().map((script) => script.currentPath);
    const first = scripts.indexOf(expected[0]);
    assert.ok(first >= 0, `Script is missing: ${expected[0]}`);
    assert.deepEqual(scripts.slice(first, first + expected.length), expected);
  }

  #readTrackedBytes() {
    return Object.fromEntries(
      Object.entries(this.paths).map(([id, relativePath]) => [
        id,
        this.#exists(relativePath) ? this.#read(relativePath) : null,
      ]),
    );
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

new StageTwoAssetContractsCheck(PROJECT_ROOT).run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
