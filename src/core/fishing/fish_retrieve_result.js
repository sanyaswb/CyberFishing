class FishRetrieveResult {
  constructor(data = {}) {
    this.holdRatio = this.#ratio(data.holdRatio);
    this.playerPullPressureKg = this.#positive(data.playerPullPressureKg);
    this.effectivePlayerPressureKg = this.#positive(
      data.effectivePlayerPressureKg,
    );
    this.pressureTransferRatio = this.#ratio(data.pressureTransferRatio);
    this.desiredPullSpeedMetersPerSecond = this.#positive(
      data.desiredPullSpeedMetersPerSecond,
    );
    this.actualPullSpeedMetersPerSecond = this.#positive(
      data.actualPullSpeedMetersPerSecond,
    );
    this.pullIntentSpeedMetersPerSecond = this.#positive(
      data.pullIntentSpeedMetersPerSecond ?? data.actualPullSpeedMetersPerSecond,
    );
    this.actualFishPullSpeedMetersPerSecond = this.#positive(
      data.actualFishPullSpeedMetersPerSecond,
    );
    this.bodyResistanceKg = this.#positive(
      data.bodyResistanceKg ?? data.tautBodyResistanceKg ?? data.bodyStaticResistanceKg,
    );
    this.tautBodyResistanceKg = this.bodyResistanceKg;
    this.bodyStaticResistanceKg = this.bodyResistanceKg;
    this.fishStaticResistanceKg = this.bodyResistanceKg;
    this.waterDragKg = this.#positive(data.waterDragKg);
    this.waterDragKgPerKgAtReferenceSpeed = this.#positive(
      data.waterDragKgPerKgAtReferenceSpeed,
    );
    this.waterDragCapacityKg = this.#positive(data.waterDragCapacityKg);
    this.pullSpeedRatio = this.#ratio(data.pullSpeedRatio);
    this.intentPullSpeedRatio = this.#ratio(data.intentPullSpeedRatio);
    this.movementAuthorityLoadKg = this.#positive(data.movementAuthorityLoadKg);
    this.potentialWaterDragKg = this.#positive(data.potentialWaterDragKg);
    this.potentialAccelerationLoadKg = this.#positive(data.potentialAccelerationLoadKg);
    this.accelerationLoadKg = this.#positive(data.accelerationLoadKg);
    this.accelerationRatio = this.#ratio(data.accelerationRatio);
    this.startAccelerationLoadKgPerKg = this.#positive(
      data.startAccelerationLoadKgPerKg,
    );
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
    this.blockedSurplusForceKg = this.#positive(data.blockedSurplusForceKg);
    this.actualSlackMeters = this.#positive(data.actualSlackMeters);
    this.lineTaut = data.lineTaut !== false;
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
