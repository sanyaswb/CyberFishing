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
const BATCH_ID = "stage-3.candidate-005-fishing-45d0c7ce";

class FishingFoundationBehaviorVerifier {
  verify(exportsByName) {
    this.#drag(exportsByName.DragForceCalculator);
    this.#retrieveResult(exportsByName.FishRetrieveResult);
    this.#recoverableLine(
      exportsByName.RecoverableLineCalculator,
      exportsByName.LooseLineCalculator,
    );
    this.#movement(exportsByName.RodControlMovementProjector);
    this.#strokeCapacity(exportsByName.RodStrokeCapacityResolver);
    this.#strokeTracker(exportsByName.RodStrokeTracker);
  }

  #drag(Calculator) {
    const calculator = new Calculator();
    const input = {
      fishOppositionKg: 3,
      effectiveRodHoldKg: 1,
      awayDir: { x: 1, y: 0 },
      dragRatio: 0.5,
      dragLimitKg: 1,
      lineHasReserve: true,
      lineTaut: true,
      targetVelocity: { x: 10, y: 4 },
    };
    const before = JSON.stringify(input);
    const result = calculator.calculate(input);
    assert.equal(JSON.stringify(input), before);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(result.fishWonForceKg, 2);
    assert.equal(result.dragEngaged, true);
    assert.equal(result.shouldSlipDrag, true);
    assert.equal(result.dragBlockedForceKg, 1);
    assert.equal(result.tangentSpeedPxPerSec, 4);
    const inward = calculator.calculate({
      fishOppositionKg: 3,
      awayDir: { x: 1, y: 0 },
      targetVelocity: { x: -5, y: 2 },
    });
    assert.equal(inward.dragEngaged, false);
    assert.equal(inward.finalXSpeedPxPerSec, -5);
    assert.equal(inward.finalYSpeedPxPerSec, 2);
    assert.equal(calculator.speedFromForceKg({ forceKg: -1 }), 0);
  }

  #retrieveResult(Result) {
    const result = new Result({
      holdRatio: 2,
      playerPullPressureKg: -1,
      fishTensionKg: 3,
      playerHoldTensionKg: 2,
      totalTensionKg: 5,
      movableHoldTensionCapApplied: true,
      rawPlayerHoldTensionKg: 4,
    });
    assert.equal(result.holdRatio, 1);
    assert.equal(result.playerPullPressureKg, 0);
    assert.equal(result.lineTensionKg, 5);
    assert.equal(result.retrieveSpeedMetersPerSecond, result.speedMps);
    const moved = result.withAppliedMovement({
      appliedMoveMeters: 1.25,
      movementBlocked: true,
      hardTensionBlocked: true,
    });
    assert.notEqual(moved, result);
    assert.equal(moved.appliedMoveMeters, 1.25);
    assert.equal(moved.movementBlocked, true);
    assert.equal(moved.tensionBlocked, true);
    assert.equal(moved.movableHoldTensionCapApplied, false);
    assert.equal(moved.playerHoldTensionKg, 4);
    assert.equal(moved.totalTensionKg, 7);
  }

  #recoverableLine(Recoverable, Loose) {
    const recoverable = new Recoverable();
    assert.equal(recoverable.calculateRecoverableLineMeters({
      releasedMeters: 10,
      fishDistanceMeters: 4,
    }), 6);
    assert.equal(recoverable.calculateRecoverableLineMeters({
      releasedMeters: 2,
      fishDistanceMeters: 4,
    }), 0);
    const loose = new Loose();
    const base = { releasedMeters: 10, fishDistanceMeters: 7 };
    assert.equal(loose.calculateActualSlackMeters(base), 0);
    assert.equal(loose.calculateActualSlackMeters({
      ...base,
      fishMovingTowardPlayer: true,
    }), 3);
    assert.equal(loose.calculateActualSlackMeters({
      ...base,
      fishMovingTowardPlayer: true,
      playerPulling: true,
    }), 0);
    assert.equal(loose.calculateActualSlackMeters({
      ...base,
      fishMovingTowardPlayer: true,
      reelRecovering: true,
    }), 0);
  }

  #movement(Projector) {
    const projector = new Projector();
    const original = { x: 5, y: 7 };
    const none = projector.resolveNextPoint({ position: original });
    assert.equal(none.mode, "none");
    assert.equal(none.x, 5);
    assert.equal(none.y, 7);
    assert.deepEqual(original, { x: 5, y: 7 });
    const free = projector.resolveNextPoint({
      position: { x: 0, y: 0 },
      rodTipPosition: { x: 0, y: 0 },
      directionX: 1,
      deltaMeters: 2,
      pixelsPerMeter: 10,
    });
    assert.equal(free.mode, "free_x");
    assert.equal(free.x, 20);
    assert.equal(free.appliedPathPx, 20);
    const noRadius = projector.resolveNextPoint({
      position: { x: 2, y: 3 },
      rodTipPosition: { x: 0, y: 0 },
      directionX: 1,
      deltaMeters: 1,
      pixelsPerMeter: 10,
      lineConstraintState: {
        radialConstraintActive: true,
        lockedLengthMeters: 0,
      },
    });
    assert.equal(noRadius.mode, "locked_no_radius");
    const arc = projector.resolveNextPoint({
      position: { x: 0, y: -10 },
      rodTipPosition: { x: 0, y: 0 },
      directionX: 1,
      deltaMeters: 1,
      pixelsPerMeter: 10,
      lineConstraintState: {
        radialConstraintActive: true,
        lockedLengthMeters: 1,
      },
    });
    assert.equal(arc.mode, "locked_arc");
    assert(Math.abs(Math.hypot(arc.x, arc.y) - 10) < 0.000001);
    assert.equal(arc.appliedPathPx, 10);
  }

  #strokeCapacity(Resolver) {
    const resolver = new Resolver({
      capacityByLineLengthRatio: 0.5,
      capacityByRodLengthRatio: 0.25,
    });
    assert.equal(resolver.resolve({
      rodLengthMeters: 4,
      lineLengthMeters: 20,
      hasReel: true,
    }), 1);
    assert.equal(resolver.resolve({
      rodLengthMeters: 4,
      lineLengthMeters: 20,
      hasReel: false,
    }), 10);
    assert.equal(new Resolver({ capacityByRodLengthRatio: -1 }).resolve({
      rodLengthMeters: 4,
    }), 0);
    assert.equal(new Resolver().resolve({ rodLengthMeters: 4 }), 4);
  }

  #strokeTracker(Tracker) {
    const tracker = new Tracker();
    assert.deepEqual(this.#plain(tracker.calculate({
      previousFishY: 100,
      currentFishY: 150,
      pixelsPerMeter: 50,
    })), { yTowardMeters: 1, yAwayMeters: 0 });
    assert.deepEqual(this.#plain(tracker.calculate({
      previousFishY: 100,
      currentFishY: 50,
      pixelsPerMeter: 50,
    })), { yTowardMeters: 0, yAwayMeters: 1 });
    assert.deepEqual(this.#plain(tracker.calculate({
      previousFishY: "invalid",
      currentFishY: 50,
    })), { yTowardMeters: 0, yAwayMeters: 0 });
    assert.equal(tracker.resolveTowardPlayerYSign({ fishY: 10, rodTipY: 20 }), 1);
    assert.equal(tracker.resolveTowardPlayerYSign({ fishY: 20, rodTipY: 10 }), -1);
    assert.equal(tracker.resolveTowardPlayerYSign({ fishY: "x" }), 1);
  }

  #plain(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class StageThreeFishingFoundationRuntimeCheck {
  async run() {
    const approved = this.#json("architecture/migration/stage_3_approved_batches.json");
    const contract = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const batch = approved.batches.find((record) => record.id === BATCH_ID);
    assert(batch);
    const selectedBatchId = state.activeBatchId && state.activeBatchPhase !== "prebuild"
      ? state.activeBatchId
      : state.completedBatchIds.at(-1);
    const selectedBatch = approved.batches.find((record) =>
      record.id === selectedBatchId);
    assert(selectedBatch);
    const expectedProjectModules = [
      ...selectedBatch.cumulativeRuntimeTopology.stage2Targets,
      ...selectedBatch.cumulativeRuntimeTopology.stage3Targets,
      ...contract.approvedInfrastructureModules,
    ].sort();
    const expectedActivationIds = [...selectedBatch.compatibility.cumulativeActivationIds].sort();
    const report = await new StageThreeCompatibilityBuildApplication({
      projectRoot: PROJECT_ROOT,
    }).run();
    assert.equal(report.status, "built");
    assert.equal(report.moduleCount, expectedProjectModules.length);
    assert.equal(report.activationCount, expectedActivationIds.length);
    assert.deepEqual(report.selectedBatchIds, approved.batches.slice(0,
      selectedBatch.order)
      .map((record) => record.id));
    const runtimeOutput = report.outputs.find((record) =>
      record.kind === "cumulative-runtime");
    assert(runtimeOutput);
    assert.deepEqual(runtimeOutput.projectModules, expectedProjectModules);
    assert.equal(new Set(runtimeOutput.projectModules).size, expectedProjectModules.length);
    assert(batch.cumulativeRuntimeTopology.stage3Targets.every((modulePath) =>
      runtimeOutput.projectModules.includes(modulePath)));
    assert.deepEqual(runtimeOutput.virtualBuildModules,
      [...new Set(runtimeOutput.virtualBuildModules)].sort());
    assert(runtimeOutput.virtualBuildModules.every((moduleId) =>
      contract.approvedVirtualModules.includes(moduleId)));

    const context = vm.createContext({});
    const activations = contract.activationPositions.filter((record) =>
      record.owner === BATCH_ID);
    for (const activation of activations) {
      assert.equal(context[activation.legacySymbol], undefined);
    }
    vm.runInContext(
      this.#read(`${contract.output.directory}${contract.output.runtimeFile}`),
      context,
      { filename: contract.output.runtimeFile },
    );
    const transport = context[contract.transport.symbol];
    assert.equal(transport.ownsGameState, false);
    assert.equal(Object.keys(transport.modules).length, expectedProjectModules.length);
    const exportsByName = {};
    const positions = [...new Set(activations.map((record) =>
      record.legacyScriptIndex))].sort((a, b) => a - b);
    for (const position of positions) {
      const group = activations.filter((record) =>
        record.legacyScriptIndex === position).sort((left, right) =>
        left.id.localeCompare(right.id));
      for (const activation of group) {
        assert.equal(context[activation.legacySymbol], undefined);
      }
      for (const activation of group) {
        vm.runInContext(
          this.#read(`${contract.output.directory}${activation.shimFile}`),
          context,
          { filename: activation.shimFile },
        );
        const exactExport = transport.modules[activation.targetModule][activation.exportName];
        assert.equal(context[activation.legacySymbol], exactExport);
        assert.equal(exactExport.name, activation.exportName);
        exportsByName[activation.exportName] = exactExport;
      }
    }
    assert.equal(
      activations.filter((record) => record.legacyScriptIndex === 117).length,
      2,
    );
    new FishingFoundationBehaviorVerifier().verify(exportsByName);
    context[contract.transport.symbol] = null;
    assert.equal(new exportsByName.RecoverableLineCalculator()
      .calculateRecoverableLineMeters({ releasedMeters: 5, fishDistanceMeters: 2 }), 3);
    this.#verifyConsumers(batch, contract.transport.symbol);
    this.#verifyScriptTopology(contract);

    console.log(
      `Stage 3.5 historical runtime passed inside the current ${expectedProjectModules.length}-module graph: ` +
        "seven exact Fishing Foundation identities, grouped position-117 timing and domain behavior preserved.",
    );
  }

  #verifyConsumers(batch, transportSymbol) {
    for (const record of batch.externalLegacyConsumers) {
      const source = this.#read(record.source);
      assert(record.symbols.some((symbol) =>
        new RegExp(`\\b${symbol}\\b`, "u").test(source)));
      assert.equal(source.includes(transportSymbol), false);
    }
  }

  #verifyScriptTopology(contract) {
    const html = this.#read("index.html");
    const scripts = [...html.matchAll(
      /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>/giu,
    )];
    assert.equal(scripts.length, 426);
    assert.equal(scripts.filter((match) =>
      /\btype=["']module["']/iu.test(`${match[1]} ${match[3]}`)).length, 0);
    assert.equal(scripts.filter((match) =>
      match[2].split("?")[0] ===
        `${contract.output.directory}${contract.output.runtimeFile}`).length, 1);
    assert.equal(scripts.filter((match) =>
      match[2].includes(`${contract.output.directory}${contract.output.activationDirectory}`)).length,
    contract.activationPositions.length);
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const logical = new LegacyScriptOrderReader(
      path.join(PROJECT_ROOT, "index.html"),
      { scriptAliases: aliases },
    ).read();
    assert.equal(logical.length, 424);
  }

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
  }
}

new StageThreeFishingFoundationRuntimeCheck().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
