"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  StageThreeCompatibilityBuildApplication,
} = require("../build/build_stage_3_compat_runtime");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

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

class RodCapabilityBehaviorVerifier {
  verify(Resolver) {
    const resolver = new Resolver();
    const empty = resolver.resolve();
    assert.deepEqual(this.#plain(empty), {
      supportsReel: false,
      supportsFloat: false,
      supportsFeederRig: false,
      supportsLures: false,
    });
    assert.equal(Object.isFrozen(empty), true);
    assert.deepEqual(Object.keys(empty), [
      "supportsReel",
      "supportsFloat",
      "supportsFeederRig",
      "supportsLures",
    ]);

    const arrayCapabilities = resolver.resolve({
      capabilities: ["reel", "float", "feeder_rig", "lure"],
    });
    assert.deepEqual(this.#plain(arrayCapabilities), {
      supportsReel: true,
      supportsFloat: true,
      supportsFeederRig: true,
      supportsLures: true,
    });
    const unknownArray = resolver.resolve({
      capabilities: ["REEL", "unknown", "reel", "reel"],
    });
    assert.equal(unknownArray.supportsReel, true);
    assert.equal(unknownArray.supportsFloat, false);

    const objectNames = resolver.resolve({
      capabilities: {
        reel: true,
        float: true,
        feeder_rig: true,
        lure: true,
      },
    });
    assert.deepEqual(this.#plain(objectNames), this.#plain(arrayCapabilities));
    const strictObjectValues = resolver.resolve({
      capabilities: {
        reel: 1,
        float: "true",
        feeder_rig: {},
        lure: null,
      },
    });
    assert.deepEqual(this.#plain(strictObjectValues), this.#plain(empty));

    const flagPrecedence = resolver.resolve({
      capabilities: {
        reel: true,
        float: true,
        feeder_rig: true,
        lure: true,
        supportsReel: false,
        supportsFloat: false,
        supportsFeederRig: false,
        supportsLures: false,
      },
    });
    assert.deepEqual(this.#plain(flagPrecedence), this.#plain(empty));
    const equipmentPrecedence = resolver.resolve({
      equipmentCapabilities: {
        supportsReel: false,
        supportsFloat: true,
        supportsFeederRig: false,
        supportsLures: true,
      },
      capabilities: {
        supportsReel: true,
        supportsFloat: false,
        supportsFeederRig: true,
        supportsLures: false,
      },
    });
    assert.deepEqual(this.#plain(equipmentPrecedence), {
      supportsReel: false,
      supportsFloat: true,
      supportsFeederRig: false,
      supportsLures: true,
    });
    const nonBooleanFallback = resolver.resolve({
      equipmentCapabilities: {
        supportsReel: "false",
        supportsFloat: 0,
      },
      capabilities: {
        supportsReel: true,
        float: true,
      },
    });
    assert.equal(nonBooleanFallback.supportsReel, true);
    assert.equal(nonBooleanFallback.supportsFloat, true);
    assert.deepEqual(this.#plain(resolver.resolve({ capabilities: null })), this.#plain(empty));
    assert.deepEqual(this.#plain(resolver.resolve({ capabilities: 7 })), this.#plain(empty));

    const input = {
      equipmentCapabilities: { supportsReel: true },
      capabilities: ["float"],
    };
    const before = JSON.stringify(input);
    const firstResult = resolver.resolve(input);
    const secondResult = resolver.resolve(input);
    assert.equal(JSON.stringify(input), before);
    assert.notEqual(firstResult, secondResult);
    assert.deepEqual(this.#plain(firstResult), this.#plain(secondResult));
    assert.equal(new Resolver().resolve(input).supportsReel, true);
  }

  #plain(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class StageThreeRodCapabilityRuntimeCheck {
  async run() {
    const approved = this.#json(
      "architecture/migration/stage_3_approved_batches.json",
    );
    const contract = this.#json(
      "architecture/migration/stage_3_compatibility_runtime.json",
    );
    const batch = approved.batches.find((record) => record.id === BATCH_ID);
    assert(batch);
    const expectedProjectModules = [
      ...batch.cumulativeRuntimeTopology.stage2Targets,
      ...batch.cumulativeRuntimeTopology.stage3Targets,
      ...contract.approvedInfrastructureModules,
    ].sort();
    const expectedActivationIds = [
      ...batch.compatibility.cumulativeActivationIds,
    ].sort();
    const report = await new StageThreeCompatibilityBuildApplication({
      projectRoot: PROJECT_ROOT,
    }).run();
    assert.equal(report.status, "built");
    assert(report.moduleCount >= expectedProjectModules.length);
    assert(report.activationCount >= expectedActivationIds.length);
    assert.deepEqual(report.selectedBatchIds.slice(0, 4), [
      "stage-3.candidate-001-inventory-85f44b2e",
      "stage-3.candidate-002-fishing-944d0790",
      "stage-3.candidate-003-fishing-9700ad4f",
      BATCH_ID,
    ]);
    const runtimeOutput = report.outputs.find(
      (output) => output.kind === "cumulative-runtime",
    );
    assert(runtimeOutput);
    for (const modulePath of expectedProjectModules) {
      assert(runtimeOutput.projectModules.includes(modulePath));
    }
    assert.equal(
      new Set(runtimeOutput.projectModules).size,
      runtimeOutput.projectModules.length,
    );
    assert.deepEqual(
      runtimeOutput.virtualBuildModules,
      [...new Set(runtimeOutput.virtualBuildModules)].sort(),
    );
    assert(runtimeOutput.virtualBuildModules.every((moduleId) =>
      contract.approvedVirtualModules.includes(moduleId)),
    );

    const activation = contract.activationPositions.find(
      (record) => record.id === ACTIVATION_ID,
    );
    assert(activation);
    this.#verifyLogicalPosition(activation);
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
    assert.equal(
      Object.keys(transport.modules).length,
      runtimeOutput.projectModules.length,
    );
    assert.equal(
      Object.keys(transport.modules).filter((module) => module === TARGET_MODULE).length,
      1,
    );
    assert.equal(context[LEGACY_SYMBOL], undefined);
    for (const earlier of contract.activationPositions
      .filter((record) => record.legacyScriptIndex < activation.legacyScriptIndex)
      .sort((left, right) => left.legacyScriptIndex - right.legacyScriptIndex)) {
      vm.runInContext(
        this.#read(`${contract.output.directory}${earlier.shimFile}`),
        context,
        { filename: earlier.shimFile },
      );
    }
    assert.equal(context[LEGACY_SYMBOL], undefined);
    vm.runInContext(
      this.#read(`${contract.output.directory}${activation.shimFile}`),
      context,
      { filename: activation.shimFile },
    );
    const Resolver = transport.modules[TARGET_MODULE][LEGACY_SYMBOL];
    assert.equal(context[LEGACY_SYMBOL], Resolver);
    assert.equal(Resolver.name, LEGACY_SYMBOL);
    context.__EXACT_ROD_CAPABILITY_RESOLVER__ = Resolver;
    assert.equal(
      vm.runInContext(
        "RodCapabilityResolver === __EXACT_ROD_CAPABILITY_RESOLVER__",
        context,
      ),
      true,
    );
    new RodCapabilityBehaviorVerifier().verify(Resolver);
    context[contract.transport.symbol] = null;
    assert.equal(new context[LEGACY_SYMBOL]().resolve({
      capabilities: ["reel"],
    }).supportsReel, true);
    this.#verifyConsumerSources(contract.transport.symbol);

    console.log(
      `Stage 3.4 historical runtime passed inside the current ` +
        `${runtimeOutput.projectModules.length}-module graph: one resolver identity, ` +
        "position-157 exposure, strict capability semantics and seven legacy consumers preserved.",
    );
  }

  #verifyLogicalPosition(activation) {
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const logical = new LegacyScriptOrderReader(
      path.join(PROJECT_ROOT, "index.html"),
      { scriptAliases: aliases },
    ).read();
    assert.equal(logical.length, 424);
    assert.equal(logical[156].legacyLoadOrder, 157);
    assert.equal(logical[156].currentPath, SOURCE_PROVIDER);
    assert.equal(activation.legacyScriptIndex, 157);
  }

  #verifyConsumerSources(transportSymbol) {
    for (const consumer of CONSUMERS) {
      const source = this.#read(consumer);
      assert.match(source, /\bRodCapabilityResolver\b/u);
      assert.equal(source.includes(transportSymbol), false);
    }
  }

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
  }
}

new StageThreeRodCapabilityRuntimeCheck().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
