class RodPullCalculator {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  calculateAvailableDistance({ rodLengthMeters, pumpCreditMeters, slackMeters, fishDistanceMeters }) {
    const maxDistanceMeters = this.calculateMaxDistance({ rodLengthMeters });
    const creditValue = pumpCreditMeters ?? slackMeters;
    const pumpCreditPenalty = this.#config.pumpCreditReducesNextPullDistance === false || this.#config.slackReducesNextPullDistance === false
      ? 0
      : Math.max(0, Number(creditValue) || 0);
    const available = Math.max(0, maxDistanceMeters - pumpCreditPenalty);
    const distanceToFish = Math.max(0, Number(fishDistanceMeters) || 0);
    const finalLandingDistance = Math.max(
      0,
      Number(this.#config.finalLandingDistanceMeters) || 0,
    );
    if (
      available <= 0 &&
      distanceToFish > 0 &&
      finalLandingDistance > 0 &&
      distanceToFish <= finalLandingDistance
    ) {
      return Math.min(maxDistanceMeters, distanceToFish);
    }
    return available;
  }

  calculateMaxDistance({ rodLengthMeters }) {
    const multiplier = Number(this.#config.distanceMultiplierByRodLength);
    return Math.max(0, (Number(rodLengthMeters) || 0) * (Number.isFinite(multiplier) ? multiplier : 1));
  }

  // New-model contract: RodPullCalculator owns only player demand + rod stroke.
  // Drag slip and final line tension are resolved later by FishRetrieveSystem + TensionSystem.
  calculateForceLimit({ maxTackleLoadKg } = {}) {
    const maxLoad = Math.max(0, Number(maxTackleLoadKg) || 0);
    const controlledLoad = this.#controlledPullLimitKg(maxLoad);
    return {
      availableExtraForceKg: controlledLoad,
      controlledPullLimitKg: controlledLoad,
      dragSlipping: false,
      blockedReason: "none",
    };
  }

  calculateNextState({
    dtSec,
    input,
    previousState,
    rodLengthMeters,
    pumpCreditMeters,
    slackMeters,
    maxTackleLoadKg,
    hardLineLimit,
    lineHasReserve = true,
    fishDistanceMeters,
  }) {
    const maxDistanceMeters = this.calculateMaxDistance({ rodLengthMeters });
    const availableDistanceMeters = this.calculateAvailableDistance({
      rodLengthMeters,
      pumpCreditMeters,
      slackMeters,
      fishDistanceMeters,
    });
    const releasedThisFrame = !!input?.pullReleasedThisFrame;
    const held = !!input?.pullHeld;
    const minDistance = Math.max(
      0,
      Number(this.#config.minStrokeMeters ?? this.#config.minPullDistanceMeters) || 0.001,
    );

    if (releasedThisFrame || !held || this.#config.enabled === false) {
      return this.#buildResult({
        active: false,
        releasedThisFrame,
        maxDistanceMeters,
        availableDistanceMeters,
        blockedReason: held ? "disabled" : "none",
        lineHasReserve: this.#lineHasReserve(lineHasReserve),
        canReleaseLine: this.#lineHasReserve(lineHasReserve),
        spoolEmpty: !this.#lineHasReserve(lineHasReserve),
      });
    }

    const lineCanRelease = this.#lineHasReserve(lineHasReserve);
    const forceLimit = this.calculateForceLimit({ maxTackleLoadKg });
    const prevDistance = Math.max(0, Number(previousState?.distanceMeters) || 0);
    const prevRatio = Math.max(0, Math.min(1, Number(previousState?.ratio) || 0));

    if (availableDistanceMeters < minDistance) {
      return this.#buildResult({
        active: true,
        maxDistanceMeters,
        availableDistanceMeters,
        availableExtraForceKg: forceLimit.availableExtraForceKg,
        blockedReason: "pump_credit_too_high",
        lineHasReserve: lineCanRelease,
        canReleaseLine: lineCanRelease,
        spoolEmpty: !lineCanRelease,
      });
    }

    const dt = Math.max(0, Number(dtSec) || 0);
    const chargePerSecond = Math.max(
      0,
      Number(this.#config.strokeChargePerSecond ?? this.#config.chargePerSecond) || 0.65,
    );
    const chargedRatio = Math.min(1, prevRatio + chargePerSecond * dt);
    const nextRatio = chargedRatio;
    const distanceMeters = Math.min(availableDistanceMeters, nextRatio * availableDistanceMeters);
    const deltaMeters = Math.max(0, distanceMeters - prevDistance);
    const controlledLoad = this.#controlledPullLimitKg(maxTackleLoadKg);
    const forceKg = controlledLoad * nextRatio;
    let blockedReason = "none";

    if (hardLineLimit) {
      blockedReason = "hard_line_limit";
    }
    if (nextRatio >= 1 || distanceMeters >= availableDistanceMeters - minDistance) {
      blockedReason = "max_distance_reached";
    }

    return this.#buildResult({
      active: true,
      ratio: availableDistanceMeters > 0 ? Math.min(1, distanceMeters / availableDistanceMeters) : 0,
      distanceMeters,
      maxDistanceMeters,
      availableDistanceMeters,
      forceKg,
      availableExtraForceKg: forceLimit.availableExtraForceKg,
      totalTensionKg: forceKg,
      deltaMeters,
      canMoveFish: deltaMeters >= minDistance && forceKg > (Number(this.#config.minEffectivePullKg) || 0.01),
      blockedReason,
      chargeSpeedMultiplier: 1,
      chargePerSecond,
      lineHasReserve: lineCanRelease,
      canReleaseLine: lineCanRelease,
      spoolEmpty: !lineCanRelease,
    });
  }

  #buildResult(data) {
    const result = {
      active: !!data.active,
      ratio: Math.max(0, Math.min(1, Number(data.ratio) || 0)),
      forceKg: Math.max(0, Number(data.forceKg) || 0),
      distanceMeters: Math.max(0, Number(data.distanceMeters) || 0),
      maxDistanceMeters: Math.max(0, Number(data.maxDistanceMeters) || 0),
      availableDistanceMeters: Math.max(0, Number(data.availableDistanceMeters) || 0),
      availableExtraForceKg: Math.max(0, Number(data.availableExtraForceKg) || 0),
      totalTensionKg: Math.max(0, Number(data.totalTensionKg) || 0),
      deltaMeters: Math.max(0, Number(data.deltaMeters) || 0),
      canMoveFish: !!data.canMoveFish,
      blockedReason: data.blockedReason || "none",
      dragSlipping: false,
      releasedThisFrame: !!data.releasedThisFrame,
      releaseRecovering: !!data.releaseRecovering,
      releaseRecoveryRatio: Math.max(0, Math.min(1, Number(data.releaseRecoveryRatio) || 0)),
      chargeSpeedMultiplier: Math.max(0, Number(data.chargeSpeedMultiplier) || 0),
      chargePerSecond: Math.max(0, Number(data.chargePerSecond) || 0),
      lineHasReserve: data.lineHasReserve !== false,
      canReleaseLine: data.canReleaseLine !== false,
      spoolEmpty: !!data.spoolEmpty,
    };
    return result;
  }

  #lineHasReserve(value) {
    return value !== false;
  }

  #controlledPullLimitKg(maxTackleLoadKg) {
    const maxLoad = Math.max(0, Number(maxTackleLoadKg) || 0);
    const ratio = Number(this.#config.controlledPullLimitRatio);
    const safeRatio = Number.isFinite(ratio) && ratio > 0
      ? Math.min(1, ratio)
      : 0.85;
    return maxLoad * safeRatio;
  }
}
