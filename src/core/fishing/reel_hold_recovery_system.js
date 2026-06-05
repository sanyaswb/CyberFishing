class ReelHoldRecoverySystem {
  #timerMs = 0;
  #loadPolicy = new ReelHoldLoadPolicy();
  #state = this.#createState({ blockedReason: "not_checked" });

  update({
    dtMs,
    config = {},
    hasReel,
    playerHoldActive,
    rodPullActive,
    strokeRatio,
    strokeCapacityMeters,
    strokeUnrecoveredMeters,
    rodPullBlockedReason,
    rawTensionKg,
    dragLimitKg,
    dragLocked,
    shouldSlipDrag,
    reelMaxLoadKg,
    retrieveSpeedMetersPerSecond,
    lineRecoverableMeters,
  } = {}) {
    const delayMs = this.#resolveDelayMs(config);
    const requiredStrokeRatio = this.#ratio(config.strokeRatio, 1);
    const strokeToleranceMeters = this.#positive(
      config.strokeToleranceMeters,
      0.001,
    );
    const recoverableLine = this.#positive(lineRecoverableMeters);
    const loadFrame = this.#loadPolicy.evaluate({
      dtMs,
      config,
      hasReel,
      playerHoldActive,
      rawTensionKg,
      dragLimitKg,
      dragLocked,
      shouldSlipDrag,
      reelMaxLoadKg,
      retrieveSpeedMetersPerSecond,
    });
    const strokeFull = this.#isStrokeFull({
      requireStrokeFull: config.requireRodStrokeFull !== false,
      strokeRatio,
      requiredStrokeRatio,
      strokeCapacityMeters,
      strokeUnrecoveredMeters,
      strokeToleranceMeters,
      rodPullBlockedReason,
    });
    const hasRecoverableLine = recoverableLine > 0.001;
    const eligible =
      loadFrame.eligible &&
      !!rodPullActive &&
      strokeFull &&
      hasRecoverableLine;

    const blockedReason = this.#blockedReason({
      loadFrame,
      rodPullActive,
      strokeFull,
      hasRecoverableLine,
    });

    this.#timerMs = eligible
      ? Math.min(delayMs, this.#timerMs + this.#positive(dtMs))
      : 0;

    const active = eligible && this.#timerMs >= delayMs;
    this.#state = this.#createState({
      eligible,
      active,
      timerMs: this.#timerMs,
      delayMs,
      reelLoadReserveRatio: loadFrame.reelLoadReserveRatio,
      reelMaxLoadKg: loadFrame.reelMaxLoadKg,
      recoverSpeedMetersPerSecond:
        loadFrame.recoverSpeedMetersPerSecond,
      maxMoveMeters: loadFrame.maxMoveMeters,
      blockedReason,
      strokeFull,
      dragCanHold: loadFrame.dragCanHold,
      lineRecoverableMeters: recoverableLine,
    });
    return this.#state;
  }

  getState() {
    return { ...this.#state };
  }

  reset() {
    this.#timerMs = 0;
    this.#state = this.#createState({ blockedReason: "reset" });
  }

  #isStrokeFull({
    requireStrokeFull,
    strokeRatio,
    requiredStrokeRatio,
    strokeCapacityMeters,
    strokeUnrecoveredMeters,
    strokeToleranceMeters,
    rodPullBlockedReason,
  }) {
    if (!requireStrokeFull) return true;
    const capacity = this.#positive(strokeCapacityMeters);
    const unrecovered = this.#positive(strokeUnrecoveredMeters);
    return (
      this.#ratio(strokeRatio, 0) >= requiredStrokeRatio ||
      (
        capacity > 0 &&
        unrecovered >= capacity - strokeToleranceMeters
      ) ||
      rodPullBlockedReason === "max_distance_reached"
    );
  }

  #blockedReason({
    loadFrame,
    rodPullActive,
    strokeFull,
    hasRecoverableLine,
  }) {
    if (!loadFrame?.eligible) {
      return loadFrame?.blockedReason || "not_checked";
    }
    if (!rodPullActive) return "rod_pull_inactive";
    if (!strokeFull) return "stroke_not_full";
    if (!hasRecoverableLine) return "no_recoverable_line";
    return "ready";
  }

  #resolveDelayMs(config) {
    const delay = Number(config.delayMs);
    return Number.isFinite(delay) ? Math.max(0, delay) : 0;
  }

  #createState(overrides = {}) {
    return {
      eligible: false,
      active: false,
      timerMs: 0,
      delayMs: 0,
      reelLoadReserveRatio: 0,
      reelMaxLoadKg: 0,
      recoverSpeedMetersPerSecond: 0,
      maxMoveMeters: 0,
      blockedReason: "not_checked",
      strokeFull: false,
      dragCanHold: false,
      lineRecoverableMeters: 0,
      ...overrides,
    };
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, number);
    return Math.max(0, Number(fallback) || 0);
  }

  #ratio(value, fallback = 0) {
    return Math.max(0, Math.min(1, this.#positive(value, fallback)));
  }
}
