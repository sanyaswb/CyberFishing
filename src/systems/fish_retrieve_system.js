class FishRetrieveSystem {
  #configSource;
  #model;

  constructor(configSource = {}) {
    this.#configSource = configSource || {};
    this.#model = new FishPullResistanceModel(() => this.#resolveRetrieveConfig());
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
    const holdRatio = this.#resolveHoldRatio(rodPullResult);
    const fishWeightKg = this.#resolveFishWeight(forceData);

    return this.#model.calculate({
      dtSec,
      holdRatio,
      playerPullPressureKg: this.#resolvePlayerPullPressure(rodPullResult),
      fishWeightKg,
      totalFishForceKg: Math.max(0, Number(forceData?.totalFishForceKg) || 0),
      awayFromPlayerRatio: this.#resolveAwayFromPlayerRatio(forceData),
      fishConfig: forceData?.fishPhysicsConfig,
      fishCondition,
      lineDistanceMeters,
      landingDistanceMeters,
      movementBlocked,
      actualSlackMeters,
      lineTaut,
    });
  }

  reset() {
  }

  #resolveRetrieveConfig() {
    const source = this.#configSource;
    if (source?.getFishRetrieveSettings) return source.getFishRetrieveSettings();
    if (source?.getFishRetrieveConfig) return source.getFishRetrieveConfig();
    return source || {};
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
}
