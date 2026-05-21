class FishPullResistanceModel {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  calculate({
    dtSec,
    holdRatio,
    previousPullSpeedMetersPerSecond,
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
    const maxPullSpeed = this.#maxPullSpeed(modifiers, retrieveConfig);
    const desiredPullSpeed = clampedHold * maxPullSpeed;
    const previousSpeed = this.#positive(previousPullSpeedMetersPerSecond);
    const actualPullSpeed = this.#approachSpeed({
      current: previousSpeed,
      target: desiredPullSpeed,
      dtSec: dt,
      retrieveConfig,
    });
    const positiveAcceleration = dt > 0
      ? Math.max(0, (actualPullSpeed - previousSpeed) / dt)
      : 0;
    const accelerationLimit = this.#positive(
      this.#setting(retrieveConfig, "pullAccelerationMetersPerSecond2", 4.0),
    );
    const accelerationRatio = accelerationLimit > 0
      ? this.#clamp01(positiveAcceleration / accelerationLimit)
      : (positiveAcceleration > 0 ? 1 : 0);
    const looseLineMeters = this.#positive(actualSlackMeters);
    const hasRealLooseLine = looseLineMeters > this.#looseLineToleranceMeters(retrieveConfig);
    const isLineTaut = lineTaut !== false && !hasRealLooseLine;

    // Baseline static load: a fish in water is not a hanging weight, but a taut
    // line should still carry a small body resistance even before the player
    // starts pulling. This is intentionally separate from active fish force.
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

    const pullSpeedRatio = maxPullSpeed > 0
      ? this.#clamp01(actualPullSpeed / maxPullSpeed)
      : 0;
    const waterDragKgPerKgAtFullSpeed = this.#resolveWaterDragAtFullSpeed({
      retrieveConfig,
      maxPullSpeed,
    });
    const waterDrag =
      weight *
      waterDragKgPerKgAtFullSpeed *
      this.#positive(modifiers.waterDragMultiplier ?? 1) *
      pullSpeedRatio *
      pullSpeedRatio;
    const accelerationLoad =
      weight *
      this.#positive(
        this.#setting(retrieveConfig, "startAccelerationLoadKgPerKg", 0.12),
      ) *
      this.#positive(modifiers.accelerationMultiplier ?? 1) *
      accelerationRatio;
    const passiveRetrieveTension =
      tautBodyResistance + waterDrag + accelerationLoad;
    const activeAwayForce =
      this.#positive(totalFishForceKg) *
      this.#clamp01(awayFromPlayerRatio) *
      this.#positive(
        modifiers.activeAwayMultiplier ??
          this.#setting(retrieveConfig, "activeAwayForceMultiplier", 1),
      );
    const movementControlRatio = this.#calculateControlRatio({
      passiveRetrieveTension,
      activeAwayForce,
      actualPullSpeed,
    });
    const actualFishPullSpeed = actualPullSpeed * movementControlRatio;
    const lineTension = passiveRetrieveTension + activeAwayForce;

    return new FishRetrieveResult({
      holdRatio: clampedHold,
      desiredPullSpeedMetersPerSecond: desiredPullSpeed,
      actualPullSpeedMetersPerSecond: actualPullSpeed,
      actualFishPullSpeedMetersPerSecond: actualFishPullSpeed,
      pullSpeedRatio,
      bodyResistanceKg: tautBodyResistance,
      tautBodyResistanceKg: tautBodyResistance,
      bodyStaticResistanceKg: tautBodyResistance,
      fishStaticResistanceKg: tautBodyResistance,
      waterDragKg: waterDrag,
      waterDragKgPerKgAtFullSpeed,
      accelerationLoadKg: accelerationLoad,
      accelerationRatio,
      startAccelerationLoadKgPerKg: this.#positive(
        this.#setting(retrieveConfig, "startAccelerationLoadKgPerKg", 0.12),
      ),
      positiveAccelerationMetersPerSecond2: positiveAcceleration,
      activeAwayForceKg: activeAwayForce,
      fishActiveForceAwayKg: activeAwayForce,
      passiveRetrieveTensionKg: passiveRetrieveTension,
      fishOppositionKg: tautBodyResistance + activeAwayForce,
      usefulPullForceKg: passiveRetrieveTension,
      movementControlRatio,
      retrieveSpeedMetersPerSecond: actualFishPullSpeed,
      terminalRetrieveSpeedMetersPerSecond: maxPullSpeed,
      terminalSpeedReached:
        maxPullSpeed > 0 && actualPullSpeed >= maxPullSpeed - 0.001,
      surplusForceKg: 0,
      lineTensionKg: lineTension,
      desiredMoveMeters: Math.max(0, actualFishPullSpeed * dt),
      movementBlocked: !!movementBlocked,
      actualSlackMeters: looseLineMeters,
      lineTaut: isLineTaut,
      balanceState: this.#resolveBalanceState({
        passiveRetrieveTension,
        activeAwayForce,
        actualPullSpeed,
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

  #calculateControlRatio({
    passiveRetrieveTension,
    activeAwayForce,
    actualPullSpeed,
  }) {
    if (actualPullSpeed <= 0.001) return 0;
    if (passiveRetrieveTension <= 0.001) {
      return activeAwayForce > 0.001 ? 0 : 1;
    }
    return this.#clamp01(
      (passiveRetrieveTension - activeAwayForce) / passiveRetrieveTension,
    );
  }

  #resolveBalanceState({
    passiveRetrieveTension,
    activeAwayForce,
    actualPullSpeed,
  }) {
    if (actualPullSpeed <= 0.001 && activeAwayForce <= 0.001) return "idle";
    const epsilon = Math.max(0.001, Number(this.#config.balanceEpsilonKg) || 0.001);
    if (Math.abs(passiveRetrieveTension - activeAwayForce) <= epsilon) {
      return "balanced";
    }
    if (activeAwayForce > passiveRetrieveTension) return "fish_away";
    return "retrieving";
  }

  #maxPullSpeed(modifiers, retrieveConfig) {
    return this.#positive(
      this.#setting(retrieveConfig, "maxPullSpeedMetersPerSecond", 1.4),
    ) * this.#positive(modifiers.maxPullSpeedMultiplier ?? 1);
  }

  #resolveWaterDragAtFullSpeed({ retrieveConfig, maxPullSpeed }) {
    const direct = this.#setting(retrieveConfig, "waterDragKgPerKgAtFullSpeed", NaN);
    if (Number.isFinite(Number(direct))) return this.#positive(direct);

    // Legacy fallback for older configs. The old value was per kg per (m/s)^2,
    // so convert it into the new human-facing “at full speed” unit.
    const legacy = this.#setting(retrieveConfig, "waterDragKgPerKgPerMps2", NaN);
    if (Number.isFinite(Number(legacy))) {
      return this.#positive(legacy) * maxPullSpeed * maxPullSpeed;
    }
    return 0.7;
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
