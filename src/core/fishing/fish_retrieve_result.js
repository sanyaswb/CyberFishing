class FishRetrieveResult {
  constructor(data = {}) {
    this.holdRatio = this.#ratio(data.holdRatio);
    this.desiredPullSpeedMetersPerSecond = this.#positive(
      data.desiredPullSpeedMetersPerSecond,
    );
    this.actualPullSpeedMetersPerSecond = this.#positive(
      data.actualPullSpeedMetersPerSecond,
    );
    this.actualFishPullSpeedMetersPerSecond = this.#positive(
      data.actualFishPullSpeedMetersPerSecond,
    );
    this.bodyResistanceKg = this.#positive(
      data.bodyResistanceKg ?? data.bodyStaticResistanceKg,
    );
    this.bodyStaticResistanceKg = this.bodyResistanceKg;
    this.fishStaticResistanceKg = this.bodyResistanceKg;
    this.waterDragKg = this.#positive(data.waterDragKg);
    this.accelerationLoadKg = this.#positive(data.accelerationLoadKg);
    this.positiveAccelerationMetersPerSecond2 = this.#positive(
      data.positiveAccelerationMetersPerSecond2,
    );
    this.activeAwayForceKg = this.#positive(
      data.activeAwayForceKg ?? data.fishActiveForceAwayKg,
    );
    this.fishActiveForceAwayKg = this.activeAwayForceKg;
    this.passiveRetrieveTensionKg = this.#positive(
      data.passiveRetrieveTensionKg,
    );
    this.movementControlRatio = this.#ratio(data.movementControlRatio);
    this.lineTensionKg = this.#positive(data.lineTensionKg);
    this.desiredMoveMeters = this.#positive(data.desiredMoveMeters);
    this.appliedMoveMeters = this.#positive(data.appliedMoveMeters);
    this.movementBlocked = !!data.movementBlocked;
    this.balanceState = data.balanceState || "idle";

    this.fishOppositionKg = this.#positive(data.fishOppositionKg);
    this.usefulPullForceKg = this.#positive(
      data.usefulPullForceKg ?? data.passiveRetrieveTensionKg,
    );
    this.retrieveSpeedMetersPerSecond = this.#positive(
      data.retrieveSpeedMetersPerSecond ??
        data.actualFishPullSpeedMetersPerSecond,
    );
    this.terminalRetrieveSpeedMetersPerSecond = this.#positive(
      data.terminalRetrieveSpeedMetersPerSecond,
    );
    this.terminalSpeedReached = !!data.terminalSpeedReached;
    this.surplusForceKg = this.#positive(data.surplusForceKg);
  }

  withAppliedMovement({ appliedMoveMeters, movementBlocked } = {}) {
    return new FishRetrieveResult({
      ...this,
      appliedMoveMeters,
      movementBlocked,
    });
  }

  #positive(value) {
    return Math.max(0, Number(value) || 0);
  }

  #ratio(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
