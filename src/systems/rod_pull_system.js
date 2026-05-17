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
  };

  constructor(config = {}) {
    this.#calculator = new RodPullCalculator(config || {});
  }

  update({
    dtSec,
    inputState,
    rod,
    slackMeters,
    fishForceKg,
    dragLimitKg,
    maxTackleLoadKg,
    dragLocked,
    hardLineLimit,
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
      slackMeters,
      fishForceKg,
      dragLimitKg,
      maxTackleLoadKg,
      dragLocked,
      hardLineLimit,
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

  updateReleaseRecovery({ slackMeters }) {
    if (Math.max(0, Number(slackMeters) || 0) <= 0.001) {
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
    this.#state.totalTensionKg = result.totalTensionKg;
    this.#state.deltaMeters = result.deltaMeters;
    this.#state.canMoveFish = result.canMoveFish;
    this.#state.blockedReason = result.blockedReason;
    this.#state.dragSlipping = result.dragSlipping;
    this.#state.releasedThisFrame = result.releasedThisFrame;
    this.#state.releaseRecovering = result.releaseRecovering;
    this.#state.releaseRecoveryRatio = result.releaseRecoveryRatio;
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
}
