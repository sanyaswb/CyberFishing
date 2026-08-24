"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  ActivationShimRenderer,
} = require("../build/compat_runtime/activation_shim");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-3.candidate-001-inventory-85f44b2e";
const SOURCE_PROVIDER = "src/core/inventory/equip_target_selection_policy.js";
const TARGET_MODULE = "src/game/domain/inventory/equip_target_selection_policy.js";
const LEGACY_SYMBOL = "InventoryEquipTargetSelectionPolicy";
const CONSUMER = "src/ui/ui.js";

class InventoryEquipTargetBehaviorVerifier {
  verify(Policy) {
    const policy = new Policy({
      rod: { acceptTypes: ["rod"] },
      bait: { acceptTypes: ["bait"] },
    });
    assert.deepEqual(this.#plain(policy.resolve()), {
      mode: "blocked",
      validSlotIds: [],
      rejectionReason: null,
      shouldEquipImmediately: false,
      requiresSlotChoice: false,
    });
    assert.deepEqual(this.#plain(policy.resolve({
      item: { itemType: "rod" },
      slotGroups: [{ slots: [{ id: "rod_primary" }, { id: "rod_primary" }] }],
    })), {
      mode: "immediate",
      validSlotIds: ["rod_primary"],
      rejectionReason: null,
      shouldEquipImmediately: true,
      requiresSlotChoice: false,
    });
    assert.deepEqual(this.#plain(policy.resolve({
      item: { itemType: "rod" },
      slotGroups: [{ slots: [{ id: "rod_primary" }, { id: "rod_secondary" }] }],
    })), {
      mode: "choose",
      validSlotIds: ["rod_primary", "rod_secondary"],
      rejectionReason: null,
      shouldEquipImmediately: false,
      requiresSlotChoice: true,
    });
    assert.deepEqual(this.#plain(policy.resolve({
      item: { itemType: "rod" },
      slotGroups: [{ slots: [{ id: "rod_primary" }] }],
      validateSlot: () => ({ isValid: false, reason: "occupied" }),
    })), {
      mode: "blocked",
      validSlotIds: [],
      rejectionReason: "occupied",
      shouldEquipImmediately: false,
      requiresSlotChoice: false,
    });
  }

  #plain(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class StageThreeInventoryEquipTargetBatchCheck {
  run() {
    const approved = this.#json(
      "architecture/migration/stage_3_approved_batches.json",
    );
    const state = this.#json(
      "architecture/migration/stage_3_execution_state.json",
    );
    const contract = this.#json(
      "architecture/migration/stage_3_compatibility_runtime.json",
    );
    const manifest = this.#json(
      "architecture/migration/module_migration_manifest.json",
    );
    const registry = this.#json(
      "architecture/guards/migration_bridge_registry.json",
    );
    const batch = approved.batches[0];
    assert.equal(batch.id, BATCH_ID);
    assert.deepEqual(batch.modules.map((module) => ({
      currentPath: module.currentPath,
      targetPath: module.targetPath,
    })), [{ currentPath: SOURCE_PROVIDER, targetPath: TARGET_MODULE }]);
    assert.equal(
      state.activeBatchId === BATCH_ID || state.completedBatchIds[0] === BATCH_ID,
      true,
    );
    assert.equal(state.compatibilityRuntimeActivated, true);

    const sourceEntry = this.#entry(manifest, SOURCE_PROVIDER);
    const targetEntry = this.#entry(manifest, TARGET_MODULE);
    assert.deepEqual(sourceEntry.architecture.roles, ["compatibility-bridge"]);
    assert.equal(sourceEntry.architecture.targetPath, TARGET_MODULE);
    assert.deepEqual(targetEntry.architecture.roles, ["domain-behavior"]);
    assert.equal(targetEntry.architecture.targetBoundary, "game-domain");
    assert(["migrating", "verified"].includes(
      targetEntry.architecture.migrationStatus,
    ));
    assert.deepEqual(targetEntry.observed.environment.browserApis, []);
    assert.deepEqual(targetEntry.analysis.dependencies.confirmed, []);

    const activation = contract.activationPositions.find(
      (record) => record.legacySymbol === LEGACY_SYMBOL,
    );
    assert(activation);
    assert.equal(activation.owner, BATCH_ID);
    assert.equal(activation.sourceProvider, SOURCE_PROVIDER);
    assert.equal(activation.targetModule, TARGET_MODULE);
    assert.equal(activation.exportName, LEGACY_SYMBOL);
    assert.equal(activation.legacyScriptIndex, 86);
    const exactShim = new ActivationShimRenderer().render(
      activation,
      contract.transport.symbol,
    );
    assert.equal(this.#read(SOURCE_PROVIDER), exactShim);
    assert.equal(
      this.#read(`${contract.output.directory}${activation.shimFile}`),
      exactShim,
    );
    assert.equal(exactShim.includes("function"), false);
    assert.equal(exactShim.includes("new "), false);
    assert.equal(exactShim.includes("CONFIG"), false);

    const bridgeRecords = registry.bridges.filter((bridge) =>
      bridge.owner === BATCH_ID,
    );
    assert.equal(bridgeRecords.length, 1);
    assert.equal(bridgeRecords[0].source, CONSUMER);
    assert.equal(bridgeRecords[0].bridge, SOURCE_PROVIDER);
    assert.equal(bridgeRecords[0].target, TARGET_MODULE);
    assert.deepEqual(bridgeRecords[0].globalProviders, [{
      symbol: LEGACY_SYMBOL,
      mechanism: "global-this-property",
    }]);
    const consumerEntry = this.#entry(manifest, CONSUMER);
    assert(consumerEntry.analysis.dependencies.items.some((dependency) =>
      dependency.target === SOURCE_PROVIDER &&
      dependency.symbols.includes(LEGACY_SYMBOL)),
    );

    this.#verifyScriptOrder(contract, activation);
    const Policy = this.#verifyRuntimeIdentityAndTiming(contract);
    new InventoryEquipTargetBehaviorVerifier().verify(Policy);
    console.log(
      "Stage 3.1 inventory equip-target batch passed: exact named ESM target, bridge-only shim, one cumulative identity, position-86 activation, UI consumer and behavior verified.",
    );
  }

  #verifyScriptOrder(contract, activation) {
    const indexPath = path.join(PROJECT_ROOT, "index.html");
    const physical = [...this.#read("index.html").matchAll(
      /<script\b[^>]*\bsrc=["']([^"']+)["']/giu,
    )].map((match) => match[1].split("?")[0]);
    const runtimePath = `${contract.output.directory}${contract.output.runtimeFile}`;
    const activationPath = `${contract.output.directory}${activation.shimFile}`;
    const runtimeIndex = physical.indexOf(runtimePath);
    assert(runtimeIndex >= 0);
    assert.equal(physical[runtimeIndex + 1], activationPath);
    assert.equal(physical.filter((source) => source === runtimePath).length, 1);
    assert.equal(physical.some((source) => source.startsWith("dist/legacy-bridges/")), false);
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(
      PROJECT_ROOT,
    );
    const logical = new LegacyScriptOrderReader(indexPath, {
      scriptAliases: aliases,
    }).read();
    assert.equal(logical.length, 424);
    assert.equal(logical[85].currentPath, SOURCE_PROVIDER);
    assert.equal(logical[85].legacyLoadOrder, 86);
  }

  #verifyRuntimeIdentityAndTiming(contract) {
    const context = vm.createContext({});
    assert.equal(context[contract.transport.symbol], undefined);
    assert.equal(context[LEGACY_SYMBOL], undefined);
    vm.runInContext(
      this.#read(`${contract.output.directory}${contract.output.runtimeFile}`),
      context,
      { filename: contract.output.runtimeFile },
    );
    const transport = context[contract.transport.symbol];
    assert.equal(transport.ownsGameState, false);
    assert.deepEqual(Object.keys(transport).sort(), ["kind", "modules", "ownsGameState"]);
    assert.equal(Object.keys(transport.modules).length >= 10, true);
    assert.equal(
      new Set(Object.keys(transport.modules)).size,
      Object.keys(transport.modules).length,
    );
    assert(transport.modules[TARGET_MODULE]);
    assert.equal(context[LEGACY_SYMBOL], undefined);
    for (const activation of [...contract.activationPositions]
      .sort((left, right) => left.legacyScriptIndex - right.legacyScriptIndex)) {
      assert.equal(context[activation.legacySymbol], undefined);
      vm.runInContext(
        this.#read(`${contract.output.directory}${activation.shimFile}`),
        context,
        { filename: activation.shimFile },
      );
      assert.equal(
        context[activation.legacySymbol],
        transport.modules[activation.targetModule][activation.exportName],
      );
    }
    return transport.modules[TARGET_MODULE][LEGACY_SYMBOL];
  }

  #entry(manifest, currentPath) {
    const entry = manifest.modules.find((item) => item.currentPath === currentPath);
    assert(entry, `Manifest entry is missing: ${currentPath}`);
    return entry;
  }

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
  }
}

new StageThreeInventoryEquipTargetBatchCheck().run();
