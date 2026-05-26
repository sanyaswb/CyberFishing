class RodPullSystem {
  #calculator;
  #state = new RodPullState();
  #strokeState = new RodStrokeState();
  #strokeSnapshot = {
    rodStrokeCapacityMeters: 0,
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
    rodStrokeUsedMeters: 0,
    rodStrokeUnrecoveredMeters: 0,
    rodStrokeRatio: 0,
    lineHasReserve: true,
    canReleaseLine: true,
    spoolEmpty: false,
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
  }) {
    if (inputState?.pullStartedThisFrame) {
      this.#state.reset();
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

    const strokeSnapshot = this.#strokeState.writeSnapshot(this.#strokeSnapshot);
    if (
      inputState?.pullStartedThisFrame ||
      (this.#result.active && strokeSnapshot.rodStrokeCapacityMeters <= 0)
    ) {
      this.#strokeState.startCycle(this.#result.maxDistanceMeters);
    }

    this.#syncStrokeSnapshot();
    this.#copyResultToState(this.#result);
    return this.#result;
  }

  updateReleaseRecovery({ pumpCreditMeters, slackMeters }) {
    const recoverableLineMeters = pumpCreditMeters ?? slackMeters;
    if (Math.max(0, Number(recoverableLineMeters) || 0) <= 0.001) {
      this.#strokeState.recover(Infinity);
    }
    this.#syncStrokeSnapshot();
    return this.#result;
  }

  recordAppliedStroke({ movedMeters }) {
    this.#strokeState.addPullDistance(movedMeters);
    this.#syncStrokeSnapshot();
    return this.#result;
  }

  recoverStroke({ recoveredMeters }) {
    this.#strokeState.recover(recoveredMeters);
    this.#syncStrokeSnapshot();
    return this.#result;
  }

  syncStrokeToPumpCredit({ pumpCreditMeters }) {
    this.#strokeState.clampToPumpCredit(pumpCreditMeters);
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
      rodStrokeUsedMeters: 0,
      rodStrokeUnrecoveredMeters: 0,
      rodStrokeRatio: 0,
      lineHasReserve: true,
      canReleaseLine: true,
      spoolEmpty: false,
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
    this.#state.lineHasReserve = result.lineHasReserve;
    this.#state.canReleaseLine = result.canReleaseLine;
    this.#state.spoolEmpty = result.spoolEmpty;
  }

  #syncStrokeSnapshot() {
    const snapshot = this.#strokeState.writeSnapshot(this.#strokeSnapshot);
    this.#result.rodStrokeCapacityMeters = snapshot.rodStrokeCapacityMeters;
    this.#result.rodStrokeUsedMeters = snapshot.rodStrokeUsedMeters;
    this.#result.rodStrokeUnrecoveredMeters = snapshot.rodStrokeUnrecoveredMeters;
    this.#result.rodStrokeRatio = snapshot.rodStrokeRatio;
    this.#result.releaseRecovering = snapshot.rodStrokeUnrecoveredMeters > 0 && !this.#result.active;
    this.#result.releaseRecoveryRatio = snapshot.rodStrokeRatio;
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
