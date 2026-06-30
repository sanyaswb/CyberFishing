class RodPullCalculator {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  calculateStrokeCapacity({ rodLengthMeters, fishDistanceMeters } = {}) {
    const maxDistanceMeters = this.calculateMaxDistance({ rodLengthMeters });
    const available = maxDistanceMeters;
    const distanceToFish = Math.max(0, Number(fishDistanceMeters) || 0);
    const finalLandingDistance = Math.max(
      0,
      Number(this.#config.finalLandingDistanceMeters) || 0,
    );
    if (
      available <= 0 &&
      distanceToFish > 0 &&
      distanceToFish <= Math.max(finalLandingDistance, maxDistanceMeters)
    ) {
      return Math.min(maxDistanceMeters, distanceToFish);
    }
    return available;
  }

  calculateAvailableDistance(args = {}) {
    // Deprecated compatibility alias. Pump credit/slack no longer reduce rod stroke.
    return this.calculateStrokeCapacity(args);
  }

  calculateMaxDistance({ rodLengthMeters }) {
    const multiplier = Number(
      this.#config.capacityByRodLengthRatio ??
        this.#config.distanceMultiplierByRodLength,
    );
    return Math.max(
      0,
      (Number(rodLengthMeters) || 0) *
        (Number.isFinite(multiplier) ? multiplier : 0.5),
    );
  }

  // New-model contract: RodPullCalculator owns only player demand + rod stroke.
  // Drag slip and final line tension are resolved later by FishRetrieveSystem + TensionSystem.
  calculateForceLimit({
    maxTackleLoadKg,
    rodLimitKg,
    playerForceBudget,
    fishTensionKg,
    rodHoldMaxKg,
    tensionCeilingMultiplier: externalTensionCeilingMultiplier,
    tensionCeilingKg: externalTensionCeilingKg,
    dragLimitKg,
    dragLocked,
    hardLineLimit,
    lineHasReserve,
  } = {}) {
    const tensionCeilingMultiplier = Math.max(
      0,
      Number.isFinite(Number(externalTensionCeilingMultiplier))
        ? Number(externalTensionCeilingMultiplier)
        : this.#tensionCeilingMultiplier(),
    );
    const resolvedRodLimitKg = Math.max(0, Number(rodLimitKg) || 0);
    const externalCeilingKg = Number(externalTensionCeilingKg);
    const tensionCeilingKg = Number.isFinite(externalCeilingKg)
      ? Math.max(0, externalCeilingKg)
      : resolvedRodLimitKg * tensionCeilingMultiplier;
    const directHoldMax = Number(rodHoldMaxKg);
    if (Number.isFinite(directHoldMax)) {
      const holdMax = Math.max(0, directHoldMax);
      const dragLimit = Math.max(0, Number(dragLimitKg) || 0);
      const canSlipLine =
        dragLocked === false && lineHasReserve !== false && !hardLineLimit;
      const controlledHoldMax = canSlipLine
        ? Math.min(holdMax, dragLimit)
        : holdMax;
      return {
        availableExtraForceKg: controlledHoldMax,
        controlledPullLimitKg: controlledHoldMax,
        rodHoldMaxKg: holdMax,
        tensionCeilingMultiplier,
        tensionCeilingKg,
        dragSlipping: canSlipLine && dragLimit < holdMax,
        blockedReason:
          canSlipLine && dragLimit <= 0.000001
            ? "drag_open_no_force_transfer"
            : "none",
      };
    }

    const rodLimit = Number(rodLimitKg);
    if (Number.isFinite(rodLimit)) {
      const fishTension = Math.max(0, Number(fishTensionKg) || 0);
      const holdMax = Math.max(0, tensionCeilingKg - fishTension);
      const dragLimit = Math.max(0, Number(dragLimitKg) || 0);
      const canSlipLine =
        dragLocked === false && lineHasReserve !== false && !hardLineLimit;
      const controlledHoldMax = canSlipLine
        ? Math.min(holdMax, dragLimit)
        : holdMax;
      return {
        availableExtraForceKg: controlledHoldMax,
        controlledPullLimitKg: controlledHoldMax,
        rodHoldMaxKg: holdMax,
        tensionCeilingMultiplier,
        tensionCeilingKg,
        dragSlipping: canSlipLine && dragLimit < holdMax,
        blockedReason: "none",
      };
    }

    const maxLoad = Math.max(0, Number(maxTackleLoadKg) || 0);
    const controlledLoad = this.#controlledPullLimitKg(maxLoad);
    const dragLimit = Math.max(0, Number(dragLimitKg) || 0);
    const canSlipLine =
      dragLocked === false && lineHasReserve !== false && !hardLineLimit;
    const effectiveLoad = canSlipLine
      ? Math.min(controlledLoad, dragLimit)
      : controlledLoad;
    return {
      availableExtraForceKg: effectiveLoad,
      controlledPullLimitKg: effectiveLoad,
      rodHoldMaxKg: effectiveLoad,
      tensionCeilingMultiplier,
      tensionCeilingKg:
        maxLoad * tensionCeilingMultiplier,
      dragSlipping: canSlipLine && dragLimit < controlledLoad,
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
    rodLimitKg,
    playerForceBudget,
    fishTensionKg,
    holdTensionRatio = 1,
    dragLimitKg,
    dragLocked,
    hardLineLimit,
    lineHasReserve = true,
    fishDistanceMeters,
    playerPressureFatigue,
  }) {
    const maxDistanceMeters = this.calculateMaxDistance({ rodLengthMeters });
    const availableDistanceMeters = this.calculateStrokeCapacity({
      rodLengthMeters,
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
    const forceLimit = this.calculateForceLimit({
      maxTackleLoadKg,
      rodLimitKg,
      fishTensionKg,
      rodHoldMaxKg: playerForceBudget?.holdBudgetKg,
      tensionCeilingMultiplier: playerForceBudget?.combinedCeilingMultiplier,
      tensionCeilingKg: playerForceBudget?.combinedTensionCeilingKg,
      dragLimitKg,
      dragLocked,
      hardLineLimit,
      lineHasReserve,
    });
    const pressureEfficiency = this.#pressureEfficiency({
      frame: playerPressureFatigue,
      channel: "rodHold",
    });
    const prevDistance = Math.max(0, Number(previousState?.distanceMeters) || 0);
    const prevRatio = Math.max(0, Math.min(1, Number(previousState?.ratio) || 0));
    const previousHoldActive =
      !!previousState?.active && (prevRatio > 0.001 || prevDistance > 0.001);

    if (availableDistanceMeters < minDistance) {
      const preservedRatio = previousHoldActive ? prevRatio : 0;
      const preservedRawForceKg =
        forceLimit.controlledPullLimitKg * preservedRatio;
      const preservedForceKg = preservedRawForceKg * pressureEfficiency;
      return this.#buildResult({
        active: true,
        ratio: preservedRatio,
        distanceMeters: previousHoldActive ? prevDistance : 0,
        maxDistanceMeters,
        availableDistanceMeters,
        availableExtraForceKg: forceLimit.availableExtraForceKg,
        rawForceKg: preservedRawForceKg,
        forceKg: preservedForceKg,
        totalTensionKg: preservedForceKg,
        rodLimitKg,
        fishTensionKg,
        rodHoldMaxKg: forceLimit.rodHoldMaxKg,
        tensionCeilingMultiplier: forceLimit.tensionCeilingMultiplier,
        tensionCeilingKg: forceLimit.tensionCeilingKg,
        holdTensionRatio,
        dragSlipping: forceLimit.dragSlipping,
        blockedReason: "stroke_capacity_unavailable",
        playerPressureEfficiency: pressureEfficiency,
        playerPressureFatigueEnabled: playerPressureFatigue?.enabled === true,
        lineHasReserve: lineCanRelease,
        canReleaseLine: lineCanRelease,
        spoolEmpty: !lineCanRelease,
      });
    }

    const dt = Math.max(0, Number(dtSec) || 0);
    const chargePerSecond = this.#resolveHoldChargePerSecond();
    const chargedRatio = Math.min(1, prevRatio + chargePerSecond * dt);
    const nextRatio = chargedRatio;
    const distanceMeters = Math.min(availableDistanceMeters, nextRatio * availableDistanceMeters);
    const deltaMeters = Math.max(0, distanceMeters - prevDistance);
    const controlledLoad = forceLimit.controlledPullLimitKg;
    const rawForceKg = controlledLoad * nextRatio;
    const forceKg = rawForceKg * pressureEfficiency;
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
      rodLimitKg,
      fishTensionKg,
      rodHoldMaxKg: forceLimit.rodHoldMaxKg,
      tensionCeilingMultiplier: forceLimit.tensionCeilingMultiplier,
      tensionCeilingKg: forceLimit.tensionCeilingKg,
      holdTensionRatio,
      deltaMeters,
      canMoveFish: deltaMeters >= minDistance && forceKg > (Number(this.#config.minEffectivePullKg) || 0.01),
      rawForceKg,
      playerPressureEfficiency: pressureEfficiency,
      playerPressureFatigueEnabled: playerPressureFatigue?.enabled === true,
      dragSlipping: forceLimit.dragSlipping,
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
      rawForceKg: Math.max(
        0,
        Number(data.rawForceKg ?? data.forceKg) || 0,
      ),
      forceKg: Math.max(0, Number(data.forceKg) || 0),
      distanceMeters: Math.max(0, Number(data.distanceMeters) || 0),
      maxDistanceMeters: Math.max(0, Number(data.maxDistanceMeters) || 0),
      availableDistanceMeters: Math.max(0, Number(data.availableDistanceMeters) || 0),
      availableExtraForceKg: Math.max(0, Number(data.availableExtraForceKg) || 0),
      rodLimitKg: Math.max(0, Number(data.rodLimitKg) || 0),
      fishTensionKg: Math.max(0, Number(data.fishTensionKg) || 0),
      rodHoldMaxKg: Math.max(0, Number(data.rodHoldMaxKg) || 0),
      tensionCeilingMultiplier: Math.max(
        0,
        Number.isFinite(Number(data.tensionCeilingMultiplier))
          ? Number(data.tensionCeilingMultiplier)
          : this.#tensionCeilingMultiplier(),
      ),
      tensionCeilingKg: Math.max(0, Number(data.tensionCeilingKg) || 0),
      effectiveForceKg: Math.max(0, Number(data.effectiveForceKg ?? data.forceKg) || 0),
      holdTensionRatio: this.#ratioOrDefault(data.holdTensionRatio, 1),
      playerHoldTensionKg: Math.max(0, Number(data.playerHoldTensionKg) || 0),
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
      playerPressureEfficiency: this.#ratioOrDefault(
        data.playerPressureEfficiency,
        1,
      ),
      playerPressureFatigueEnabled:
        data.playerPressureFatigueEnabled === true,
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

  #tensionCeilingMultiplier() {
    const multiplier = Number(this.#config.tensionCeilingMultiplier);
    return Number.isFinite(multiplier) && multiplier >= 0
      ? multiplier
      : 1;
  }

  #resolveHoldChargePerSecond() {
    const chargeTimeSeconds = Number(
      this.#config.chargeTimeSeconds ?? this.#config.rodHold?.chargeTimeSeconds,
    );
    if (Number.isFinite(chargeTimeSeconds) && chargeTimeSeconds > 0) {
      return 1 / chargeTimeSeconds;
    }

    return Math.max(
      0,
      Number(this.#config.strokeChargePerSecond ?? this.#config.chargePerSecond) || 0.65,
    );
  }

  #ratioOrDefault(value, fallback) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, Math.min(1, number));
    return Math.max(0, Math.min(1, Number(fallback) || 0));
  }

  #pressureEfficiency({ frame, channel }) {
    if (frame?.enabled !== true) return 1;
    const channels = frame.channels || {};
    if (channels[channel] === false) return 1;
    return this.#ratioOrDefault(frame.efficiency, 1);
  }
}
