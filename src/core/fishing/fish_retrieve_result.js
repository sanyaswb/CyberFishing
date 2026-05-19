class FishRetrieveResult {
  constructor(data = {}) {
    this.playerDemandForceKg = this.#positive(data.playerDemandForceKg);
    this.fishActiveForceAwayKg = this.#positive(data.fishActiveForceAwayKg);
    this.bodyStaticResistanceKg = this.#positive(data.bodyStaticResistanceKg ?? data.fishStaticResistanceKg);
    this.fishStaticResistanceKg = this.bodyStaticResistanceKg;
    this.fishOppositionKg = this.#positive(data.fishOppositionKg);
    this.waterDragKg = this.#positive(data.waterDragKg);
    this.usefulPullForceKg = this.#positive(data.usefulPullForceKg);
    this.retrieveSpeedMetersPerSecond = this.#positive(
      data.retrieveSpeedMetersPerSecond,
    );
    this.terminalRetrieveSpeedMetersPerSecond = this.#positive(
      data.terminalRetrieveSpeedMetersPerSecond,
    );
    this.terminalSpeedReached = !!data.terminalSpeedReached;
    this.surplusForceKg = this.#positive(data.surplusForceKg);
    this.lineTensionKg = this.#positive(data.lineTensionKg);
    this.desiredMoveMeters = this.#positive(data.desiredMoveMeters);
    this.appliedMoveMeters = this.#positive(data.appliedMoveMeters);
    this.movementBlocked = !!data.movementBlocked;
    this.balanceState = data.balanceState || "idle";
  }

  withAppliedMovement({ appliedMoveMeters, movementBlocked } = {}) {
    return new FishRetrieveResult({
      ...this,
      appliedMoveMeters,
      movementBlocked,
      lineTensionKg: this.lineTensionKg,
    });
  }

  #positive(value) {
    return Math.max(0, Number(value) || 0);
  }
}
