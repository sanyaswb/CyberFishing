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
    const strokeRatioTolerance = this.#positive(
      config.strokeRatioTolerance,
      0.001,
    );
    const inputStrokeRatio = this.#ratio(strokeRatio, 0);
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
      strokeRatio: inputStrokeRatio,
      requiredStrokeRatio,
      strokeRatioTolerance,
    });
    const hasRecoverableLine = recoverableLine > 0.001;
    const eligible =
      loadFrame.eligible &&
      !!rodPullActive &&
      strokeFull;

    const blockedReason = this.#blockedReason({
      loadFrame,
      rodPullActive,
      strokeFull,
    });

    this.#timerMs = eligible
      ? Math.min(delayMs, this.#timerMs + this.#positive(dtMs))
      : 0;

    const engaged = eligible && this.#timerMs >= delayMs;
    const recoveringLine = engaged && hasRecoverableLine;
    this.#state = this.#createState({
      eligible,
      active: engaged,
      engaged,
      recoveringLine,
      hasRecoverableLine,
      timerMs: this.#timerMs,
      delayMs,
      reelLoadReserveRatio: loadFrame.reelLoadReserveRatio,
      reelMaxLoadKg: loadFrame.reelMaxLoadKg,
      enabled: loadFrame.enabled,
      hasReel: loadFrame.hasReel,
      playerHoldActive: loadFrame.playerHoldActive,
      rawTensionKg: loadFrame.rawTensionKg,
      dragLimitKg: loadFrame.dragLimitKg,
      dragLocked: loadFrame.dragLocked,
      shouldSlipDrag: loadFrame.shouldSlipDrag,
      tensionBelowDragLimit: loadFrame.tensionBelowDragLimit,
      tensionBelowMaxLoad: loadFrame.tensionBelowMaxLoad,
      retrieveSpeedMetersPerSecond:
        loadFrame.retrieveSpeedMetersPerSecond,
      requiredStrokeRatio,
      inputStrokeRatio,
      strokeRatioTolerance,
      strokeRatioDeltaToFull: Math.max(
        0,
        requiredStrokeRatio - inputStrokeRatio,
      ),
      recoverSpeedMetersPerSecond:
        loadFrame.recoverSpeedMetersPerSecond,
      maxMoveMeters: loadFrame.maxMoveMeters,
      blockedReason,
      lineRecoveryBlockedReason: this.#lineRecoveryBlockedReason({
        engaged,
        hasRecoverableLine,
        blockedReason,
      }),
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
    strokeRatioTolerance,
  }) {
    if (!requireStrokeFull) return true;
    return this.#ratio(strokeRatio, 0) >=
      requiredStrokeRatio - this.#positive(strokeRatioTolerance, 0.001);
  }

  #blockedReason({
    loadFrame,
    rodPullActive,
    strokeFull,
  }) {
    if (!loadFrame?.eligible) {
      return loadFrame?.blockedReason || "not_checked";
    }
    if (!rodPullActive) return "rod_pull_inactive";
    if (!strokeFull) return "stroke_not_full";
    return "ready";
  }

  #lineRecoveryBlockedReason({
    engaged,
    hasRecoverableLine,
    blockedReason,
  }) {
    if (!engaged) return blockedReason || "not_engaged";
    if (!hasRecoverableLine) return "no_recoverable_line";
    return "none";
  }

  #resolveDelayMs(config) {
    const delay = Number(config.delayMs);
    return Number.isFinite(delay) ? Math.max(0, delay) : 0;
  }

  #createState(overrides = {}) {
    return {
      eligible: false,
      active: false,
      engaged: false,
      recoveringLine: false,
      hasRecoverableLine: false,
      timerMs: 0,
      delayMs: 0,
      reelLoadReserveRatio: 0,
      reelMaxLoadKg: 0,
      enabled: false,
      hasReel: false,
      playerHoldActive: false,
      rawTensionKg: 0,
      dragLimitKg: 0,
      dragLocked: false,
      shouldSlipDrag: false,
      tensionBelowDragLimit: false,
      tensionBelowMaxLoad: false,
      retrieveSpeedMetersPerSecond: 0,
      requiredStrokeRatio: 1,
      inputStrokeRatio: 0,
      strokeRatioTolerance: 0.001,
      strokeRatioDeltaToFull: 1,
      recoverSpeedMetersPerSecond: 0,
      maxMoveMeters: 0,
      blockedReason: "not_checked",
      lineRecoveryBlockedReason: "not_checked",
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
