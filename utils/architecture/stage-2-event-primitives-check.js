const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-2.3-engine-event-primitives";
const CONTRACTS = Object.freeze([
  Object.freeze({
    symbol: "EventBus",
    source: "src/app/core/event_bus.js",
    target: "src/engine/events/event_bus.js",
    wrapper: "src/engine/compat/stage_2/event_bus_legacy_bridge.js",
    output: "dist/legacy-bridges/event_bus.iife.js",
    order: 391,
    consumers: Object.freeze(["src/app/adapters.js", "src/app/script.js"]),
  }),
  Object.freeze({
    symbol: "EventLifecycle",
    source: "src/app/core/event_lifecycle.js",
    target: "src/engine/events/event_lifecycle.js",
    wrapper: "src/engine/compat/stage_2/event_lifecycle_legacy_bridge.js",
    output: "dist/legacy-bridges/event_lifecycle.iife.js",
    order: 392,
    consumers: Object.freeze(["src/app/application.js", "src/app/script.js"]),
  }),
]);

class EventPrimitiveSourceLoader {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  loadLegacy() {
    const context = vm.createContext({});
    vm.runInContext(
      `${CONTRACTS.map((item) => this.#read(item.source)).join("\n")}\n` +
        "globalThis.__events = { EventBus, EventLifecycle };",
      context,
      { filename: "stage-2.3-legacy-event-primitives.js" },
    );
    return context.__events;
  }

  async loadMigrated() {
    const modules = await Promise.all(CONTRACTS.map((item) => {
      const source = this.#read(item.target);
      const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
      return import(`${url}#stage-2.3-${item.symbol}`);
    }));
    for (let index = 0; index < CONTRACTS.length; index += 1) {
      assert.deepEqual(Object.keys(modules[index]), [CONTRACTS[index].symbol]);
    }
    return Object.fromEntries(CONTRACTS.map((item, index) => [
      item.symbol,
      modules[index][item.symbol],
    ]));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(this.projectRoot, relativePath), "utf8");
  }
}

class EventPrimitiveBehaviorVerifier {
  verify({ EventBus, EventLifecycle }) {
    this.#verifyEventBus(EventBus);
    this.#verifyEventLifecycle(EventLifecycle);
  }

  #verifyEventBus(EventBus) {
    assert.equal(EventBus.getActiveListenerCount(), 0);
    const bus = new EventBus();
    const received = [];
    const first = (payload) => received.push(`first:${payload}`);
    const second = (payload) => received.push(`second:${payload}`);
    const removeFirst = bus.on("tick", first);
    const removeDuplicate = bus.on("tick", first);
    const removeSecond = bus.on("tick", second);
    assert.equal(EventBus.getActiveListenerCount(), 2);
    assert.equal(removeDuplicate(), false, "Duplicate registration cleanup must be inactive");
    bus.emit("tick", 7);
    assert.deepEqual(received, ["first:7", "second:7"]);
    assert.equal(removeFirst(), true);
    assert.equal(removeFirst(), false, "EventBus cleanup must be idempotent");
    assert.equal(EventBus.getActiveListenerCount(), 1);
    bus.emit("missing", 1);
    bus.clear();
    assert.equal(EventBus.getActiveListenerCount(), 0);
    assert.equal(
      removeSecond(),
      true,
      "Cleanup after clear must preserve the legacy retained-Set behavior",
    );
    assert.equal(EventBus.getActiveListenerCount(), 0);
    bus.clear();
    assert.equal(EventBus.getActiveListenerCount(), 0);

    const other = new EventBus();
    const removeOther = other.on("other", second);
    assert.equal(EventBus.getActiveListenerCount(), 1);
    assert.equal(removeOther(), true);
    assert.equal(EventBus.getActiveListenerCount(), 0);
  }

  #verifyEventLifecycle(EventLifecycle) {
    assert.equal(EventLifecycle.getActiveListenerCount(), 0);
    const calls = [];
    const target = {
      addEventListener(type, handler, options) {
        calls.push(["add", type, handler, options]);
      },
      removeEventListener(type, handler, options) {
        calls.push(["remove", type, handler, options]);
      },
    };
    const lifecycle = new EventLifecycle();
    const first = () => {};
    const second = () => {};
    const firstOptions = { capture: true };
    const cleanupFirst = lifecycle.add(target, "first", first, firstOptions);
    lifecycle.add(target, "second", second, false);
    assert.equal(EventLifecycle.getActiveListenerCount(), 2);
    assert.deepEqual(calls.slice(0, 2), [
      ["add", "first", first, firstOptions],
      ["add", "second", second, false],
    ]);
    cleanupFirst();
    cleanupFirst();
    assert.equal(EventLifecycle.getActiveListenerCount(), 1);
    lifecycle.dispose();
    assert.equal(EventLifecycle.getActiveListenerCount(), 0);
    assert.deepEqual(calls.slice(2), [
      ["remove", "first", first, firstOptions],
      ["remove", "second", second, false],
    ]);
    lifecycle.dispose();
    assert.equal(calls.length, 4, "Repeated dispose must not repeat cleanup");
  }
}

class StageTwoEventPrimitivesCheck {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.paths = Object.freeze({
      approved: "architecture/migration/stage_2_approved_batches.json",
      manifest: "architecture/migration/module_migration_manifest.json",
      state: "architecture/migration/stage_2_execution_state.json",
      registry: "architecture/guards/migration_bridge_registry.json",
      index: "index.html",
      ...Object.fromEntries(CONTRACTS.flatMap((item) => [
        [`${item.symbol}Source`, item.source],
        [`${item.symbol}Target`, item.target],
        [`${item.symbol}Wrapper`, item.wrapper],
      ])),
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
    if (migrated) this.#verifyMigrated({ manifest, state, registry });
    else this.#verifyPreflight({ manifest, state, registry });

    const loader = new EventPrimitiveSourceLoader(this.projectRoot);
    const contracts = migrated ? await loader.loadMigrated() : loader.loadLegacy();
    new EventPrimitiveBehaviorVerifier().verify(contracts);
    assert.deepEqual(
      this.#readTrackedBytes(),
      before,
      "Stage 2.3 event primitive check must be read-only",
    );
    console.log(
      `Stage 2.3 event primitives passed (${migrated ? "migrated" : "preflight"}): ` +
        "2 dependency-free engine contracts, 4 exact classic consumers, " +
        "listener lifecycle, diagnostics and load order verified; read-only.",
    );
  }

  #verifyFrozenBatch(batch) {
    assert.ok(batch, "Approved Stage 2.3 batch is missing");
    assert.equal(batch.order, 3);
    assert.equal(batch.status, "approved");
    assert.equal(batch.targetBoundary, "engine");
    assert.deepEqual(batch.dependencyOrdering.batchPrerequisites, [
      "stage-2.2-engine-dependency-contract",
    ]);
    assert.deepEqual(
      batch.modules.map((item) => ({
        currentPath: item.currentPath,
        targetPath: item.targetPath,
        providers: item.providers,
        legacyConsumers: item.legacyConsumers,
      })),
      CONTRACTS.map((item) => ({
        currentPath: item.source,
        targetPath: item.target,
        providers: [item.symbol],
        legacyConsumers: [...item.consumers],
      })),
    );
    assert.equal(batch.bridgeStrategy.owner, BATCH_ID);
    assert.equal(batch.bridgeStrategy.removalStage, "stage-5");
    assert.equal(batch.bridgeStrategy.bridges.length, 2);
    for (let index = 0; index < CONTRACTS.length; index += 1) {
      const contract = CONTRACTS[index];
      const bridge = batch.bridgeStrategy.bridges[index];
      assert.equal(bridge.wrapperPath, contract.wrapper);
      assert.equal(bridge.outputPath, contract.output);
      assert.deepEqual(bridge.legacyConsumers, [...contract.consumers]);
      assert.deepEqual(bridge.globalProviders, [{
        symbol: contract.symbol,
        mechanism: "global-this-property",
        availability: "program-init",
      }]);
    }
  }

  #verifyPreflight({ manifest, state, registry }) {
    assert.deepEqual(state.completedBatchIds, [
      "stage-2.1-engine-asset-contracts",
      "stage-2.2-engine-dependency-contract",
    ]);
    assert.equal(state.activeBatchId, null);
    assert.equal(registry.bridges.some((item) => item.owner === BATCH_ID), false);
    for (const contract of CONTRACTS) {
      const entry = this.#entry(manifest, contract.source);
      assert.equal(entry.observed.legacyLoadOrder, contract.order);
      assert.equal(entry.architecture.migrationStatus, "classified");
      assert.deepEqual(entry.architecture.roles, ["engine-runtime"]);
      assert.equal(entry.architecture.targetBoundary, "engine");
      assert.equal(entry.architecture.targetPath, contract.target);
      assert.deepEqual(entry.observed.environment.browserApis, []);
      assert.deepEqual(entry.analysis.dependencies.items, []);
      assert.deepEqual(entry.analysis.blockers.items, []);
      assert.equal(this.#exists(contract.source), true);
      assert.equal(this.#exists(contract.target), false);
      this.#verifyConsumers(manifest, contract, contract.source);
    }
    this.#assertRuntimePositions(CONTRACTS.map((item) => item.source));
  }

  #verifyMigrated({ manifest, state, registry }) {
    assert.ok(
      state.completedBatchIds.includes(BATCH_ID) || state.activeBatchId === BATCH_ID,
      "Stage 2.3 must be active or completed",
    );
    assert.equal(
      registry.bridges.filter((item) => item.owner === BATCH_ID).length,
      4,
    );
    for (const contract of CONTRACTS) {
      const target = this.#entry(manifest, contract.target);
      assert.ok(["migrating", "esm", "verified"].includes(
        target.architecture.migrationStatus,
      ));
      assert.equal(target.observed.legacyLoadOrder, null);
      assert.deepEqual(target.observed.environment.browserApis, []);
      assert.deepEqual(target.analysis.dependencies.items, []);
      assert.equal(this.#exists(contract.source), false);
      assert.equal(this.#exists(contract.target), true);
      assert.equal(this.#exists(contract.wrapper), true);
      this.#verifyConsumers(manifest, contract, contract.wrapper);
    }
    this.#assertRuntimePositions(CONTRACTS.map((item) => item.wrapper));
  }

  #verifyConsumers(manifest, contract, expectedTarget) {
    const consumers = manifest.modules
      .filter((entry) => entry.analysis.dependencies.items.some(
        (dependency) => dependency.target === expectedTarget &&
          dependency.symbols.includes(contract.symbol),
      ))
      .map((entry) => entry.currentPath)
      .sort();
    assert.deepEqual(consumers, [...contract.consumers]);
  }

  #assertRuntimePositions(expectedProviders) {
    const scriptAliases = new StageTwoRuntimeScriptAliasResolver().loadProject(
      this.projectRoot,
    );
    const scripts = new LegacyScriptOrderReader(
      path.join(this.projectRoot, this.paths.index),
      { scriptAliases },
    ).read().map((script) => script.currentPath);
    assert.equal(scripts[390], expectedProviders[0]);
    assert.equal(scripts[391], expectedProviders[1]);
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

new StageTwoEventPrimitivesCheck(PROJECT_ROOT).run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
