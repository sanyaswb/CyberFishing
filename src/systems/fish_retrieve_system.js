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
    const staticResistanceKg = this.#resolveStaticResistance(forceData);
    const totalForceKg = Math.max(0, Number(forceData?.totalFishForceKg) || 0);
    const activeAwayKg = Math.max(0, totalForceKg - staticResistanceKg);

    return this.#model.calculate({
      dtSec,
      playerDemandForceKg: rodPullResult?.forceKg,
      fishWeightKg,
      fishActiveForceAwayKg: activeAwayKg,
      fishStaticResistanceKg: staticResistanceKg,
      fishConfig: forceData?.fishPhysicsConfig,
      movementBlocked,
    });
  }

  #resolveStaticResistance(forceData) {
    const explicit = Number(forceData?.staticFishForceKg);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    const debugValue = Number(forceData?.debug?.staticFishForceKg);
    return Number.isFinite(debugValue) && debugValue >= 0 ? debugValue : 0;
  }
}
