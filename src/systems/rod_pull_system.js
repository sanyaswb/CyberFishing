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
    rodLimitKg: 0,
    fishTensionKg: 0,
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
    rodStrokeCapacityMeters: 0,
    rodStrokeWonMeters: 0,
    rodStrokeUsedMeters: 0,
    rodStrokeUnrecoveredMeters: 0,
    rodStrokeRatio: 0,
    lineHasReserve: true,
    canReleaseLine: true,
    spoolEmpty: false,
    strokeRecoveredMeters: 0,
    strokeSyncedMeters: 0,
    strokeYGainedMeters: 0,
    strokeYLostMeters: 0,
    strokeResetReason: "none",
    strokeSyncReason: "none",
  };

  constructor(config = {}) {
    this.#calculator = new RodPullCalculator(config || {});
  }

  update({
    dtSec,
    inputState,
    rod,
    pumpCreditMeters,
    slackMeters,
    fishForceKg,
    fishTensionKg,
    rodLimitKg,
    dragLimitKg,
    maxTackleLoadKg,
    dragLocked,
    hardLineLimit,
    lineHasReserve = true,
    fishDistanceMeters,
    yLostBeforePullMeters = 0,
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
    let strokeYLostMeters = 0;
    if (yLostBeforePullMeters > 0) {
      strokeYLostMeters = this.#strokeState.loseWonDistance(yLostBeforePullMeters);
    }

    this.#result = this.#calculator.calculateNextState({
      dtSec,
      input: inputState,
      previousState: this.#state,
      rodLengthMeters: this.#rodLengthMeters(rod),
      pumpCreditMeters,
      slackMeters,
      maxTackleLoadKg,
      rodLimitKg: this.#rodLimitKg(rod, rodLimitKg),
      fishTensionKg: this.#fishTensionKg(fishTensionKg, fishForceKg),
      holdTensionRatio: this.#holdTensionRatio(rod),
      dragLimitKg,
      dragLocked,
      hardLineLimit,
      lineHasReserve,
      fishDistanceMeters,
    });

    this.#strokeState.setCapacity(this.#result.maxDistanceMeters);
    this.#result.strokeYLostMeters = strokeYLostMeters;
    this.#result.strokeYGainedMeters = 0;
    this.#result.strokeResetReason = strokeResetReason;

    this.#syncStrokeSnapshot();
    this.#copyResultToState(this.#result);
    return this.#result;
  }

  updateReleaseRecovery({ pumpCreditMeters, slackMeters }) {
    this.#syncStrokeSnapshot();
    return this.#result;
  }

  recordAppliedStroke({ movedMeters }) {
    return this.recordYMovement({ gainedMeters: movedMeters });
  }

  recordYMovement({ gainedMeters = 0, lostMeters = 0 } = {}) {
    const lost = this.#strokeState.loseWonDistance(lostMeters);
    const gained = this.#strokeState.addWonDistance(gainedMeters);
    this.#result.strokeYLostMeters =
      Math.max(0, Number(this.#result.strokeYLostMeters) || 0) + lost;
    this.#result.strokeYGainedMeters =
      Math.max(0, Number(this.#result.strokeYGainedMeters) || 0) + gained;
    this.#syncStrokeSnapshot();
    return this.#result;
  }

  recoverStroke({ recoveredMeters }) {
    const recovered = this.#strokeState.recover(recoveredMeters);
    this.#result.strokeRecoveredMeters = recovered;
    this.#result.strokeResetReason = recovered > 0
      ? "recovered_by_reel"
      : "none";
    this.#syncStrokeSnapshot();
    return this.#result;
  }

  syncStrokeToPumpCredit({ pumpCreditMeters }) {
    this.#result.strokeSyncedMeters = 0;
    this.#result.strokeSyncReason = "debug_only";
    this.#syncStrokeSnapshot();
    return this.#result;
  }

  // Deprecated compatibility alias. This accepts the old name, but the value is
  // pump credit / recoverable line, not real loose line.
  syncStrokeToSlack({ slackMeters }) {
    return this.syncStrokeToPumpCredit({ pumpCreditMeters: slackMeters });
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
      rodLimitKg: 0,
      fishTensionKg: 0,
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
      rodStrokeCapacityMeters: 0,
      rodStrokeWonMeters: 0,
      rodStrokeUsedMeters: 0,
      rodStrokeUnrecoveredMeters: 0,
      rodStrokeRatio: 0,
      lineHasReserve: true,
      canReleaseLine: true,
      spoolEmpty: false,
      strokeRecoveredMeters: 0,
      strokeSyncedMeters: 0,
      strokeYGainedMeters: 0,
      strokeYLostMeters: 0,
      strokeResetReason: "none",
      strokeSyncReason: "none",
    };
    this.#strokeState.reset();
  }

  #copyResultToState(result) {
    this.#state.active = result.active;
    this.#state.ratio = result.ratio;
    this.#state.distanceMeters = result.distanceMeters;
    this.#state.maxDistanceMeters = result.maxDistanceMeters;
    this.#state.availableDistanceMeters = result.availableDistanceMeters;
    this.#state.forceKg = result.forceKg;
    this.#state.availableExtraForceKg = result.availableExtraForceKg;
    this.#state.rodLimitKg = result.rodLimitKg;
    this.#state.fishTensionKg = result.fishTensionKg;
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
    this.#state.rodStrokeWonMeters = result.rodStrokeWonMeters;
    this.#state.rodStrokeUnrecoveredMeters =
      result.rodStrokeUnrecoveredMeters;
    this.#state.rodStrokeRatio = result.rodStrokeRatio;
    this.#state.lineHasReserve = result.lineHasReserve;
    this.#state.canReleaseLine = result.canReleaseLine;
    this.#state.spoolEmpty = result.spoolEmpty;
    this.#state.strokeRecoveredMeters = result.strokeRecoveredMeters;
    this.#state.strokeSyncedMeters = result.strokeSyncedMeters;
    this.#state.strokeResetReason = result.strokeResetReason;
    this.#state.strokeSyncReason = result.strokeSyncReason;
  }

  #syncStrokeSnapshot() {
    const snapshot = this.#strokeState.writeSnapshot(this.#strokeSnapshot);
    this.#result.rodStrokeCapacityMeters = snapshot.rodStrokeCapacityMeters;
    this.#result.rodStrokeWonMeters = snapshot.rodStrokeWonMeters;
    this.#result.rodStrokeUsedMeters = snapshot.rodStrokeUsedMeters;
    this.#result.rodStrokeUnrecoveredMeters = snapshot.rodStrokeUnrecoveredMeters;
    this.#result.rodStrokeRatio = snapshot.rodStrokeRatio;
    this.#result.releaseRecovering = snapshot.rodStrokeUnrecoveredMeters > 0 && !this.#result.active;
    this.#result.releaseRecoveryRatio = snapshot.rodStrokeRatio;
    this.#result.strokeRecoveredMeters = Math.max(0, Number(this.#result.strokeRecoveredMeters) || 0);
    this.#result.strokeSyncedMeters = Math.max(0, Number(this.#result.strokeSyncedMeters) || 0);
    this.#result.strokeYGainedMeters = Math.max(0, Number(this.#result.strokeYGainedMeters) || 0);
    this.#result.strokeYLostMeters = Math.max(0, Number(this.#result.strokeYLostMeters) || 0);
    this.#result.strokeResetReason = this.#result.strokeResetReason || "none";
    this.#result.strokeSyncReason = this.#result.strokeSyncReason || "none";
  }

  #clearStrokeFrameDiagnostics() {
    this.#result.strokeRecoveredMeters = 0;
    this.#result.strokeSyncedMeters = 0;
    this.#result.strokeYGainedMeters = 0;
    this.#result.strokeYLostMeters = 0;
    this.#result.strokeResetReason = "none";
    this.#result.strokeSyncReason = "none";
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
