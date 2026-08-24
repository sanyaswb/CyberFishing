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
const BATCH_ID = "stage-3.candidate-003-fishing-9700ad4f";
const SOURCE_PROVIDER = "src/core/fishing/line_tension_calculator.js";
const TARGET_MODULE = "src/game/domain/fishing/line_tension_calculator.js";
const LEGACY_SYMBOL = "LineTensionCalculator";
const ACTIVATION_ID = "activation-a8e624a68a8e";

class LineTensionBehaviorVerifier {
  verify(Calculator) {
    const calculator = new Calculator();
    const calculate = (override = {}) => calculator.calculate({
      totalTensionKg: 5,
      fishTensionKg: 3,
      playerHoldTensionKg: 2,
      rodLimitKg: 10,
      lineLimitKg: 10,
      hookLimitKg: 10,
      fishForceKg: 20,
      rodPullForceKg: 30,
      dragLimitKg: 4,
      hardLineLimit: false,
      lineHasReserve: false,
      dragLocked: false,
      dragAlreadyResolved: false,
      shouldSlipDrag: false,
      ...override,
    });

    const direct = calculate();
    assert.equal(direct.tensionKg, 5, "finite direct tension must win over forces");
    assert.equal(direct.rawTensionKg, 5);
    const fallback = calculate({
      totalTensionKg: undefined,
      fishTensionKg: undefined,
      playerHoldTensionKg: undefined,
      fishForceKg: 2,
      rodPullForceKg: 3,
    });
    assert.equal(fallback.tensionKg, 5);
    assert.equal(fallback.fishTensionKg, 2);
    assert.equal(fallback.playerHoldTensionKg, 3);
    assert.equal(calculate({ totalTensionKg: -5 }).tensionKg, 0);
    assert.equal(calculate({
      totalTensionKg: undefined,
      fishForceKg: -2,
      rodPullForceKg: -3,
    }).tensionKg, 0);

    const slip = calculate({ lineHasReserve: true });
    assert.equal(slip.tensionKg, 4);
    assert.equal(slip.rawTensionKg, 5);
    assert.equal(slip.shouldSlipDrag, true);
    assert.equal(slip.mode, "drag_limit");
    const resolvedSlip = calculate({
      lineHasReserve: true,
      dragAlreadyResolved: true,
    });
    assert.equal(resolvedSlip.mode, "drag_resolved_limit");
    const equality = calculate({ totalTensionKg: 4, lineHasReserve: true });
    assert.equal(equality.tensionKg, 4);
    assert.equal(equality.shouldSlipDrag, false);
    assert.equal(equality.mode, "raw");
    assert.equal(calculate({ lineHasReserve: false }).shouldSlipDrag, false);
    const hardLimit = calculate({ hardLineLimit: true, lineHasReserve: true });
    assert.equal(hardLimit.tensionKg, 5);
    assert.equal(hardLimit.mode, "raw");
    assert.equal(hardLimit.shouldSlipDrag, false);
    const locked = calculate({ dragLocked: true, lineHasReserve: true });
    assert.equal(locked.tensionKg, 5);
    assert.equal(locked.mode, "raw");
    const resolved = calculate({ dragAlreadyResolved: true });
    assert.equal(resolved.mode, "drag_resolved");
    assert.equal(calculate({ shouldSlipDrag: true }).shouldSlipDrag, true);

    const coerced = calculate({
      totalTensionKg: "6",
      fishTensionKg: "2",
      playerHoldTensionKg: "4",
      rodLimitKg: "3",
      lineLimitKg: "12",
      hookLimitKg: "2",
    });
    assert.equal(coerced.tensionKg, 6);
    assert.equal(coerced.fishTensionKg, 2);
    assert.equal(coerced.playerHoldTensionKg, 4);
    assert.equal(coerced.rodStressRatio, 2);
    assert.equal(coerced.lineStressRatio, 0.5);
    assert.equal(coerced.hookStressRatio, 3);
    const nonFinite = calculate({
      totalTensionKg: Number.POSITIVE_INFINITY,
      fishForceKg: 2,
      rodPullForceKg: 3,
      rodLimitKg: Number.NaN,
      lineLimitKg: Number.POSITIVE_INFINITY,
      hookLimitKg: -1,
    });
    assert.equal(nonFinite.tensionKg, 5);
    assert.equal(nonFinite.rodStressRatio, 0);
    assert.equal(nonFinite.lineStressRatio, 0);
    assert.equal(nonFinite.hookStressRatio, 0);
    const nanForces = calculate({
      totalTensionKg: Number.NaN,
      fishForceKg: Number.NaN,
      rodPullForceKg: Number.NaN,
    });
    assert.equal(nanForces.tensionKg, 0);

    assert.equal(direct.tensionKg, direct.totalTensionKg);
    assert.equal(direct.rawTensionKg, direct.rawTotalTensionKg);
    assert.deepEqual(Object.keys(direct), [
      "tensionKg",
      "rawTensionKg",
      "fishTensionKg",
      "playerHoldTensionKg",
      "totalTensionKg",
      "rawTotalTensionKg",
      "rodStressRatio",
      "lineStressRatio",
      "hookStressRatio",
      "shouldSlipDrag",
      "mode",
    ]);
    assert.equal(Object.isFrozen(direct), false);
    direct.mode = "mutable-proof";
    assert.equal(direct.mode, "mutable-proof");
  }
}

class StageThreeLineTensionRuntimeCheck {
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
    assert.deepEqual(report.selectedBatchIds.slice(0, 3), [
      "stage-3.candidate-001-inventory-85f44b2e",
      "stage-3.candidate-002-fishing-944d0790",
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
    this.#verifyLogicalPosition(contract, activation);
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
    const Calculator = transport.modules[TARGET_MODULE][LEGACY_SYMBOL];
    assert.equal(context[LEGACY_SYMBOL], Calculator);
    assert.equal(Calculator.name, LEGACY_SYMBOL);
    new LineTensionBehaviorVerifier().verify(Calculator);
    this.#verifyTensionSystemIntegration(context, contract.transport.symbol, Calculator);

    console.log(
      `Stage 3.3 historical runtime passed inside the current ` +
        `${runtimeOutput.projectModules.length}-module graph: ` +
        `${runtimeOutput.virtualBuildModules.length} approved virtual build modules, ` +
        "one calculator identity, activation at logical position 129 and calculator/TensionSystem semantics preserved.",
    );
  }

  #verifyLogicalPosition(contract, activation) {
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const logical = new LegacyScriptOrderReader(
      path.join(PROJECT_ROOT, "index.html"),
      { scriptAliases: aliases },
    ).read();
    assert.equal(logical.length, 424);
    assert.equal(logical[128].legacyLoadOrder, 129);
    assert.equal(logical[128].currentPath, SOURCE_PROVIDER);
    assert.equal(activation.legacyScriptIndex, 129);
  }

  #verifyTensionSystemIntegration(context, transportSymbol, Calculator) {
    let constructorCount = 0;
    context[LEGACY_SYMBOL] = class CountingLineTensionCalculator extends Calculator {
      constructor() {
        super();
        constructorCount += 1;
      }
    };
    vm.runInContext(this.#read("src/systems/tension_system.js"), context, {
      filename: "src/systems/tension_system.js",
    });
    const TensionSystem = vm.runInContext("TensionSystem", context);
    const first = new TensionSystem();
    assert.equal(constructorCount, 1);
    context[transportSymbol] = null;
    const input = {
      totalTensionKg: 5,
      dragLimitKg: 4,
      lineHasReserve: true,
    };
    assert.equal(first.calculate(input).tensionKg, 4);
    assert.equal(first.calculate(input).tensionKg, 4);
    assert.equal(constructorCount, 1);
    const second = new TensionSystem();
    assert.equal(constructorCount, 2);
    assert.equal(second.calculate(input).mode, "drag_limit");
  }

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
  }
}

new StageThreeLineTensionRuntimeCheck().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
