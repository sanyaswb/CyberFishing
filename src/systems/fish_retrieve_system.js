class FishRetrieveSystem {
  #model;

  constructor(config = {}) {
    this.#model = new FishPullResistanceModel(config || {});
  }

  calculate({
    dtSec,
    rodPullResult,
    forceData,
    movementBlocked = false,
  } = {}) {
    const fishWeightKg =
      Number(forceData?.fishWeightKg) ||
      Number(forceData?.debug?.fishWeightKg) ||
      0;
    const bodyStaticResistanceKg = this.#resolveBodyStaticResistance(forceData);
    const totalForceKg = Math.max(0, Number(forceData?.totalFishForceKg) || 0);
    const awayFromPlayerRatio = this.#resolveAwayFromPlayerRatio(forceData);
    const activeAwayKg = totalForceKg * awayFromPlayerRatio;

    return this.#model.calculate({
      dtSec,
      playerDemandForceKg: rodPullResult?.forceKg,
      fishWeightKg,
      fishActiveForceAwayKg: activeAwayKg,
      bodyStaticResistanceKg,
      fishConfig: forceData?.fishPhysicsConfig,
      movementBlocked,
    });
  }

  #resolveBodyStaticResistance(forceData) {
    const direct = Number(forceData?.bodyStaticResistanceKg);
    if (Number.isFinite(direct) && direct >= 0) return direct;

    const debugValue = Number(forceData?.debug?.bodyStaticResistanceKg);
    return Number.isFinite(debugValue) && debugValue >= 0 ? debugValue : undefined;
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
