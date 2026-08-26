"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  ActivationShimContractValidator,
  ActivationShimRenderer,
} = require("../build/compat_runtime/activation_shim");
const {
  PATHS,
  buildMatrix,
  serialize,
} = require("./generate-stage-3-batch-006-test-matrix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class StageThreeBatch006FocusedTestMatrixCheck {
  run() {
    const matrix = buildMatrix();
    assert.deepEqual(this.#readBytes(PATHS.output), serialize(matrix));
    const planBytes = this.#readBytes(matrix.sourceExecutionPlan.path);
    assert.equal(this.#sha256(planBytes), matrix.sourceExecutionPlan.sha256);
    const plan = JSON.parse(planBytes.toString("utf8"));
    const runtime = this.#loadRuntime(plan);
    const classes = runtime.classes;

    this.#floatBudget(classes.get("FloatTackleLineBudgetPolicy"));
    this.#holdOpposition(classes.get("HoldOppositionResolver"));
    this.#rodControlMode(classes.get("RodControlTensionModeResolver"));
    this.#lineConstraint(classes.get("LineConstraintStateResolver"));
    this.#poleGeometry(classes.get("PoleFightSectorGeometry"));
    this.#landingLift(classes.get("LandingLiftTensionCalculator"));
    this.#compatibility(plan, classes, runtime);

    assert.equal(matrix.behaviorCases.length, 33);
    assert.equal(matrix.compatibilityCases.length, 6);
    assert.equal(matrix.verdict, "eligible-for-prebuild-open");
    console.log(
      `Stage 3.6.3 focused test matrix passed: 33 executable behavior/state baselines and 6 compatibility identity/timing/consumer/transport contracts verified ${runtime.active ? "on the built cumulative runtime" : "before cutover"}.`,
    );
  }

  #floatBudget(Policy) {
    const equipment = (variant = "float", hasFloat = true) => ({
      rod: { variant, effectiveStats: { lengthMeters: 3 } },
      line: { effectiveStats: { lengthMeters: 10 } },
      float: hasFloat ? {} : null,
    });
    const policy = new Policy();
    assert.equal(policy.appliesTo(equipment("float")), true);
    assert.equal(policy.appliesTo(equipment("pole")), true);
    assert.equal(policy.appliesTo(equipment("spinning")), false);
    assert.equal(policy.appliesTo(equipment("float", false)), false);
    assert.equal(policy.resolve({ equipment: equipment(), selectedDepthMeters: -5 }).selectedDepthMeters, 0.1);
    assert.equal(policy.resolve({ equipment: equipment(), selectedDepthMeters: 99 }).selectedDepthMeters, 7);
    const surfacePolicy = new Policy({ minimumDepthMeters: 0.1, surfaceDepthToleranceMeters: 0.01 });
    assert.equal(surfacePolicy.resolve({ equipment: equipment(), selectedDepthMeters: 0.105 }).depthLineCostMeters, 0);
    assert.equal(surfacePolicy.resolve({ equipment: equipment(), selectedDepthMeters: 0.111 }).depthLineCostMeters, 0.111);
    const budget = policy.resolve({ equipment: equipment(), selectedDepthMeters: 3 });
    assert.equal(budget.maxDepthMeters, 7);
    assert.equal(budget.maxCastDistanceMeters, 7);
    const fallback = policy.resolve({ equipment: equipment("spinning"), selectedDepthMeters: 3 });
    assert.equal(fallback.applies, false);
    assert.equal(fallback.maxCastDistanceMeters, 10);
    assert.equal(fallback.depthLineCostMeters, 0);
    const injected = new Policy({ minimumDepthMeters: 0.5, surfaceDepthToleranceMeters: 0.2 })
      .resolve({ equipment: equipment(), selectedDepthMeters: 0.6 });
    assert.equal(injected.minDepthMeters, 0.5);
    assert.equal(injected.depthLineCostMeters, 0);
  }

  #holdOpposition(Resolver) {
    const resolver = new Resolver();
    const config = {
      towardPlayerHoldOppositionRatio: 0,
      sideHoldOppositionRatio: 0.35,
      awayHoldOppositionRatio: 1,
    };
    assert.equal(resolver.resolve({ activeRodHoldKg: 4, fishDirectionState: "away", directionConfig: config }).forceKg, 4);
    assert.equal(resolver.resolve({ activeRodHoldKg: -4, fishDirectionState: "away", directionConfig: config }).forceKg, 0);
    assert.equal(resolver.resolve({ activeRodHoldKg: 0, fishDirectionState: "side", directionConfig: config }).forceKg, 0);
    assert.equal(resolver.resolve({ activeRodHoldKg: 4, fishDirectionState: "toward_player", directionConfig: config }).ratio, 0);
    assert.equal(resolver.resolve({ activeRodHoldKg: 4, fishDirectionState: "side", directionConfig: { sideHoldOppositionRatio: 2 } }).ratio, 1);
    assert.equal(resolver.resolve({ activeRodHoldKg: 4, fishDirectionState: "side", directionConfig: { sideHoldOppositionRatio: -1 } }).ratio, 0);
    const invalid = resolver.resolve({ activeRodHoldKg: Number.NaN, fishDirectionState: "unknown", directionConfig: { awayHoldOppositionRatio: Number.NaN } });
    assert.equal(invalid.direction, "away");
    assert.equal(invalid.ratio, 1);
    assert.equal(invalid.forceKg, 0);
  }

  #rodControlMode(Resolver) {
    const resolver = new Resolver();
    const config = { sameDirectionThreshold: 0.35, oppositeDirectionThreshold: -0.35, minFishSpeedPxPerSec: 1 };
    assert.equal(resolver.resolve({ fishVelocity: { x: 10, y: 0 }, controlAxis: { x: 1, y: 0 }, config }).mode, "same_direction");
    assert.equal(resolver.resolve({ fishVelocity: { x: -10, y: 0 }, controlAxis: { x: 1, y: 0 }, config }).mode, "opposite_direction");
    assert.equal(resolver.resolve({ fishVelocity: { x: 0, y: 10 }, controlAxis: { x: 1, y: 0 }, config }).mode, "side");
    const slow = resolver.resolve({ fishVelocity: { x: 0.5, y: 0 }, controlAxis: { x: 3, y: 4 }, config });
    assert.equal(slow.mode, "side");
    assert.equal(slow.controlAxisX, 0.6);
    assert.equal(slow.controlAxisY, 0.8);
    const threshold = resolver.resolve({ fishVelocity: { x: 0.35, y: Math.sqrt(1 - 0.35 ** 2) }, controlAxis: { x: 1, y: 0 }, config: { ...config, minFishSpeedPxPerSec: 0 } });
    assert.equal(threshold.mode, "same_direction");
    const zeroAxis = resolver.resolve({ fishVelocity: { x: 10, y: 0 }, controlAxis: { x: 0, y: 0 }, config });
    assert.equal(zeroAxis.mode, "side");
    assert.equal(Object.isFrozen(zeroAxis), true);
  }

  #lineConstraint(Resolver) {
    const resolver = new Resolver();
    const taut = resolver.resolve({ lineState: { releasedMeters: 10, distanceMeters: 10, remainingMeters: 5 }, payoutContext: {} });
    const slack = resolver.resolve({ lineState: { releasedMeters: 10, distanceMeters: 5, remainingMeters: 5 }, payoutContext: {} });
    assert.equal(taut.tautLine, true);
    assert.equal(slack.tautLine, false);
    assert.equal(taut.lineHasReserve, true);
    assert.equal(resolver.resolve({ lineState: { releasedMeters: 10, distanceMeters: 10, remainingMeters: 5, canReleaseLine: false }, payoutContext: {} }).lineHasReserve, false);
    const payout = resolver.resolve({ lineState: { releasedMeters: 10, distanceMeters: 10, remainingMeters: 5 }, payoutContext: { dragCanPayout: true, payoutOccurred: true } });
    assert.equal(payout.dragCanPayout, true);
    assert.equal(payout.lineLengthLocked, false);
    const hard = resolver.resolve({ lineState: { releasedMeters: 10, distanceMeters: 10, remainingMeters: 0 }, payoutContext: {} });
    assert.equal(hard.hardLineLimit, true);
    assert.equal(hard.reason, "spool_empty");
    const blocked = resolver.resolve({ lineState: { releasedMeters: 10, distanceMeters: 10, remainingMeters: 5 }, payoutContext: { dragCanPayout: false, reason: "custom_hold" } });
    assert.equal(blocked.dragPayoutBlocked, true);
    assert.equal(blocked.reason, "custom_hold");
    const epsilon = resolver.resolve({ lineState: { releasedMeters: 0.001, distanceMeters: 0, remainingMeters: 0.001 }, payoutContext: {}, config: { epsilonMeters: 0.001 } });
    assert.equal(epsilon.lineExtensionRatio, 1);
    assert.equal(epsilon.lineHasReserve, false);
  }

  #poleGeometry(Geometry) {
    const geometryResolver = new Geometry();
    const geometry = geometryResolver.resolve({
      origin: { x: 0, y: 0 },
      position: { x: 0, y: -50 },
      limitRadiusPx: 100,
      pixelsPerMeter: 50,
      config: { enabled: true, maxAngleFromCenterDeg: 60, shoreOpeningWidthMeters: 1 },
    });
    assert.equal(geometry.active, true);
    assert.equal(geometry.limitRadiusPx, 100);
    assert.equal(geometryResolver.angleDeg({ x: 10, y: 0 }, { x: 0, y: 0 }), 90);
    assert.equal(geometryResolver.radiusPx({ x: 3, y: 4 }, { x: 0, y: 0 }), 5);
    assert.equal(geometryResolver.contains({ x: 0, y: -50 }, geometry), true);
    assert.equal(geometryResolver.contains({ x: 500, y: 0 }, geometry), false);
    assert.equal(geometryResolver.violation({ x: 500, y: 0 }, geometry).score > 0, true);
    const target = {};
    assert.equal(geometryResolver.pointAt({ originX: 0, originY: 0 }, 90, 10, target), target);
    assert.equal(Math.abs(target.x - 10) < 1e-9, true);
    assert.equal(Math.abs(target.y) < 1e-9, true);
    assert.equal(geometryResolver.contains({ x: Number.NaN, y: 0 }, geometry), false);
    const secondFrame = geometryResolver.resolve({ origin: { x: 1, y: 1 }, limitRadiusPx: 50 });
    assert.equal(secondFrame, geometry);
    const otherFrame = new Geometry().resolve({ origin: { x: 0, y: 0 }, limitRadiusPx: 50 });
    assert.notEqual(otherFrame, geometry);
    const source = this.#readText("src/game/domain/fishing/pole_fight_sector_geometry.js");
    assert.equal(/^(?:let|var|const)\s+/mu.test(source), false);
  }

  #landingLift(Calculator) {
    const calculator = new Calculator();
    const base = {
      previousLiftHoldKg: 0,
      fishWeightKg: 2,
      maxTackleLoadKg: 2,
      waterFightTensionKg: 0.25,
      inLandingZone: true,
      playerHoldActive: true,
      config: { liftWeightTensionRatio: 1, fastLiftTimeSeconds: 1, releaseTimeSeconds: 0.2 },
    };
    assert.equal(calculator.calculate({ ...base, dtSec: 0.25 }).liftHoldKg, 0.5);
    assert.equal(calculator.calculate({ ...base, previousLiftHoldKg: 1, playerHoldActive: false, dtSec: 0.1 }).liftHoldKg, 0);
    const outside = calculator.calculate({ ...base, inLandingZone: false, dtSec: 1 });
    assert.equal(outside.liftMaxKg, 0);
    assert.equal(outside.active, false);
    assert.equal(outside.fishTensionKg, 0.25);
    const lowLoad = calculator.calculate({ ...base, previousLiftHoldKg: 1, dtSec: 0 });
    const highLoad = calculator.calculate({ ...base, previousLiftHoldKg: 1.9, dtSec: 0 });
    assert.equal(lowLoad.speedRatio >= highLoad.speedRatio, true);
    const invalid = calculator.calculate({ ...base, fishWeightKg: -2, maxTackleLoadKg: Number.NaN, dtSec: -1, config: { fastLiftTimeSeconds: Number.NaN } });
    assert.equal(invalid.liftMaxKg, 0);
    assert.equal(invalid.liftHoldKg, 0);
    const frozen = calculator.calculate({ ...base, dtSec: 0 });
    assert.equal(Object.isFrozen(frozen), true);
    const short = calculator.calculate({ ...base, dtSec: 0.1 });
    const long = calculator.calculate({ ...base, dtSec: 0.2 });
    assert.equal(Math.abs(long.liftHoldKg - short.liftHoldKg * 2) < 1e-12, true);
  }

  #compatibility(plan, classes, runtime) {
    const transport = "__CYBER_FISHING_COMPAT_RUNTIME__";
    const modules = runtime.modules;
    for (const activation of plan.compatibility.activations) {
      const context = runtime.active ? runtime.context : vm.createContext({
        [transport]: { modules },
      });
      assert.equal(context[activation.legacySymbol], undefined);
      const code = new ActivationShimRenderer().render(activation, transport);
      new ActivationShimContractValidator().validate({ code, activation, transportSymbol: transport });
      const actualCode = runtime.active
        ? this.#readText(`dist/stage-3-compat-runtime/${activation.shimFile}`)
        : code;
      assert.equal(actualCode, code);
      new vm.Script(actualCode).runInContext(context);
      const exactExport = modules[activation.targetModule][activation.exportName];
      assert.equal(context[activation.legacySymbol], exactExport);
      assert.equal(context[activation.legacySymbol], classes.get(activation.exportName));
    }
    assert.equal(new Set(plan.scope.modules.map((module) =>
      modules[module.targetPath])).size, 6);
    assert.equal(plan.cumulativeRuntime?.evaluationCountPerModule ?? 1, 1);
    assert.equal(plan.compatibility.plannedBridgeRecords.length, 7);
    for (const record of plan.compatibility.plannedBridgeRecords) {
      const source = this.#readText(record.source);
      for (const provider of record.globalProviders) {
        assert.match(source, new RegExp(`\\b${provider.symbol}\\b`, "u"));
      }
      assert.equal(source.includes(transport), false);
    }
    for (const module of plan.scope.modules) {
      assert.equal(this.#readText(module.targetPath).includes(transport), false);
    }
  }

  #loadRuntime(plan) {
    const state = JSON.parse(this.#readText(
      "architecture/migration/stage_3_execution_state.json",
    ));
    const runtimeContainsBatch = state.activeBatchPhase === "runtime-active" ||
      state.completedBatchIds.includes(plan.batchId);
    if (!runtimeContainsBatch) {
      const classes = new Map(plan.scope.modules.flatMap((module) =>
        module.exports.map((exportName) => [
          exportName,
          this.#loadClassicClass(module.currentPath, exportName),
        ])));
      const modules = {};
      for (const module of plan.scope.modules) {
        modules[module.targetPath] = {};
        for (const exportName of module.exports) {
          modules[module.targetPath][exportName] = classes.get(exportName);
        }
      }
      return { active: false, classes, modules, context: null };
    }
    const contract = JSON.parse(this.#readText(
      "architecture/migration/stage_3_compatibility_runtime.json",
    ));
    const context = vm.createContext({});
    for (const activation of plan.compatibility.activations) {
      assert.equal(context[activation.legacySymbol], undefined);
    }
    new vm.Script(this.#readText(
      `${contract.output.directory}${contract.output.runtimeFile}`,
    )).runInContext(context);
    const registry = context[contract.transport.symbol];
    assert(registry);
    assert.equal(registry.ownsGameState, false);
    assert.equal(Object.keys(registry.modules).length, 25);
    const classes = new Map(plan.scope.modules.flatMap((module) =>
      module.exports.map((exportName) => [
        exportName,
        registry.modules[module.targetPath][exportName],
      ])));
    return {
      active: true,
      classes,
      modules: registry.modules,
      context,
    };
  }

  #loadClassicClass(relativePath, exportName) {
    const source = this.#readText(relativePath);
    const context = vm.createContext({});
    new vm.Script(`${source}\nglobalThis.__CLASS__ = ${exportName};`, {
      filename: relativePath,
    }).runInContext(context);
    return context.__CLASS__;
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  #readBytes(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  }

  #readText(relativePath) {
    return this.#readBytes(relativePath).toString("utf8");
  }
}

if (require.main === module) {
  new StageThreeBatch006FocusedTestMatrixCheck().run();
}

module.exports = { StageThreeBatch006FocusedTestMatrixCheck };
