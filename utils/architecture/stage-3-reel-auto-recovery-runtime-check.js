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
const BATCH_ID = "stage-3.candidate-002-fishing-944d0790";
const SOURCE_PROVIDER = "src/core/fishing/reel_auto_recovery_calculator.js";
const TARGET_MODULE = "src/game/domain/fishing/reel_auto_recovery_calculator.js";
const LEGACY_SYMBOL = "ReelAutoRecoveryCalculator";
const ACTIVATION_ID = "activation-57add99af90d";

class ReelAutoRecoveryBehaviorVerifier {
  verify(Calculator) {
    const calculator = new Calculator();
    const base = {
      hasReel: true,
      playerHoldActive: false,
      strokeWonMeters: 2,
      totalTensionKg: 2,
      reelMaxLoadKg: 4,
      retrieveSpeedMetersPerSec: 1,
      releasedLineMeters: 4,
      fishDistanceMeters: 1,
      dtSec: 1,
    };
    const normal = calculator.calculate(base);
    assert.equal(Object.isFrozen(normal), true);
    assert.deepEqual(this.#plain(normal), {
      active: true,
      blockedReason: "none",
      retrieveSpeedMetersPerSec: 1,
      reelMaxLoadKg: 4,
      tensionKg: 2,
      reelLoadRatio: 0.5,
      reelEfficiency: 1,
      recoverSpeedMetersPerSec: 1,
      desiredRecoverMeters: 1,
      maxRecoverByLineMeters: 3,
      recoveredMeters: 1,
    });
    this.#blocked(calculator, base, { hasReel: false }, "no_reel");
    this.#blocked(calculator, base, { playerHoldActive: true }, "hold_active");
    this.#blocked(calculator, base, { strokeWonMeters: 0.000001 }, "no_stroke_credit");
    this.#blocked(calculator, base, { retrieveSpeedMetersPerSec: 0.000001 }, "zero_retrieve_speed");
    this.#blocked(calculator, base, { reelMaxLoadKg: 0.000001 }, "zero_reel_load");
    this.#blocked(
      calculator,
      base,
      { totalTensionKg: 3.999999 },
      "tension_at_or_above_reel_load",
    );
    this.#blocked(
      calculator,
      base,
      { releasedLineMeters: 1, fishDistanceMeters: 1 },
      "stroke_line_desync",
    );
    this.#blocked(calculator, base, { dtSec: 0 }, "zero_recover_speed");
    assert.equal(calculator.calculate({ ...base, strokeWonMeters: 0.25 }).recoveredMeters, 0.25);
    assert.equal(calculator.calculate({
      ...base,
      releasedLineMeters: 1.4,
      fishDistanceMeters: 1,
    }).recoveredMeters, 0.3999999999999999);
    const belowLimit = calculator.calculate({
      ...base,
      totalTensionKg: 3.999998,
    });
    assert.equal(belowLimit.active, true);
    assert.equal(belowLimit.recoverSpeedMetersPerSec, 1);
    assert.equal(belowLimit.reelEfficiency, 1);
    const normalized = calculator.calculate({
      ...base,
      strokeWonMeters: Number.POSITIVE_INFINITY,
      totalTensionKg: -10,
      releasedLineMeters: Number.NaN,
      fishDistanceMeters: -1,
      dtSec: Number.NEGATIVE_INFINITY,
    });
    assert.equal(normalized.blockedReason, "no_stroke_credit");
    assert.equal(normalized.tensionKg, 0);
    assert.equal(normalized.recoveredMeters, 0);
  }

  #blocked(calculator, base, override, reason) {
    const result = calculator.calculate({ ...base, ...override });
    assert.equal(result.active, false);
    assert.equal(result.blockedReason, reason);
    assert.equal(result.recoveredMeters, 0);
  }

  #plain(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class StageThreeReelAutoRecoveryRuntimeCheck {
  async run() {
    const approved = this.#json(
      "architecture/migration/stage_3_approved_batches.json",
    );
    const contract = this.#json(
      "architecture/migration/stage_3_compatibility_runtime.json",
    );
    const batch = approved.batches.find((record) => record.id === BATCH_ID);
    const expectedProjectModules = [
      ...batch.cumulativeRuntimeTopology.stage2Targets,
      ...batch.cumulativeRuntimeTopology.stage3Targets,
      ...contract.approvedInfrastructureModules,
    ].sort();
    const report = await new StageThreeCompatibilityBuildApplication({
      projectRoot: PROJECT_ROOT,
    }).run();
    assert.equal(report.status, "built");
    assert(report.moduleCount >= expectedProjectModules.length);
    assert(
      report.activationCount >= batch.compatibility.cumulativeActivationIds.length,
    );
    assert.deepEqual(report.selectedBatchIds.slice(0, 2), [
      "stage-3.candidate-001-inventory-85f44b2e",
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
      new Set(Object.keys(transport.modules)).size,
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
    new ReelAutoRecoveryBehaviorVerifier().verify(Calculator);
    this.#verifyReelSystemIntegration(context, contract.transport.symbol);

    console.log(
      `Stage 3.2 historical runtime passed inside the current ` +
        `${runtimeOutput.projectModules.length}-module graph: ` +
        `${runtimeOutput.virtualBuildModules.length} approved virtual build modules, ` +
        "one calculator identity, activation at logical position 113 and calculator/ReelSystem semantics preserved.",
    );
  }

  #verifyLogicalPosition(contract, activation) {
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const logical = new LegacyScriptOrderReader(
      path.join(PROJECT_ROOT, "index.html"),
      { scriptAliases: aliases },
    ).read();
    assert.equal(logical.length, 424);
    assert.equal(logical[112].legacyLoadOrder, 113);
    assert.equal(logical[112].currentPath, SOURCE_PROVIDER);
    assert.equal(activation.legacyScriptIndex, 113);
  }

  #verifyReelSystemIntegration(context, transportSymbol) {
    vm.runInContext(this.#read("src/systems/reel_system.js"), context, {
      filename: "src/systems/reel_system.js",
    });
    const ReelSystem = vm.runInContext("ReelSystem", context);
    context[transportSymbol] = null;
    const lineState = { releasedMeters: 4, distanceMeters: 1 };
    const recoverCalls = [];
    const lineSystem = {
      getState: () => lineState,
      recoverReleasedLine: (request) => {
        recoverCalls.push(request);
        return request.meters;
      },
    };
    const reel = {
      hasReel: () => true,
      getEffectiveMaxLoadKg: () => 4,
      getRetrieveSpeedMetersPerSec: () => 1,
    };
    const result = new ReelSystem().recoverRodStrokeCredit({
      dtSec: 1,
      lineSystem,
      reel,
      tensionKg: 2,
      playerHoldActive: false,
      strokeWonMeters: 2,
      fishDistanceMeters: 1,
    });
    assert.equal(result.active, true);
    assert.equal(result.recoveredMeters, 1);
    assert.deepEqual(
      JSON.parse(JSON.stringify(recoverCalls)),
      [{ meters: 1, minReleasedMeters: 1 }],
    );
  }

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
  }
}

new StageThreeReelAutoRecoveryRuntimeCheck().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
