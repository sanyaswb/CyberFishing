class FishRetrieveSystem {
  #configSource;
  #calculator = new SimpleFightForceCalculator();

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
  } = {}) {
    const water = this.#resolveWaterConfig();
    const tension = this.#resolveTensionConfig();
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
      rodHoldKg: this.#resolvePlayerPullPressure(rodPullResult),
      rodAngleMultiplier: this.#ratio(forceData?.player?.anglePenalty, 1),
      holdTensionRatio: this.#ratio(rodPullResult?.holdTensionRatio, 1),
      movableHoldTensionCapRatio: tension.movableHoldTensionCapRatio,
      fishCanMoveTowardPlayer: true,
      waterMotionResistance: water.motionResistance,
      waterSpeedMultiplier: water.speedMultiplier,
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
    rodPullResult.fishTensionKg = frame.fishTensionKg;

    return new FishRetrieveResult({
      holdRatio: this.#resolveHoldRatio(rodPullResult),
      playerPullPressureKg: this.#resolvePlayerPullPressure(rodPullResult),
      bodyResistanceKg: frame.fishPassiveKg,
      activeAwayForceKg: frame.fishActiveKg,
      fishOppositionKg: frame.fishOppositionKg,
      usefulPullForceKg: frame.effectiveRodHoldKg,
      lineTensionKg: frame.totalTensionKg,
      desiredMoveMeters,
      retrieveSpeedMetersPerSecond: frame.speedMps,
      actualFishPullSpeedMetersPerSecond: frame.towardPlayerSpeedMps,
      targetFishPullSpeedMetersPerSecond: frame.towardPlayerSpeedMps,
      movementControlRatio,
      movementBlocked,
      balanceState,
      actualSlackMeters,
      lineTaut,
      fishPassiveKg: frame.fishPassiveKg,
      fishActiveKg: frame.fishActiveKg,
      fishTensionKg: frame.fishTensionKg,
      rodHoldMaxKg: frame.rodHoldMaxKg,
      effectiveRodHoldKg: frame.effectiveRodHoldKg,
      playerHoldTensionKg: frame.playerHoldTensionKg,
      rawPlayerHoldTensionKg: frame.rawPlayerHoldTensionKg,
      movableHoldTensionCapKg: frame.movableHoldTensionCapKg,
      movableHoldTensionCapRatio: tension.movableHoldTensionCapRatio,
      movableHoldTensionCapApplied: frame.movableHoldTensionCapApplied,
      fishCanMoveTowardPlayer: true,
      totalTensionKg: frame.totalTensionKg,
      netForceKg: frame.netForceKg,
      speedMps: frame.speedMps,
      towardPlayerSpeedMps: frame.towardPlayerSpeedMps,
      awaySpeedMps: frame.awaySpeedMps,
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

  #resolveAwayFromPlayerRatio(forceData) {
    const direct = Number(forceData?.awayFromPlayerRatio);
    if (Number.isFinite(direct)) return Math.max(0, Math.min(1, direct));

    const debugValue = Number(forceData?.debug?.awayFromPlayerRatio);
    return Number.isFinite(debugValue)
      ? Math.max(0, Math.min(1, debugValue))
      : 1;
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
