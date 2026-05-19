class RodPullCalculator {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  calculateAvailableDistance({ rodLengthMeters, slackMeters, fishDistanceMeters }) {
    const maxDistanceMeters = this.calculateMaxDistance({ rodLengthMeters });
    const slackPenalty = this.#config.slackReducesNextPullDistance === false
      ? 0
      : Math.max(0, Number(slackMeters) || 0);
    const available = Math.max(0, maxDistanceMeters - slackPenalty);
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

  calculateForceLimit({
    fishForceKg,
    dragLimitKg,
    maxTackleLoadKg,
    dragLocked,
  }) {
    const fishForce = Math.max(0, Number(fishForceKg) || 0);
    const maxLoad = Math.max(0, Number(maxTackleLoadKg) || 0);
    const controlledLoad = this.#controlledPullLimitKg(maxLoad);
    if (dragLocked) {
      return {
        availableExtraForceKg: controlledLoad,
        dragSlipping: false,
        blockedReason: "none",
      };
    }

    const dragLimit = Math.max(0, Number(dragLimitKg) || 0);
    const availableExtra = Math.max(0, Math.min(controlledLoad, dragLimit - fishForce));
    return {
      availableExtraForceKg: availableExtra,
      dragSlipping: fishForce > dragLimit,
      blockedReason: fishForce > dragLimit ? "drag_slipping" : "none",
    };
  }

  calculateNextState({
    dtSec,
    input,
    previousState,
    rodLengthMeters,
    slackMeters,
    fishForceKg,
    dragLimitKg,
    maxTackleLoadKg,
    dragLocked,
    hardLineLimit,
    lineHasReserve = true,
    fishDistanceMeters,
  }) {
    const maxDistanceMeters = this.calculateMaxDistance({ rodLengthMeters });
    const availableDistanceMeters = this.calculateAvailableDistance({
      rodLengthMeters,
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
      });
    }

    const lineCanRelease = this.#lineHasReserve(lineHasReserve);
    const riskyNoReservePull = !lineCanRelease && !dragLocked;
    const forceLimit = this.calculateForceLimit({
      fishForceKg,
      dragLimitKg,
      maxTackleLoadKg,
      dragLocked: dragLocked || hardLineLimit || riskyNoReservePull,
    });
    const prevDistance = Math.max(0, Number(previousState?.distanceMeters) || 0);
    const prevRatio = Math.max(0, Math.min(1, Number(previousState?.ratio) || 0));

    if (availableDistanceMeters < minDistance) {
      return this.#buildResult({
        active: true,
        maxDistanceMeters,
        availableDistanceMeters,
        availableExtraForceKg: forceLimit.availableExtraForceKg,
        totalTensionKg: Math.max(0, Number(fishForceKg) || 0),
        blockedReason: "slack_too_high",
      });
    }

    if (lineCanRelease && !hardLineLimit && forceLimit.dragSlipping && this.#config.freezeWhenDragSlips !== false) {
      return this.#buildResult({
        active: true,
        ratio: prevRatio,
        distanceMeters: prevDistance,
        maxDistanceMeters,
        availableDistanceMeters,
        availableExtraForceKg: forceLimit.availableExtraForceKg,
        totalTensionKg: Math.max(0, Number(dragLimitKg) || 0),
        blockedReason: forceLimit.blockedReason,
        dragSlipping: true,
        lineHasReserve: lineCanRelease,
        canReleaseLine: lineCanRelease,
        spoolEmpty: !lineCanRelease,
      });
    }

    const dt = Math.max(0, Number(dtSec) || 0);
    const maxLoad = Math.max(0, Number(maxTackleLoadKg) || 0);
    const chargeMultiplier = this.#calculateChargeSpeedMultiplier({
      fishForceKg,
      maxTackleLoadKg: maxLoad,
      availableExtraForceKg: forceLimit.availableExtraForceKg,
      dragLocked,
      hardLineLimit,
      lineHasReserve: lineCanRelease,
    });
    const chargedRatio = Math.min(
      1,
      prevRatio +
        Math.max(
          0,
          Number(this.#config.strokeChargePerSecond ?? this.#config.chargePerSecond) || 0.65,
        ) *
          chargeMultiplier *
          dt,
    );
    const controlledLoadForRatio = this.#controlledPullLimitKg(maxLoad);
    const forceRatioLimit = dragLocked || hardLineLimit || !lineCanRelease || controlledLoadForRatio <= 0
      ? 1
      : this.#clamp01(forceLimit.availableExtraForceKg / Math.max(0.001, controlledLoadForRatio));
    const nextRatio = Math.min(chargedRatio, forceRatioLimit);
    const unclampedDistance = nextRatio * availableDistanceMeters;
    const distanceMeters = Math.min(availableDistanceMeters, unclampedDistance);
    const deltaMeters = Math.max(0, distanceMeters - prevDistance);
    const controlledLoad = this.#controlledPullLimitKg(maxLoad);
    const rawForceKg = controlledLoad * nextRatio;
    const forceKg = dragLocked || hardLineLimit || !lineCanRelease
      ? rawForceKg
      : Math.min(rawForceKg, forceLimit.availableExtraForceKg);
    const totalTensionKg = Math.max(0, Number(fishForceKg) || 0) + forceKg;
    let blockedReason = "none";

    if (!dragLocked && chargedRatio >= forceRatioLimit && forceRatioLimit < 1) {
      blockedReason = "max_tension_reached";
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
      totalTensionKg,
      deltaMeters,
      canMoveFish: deltaMeters >= minDistance && forceKg > (Number(this.#config.minEffectivePullKg) || 0.01),
      blockedReason,
      chargeSpeedMultiplier: chargeMultiplier,
      chargePerSecond:
        Math.max(
          0,
          Number(this.#config.strokeChargePerSecond ?? this.#config.chargePerSecond) || 0.65,
        ) *
        chargeMultiplier,
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
      dragSlipping: !!data.dragSlipping,
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

  #calculateChargeSpeedMultiplier({
    fishForceKg,
    maxTackleLoadKg,
    availableExtraForceKg,
    dragLocked,
    hardLineLimit,
    lineHasReserve = true,
  }) {
    const maxLoad = Math.max(0.001, Number(maxTackleLoadKg) || 0.001);
    const fishForce = Math.max(0, Number(fishForceKg) || 0);
    const stressHeadroomRatio = this.#clamp01(maxLoad / Math.max(maxLoad, fishForce + maxLoad));
    const forceHeadroomRatio = dragLocked || hardLineLimit || !this.#lineHasReserve(lineHasReserve)
      ? 1
      : this.#clamp01((Number(availableExtraForceKg) || 0) / maxLoad);
    const loadRatio = Math.min(stressHeadroomRatio, forceHeadroomRatio);
    const minMultiplier = Math.max(
      0,
      Math.min(1, Number(this.#config.minChargeSpeedMultiplier) || 0.12),
    );
    const power = Math.max(0.01, Number(this.#config.loadChargePower) || 1);
    return minMultiplier + (1 - minMultiplier) * Math.pow(loadRatio, power);
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

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
