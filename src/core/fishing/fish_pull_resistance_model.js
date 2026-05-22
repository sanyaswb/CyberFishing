class FishPullResistanceModel {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  calculate({
    dtSec,
    holdRatio,
    previousFishPullSpeedMetersPerSecond,
    playerPullPressureKg,
    fishWeightKg,
    totalFishForceKg,
    awayFromPlayerRatio,
    fishConfig,
    movementBlocked,
    actualSlackMeters = 0,
    lineTaut = true,
  } = {}) {
    const dt = Math.max(0, Number(dtSec) || 0);
    const weight = Math.max(0, Number(fishWeightKg) || 0);
    const retrieveConfig = fishConfig?.fishRetrieve || {};
    const modifiers = fishConfig?.pullResistance || {};
    const clampedHold = this.#clamp01(holdRatio);
    const playerPullPressure = this.#positive(playerPullPressureKg);
    const referencePullSpeed = this.#referencePullSpeed(
      modifiers,
      retrieveConfig,
    );
    const looseLineMeters = this.#positive(actualSlackMeters);
    const isLineTaut =
      lineTaut !== false &&
      looseLineMeters <= this.#looseLineToleranceMeters(retrieveConfig);

    const tautBodyResistance = isLineTaut
      ? weight *
        this.#positive(
          this.#setting(
            retrieveConfig,
            "tautBodyResistanceKgPerKg",
            this.#setting(retrieveConfig, "staticBodyResistanceKgPerKg", 0.1),
          ),
        ) *
        this.#positive(modifiers.staticMultiplier ?? 1)
      : 0;
    const activeAwayForce =
      this.#positive(totalFishForceKg) *
      this.#clamp01(awayFromPlayerRatio) *
      this.#positive(
        modifiers.activeAwayMultiplier ??
          this.#setting(retrieveConfig, "activeAwayForceMultiplier", 1),
      );
    const fishOpposition = tautBodyResistance + activeAwayForce;
    const surplusPull = isLineTaut
      ? Math.max(0, playerPullPressure - fishOpposition)
      : 0;
    const waterDragKgPerKgAtReferenceSpeed =
      this.#resolveWaterDragAtReferenceSpeed({
        retrieveConfig,
        referencePullSpeed,
      });
    const waterDragCapacity =
      weight *
      waterDragKgPerKgAtReferenceSpeed *
      this.#positive(modifiers.waterDragMultiplier ?? 1);
    const targetFishPullSpeed = this.#calculatePullSpeedFromSurplus({
      surplusPull,
      waterDragCapacity,
      referencePullSpeed,
    });
    const actualFishPullSpeed = this.#approachSpeed({
      current: this.#positive(previousFishPullSpeedMetersPerSecond),
      target: targetFishPullSpeed,
      dtSec: dt,
      retrieveConfig,
    });
    const pullSpeedRatio =
      referencePullSpeed > 0 ? Math.max(0, actualFishPullSpeed / referencePullSpeed) : 0;
    const waterDrag =
      weight *
      waterDragKgPerKgAtReferenceSpeed *
      this.#positive(modifiers.waterDragMultiplier ?? 1) *
      pullSpeedRatio *
      pullSpeedRatio;
    const positiveAcceleration =
      dt > 0
        ? Math.max(
            0,
            (actualFishPullSpeed -
              this.#positive(previousFishPullSpeedMetersPerSecond)) /
              dt,
          )
        : 0;
    const accelerationLimit = this.#positive(
      this.#setting(retrieveConfig, "pullAccelerationMetersPerSecond2", 4.0),
    );
    const accelerationRatio =
      accelerationLimit > 0
        ? this.#clamp01(positiveAcceleration / accelerationLimit)
        : positiveAcceleration > 0
          ? 1
          : 0;
    const accelerationLoad =
      weight *
      this.#positive(
        this.#setting(retrieveConfig, "startAccelerationLoadKgPerKg", 0.12),
      ) *
      this.#positive(modifiers.accelerationMultiplier ?? 1) *
      accelerationRatio;
    const pressureTransferRatio = this.#calculatePressureTransferRatio({
      weight,
      fishOpposition,
      playerPullPressure,
      movementBlocked,
      retrieveConfig,
    });
    const effectivePlayerPressure = isLineTaut
      ? playerPullPressure * pressureTransferRatio
      : 0;
    const blockedSurplusForce =
      movementBlocked && isLineTaut
        ? Math.max(0, playerPullPressure - effectivePlayerPressure)
        : 0;
    const passiveRetrieveTension =
      tautBodyResistance +
      effectivePlayerPressure +
      accelerationLoad +
      blockedSurplusForce;
    const lineTension = passiveRetrieveTension + activeAwayForce;
    const movementControlRatio =
      playerPullPressure > 0.001
        ? this.#clamp01(surplusPull / playerPullPressure)
        : 0;

    return new FishRetrieveResult({
      holdRatio: clampedHold,
      playerPullPressureKg: playerPullPressure,
      effectivePlayerPressureKg: effectivePlayerPressure,
      pressureTransferRatio,
      desiredPullSpeedMetersPerSecond: targetFishPullSpeed,
      actualPullSpeedMetersPerSecond: actualFishPullSpeed,
      pullIntentSpeedMetersPerSecond: 0,
      actualFishPullSpeedMetersPerSecond: actualFishPullSpeed,
      pullSpeedRatio,
      intentPullSpeedRatio: 0,
      movementAuthorityLoadKg: playerPullPressure,
      potentialWaterDragKg: waterDragCapacity,
      potentialAccelerationLoadKg: accelerationLoad,
      bodyResistanceKg: tautBodyResistance,
      tautBodyResistanceKg: tautBodyResistance,
      bodyStaticResistanceKg: tautBodyResistance,
      fishStaticResistanceKg: tautBodyResistance,
      waterDragKg: waterDrag,
      waterDragCapacityKg: waterDragCapacity,
      waterDragKgPerKgAtReferenceSpeed,
      accelerationLoadKg: accelerationLoad,
      accelerationRatio,
      startAccelerationLoadKgPerKg: this.#positive(
        this.#setting(retrieveConfig, "startAccelerationLoadKgPerKg", 0.12),
      ),
      positiveAccelerationMetersPerSecond2: positiveAcceleration,
      activeAwayForceKg: activeAwayForce,
      fishActiveForceAwayKg: activeAwayForce,
      passiveRetrieveTensionKg: passiveRetrieveTension,
      fishOppositionKg: fishOpposition,
      usefulPullForceKg: effectivePlayerPressure,
      movementControlRatio,
      retrieveSpeedMetersPerSecond: actualFishPullSpeed,
      terminalRetrieveSpeedMetersPerSecond: targetFishPullSpeed,
      terminalSpeedReached:
        targetFishPullSpeed > 0 &&
        actualFishPullSpeed >= targetFishPullSpeed - 0.001,
      surplusForceKg: surplusPull,
      blockedSurplusForceKg: blockedSurplusForce,
      lineTensionKg: lineTension,
      desiredMoveMeters: Math.max(0, actualFishPullSpeed * dt),
      movementBlocked: !!movementBlocked,
      actualSlackMeters: looseLineMeters,
      lineTaut: isLineTaut,
      balanceState: this.#resolveBalanceState({
        playerPullPressure,
        fishOpposition,
        surplusPull,
      }),
    });
  }

  #approachSpeed({ current, target, dtSec, retrieveConfig }) {
    const acceleration = this.#positive(
      this.#setting(retrieveConfig, "pullAccelerationMetersPerSecond2", 4.0),
    );
    if (acceleration <= 0 || dtSec <= 0) return this.#positive(target);

    const maxDelta = acceleration * dtSec;
    if (target > current) return Math.min(target, current + maxDelta);
    return Math.max(target, current - maxDelta);
  }

  #resolveBalanceState({ playerPullPressure, fishOpposition, surplusPull }) {
    if (playerPullPressure <= 0.001 && fishOpposition <= 0.001) return "idle";
    const epsilon = Math.max(0.001, Number(this.#config.balanceEpsilonKg) || 0.001);
    if (Math.abs(playerPullPressure - fishOpposition) <= epsilon) {
      return "balanced";
    }
    if (surplusPull <= 0.001) return "fish_away";
    return "retrieving";
  }

  #referencePullSpeed(modifiers, retrieveConfig) {
    return (
      this.#positive(
        this.#setting(
          retrieveConfig,
          "referencePullSpeedMetersPerSecond",
          1.2,
        ),
      ) * this.#positive(modifiers.referencePullSpeedMultiplier ?? 1)
    );
  }

  #resolveWaterDragAtReferenceSpeed({ retrieveConfig, referencePullSpeed }) {
    const direct = this.#setting(
      retrieveConfig,
      "waterDragKgPerKgAtReferenceSpeed",
      NaN,
    );
    if (Number.isFinite(Number(direct))) return this.#positive(direct);
    return 0.85;
  }

  #calculatePullSpeedFromSurplus({
    surplusPull,
    waterDragCapacity,
    referencePullSpeed,
  }) {
    if (surplusPull <= 0.001 || referencePullSpeed <= 0) return 0;
    const capacity = Math.max(0.001, waterDragCapacity);
    return referencePullSpeed * Math.sqrt(surplusPull / capacity);
  }

  #calculatePressureTransferRatio({
    weight,
    fishOpposition,
    playerPullPressure,
    movementBlocked,
    retrieveConfig,
  }) {
    if (playerPullPressure <= 0.001) return 0;
    if (movementBlocked) {
      return this.#clamp01(
        this.#setting(retrieveConfig, "blockedPlayerPressureTransferRatio", 1),
      );
    }

    const referenceWeight = Math.max(
      0.001,
      this.#setting(
        retrieveConfig,
        "playerPressureTransferReferenceWeightKg",
        0.5,
      ),
    );
    const minTransfer = this.#clamp01(
      this.#setting(retrieveConfig, "minPlayerPressureTransferRatio", 0.05),
    );
    const weightTransfer = weight / (weight + referenceWeight);
    const loadTransfer = fishOpposition / playerPullPressure;
    return this.#clamp01(Math.max(minTransfer, weightTransfer, loadTransfer));
  }

  #looseLineToleranceMeters(retrieveConfig) {
    return this.#positive(
      this.#setting(retrieveConfig, "looseLineTautToleranceMeters", 0.02),
    );
  }

  #setting(overrideConfig, key, defaultValue) {
    if (Number.isFinite(Number(overrideConfig?.[key]))) {
      return Number(overrideConfig[key]);
    }
    if (Number.isFinite(Number(this.#config?.[key]))) {
      return Number(this.#config[key]);
    }
    return defaultValue;
  }

  #positive(value) {
    return Math.max(0, Number(value) || 0);
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
