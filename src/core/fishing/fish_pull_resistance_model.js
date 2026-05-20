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
    const pullActive = clampedHold > 0.001 || actualPullSpeed > 0.001;
    const bodyResistance = pullActive
      ? weight *
        this.#positive(
          this.#setting(
            retrieveConfig,
            "staticBodyResistanceKgPerKg",
            0.1,
          ),
        ) *
        this.#positive(modifiers.staticMultiplier ?? 1)
      : 0;
    const waterDrag =
      weight *
      this.#positive(
        this.#setting(retrieveConfig, "waterDragKgPerKgPerMps2", 0.7),
      ) *
      this.#positive(modifiers.waterDragMultiplier ?? 1) *
      actualPullSpeed *
      actualPullSpeed;
    const accelerationLoad =
      weight *
      this.#positive(
        this.#setting(
          retrieveConfig,
          "accelerationResistanceKgPerKgPerMps2",
          0.08,
        ),
      ) *
      this.#positive(modifiers.accelerationMultiplier ?? 1) *
      positiveAcceleration;
    const passiveRetrieveTension =
      bodyResistance + waterDrag + accelerationLoad;
    const activeAwayForce =
      this.#positive(totalFishForceKg) *
      this.#clamp01(awayFromPlayerRatio) *
      this.#positive(modifiers.activeAwayMultiplier ?? 1);
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
      bodyResistanceKg: bodyResistance,
      bodyStaticResistanceKg: bodyResistance,
      fishStaticResistanceKg: bodyResistance,
      waterDragKg: waterDrag,
      accelerationLoadKg: accelerationLoad,
      positiveAccelerationMetersPerSecond2: positiveAcceleration,
      activeAwayForceKg: activeAwayForce,
      fishActiveForceAwayKg: activeAwayForce,
      passiveRetrieveTensionKg: passiveRetrieveTension,
      fishOppositionKg: bodyResistance + activeAwayForce,
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
