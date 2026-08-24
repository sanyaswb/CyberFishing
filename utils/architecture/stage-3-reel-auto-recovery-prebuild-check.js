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
const BATCH_ID = "stage-3.candidate-002-fishing-944d0790";
const SOURCE_PROVIDER = "src/core/fishing/reel_auto_recovery_calculator.js";
const TARGET_MODULE = "src/game/domain/fishing/reel_auto_recovery_calculator.js";
const CONSUMER = "src/systems/reel_system.js";
const LEGACY_SYMBOL = "ReelAutoRecoveryCalculator";
const ACTIVATION_ID = "activation-57add99af90d";

class StageThreeReelAutoRecoveryPrebuildCheck {
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
    assert.equal(batch.order, 2);
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
    assert.deepEqual(state.completedBatchIds.slice(0, 1), [
      "stage-3.candidate-001-inventory-85f44b2e",
    ]);
    assert.equal(state.compatibilityRuntimeActivated, true);

    const approvedActivation = batch.compatibility.newActivations[0];
    assert.equal(approvedActivation.contract.id, ACTIVATION_ID);
    assert.equal(approvedActivation.contract.legacyScriptIndex, 113);
    assert.deepEqual(approvedActivation.legacyConsumers, [CONSUMER]);
    const activation = contract.activationPositions.find(
      (record) => record.id === ACTIVATION_ID,
    );
    assert.deepEqual(activation, approvedActivation.contract);
    assert.equal(
      contract.activationPositions.filter((record) => record.id === ACTIVATION_ID).length,
      1,
    );

    this.#verifyEsmTarget();
    const exactShim = new ActivationShimRenderer().render(
      activation,
      contract.transport.symbol,
    );
    assert.equal(this.#read(SOURCE_PROVIDER), exactShim);
    assert.equal(exactShim.includes("CONFIG"), false);
    assert.equal(exactShim.includes("function"), false);
    assert.equal(exactShim.includes("new "), false);

    const records = registry.bridges.filter((record) => record.owner === BATCH_ID);
    assert.equal(records.length, 1);
    assert.deepEqual(records.map((record) => record.source).sort(), [CONSUMER]);
    assert.deepEqual(records[0], {
      id: CanonicalBridgeIdentity.id(records[0]),
      bridge: SOURCE_PROVIDER,
      source: CONSUMER,
      target: TARGET_MODULE,
      reason: "Preserve the exact synchronous ReelSystem consumer until application migration removes the legacy symbol.",
      owner: BATCH_ID,
      introducedStage: "stage-3",
      removalStage: "stage-4",
      globalProviders: [{
        symbol: LEGACY_SYMBOL,
        mechanism: "global-this-property",
      }],
    });

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
      `${contract.output.directory}${activation.shimFile}`;
    const scripts = [...this.#read("index.html").matchAll(
      /<script\b[^>]*\bsrc=["']([^"']+)["']/giu,
    )].map((match) => match[1].split("?")[0]);
    assert.equal(scripts.includes(SOURCE_PROVIDER), false);
    assert.equal(scripts.filter((source) => source === expectedActivationPath).length, 1);

    console.log(
      "Stage 3.2 pre-build contract passed: frozen batch, exact ESM target, registry consumer set, activation-113 contract and bridge-only source verified.",
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

new StageThreeReelAutoRecoveryPrebuildCheck().run();
