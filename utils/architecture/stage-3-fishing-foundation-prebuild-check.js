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
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-3.candidate-005-fishing-45d0c7ce";
const BRIDGE_REASON =
  "Preserve the exact synchronous Fishing Foundation consumer set until its approved migration stage removes the legacy symbols.";
const MODULES = Object.freeze([
  ["src/core/fishing/drag_force_calculator.js", "src/game/domain/fishing/drag_force_calculator.js", ["DragForceCalculator"]],
  ["src/core/fishing/fish_retrieve_result.js", "src/game/domain/fishing/fish_retrieve_result.js", ["FishRetrieveResult"]],
  ["src/core/fishing/recoverable_line_calculator.js", "src/game/domain/fishing/recoverable_line_calculator.js", ["RecoverableLineCalculator", "LooseLineCalculator"]],
  ["src/core/fishing/rod_control_movement_projector.js", "src/game/domain/fishing/rod_control_movement_projector.js", ["RodControlMovementProjector"]],
  ["src/core/fishing/rod_stroke_capacity_resolver.js", "src/game/domain/fishing/rod_stroke_capacity_resolver.js", ["RodStrokeCapacityResolver"]],
  ["src/core/fishing/rod_stroke_tracker.js", "src/game/domain/fishing/rod_stroke_tracker.js", ["RodStrokeTracker"]],
]);

class StageThreeFishingFoundationPrebuildCheck {
  run() {
    const approved = this.#json("architecture/migration/stage_3_approved_batches.json");
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const contract = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = this.#json("architecture/guards/migration_bridge_registry.json");
    const manifest = this.#json("architecture/migration/module_migration_manifest.json");
    const batch = approved.batches.find((record) => record.id === BATCH_ID);
    assert(batch);
    assert.equal(batch.status, "approved-frozen");
    assert.equal(batch.order, 5);
    assert.deepEqual(batch.prerequisites, []);
    assert.deepEqual(batch.internalDependencyClosure, []);
    assert.deepEqual(
      batch.modules.map((record) => [record.currentPath, record.targetPath]),
      MODULES.map(([source, target]) => [source, target]),
    );
    assert.deepEqual(state.completedBatchIds.slice(0, 4), [
      "stage-3.candidate-001-inventory-85f44b2e",
      "stage-3.candidate-002-fishing-944d0790",
      "stage-3.candidate-003-fishing-9700ad4f",
      "stage-3.candidate-004-equipment-4f2570dc",
    ]);
    assert.equal(
      state.activeBatchId === BATCH_ID || state.completedBatchIds.includes(BATCH_ID),
      true,
    );
    assert.equal(state.compatibilityRuntimeActivated, true);

    const approvedActivations = batch.compatibility.newActivations;
    assert.equal(approvedActivations.length, 7);
    const ownerActivations = contract.activationPositions.filter(
      (record) => record.owner === BATCH_ID,
    );
    assert.deepEqual(
      ownerActivations,
      approvedActivations.map((record) => record.contract)
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
    assert.deepEqual(
      ownerActivations.map((record) => record.legacyScriptIndex).sort((a, b) => a - b),
      [93, 117, 117, 118, 122, 128, 133],
    );

    for (const [source, target, symbols] of MODULES) {
      this.#verifyEsmTarget(target, symbols);
      const expectedShim = ownerActivations
        .filter((activation) => activation.sourceProvider === source)
        .map((activation) => new ActivationShimRenderer().render(
          activation,
          contract.transport.symbol,
        ))
        .join("");
      assert.equal(this.#read(source), expectedShim);
      assert.equal(expectedShim.includes("function"), false);
      assert.equal(expectedShim.includes("new "), false);
      const sourceEntry = this.#entry(manifest, source);
      const targetEntry = this.#entry(manifest, target);
      assert.deepEqual(sourceEntry.architecture.roles, ["compatibility-bridge"]);
      assert.equal(sourceEntry.architecture.targetPath, target);
      assert.deepEqual(
        targetEntry.architecture.roles,
        batch.modules.find((record) => record.targetPath === target).roles,
      );
      assert.equal(targetEntry.architecture.targetBoundary, "game-domain");
      assert.equal(targetEntry.architecture.targetPath, target);
      assert(["migrating", "verified"].includes(
        targetEntry.architecture.migrationStatus,
      ));
    }

    const records = registry.bridges.filter((record) => record.owner === BATCH_ID);
    assert.equal(records.length, 7);
    assert.deepEqual(records.map((record) => record.id),
      [...records.map((record) => record.id)].sort());
    for (const consumer of batch.externalLegacyConsumers) {
      const record = records.find((candidate) =>
        candidate.bridge === consumer.provider && candidate.source === consumer.source);
      assert(record);
      const activationStages = ownerActivations
        .filter((activation) =>
          activation.sourceProvider === consumer.provider &&
          consumer.symbols.includes(activation.legacySymbol))
        .map((activation) => activation.removalStage);
      assert.equal(new Set(activationStages).size, 1);
      assert.deepEqual(record, {
        id: CanonicalBridgeIdentity.id(record),
        bridge: consumer.provider,
        source: consumer.source,
        target: batch.modules.find((module) =>
          module.currentPath === consumer.provider).targetPath,
        reason: BRIDGE_REASON,
        owner: BATCH_ID,
        introducedStage: "stage-3",
        removalStage: activationStages[0],
        globalProviders: [...consumer.symbols].sort().map((symbol) => ({
          symbol,
          mechanism: "global-this-property",
        })),
      });
      assert.match(this.#read(record.source), new RegExp(
        `\\b(${consumer.symbols.join("|")})\\b`,
        "u",
      ));
      assert.equal(this.#read(record.source).includes(contract.transport.symbol), false);
    }

    this.#verifyScriptTopology(contract, ownerActivations);
    console.log(
      "Stage 3.5 pre-build contract passed: six frozen ESM targets, seven canonical activations, seven exact consumer bridges and grouped position-117 aliases verified.",
    );
  }

  #verifyEsmTarget(target, expectedSymbols) {
    const tree = espree.parse(this.#read(target), {
      ecmaVersion: "latest",
      sourceType: "module",
    });
    const exportedClasses = tree.body
      .filter((node) => node.type === "ExportNamedDeclaration")
      .map((node) => node.declaration)
      .filter((node) => node?.type === "ClassDeclaration")
      .map((node) => node.id.name);
    assert.deepEqual(exportedClasses, expectedSymbols);
    const forbidden = [];
    estraverse.traverse(tree, {
      fallback: "iteration",
      enter(node) {
        if (node.type === "ImportDeclaration") forbidden.push("import");
        if (
          node.type === "Identifier" &&
          ["CONFIG", "document", "window", "globalThis"].includes(node.name)
        ) forbidden.push(node.name);
      },
    });
    assert.deepEqual(forbidden, []);
  }

  #verifyScriptTopology(contract, activations) {
    const html = this.#read("index.html");
    const physicalScripts = [...html.matchAll(
      /<script\b[^>]*\bsrc=["']([^"']+)["']/giu,
    )].map((match) => match[1].split("?")[0]);
    for (const [source] of MODULES) assert.equal(physicalScripts.includes(source), false);
    for (const activation of activations) {
      const output = `${contract.output.directory}${activation.shimFile}`;
      assert.equal(physicalScripts.filter((source) => source === output).length, 1);
    }
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const logical = new LegacyScriptOrderReader(
      path.join(PROJECT_ROOT, "index.html"),
      { scriptAliases: aliases },
    ).read();
    assert.equal(logical.length, 424);
    const positions = new Map(MODULES.map(([source]) => [source, null]));
    for (const script of logical) {
      if (positions.has(script.currentPath)) positions.set(script.currentPath, script.legacyLoadOrder);
    }
    assert.deepEqual([...positions.values()].sort((a, b) => a - b),
      [93, 117, 118, 122, 128, 133]);
    const position117Outputs = activations.filter((record) =>
      record.legacyScriptIndex === 117);
    assert.equal(position117Outputs.length, 2);
    assert.equal(
      [...aliases.entries()].filter(([source]) =>
        position117Outputs.some((record) =>
          source.endsWith(record.shimFile)) && aliases.get(source) === null).length,
      1,
    );
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

new StageThreeFishingFoundationPrebuildCheck().run();
