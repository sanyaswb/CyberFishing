"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const estraverse = require("estraverse");
const {
  CanonicalBridgeIdentity,
} = require("../build/legacy_bridge_build_config");
const {
  ActivationShimRenderer,
} = require("../build/compat_runtime/activation_shim");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-3.candidate-004-equipment-4f2570dc";
const SOURCE_PROVIDER = "src/core/equipment/rod_capability_resolver.js";
const TARGET_MODULE = "src/game/domain/equipment/rod_capability_resolver.js";
const LEGACY_SYMBOL = "RodCapabilityResolver";
const ACTIVATION_ID = "activation-59bd96059da6";
const CONSUMERS = Object.freeze([
  "src/application/inventory/equipment_read_model_factory.js",
  "src/application/inventory/inventory_v2_composition_root.js",
  "src/core/equipment/equipment_compatibility_policy.js",
  "src/core/equipment/equipment_slot_visibility_policy.js",
  "src/core/equipment/fishing_readiness_policy.js",
  "src/core/equipment/terminal_line_slot_resolver.js",
  "src/infrastructure/storage/inventory_v2_legacy_migration.js",
]);
const BRIDGE_REASON =
  "Preserve the exact synchronous RodCapabilityResolver consumer set until Stage 5 migration removes the legacy symbol.";

class StageThreeRodCapabilityPrebuildCheck {
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
    const registry = this.#json(
      "architecture/guards/migration_bridge_registry.json",
    );
    const manifest = this.#json(
      "architecture/migration/module_migration_manifest.json",
    );
    const batch = approved.batches.find((record) => record.id === BATCH_ID);
    assert(batch);
    assert.equal(batch.status, "approved-frozen");
    assert.equal(batch.order, 4);
    assert.deepEqual(batch.prerequisites, []);
    assert.deepEqual(batch.internalDependencyClosure, []);
    assert.deepEqual(batch.modules.map((module) => ({
      currentPath: module.currentPath,
      targetPath: module.targetPath,
    })), [{ currentPath: SOURCE_PROVIDER, targetPath: TARGET_MODULE }]);
    assert.equal(
      state.activeBatchId === BATCH_ID || state.completedBatchIds.includes(BATCH_ID),
      true,
    );
    assert.deepEqual(state.completedBatchIds.slice(0, 3), [
      "stage-3.candidate-001-inventory-85f44b2e",
      "stage-3.candidate-002-fishing-944d0790",
      "stage-3.candidate-003-fishing-9700ad4f",
    ]);
    assert.equal(state.compatibilityRuntimeActivated, true);

    const approvedActivation = batch.compatibility.newActivations[0];
    assert.equal(batch.compatibility.newActivations.length, 1);
    assert.equal(approvedActivation.contract.id, ACTIVATION_ID);
    assert.equal(approvedActivation.contract.legacyScriptIndex, 157);
    assert.deepEqual(approvedActivation.legacyConsumers, [...CONSUMERS]);
    const ownerActivations = contract.activationPositions.filter(
      (record) => record.owner === BATCH_ID,
    );
    assert.equal(ownerActivations.length, 1);
    assert.deepEqual(ownerActivations[0], approvedActivation.contract);

    this.#verifyEsmTarget();
    const exactShim = new ActivationShimRenderer().render(
      ownerActivations[0],
      contract.transport.symbol,
    );
    assert.equal(this.#read(SOURCE_PROVIDER), exactShim);
    assert.equal(exactShim.includes("function"), false);
    assert.equal(exactShim.includes("new "), false);

    const records = registry.bridges.filter((record) => record.owner === BATCH_ID);
    assert.equal(records.length, CONSUMERS.length);
    assert.deepEqual(records.map((record) => record.source).sort(), [...CONSUMERS]);
    assert.equal(new Set(records.map((record) => record.bridge)).size, 1);
    assert.equal(new Set(records.map((record) => record.target)).size, 1);
    assert.equal(new Set(records.map((record) => record.removalStage)).size, 1);
    for (const record of records) {
      assert.deepEqual(record, {
        id: CanonicalBridgeIdentity.id(record),
        bridge: SOURCE_PROVIDER,
        source: record.source,
        target: TARGET_MODULE,
        reason: BRIDGE_REASON,
        owner: BATCH_ID,
        introducedStage: "stage-3",
        removalStage: "stage-5",
        globalProviders: [{
          symbol: LEGACY_SYMBOL,
          mechanism: "global-this-property",
        }],
      });
      const source = this.#read(record.source);
      assert.match(source, /\bRodCapabilityResolver\b/u);
      assert.equal(source.includes(contract.transport.symbol), false);
    }

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
    const expectedActivationPath =
      `${contract.output.directory}${ownerActivations[0].shimFile}`;
    const scripts = [...this.#read("index.html").matchAll(
      /<script\b[^>]*\bsrc=["']([^"']+)["']/giu,
    )].map((match) => match[1].split("?")[0]);
    assert.equal(scripts.includes(SOURCE_PROVIDER), false);
    assert.equal(
      scripts.filter((source) => source === expectedActivationPath).length,
      1,
    );

    console.log(
      "Stage 3.4 pre-build contract passed: one frozen ESM target, one activation-157 shim and seven exact consumer bridge records verified.",
    );
  }

  #verifyEsmTarget() {
    const source = this.#read(TARGET_MODULE);
    const tree = espree.parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
    });
    assert.equal(tree.body.length, 1);
    assert.equal(tree.body[0].type, "ExportNamedDeclaration");
    assert.equal(tree.body[0].declaration?.type, "ClassDeclaration");
    assert.equal(tree.body[0].declaration?.id?.name, LEGACY_SYMBOL);
    const forbidden = [];
    estraverse.traverse(tree, {
      fallback: "iteration",
      enter(node) {
        if (node.type === "ImportDeclaration") forbidden.push("import");
        if (
          node.type === "Identifier" &&
          ["CONFIG", "document", "window", "globalThis"].includes(node.name)
        ) {
          forbidden.push(node.name);
        }
      },
    });
    assert.deepEqual(forbidden, []);
  }

  #entry(manifest, currentPath) {
    const entry = manifest.modules.find((record) => record.currentPath === currentPath);
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

new StageThreeRodCapabilityPrebuildCheck().run();
