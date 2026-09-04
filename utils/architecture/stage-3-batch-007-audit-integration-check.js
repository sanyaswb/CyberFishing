"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { globSync } = require("glob");
const {
  BATCH_ID,
  ROD_PULL_FIELDS,
  ROD_STROKE_SNAPSHOT_FIELDS,
  StageThreeBatch007DependencyStateAuditValidator,
} = require("./domain_batches/stage_three_batch_007_dependency_state_audit");
const {
  PATHS,
} = require("./generate-stage-3-batch-007-audit");
const {
  StageThreeBatch007LifecycleTransition,
} = require("./domain_batches/stage_three_batch_007_lifecycle_transition");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class StageThreeBatch007AuditIntegrationCheck {
  run() {
    const protectedPaths = [
      ...globSync("src/**/*.js", { cwd: PROJECT_ROOT, nodir: true }).sort(),
      "index.html",
      "package.json",
      "package-lock.json",
      "architecture/guards/migration_bridge_registry.json",
      "architecture/migration/module_migration_manifest.json",
      "architecture/migration/stage_3_domain_audit.json",
      "architecture/migration/stage_3_approved_batches.json",
      "architecture/migration/stage_3_execution_state.json",
      "architecture/migration/stage_3_compatibility_runtime.json",
    ];
    const before = new Map(protectedPaths.map((relativePath) => [
      relativePath,
      this.#readBytes(relativePath),
    ]));
    const generated = JSON.parse(this.#readBytes(PATHS.output).toString("utf8"));
    new StageThreeBatch007DependencyStateAuditValidator().validate(generated);
    this.moduleByCurrentPath = new Map(generated.scope.modules.map((module) => [
      module.currentPath,
      module,
    ]));

    this.#verifyTopology(generated);
    this.#verifyStateAndBehavior(generated);
    this.#verifyPerformance(generated);
    this.#verifyCompatibility(generated);
    this.#verifyRuntimeUnchanged(generated);

    for (const [relativePath, bytes] of before) {
      assert.deepEqual(this.#readBytes(relativePath), bytes, `audit mutated ${relativePath}`);
    }
    console.log(
      "Stage 3.7.0 dependency/state audit passed: six singleton depth-zero modules add exactly 25→31; mutable state/snapshot identity, reusable movement buffers, formula semantics, hot-loop allocation baselines, six activations and nine consumers are frozen with no new prerequisite.",
    );
  }

  #verifyTopology(artifact) {
    assert.equal(artifact.status, "verified");
    assert.equal(artifact.verdict, "eligible-for-execution-plan");
    assert.equal(artifact.scope.targetCount, 6);
    assert.equal(artifact.closure.existingCumulativeModuleCount, 25);
    assert.equal(artifact.closure.newProjectModuleCount, 6);
    assert.equal(artifact.closure.resultingProjectModuleCount, 31);
    assert.deepEqual(artifact.closure.internalEdges, []);
    assert.deepEqual(artifact.closure.alreadyCumulativeDependencies, []);
    assert.deepEqual(artifact.closure.unexpectedDependencies, []);
    assert.equal(artifact.evaluation.stronglyConnectedComponents.length, 6);
    assert.deepEqual(artifact.evaluation.cycles, []);
    assert.deepEqual(artifact.boundaries, {
      forbiddenEdges: [],
      directConfigDependencies: [],
      browserCapabilities: [],
      transportReads: [],
    });
    assert.deepEqual(artifact.prerequisites, {
      frozen: [],
      newlyDiscovered: [],
    });
    for (const module of artifact.scope.modules) {
      assert.equal(module.outgoingProjectEdges.length, 0);
      assert.equal(module.dependencyDepth, 0);
      assert.equal(module.scc.cyclic, false);
      assert.equal(module.scc.members.length, 1);
    }
  }

  #verifyStateAndBehavior(artifact) {
    const byPath = new Map(artifact.scope.modules.map((module) => [module.currentPath, module]));

    const MotionResolver = this.#loadClass(
      "src/core/fishing/line_constrained_fish_motion_resolver.js",
      "LineConstrainedFishMotionResolver",
    );
    const motion = new MotionResolver();
    const motionInput = {
      position: { x: 10, y: 0 },
      rodTipPosition: { x: 0, y: 0 },
      rawVelocity: { x: 4, y: 3 },
      lineConstraintState: { radialConstraintActive: true },
      dtSec: 0.25,
    };
    const motionInputBefore = JSON.stringify(motionInput);
    const constrained = motion.resolve(motionInput);
    const sameFrame = motion.resolve({
      ...motionInput,
      lineConstraintState: { radialConstraintActive: false },
    });
    assert.equal(constrained, sameFrame);
    assert.equal(JSON.stringify(motionInput), motionInputBefore);
    assert.equal(constrained.velocityX, 4);
    assert.equal(constrained.velocityY, 3);
    assert.notEqual(new MotionResolver().resolve(motionInput), constrained);
    assert.equal(byPath.get("src/core/fishing/line_constrained_fish_motion_resolver.js")
      .state.classification, "instance-local-derived-buffer");

    const Splitter = this.#loadClass(
      "src/core/fishing/line_radial_movement_splitter.js",
      "LineRadialMovementSplitter",
    );
    const splitter = new Splitter();
    const splitterInput = {
      position: { x: 0, y: 0 },
      rodTipPosition: { x: 0, y: 0 },
      freeVelocity: { x: 10, y: 0 },
      constrainedVelocity: { x: 0, y: 5 },
      releasedMeters: 100,
      pixelsPerMeter: 1,
      dtSec: 1,
    };
    const splitterBefore = JSON.stringify(splitterInput);
    const free = splitter.resolveVelocity(splitterInput);
    assert.equal(free.velocityX, 10);
    assert.equal(free.freeTimeSec, 1);
    const sameResult = splitter.resolveVelocity({ ...splitterInput, releasedMeters: 0 });
    assert.equal(free, sameResult);
    assert.equal(JSON.stringify(splitterInput), splitterBefore);
    assert.equal(sameResult.velocityY, 5);

    const ReelCalculator = this.#loadClass(
      "src/core/fishing/reel_retrieve_speed_calculator.js",
      "ReelRetrieveSpeedCalculator",
    );
    const reel = new ReelCalculator();
    assert.equal(reel.calculate(), 0);
    assert.equal(reel.calculate({ baseSpeedMetersPerSec: 2, bearingCount: 3, bearingBonusMetersPerSec: 0.5 }), 3.5);
    assert.equal(reel.calculate({ baseSpeedMetersPerSec: -2, bearingCount: -3, bearingBonusMetersPerSec: Infinity }), 0);

    const RodPullState = this.#loadClass(
      "src/core/fishing/rod_pull_state.js",
      "RodPullState",
    );
    const pull = new RodPullState();
    const pullDefaults = JSON.parse(JSON.stringify(pull));
    assert.deepEqual(Object.keys(pull).sort(), [...ROD_PULL_FIELDS]);
    for (const key of Object.keys(pull)) pull[key] = key;
    const pullIdentity = pull;
    pull.reset();
    assert.equal(pull, pullIdentity);
    assert.deepEqual(JSON.parse(JSON.stringify(pull)), pullDefaults);
    assert.equal(pull.tensionCeilingMultiplier, 1);
    assert.equal(pull.holdTensionRatio, 1);
    assert.equal(pull.lineHasReserve, true);
    assert.equal(pull.canReleaseLine, true);

    const RodStrokeState = this.#loadClass(
      "src/core/fishing/rod_stroke_state.js",
      "RodStrokeState",
    );
    const stroke = new RodStrokeState();
    stroke.setCapacity(10);
    assert.equal(stroke.addWonDistance(4), 4);
    assert.equal(stroke.addWonDistance(20), 6);
    assert.equal(stroke.wonMeters, 10);
    assert.equal(stroke.getRatio(), 1);
    assert.equal(stroke.loseWonDistance(-5), 0);
    assert.equal(stroke.recoverWonDistance(2.5), 2.5);
    const target = {};
    assert.equal(stroke.writeSnapshot(target), target);
    assert.deepEqual(Object.keys(target).sort(), [...ROD_STROKE_SNAPSHOT_FIELDS]);
    assert.equal(target.rodStrokeWonMeters, 7.5);
    assert.equal(target.rodStrokeUsedMeters, 7.5);
    assert.equal(target.rodStrokeUnrecoveredMeters, 7.5);
    assert.equal(target.rodStrokeRatio, 0.75);
    assert.notEqual(stroke.getSnapshot(), stroke.getSnapshot());

    const ForceCalculator = this.#loadClass(
      "src/core/fishing/simple_fight_force_calculator.js",
      "SimpleFightForceCalculator",
    );
    const force = new ForceCalculator();
    assert.equal(force.calculateFishPassiveKg({ fishWeightKg: 2.5, tautBodyResistancePerKg: 0.2, fishBasePower: 1.3 }), 0.65);
    assert.equal(force.calculateFishPassiveKg({ fishWeightKg: -2 }), 0);
    assert.equal(force.calculateEffectiveRodHoldKg({ rodHoldKg: 10, rodHoldMaxKg: 8, rodAngleMultiplier: 2 }), 8);
    assert.equal(force.calculateEffectiveRodHoldKg({ rodHoldKg: 10, rodHoldMaxKg: 8, rodAngleMultiplier: -1 }), 0);
    const forceResult = force.calculate({ fishWeightKg: 2, rodLimitKg: 10, rodHoldKg: 3 });
    assert.equal(Object.isFrozen(forceResult), true);
    assert.equal(Number.isInteger(forceResult.totalTensionKg), false);
    assert.equal(force.calculateSpeedMps({ netForceKg: Number.NaN }).speedMps, 0);
    assert.equal(byPath.get("src/core/fishing/simple_fight_force_calculator.js")
      .sourceShape.allocationTotals.roundingCalls, 0);
  }

  #verifyPerformance(artifact) {
    assert.equal(artifact.performance.hotLoopSensitive.length, 6);
    assert.equal(artifact.performance.additionalMigrationAllocationsAllowed, 0);
    assert.equal(artifact.performance.transportLookupsAllowed, 0);
    for (const module of artifact.scope.modules) {
      assert.equal(module.performance.callSites.length > 0, true);
      assert.equal(module.performance.callSiteEvidence.length > 0, true);
      for (const evidence of module.performance.callSiteEvidence) {
        assert(this.#readText(evidence.path).includes(evidence.marker));
      }
      assert.equal(module.performance.additionalMigrationAllocationsAllowed, 0);
      assert.equal(module.performance.transportLookupsAllowed, 0);
      assert.equal(module.sourceShape.forbiddenReads.length, 0);
    }
    const pull = artifact.scope.modules.find((module) =>
      module.currentPath.endsWith("rod_pull_state.js"));
    assert.deepEqual(pull.performance.allocationBaseline, {
      objectExpressions: 0,
      arrayExpressions: 0,
      newExpressions: 0,
      objectFreezeCalls: 0,
      objectAssignCalls: 0,
      roundingCalls: 0,
    });
  }

  #verifyCompatibility(artifact) {
    assert.equal(artifact.compatibility.providers.length, 6);
    assert.equal(artifact.compatibility.consumers.length, 9);
    assert.equal(new Set(artifact.compatibility.consumers.map((record) =>
      `${record.provider}\0${record.source}`)).size, 9);
    assert.deepEqual(
      artifact.compatibility.activations.map((activation) => activation.legacyScriptIndex)
        .sort((left, right) => left - right),
      [91, 92, 112, 131, 132, 139],
    );
    assert(artifact.compatibility.activations.every((activation) =>
      activation.owner === BATCH_ID));
  }

  #verifyRuntimeUnchanged(artifact) {
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const runtime = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = this.#json("architecture/guards/migration_bridge_registry.json");
    const lifecycle = new StageThreeBatch007LifecycleTransition();
    lifecycle.assertCurrentContainsBatch(state);
    const completed = lifecycle.isCompleted(state);
    const batchOpen = state.activeBatchId === BATCH_ID &&
      ["prebuild", "runtime-active"].includes(state.activeBatchPhase);
    assert.equal(
      completed || batchOpen,
      true,
    );
    const runtimeActive = lifecycle.isRuntimeAvailable(state);
    assert.equal(runtime.activationPositions.length, runtimeActive ? 32 : 26);
    assert.equal(runtime.plannedActivationPositions, undefined);
    assert.equal(registry.bridges.length, runtimeActive ? 57 : 48);
    assert.equal(registry.plannedBridges, undefined);
    assert.equal(this.#scriptSources().length, 426);
    assert.equal(this.#readText("index.html").includes('type="module"'), false);
    assert.equal(artifact.sourceReleaseVersion, "0.24.43");
  }

  #loadClass(relativePath, exportName) {
    const context = vm.createContext({});
    let source = this.#readText(relativePath);
    if (source.includes("__CYBER_FISHING_COMPAT_RUNTIME__")) {
      const targetPath = this.moduleByCurrentPath.get(relativePath)?.targetPath;
      assert(targetPath, `audit target mapping missing: ${relativePath}`);
      source = this.#readText(targetPath).replace(
        `export class ${exportName}`,
        `class ${exportName}`,
      );
    }
    new vm.Script(
      `${source}\nglobalThis.__AUDIT_CLASS__ = ${exportName};`,
      { filename: relativePath },
    ).runInContext(context);
    return context.__AUDIT_CLASS__;
  }

  #scriptSources() {
    return [...this.#readText("index.html").matchAll(
      /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/giu,
    )].map((match) => match[1]);
  }

  #json(relativePath) {
    return JSON.parse(this.#readText(relativePath));
  }

  #readText(relativePath) {
    return this.#readBytes(relativePath).toString("utf8");
  }

  #readBytes(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  }
}

new StageThreeBatch007AuditIntegrationCheck().run();
