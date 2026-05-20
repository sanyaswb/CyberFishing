class FishRetrieveSystem {
  #model;
  #pullSpeedMetersPerSecond = 0;

  constructor(config = {}) {
    this.#model = new FishPullResistanceModel(config || {});
  }

  calculate({
    dtSec,
    rodPullResult,
    forceData,
    movementBlocked = false,
  } = {}) {
    const holdRatio = this.#resolveHoldRatio(rodPullResult);
    if (!rodPullResult?.active && holdRatio <= 0) {
      this.#pullSpeedMetersPerSecond = 0;
    }

    const result = this.#model.calculate({
      dtSec,
      holdRatio,
      previousPullSpeedMetersPerSecond: this.#pullSpeedMetersPerSecond,
      fishWeightKg: this.#resolveFishWeight(forceData),
      totalFishForceKg: Math.max(0, Number(forceData?.totalFishForceKg) || 0),
      awayFromPlayerRatio: this.#resolveAwayFromPlayerRatio(forceData),
      fishConfig: forceData?.fishPhysicsConfig,
      movementBlocked,
    });
    this.#pullSpeedMetersPerSecond = result.actualPullSpeedMetersPerSecond;
    return result;
  }

  reset() {
    this.#pullSpeedMetersPerSecond = 0;
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

  #resolveAwayFromPlayerRatio(forceData) {
    const direct = Number(forceData?.awayFromPlayerRatio);
    if (Number.isFinite(direct)) return Math.max(0, Math.min(1, direct));

    const debugValue = Number(forceData?.debug?.awayFromPlayerRatio);
    return Number.isFinite(debugValue)
      ? Math.max(0, Math.min(1, debugValue))
      : 1;
  }
}
