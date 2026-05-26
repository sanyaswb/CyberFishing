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
    this.targetFishPullSpeedMetersPerSecond = this.#positive(
      data.targetFishPullSpeedMetersPerSecond ??
        data.desiredPullSpeedMetersPerSecond,
    );
    this.bodyResistanceKg = this.#positive(
      data.bodyResistanceKg ?? data.tautBodyResistanceKg ?? data.bodyStaticResistanceKg,
    );
    this.landingLiftRatio = this.#ratio(data.landingLiftRatio);
    this.landingLiftLoadKg = this.#positive(data.landingLiftLoadKg);
    this.landingZoneActive = !!data.landingZoneActive;
    this.landingFullyExhausted = !!data.landingFullyExhausted;
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
    this.fishPassiveKg = this.#positive(data.fishPassiveKg ?? this.bodyResistanceKg);
    this.fishActiveKg = this.#positive(data.fishActiveKg ?? this.activeAwayForceKg);
    this.fishTensionKg = this.#positive(data.fishTensionKg);
    this.rodHoldMaxKg = this.#positive(data.rodHoldMaxKg);
    this.effectiveRodHoldKg = this.#positive(data.effectiveRodHoldKg);
    this.rawPlayerHoldTensionKg = this.#positive(
      data.rawPlayerHoldTensionKg ?? data.playerHoldTensionKg,
    );
    this.movableHoldTensionCapKg = this.#positive(
      data.movableHoldTensionCapKg,
    );
    this.movableHoldTensionCapRatio = this.#positive(
      data.movableHoldTensionCapRatio ?? 1,
    );
    this.movableHoldTensionCapApplied =
      !!data.movableHoldTensionCapApplied;
    this.fishCanMoveTowardPlayer = data.fishCanMoveTowardPlayer !== false;
    this.playerHoldTensionKg = this.#positive(data.playerHoldTensionKg);
    this.totalTensionKg = this.#positive(data.totalTensionKg ?? this.lineTensionKg);
    this.netForceKg = Number.isFinite(Number(data.netForceKg))
      ? Number(data.netForceKg)
      : 0;
    this.speedMps = this.#positive(data.speedMps);
    this.towardPlayerSpeedMps = this.#positive(data.towardPlayerSpeedMps);
    this.awaySpeedMps = this.#positive(data.awaySpeedMps);
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
    if (!!movementBlocked && this.movableHoldTensionCapApplied) {
      const playerHoldTensionKg = this.rawPlayerHoldTensionKg;
      const totalTensionKg = this.fishTensionKg + playerHoldTensionKg;
      return new FishRetrieveResult({
        ...this,
        appliedMoveMeters,
        movementBlocked,
        fishCanMoveTowardPlayer: false,
        movableHoldTensionCapApplied: false,
        playerHoldTensionKg,
        lineTensionKg: totalTensionKg,
        totalTensionKg,
      });
    }

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
