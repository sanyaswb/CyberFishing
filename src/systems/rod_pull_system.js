class RodPullSystem {
  #calculator;
  #state = new RodPullState();
  #strokeState = new RodStrokeState();
  #strokeSnapshot = {
    rodStrokeCapacityMeters: 0,
    rodStrokeWonMeters: 0,
    rodStrokeUsedMeters: 0,
    rodStrokeUnrecoveredMeters: 0,
    rodStrokeRatio: 0,
  };
  #result = {
    active: false,
    ratio: 0,
    forceKg: 0,
    distanceMeters: 0,
    maxDistanceMeters: 0,
    availableDistanceMeters: 0,
    availableExtraForceKg: 0,
    rawForceKg: 0,
    rodLimitKg: 0,
    fishTensionKg: 0,
    tensionCeilingMultiplier: 1,
    tensionCeilingKg: 0,
    playerForceBudgetEnabled: false,
    playerForceTotalBudgetKg: 0,
    playerForceHoldBudgetKg: 0,
    playerForceControlBudgetKg: 0,
    playerForceHoldShare: 0,
    playerForceControlShare: 0,
    playerForceCombinedCeilingMultiplier: 1,
    playerForceCombinedTensionCeilingKg: 0,
    playerForceBudgetReason: "none",
    rodHoldMaxKg: 0,
    effectiveForceKg: 0,
    holdTensionRatio: 1,
    playerHoldTensionKg: 0,
    totalTensionKg: 0,
    deltaMeters: 0,
    canMoveFish: false,
    blockedReason: "none",
    dragSlipping: false,
    releasedThisFrame: false,
    releaseRecovering: false,
    releaseRecoveryRatio: 0,
    playerPressureEfficiency: 1,
    playerPressureFatigueEnabled: false,
    rodStrokeCapacityMeters: 0,
    rodStrokeWonMeters: 0,
    rodStrokeUsedMeters: 0,
    rodStrokeUnrecoveredMeters: 0,
    rodStrokeRatio: 0,
    lineHasReserve: true,
    canReleaseLine: true,
    spoolEmpty: false,
    strokeRecoveredMeters: 0,
    strokeDistancePreviousMeters: 0,
    strokeDistanceCurrentMeters: 0,
    strokeDistanceDeltaMeters: 0,
    strokeDistanceGainedMeters: 0,
    strokeDistanceLostMeters: 0,
    strokeDistanceReason: "none",
    strokeResetReason: "none",
    playerPressureGainMultiplier: 1,
    playerPressureGainMode: "none",
    tensionBuildRateMultiplier: 1,
    tensionBuildMode: "none",
    chargePerSecond: 0,
    baseChargePerSecond: 0,
  };

  constructor(config = {}) {
    this.#calculator = new RodPullCalculator(config || {});
  }

  update({
    dtSec,
    inputState,
    rod,
    fishForceKg,
    fishTensionKg,
    rodLimitKg,
    playerForceBudget,
    dragLimitKg,
    maxTackleLoadKg,
    dragLocked,
    hardLineLimit,
    lineHasReserve = true,
    fishDistanceMeters,
    distanceLostBeforePullMeters = null,
    playerPressureGain = null,
    playerTensionBuildRate = null,
    playerPressureFatigue = null,
  }) {
    this.#clearStrokeFrameDiagnostics();
    if (inputState?.pullStartedThisFrame) {
      this.#state.reset();
    }
    const configuredCapacity = this.#calculator.calculateMaxDistance({
      rodLengthMeters: this.#rodLengthMeters(rod),
    });
    const previousStrokeSnapshot = this.#strokeState.getSnapshot();
    this.#strokeState.setCapacity(configuredCapacity);
    let strokeResetReason = "none";
    if (
      configuredCapacity > 0 &&
      previousStrokeSnapshot.rodStrokeCapacityMeters <= 0
    ) {
      strokeResetReason = "stroke_capacity_initialized";
    }
    const hasDistanceLostBeforePull =
      distanceLostBeforePullMeters !== null &&
      distanceLostBeforePullMeters !== undefined &&
      Number.isFinite(Number(distanceLostBeforePullMeters));
    const distanceLostBeforePull = hasDistanceLostBeforePull
      ? Math.max(0, Number(distanceLostBeforePullMeters) || 0)
      : 0;
    let strokeDistanceLostMeters = 0;
    if (distanceLostBeforePull > 0) {
      strokeDistanceLostMeters = this.#strokeState.loseWonDistance(distanceLostBeforePull);
    }

    this.#result = this.#calculator.calculateNextState({
      dtSec,
      input: inputState,
      previousState: this.#state,
      rodLengthMeters: this.#rodLengthMeters(rod),
      maxTackleLoadKg,
      rodLimitKg: this.#rodLimitKg(rod, rodLimitKg),
      playerForceBudget,
      fishTensionKg: this.#fishTensionKg(fishTensionKg, fishForceKg),
      holdTensionRatio: this.#holdTensionRatio(rod),
      dragLimitKg,
      dragLocked,
      hardLineLimit,
      lineHasReserve,
      fishDistanceMeters,
      playerPressureGain,
      playerTensionBuildRate,
      playerPressureFatigue,
    });

    this.#applyPlayerForceBudgetDiagnostics(playerForceBudget);

    this.#strokeState.setCapacity(this.#result.maxDistanceMeters);
    this.#result.strokeDistanceLostMeters = strokeDistanceLostMeters;
    this.#result.strokeDistanceGainedMeters = 0;
    this.#result.strokeDistanceReason = strokeDistanceLostMeters > 0
      ? "pre_player_distance_lost"
      : "none";
    this.#result.strokeResetReason = strokeResetReason;

    this.#writeStrokeSnapshot();
    this.#copyResultToState(this.#result);
    return this.#result;
  }

  #applyPlayerForceBudgetDiagnostics(playerForceBudget) {
    const budget = playerForceBudget || {};
    this.#result.playerForceBudgetEnabled = budget.enabled === true;
    this.#result.playerForceTotalBudgetKg = Math.max(
      0,
      Number(budget.totalPlayerBudgetKg) || 0,
    );
    this.#result.playerForceHoldBudgetKg = Math.max(
      0,
      Number(budget.holdBudgetKg) || 0,
    );
    this.#result.playerForceControlBudgetKg = Math.max(
      0,
      Number(budget.controlBudgetKg) || 0,
    );
    this.#result.playerForceHoldShare = this.#clamp01(
      budget.holdShare,
    );
    this.#result.playerForceControlShare = this.#clamp01(
      budget.controlShare,
    );
    this.#result.playerForceCombinedCeilingMultiplier = Math.max(
      0,
      Number(budget.combinedCeilingMultiplier) || 1,
    );
    this.#result.playerForceCombinedTensionCeilingKg = Math.max(
      0,
      Number(budget.combinedTensionCeilingKg) || 0,
    );
    this.#result.playerForceBudgetReason = budget.reason || "none";
  }

  recordAppliedStroke({ movedMeters }) {
    return this.recordDistanceMovement({
      gainedMeters: movedMeters,
      reason: "applied_stroke_distance",
    });
  }

  recordDistanceMovement({
    gainedMeters = 0,
    lostMeters = 0,
    previousDistanceMeters = null,
    currentDistanceMeters = null,
    deltaMeters = null,
    reason = "line_distance",
  } = {}) {
    const lost = this.#strokeState.loseWonDistance(lostMeters);
    const gained = this.#strokeState.addWonDistance(gainedMeters);
    this.#result.strokeDistanceLostMeters =
      Math.max(0, Number(this.#result.strokeDistanceLostMeters) || 0) + lost;
    this.#result.strokeDistanceGainedMeters =
      Math.max(0, Number(this.#result.strokeDistanceGainedMeters) || 0) + gained;
    if (Number.isFinite(Number(previousDistanceMeters))) {
      this.#result.strokeDistancePreviousMeters = Math.max(
        0,
        Number(previousDistanceMeters) || 0,
      );
    }
    if (Number.isFinite(Number(currentDistanceMeters))) {
      this.#result.strokeDistanceCurrentMeters = Math.max(
        0,
        Number(currentDistanceMeters) || 0,
      );
    }
    if (Number.isFinite(Number(deltaMeters))) {
      this.#result.strokeDistanceDeltaMeters = Number(deltaMeters) || 0;
    }
    if (gained > 0 || lost > 0 || reason !== "line_distance") {
      this.#result.strokeDistanceReason = reason || "line_distance";
    }
    this.#writeStrokeSnapshot();
    return this.#result;
  }

  recoverStroke({ recoveredMeters }) {
    const recovered = this.#strokeState.recover(recoveredMeters);
    this.#result.strokeRecoveredMeters = recovered;
    this.#result.strokeResetReason = recovered > 0
      ? "recovered_by_reel"
      : "none";
    this.#writeStrokeSnapshot();
    return this.#result;
  }

  getState() {
    return this.#result;
  }

  reset() {
    this.#state.reset();
    this.#result = {
      active: false,
      ratio: 0,
      forceKg: 0,
      distanceMeters: 0,
      maxDistanceMeters: 0,
      availableDistanceMeters: 0,
      availableExtraForceKg: 0,
      rawForceKg: 0,
      rodLimitKg: 0,
      fishTensionKg: 0,
      tensionCeilingMultiplier: 1,
      tensionCeilingKg: 0,
      rodHoldMaxKg: 0,
      effectiveForceKg: 0,
      holdTensionRatio: 1,
      playerHoldTensionKg: 0,
      totalTensionKg: 0,
      deltaMeters: 0,
      canMoveFish: false,
      blockedReason: "none",
      dragSlipping: false,
      releasedThisFrame: false,
      releaseRecovering: false,
      releaseRecoveryRatio: 0,
      playerPressureEfficiency: 1,
      playerPressureFatigueEnabled: false,
      rodStrokeCapacityMeters: 0,
      rodStrokeWonMeters: 0,
      rodStrokeUsedMeters: 0,
      rodStrokeUnrecoveredMeters: 0,
      rodStrokeRatio: 0,
      lineHasReserve: true,
      canReleaseLine: true,
      spoolEmpty: false,
      strokeRecoveredMeters: 0,
      strokeResetReason: "none",
    };
    this.#strokeState.reset();
  }

  #copyResultToState(result) {
    this.#state.active = result.active;
    this.#state.ratio = result.ratio;
    this.#state.distanceMeters = result.distanceMeters;
    this.#state.maxDistanceMeters = result.maxDistanceMeters;
    this.#state.availableDistanceMeters = result.availableDistanceMeters;
    this.#state.rawForceKg = result.rawForceKg;
    this.#state.forceKg = result.forceKg;
    this.#state.availableExtraForceKg = result.availableExtraForceKg;
    this.#state.rodLimitKg = result.rodLimitKg;
    this.#state.fishTensionKg = result.fishTensionKg;
    this.#state.tensionCeilingMultiplier =
      result.tensionCeilingMultiplier;
    this.#state.tensionCeilingKg = result.tensionCeilingKg;
    this.#state.rodHoldMaxKg = result.rodHoldMaxKg;
    this.#state.effectiveForceKg = result.effectiveForceKg;
    this.#state.holdTensionRatio = result.holdTensionRatio;
    this.#state.playerHoldTensionKg = result.playerHoldTensionKg;
    this.#state.totalTensionKg = result.totalTensionKg;
    this.#state.deltaMeters = result.deltaMeters;
    this.#state.canMoveFish = result.canMoveFish;
    this.#state.blockedReason = result.blockedReason;
    this.#state.dragSlipping = result.dragSlipping;
    this.#state.releasedThisFrame = result.releasedThisFrame;
    this.#state.releaseRecovering = result.releaseRecovering;
    this.#state.releaseRecoveryRatio = result.releaseRecoveryRatio;
    this.#state.playerPressureEfficiency = result.playerPressureEfficiency;
    this.#state.playerPressureFatigueEnabled =
      result.playerPressureFatigueEnabled;
    this.#state.rodStrokeWonMeters = result.rodStrokeWonMeters;
    this.#state.rodStrokeUnrecoveredMeters =
      result.rodStrokeUnrecoveredMeters;
    this.#state.rodStrokeRatio = result.rodStrokeRatio;
    this.#state.lineHasReserve = result.lineHasReserve;
    this.#state.canReleaseLine = result.canReleaseLine;
    this.#state.spoolEmpty = result.spoolEmpty;
    this.#state.strokeRecoveredMeters = result.strokeRecoveredMeters;
    this.#state.strokeDistancePreviousMeters = result.strokeDistancePreviousMeters;
    this.#state.strokeDistanceCurrentMeters = result.strokeDistanceCurrentMeters;
    this.#state.strokeDistanceDeltaMeters = result.strokeDistanceDeltaMeters;
    this.#state.strokeDistanceGainedMeters = result.strokeDistanceGainedMeters;
    this.#state.strokeDistanceLostMeters = result.strokeDistanceLostMeters;
    this.#state.strokeDistanceReason = result.strokeDistanceReason;
    this.#state.strokeResetReason = result.strokeResetReason;
  }

  #writeStrokeSnapshot() {
    const snapshot = this.#strokeState.writeSnapshot(this.#strokeSnapshot);
    this.#result.rodStrokeCapacityMeters = snapshot.rodStrokeCapacityMeters;
    this.#result.rodStrokeWonMeters = snapshot.rodStrokeWonMeters;
    this.#result.rodStrokeUsedMeters = snapshot.rodStrokeUsedMeters;
    this.#result.rodStrokeUnrecoveredMeters = snapshot.rodStrokeUnrecoveredMeters;
    this.#result.rodStrokeRatio = snapshot.rodStrokeRatio;
    this.#result.releaseRecovering = snapshot.rodStrokeUnrecoveredMeters > 0 && !this.#result.active;
    this.#result.releaseRecoveryRatio = snapshot.rodStrokeRatio;
    this.#result.strokeRecoveredMeters = Math.max(0, Number(this.#result.strokeRecoveredMeters) || 0);
    this.#result.strokeDistancePreviousMeters = Math.max(
      0,
      Number(this.#result.strokeDistancePreviousMeters) || 0,
    );
    this.#result.strokeDistanceCurrentMeters = Math.max(
      0,
      Number(this.#result.strokeDistanceCurrentMeters) || 0,
    );
    this.#result.strokeDistanceDeltaMeters = Number(this.#result.strokeDistanceDeltaMeters) || 0;
    this.#result.strokeDistanceGainedMeters = Math.max(0, Number(this.#result.strokeDistanceGainedMeters) || 0);
    this.#result.strokeDistanceLostMeters = Math.max(0, Number(this.#result.strokeDistanceLostMeters) || 0);
    this.#result.strokeDistanceReason = this.#result.strokeDistanceReason || "none";
    this.#result.strokeResetReason = this.#result.strokeResetReason || "none";
  }

  #clearStrokeFrameDiagnostics() {
    this.#result.strokeRecoveredMeters = 0;
    this.#result.strokeDistancePreviousMeters = 0;
    this.#result.strokeDistanceCurrentMeters = 0;
    this.#result.strokeDistanceDeltaMeters = 0;
    this.#result.strokeDistanceGainedMeters = 0;
    this.#result.strokeDistanceLostMeters = 0;
    this.#result.strokeDistanceReason = "none";
    this.#result.strokeResetReason = "none";
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }

  #rodLengthMeters(rod) {
    return (
      Number(rod?.lengthMeters) ||
      Number(rod?.getLengthMeters?.()) ||
      Number(rod?.engineStats?.lengthMeters) ||
      1
    );
  }

  #rodLimitKg(rod, fallback) {
    return (
      Number(fallback) ||
      Number(rod?.getEffectiveMaxLoadKg?.()) ||
      Number(rod?.getMaxLoadKg?.()) ||
      Number(rod?.engineStats?.maxLoadKg) ||
      0
    );
  }

  #fishTensionKg(fishTensionKg, fishForceKg) {
    return Math.max(
      0,
      Number(fishTensionKg) ||
        Number(fishForceKg) ||
        0,
    );
  }

  #holdTensionRatio(rod) {
    const direct = Number(rod?.getHoldTensionRatio?.());
    if (Number.isFinite(direct)) return Math.max(0, Math.min(1, direct));
    const plain = Number(rod?.holdTensionRatio);
    if (Number.isFinite(plain)) return Math.max(0, Math.min(1, plain));
    const engine = Number(rod?.engineStats?.holdTensionRatio);
    if (Number.isFinite(engine)) return Math.max(0, Math.min(1, engine));
    return Math.max(
      0,
      Math.min(
        1,
        1,
      ),
    );
  }
}
