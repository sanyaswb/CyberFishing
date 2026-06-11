class FishRetrieveSystem {
  #configSource;
  #calculator = new SimpleFightForceCalculator();
  #dragForceCalculator = new DragForceCalculator();

  constructor(configSource = {}) {
    this.#configSource = configSource || {};
  }

  calculate({
    dtSec,
    rodPullResult,
    forceData,
    fishCondition,
    lineDistanceMeters,
    landingDistanceMeters,
    movementBlocked = false,
    actualSlackMeters = 0,
    lineTaut = true,
    dragRatio = 0,
    dragLimitKg = 0,
    dragLocked = false,
    dragSupported = true,
    lineHasReserve = true,
  } = {}) {
    const water = this.#resolveWaterConfig();
    const tension = this.#resolveTensionConfig();
    const rodHold = this.#resolveRodHoldConfig();
    const frame = this.#calculator.calculate({
      fishWeightKg: this.#resolveFishWeight(forceData),
      fishBasePower: this.#positive(forceData?.fishBasePower, 1),
      fishBaseSpeed: this.#positive(forceData?.fishBaseSpeed, 1),
      fishStateForceMultiplier: this.#positive(
        forceData?.fishStateForceMultiplier,
        1,
      ),
      fishStateSpeedMultiplier: this.#positive(
        forceData?.fishStateSpeedMultiplier,
        1,
      ),
      directionMultiplier: this.#positive(
        forceData?.directionResistanceMultiplier,
        1,
      ),
      tautBodyResistancePerKg: water.tautBodyResistancePerKg,
      rodLimitKg: this.#positive(rodPullResult?.rodLimitKg),
      rodHoldTensionCeilingMultiplier:
        rodHold.tensionCeilingMultiplier,
      rodHoldKg: this.#resolvePlayerPullPressure(rodPullResult),
      rodAngleMultiplier: this.#ratio(forceData?.player?.anglePenalty, 1),
      holdTensionRatio: this.#ratio(rodPullResult?.holdTensionRatio, 1),
      movableHoldTensionCapRatio: tension.movableHoldTensionCapRatio,
      fishCanMoveTowardPlayer: true,
      waterMotionResistance: water.motionResistance,
      waterSpeedMultiplier: water.speedMultiplier,
    });
    const pixelsPerMeter = this.#resolvePixelsPerMeter();
    const dragFrame = this.#dragForceCalculator.calculate({
      fishOppositionKg: frame.fishOppositionKg,
      effectiveRodHoldKg: frame.effectiveRodHoldKg,
      awayDir: {
        x: Number(forceData?.awayDirX) || 0,
        y: Number(forceData?.awayDirY) || 0,
      },
      dragRatio,
      dragLimitKg,
      lineHasReserve,
      lineTaut,
      dragLocked,
      dragSupported,
      targetVelocity: {
        x: forceData?.modelFishEscapeVelocityX,
        y: forceData?.modelFishEscapeVelocityY,
      },
      waterMotionResistance: water.motionResistance,
      waterSpeedMultiplier: water.speedMultiplier,
      fishBaseSpeed: this.#positive(forceData?.fishBaseSpeed, 1),
      fishStateSpeedMultiplier: this.#positive(
        forceData?.fishStateSpeedMultiplier,
        1,
      ),
      pixelsPerMeter,
    });
    const dt = Math.max(0, Number(dtSec) || 0);
    const desiredMoveMeters = frame.towardPlayerSpeedMps * dt;
    const movementControlRatio =
      desiredMoveMeters > 0.001 && !movementBlocked ? 1 : 0;
    const balanceState = frame.netForceKg > 0
      ? "player_wins"
      : frame.netForceKg < 0
        ? "fish_wins"
        : "balanced";

    rodPullResult.effectiveForceKg = frame.effectiveRodHoldKg;
    rodPullResult.playerHoldTensionKg = frame.playerHoldTensionKg;
    rodPullResult.totalTensionKg = frame.totalTensionKg;
    rodPullResult.rodHoldMaxKg = frame.rodHoldMaxKg;
    rodPullResult.tensionCeilingMultiplier =
      frame.rodHoldTensionCeilingMultiplier;
    rodPullResult.tensionCeilingKg = frame.rodHoldTensionCeilingKg;
    rodPullResult.fishTensionKg = frame.fishTensionKg;

    return new FishRetrieveResult({
      holdRatio: this.#resolveHoldRatio(rodPullResult),
      playerPullPressureKg: this.#resolvePlayerPullPressure(rodPullResult),
      fishPassiveKg: frame.fishPassiveKg,
      fishActiveKg: frame.fishActiveKg,
      fishOppositionKg: frame.fishOppositionKg,
      fishTensionKg: frame.fishTensionKg,
      rodHoldTensionCeilingMultiplier:
        frame.rodHoldTensionCeilingMultiplier,
      rodHoldTensionCeilingKg: frame.rodHoldTensionCeilingKg,
      rodHoldMaxKg: frame.rodHoldMaxKg,
      effectiveRodHoldKg: frame.effectiveRodHoldKg,
      rawPlayerHoldTensionKg: frame.rawPlayerHoldTensionKg,
      movableHoldTensionCapKg: frame.movableHoldTensionCapKg,
      movableHoldTensionCapRatio: tension.movableHoldTensionCapRatio,
      movableHoldTensionCapApplied: frame.movableHoldTensionCapApplied,
      fishCanMoveTowardPlayer: true,
      playerHoldTensionKg: frame.playerHoldTensionKg,
      totalTensionKg: frame.totalTensionKg,
      netForceKg: frame.netForceKg,
      fishWonForceKg: dragFrame.fishWonForceKg,
      fishWonRadialForceKg: dragFrame.fishWonRadialForceKg,
      fishWonYForceKg: dragFrame.fishWonYForceKg,
      yAwayRatio: dragFrame.yAwayRatio,
      dragBlockedForceKg: dragFrame.dragBlockedForceKg,
      radialEscapeForceKg: dragFrame.radialEscapeForceKg,
      radialSpeedPxPerSec: dragFrame.radialSpeedPxPerSec,
      outwardRadialSpeedPxPerSec:
        dragFrame.outwardRadialSpeedPxPerSec,
      tangentSpeedPxPerSec: dragFrame.tangentSpeedPxPerSec,
      excessYForceKg: dragFrame.excessYForceKg,
      yEscapeForceKg: dragFrame.yEscapeForceKg,
      shouldSlipDrag: dragFrame.shouldSlipDrag,
      speedMps: frame.speedMps,
      towardPlayerSpeedMps: frame.towardPlayerSpeedMps,
      awaySpeedMps: frame.awaySpeedMps,
      desiredMoveMeters,
      movementControlRatio,
      movementBlocked,
      balanceState,
      actualSlackMeters,
      lineTaut,
    });
  }

  reset() {
  }

  #resolveWaterConfig() {
    const source = this.#configSource;
    const water = source?.getWaterConfig?.() || source?.water || {};
    return {
      tautBodyResistancePerKg: this.#positive(
        water.tautBodyResistancePerKg,
        0.2,
      ),
      motionResistance: this.#positive(water.motionResistance, 1000),
      speedMultiplier: this.#positive(water.speedMultiplier, 64),
    };
  }

  #resolveTensionConfig() {
    const source = this.#configSource;
    const tension = source?.getFightTensionConfig?.() || source?.tension || {};
    return {
      movableHoldTensionCapRatio: this.#positive(
        tension.movableHoldTensionCapRatio,
        1,
      ),
    };
  }

  #resolveRodHoldConfig() {
    const source = this.#configSource;
    const rodHold = source?.getRodHoldConfig?.() || source?.rodHold || {};
    return {
      tensionCeilingMultiplier: this.#positive(
        rodHold.tensionCeilingMultiplier,
        1,
      ),
    };
  }

  #resolvePixelsPerMeter() {
    const source = this.#configSource;
    return Math.max(
      1,
      Number(source?.getPixelsPerMeter?.()) ||
        Number(source?.pixelsPerMeter) ||
        50,
    );
  }

  #resolveHoldRatio(rodPullResult) {
    if (!rodPullResult?.active) return 0;
    return Math.max(
      0,
      Math.min(
        1,
        Number(rodPullResult.holdRatio ?? rodPullResult.ratio) || 0,
      ),
    );
  }

  #resolveFishWeight(forceData) {
    return Math.max(
      0,
      Number(forceData?.fishWeightKg) ||
        Number(forceData?.debug?.fishWeightKg) ||
        0,
    );
  }

  #resolvePlayerPullPressure(rodPullResult) {
    if (!rodPullResult?.active) return 0;
    return Math.max(0, Number(rodPullResult.forceKg) || 0);
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, number);
    return Math.max(0, Number(fallback) || 0);
  }

  #ratio(value, fallback = 1) {
    return Math.max(0, Math.min(1, this.#positive(value, fallback)));
  }
}
