class RodPullSystem {
  #calculator;
  #state = new RodPullState();
  #releaseRecoveryActive = false;
  #releaseRecoveryStartSlackMeters = 0;
  #releaseRecoveryStartRatio = 0;
  #releaseRecoveryStartDistanceMeters = 0;
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
      this.#clearReleaseRecovery();
      this.#state.reset();
    }

    const previousRatio = this.#state.ratio;
    const previousDistanceMeters = this.#state.distanceMeters;
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

    if (inputState?.pullReleasedThisFrame && previousRatio > 0) {
      this.#startReleaseRecovery({
        slackMeters,
        ratio: previousRatio,
        distanceMeters: previousDistanceMeters,
      });
      this.#applyReleaseRecoveryDisplay(slackMeters);
    }

    this.#copyResultToState(this.#result);
    return this.#result;
  }

  updateReleaseRecovery({ slackMeters }) {
    if (!this.#releaseRecoveryActive) return this.#result;
    this.#applyReleaseRecoveryDisplay(slackMeters);
    this.#copyResultToState(this.#result);
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
    };
    this.#clearReleaseRecovery();
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

  #startReleaseRecovery({ slackMeters, ratio, distanceMeters }) {
    const startSlack = Math.max(0, Number(slackMeters) || 0);
    if (startSlack <= 0.001) {
      this.#clearReleaseRecovery();
      return;
    }

    this.#releaseRecoveryActive = true;
    this.#releaseRecoveryStartSlackMeters = startSlack;
    this.#releaseRecoveryStartRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    this.#releaseRecoveryStartDistanceMeters = Math.max(0, Number(distanceMeters) || 0);
  }

  #applyReleaseRecoveryDisplay(slackMeters) {
    const currentSlack = Math.max(0, Number(slackMeters) || 0);
    if (!this.#releaseRecoveryActive || currentSlack <= 0.001) {
      this.#clearReleaseRecovery();
      this.#result.ratio = 0;
      this.#result.distanceMeters = 0;
      this.#result.forceKg = 0;
      this.#result.deltaMeters = 0;
      this.#result.canMoveFish = false;
      this.#result.releaseRecovering = false;
      this.#result.releaseRecoveryRatio = 0;
      if (!this.#result.active) this.#result.blockedReason = "none";
      return;
    }

    const recoveryRatio = Math.max(
      0,
      Math.min(1, currentSlack / Math.max(0.001, this.#releaseRecoveryStartSlackMeters)),
    );
    this.#result.active = false;
    this.#result.ratio = this.#releaseRecoveryStartRatio * recoveryRatio;
    this.#result.distanceMeters =
      this.#releaseRecoveryStartDistanceMeters * recoveryRatio;
    this.#result.forceKg = 0;
    this.#result.totalTensionKg = 0;
    this.#result.deltaMeters = 0;
    this.#result.canMoveFish = false;
    this.#result.blockedReason = "recovering_slack";
    this.#result.releaseRecovering = true;
    this.#result.releaseRecoveryRatio = recoveryRatio;
  }

  #clearReleaseRecovery() {
    this.#releaseRecoveryActive = false;
    this.#releaseRecoveryStartSlackMeters = 0;
    this.#releaseRecoveryStartRatio = 0;
    this.#releaseRecoveryStartDistanceMeters = 0;
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
