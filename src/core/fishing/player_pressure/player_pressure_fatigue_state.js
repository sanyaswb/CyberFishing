class PlayerPressureFatigueState {
  enabled = false;
  efficiency = 1;
  pressureHoldMs = 0;
  recoveryIdleMs = 0;
  recoveryState = "full";
  stateName = "idle";
  pressureActive = false;
  pressureKg = 0;
  fatigueRatio = 0;
  fatigueProgress = 0;
  sourceMode = "reel_hold_session";
  sourceActive = false;
  sourceReason = "reel_hold_session_inactive";
  holdElapsedMs = 0;
  graceElapsedMs = 0;
  graceDurationMs = 3000;
  graceRemainingMs = 0;
  fatigueElapsedMs = 0;
  fatigueDurationMs = 6000;
  fatigueRemainingMs = 0;
  recoveryDelayElapsedMs = 0;
  recoveryDelayMs = 400;
  recoveryDelayRemainingMs = 0;
  recoveryProgress = 0;
  recoveryRemainingMs = 0;
  controlBreakEnabled = false;
  isControlExhausted = false;
  controlBreakFatigueProgressThreshold = 0.9;
  controlBreakMinContinuousPressureMs = 8000;
  delayAfterPressureMs = 0;
  recoveryPerSecond = 0;

  reset() {
    this.enabled = false;
    this.efficiency = 1;
    this.pressureHoldMs = 0;
    this.recoveryIdleMs = 0;
    this.recoveryState = "full";
    this.stateName = "idle";
    this.pressureActive = false;
    this.pressureKg = 0;
    this.fatigueRatio = 0;
    this.fatigueProgress = 0;
    this.sourceMode = "reel_hold_session";
    this.sourceActive = false;
    this.sourceReason = "reel_hold_session_inactive";
    this.holdElapsedMs = 0;
    this.graceElapsedMs = 0;
    this.graceDurationMs = 3000;
    this.graceRemainingMs = 0;
    this.fatigueElapsedMs = 0;
    this.fatigueDurationMs = 6000;
    this.fatigueRemainingMs = 0;
    this.recoveryDelayElapsedMs = 0;
    this.recoveryDelayMs = 400;
    this.recoveryDelayRemainingMs = 0;
    this.recoveryProgress = 0;
    this.recoveryRemainingMs = 0;
    this.controlBreakEnabled = false;
    this.isControlExhausted = false;
    this.controlBreakFatigueProgressThreshold = 0.9;
    this.controlBreakMinContinuousPressureMs = 8000;
    this.delayAfterPressureMs = 0;
    this.recoveryPerSecond = 0;
  }

  applyFrame(frame = {}) {
    this.enabled = frame.enabled === true;
    this.efficiency = this.#ratio(frame.efficiency, 1);
    this.pressureHoldMs = this.#positive(frame.pressureHoldMs);
    this.recoveryIdleMs = this.#positive(frame.recoveryIdleMs);
    this.recoveryState = frame.recoveryState || "full";
    this.stateName = frame.stateName || "idle";
    this.pressureActive = frame.pressureActive === true;
    this.pressureKg = this.#positive(frame.pressureKg);
    this.fatigueRatio = this.#ratio(frame.fatigueRatio);
    this.fatigueProgress = this.#ratio(frame.fatigueProgress);
    this.sourceMode = frame.sourceMode || "reel_hold_session";
    this.sourceActive = frame.sourceActive === true;
    this.sourceReason = frame.sourceReason || "reel_hold_session_inactive";
    this.holdElapsedMs = this.#positive(
      frame.holdElapsedMs ?? frame.pressureHoldMs,
    );
    this.graceElapsedMs = this.#positive(frame.graceElapsedMs);
    this.graceDurationMs = this.#positive(frame.graceDurationMs, 3000);
    this.graceRemainingMs = this.#positive(frame.graceRemainingMs);
    this.fatigueElapsedMs = this.#positive(frame.fatigueElapsedMs);
    this.fatigueDurationMs = this.#positive(frame.fatigueDurationMs, 6000);
    this.fatigueRemainingMs = this.#positive(frame.fatigueRemainingMs);
    this.recoveryDelayElapsedMs = this.#positive(
      frame.recoveryDelayElapsedMs,
    );
    this.recoveryDelayMs = this.#positive(
      frame.recoveryDelayMs ?? frame.delayAfterPressureMs,
      400,
    );
    this.recoveryDelayRemainingMs = this.#positive(
      frame.recoveryDelayRemainingMs,
    );
    this.recoveryProgress = this.#ratio(frame.recoveryProgress);
    this.recoveryRemainingMs = this.#positive(frame.recoveryRemainingMs);
    this.controlBreakEnabled = frame.controlBreakEnabled === true;
    this.isControlExhausted = frame.isControlExhausted === true;
    this.controlBreakFatigueProgressThreshold = this.#ratio(
      frame.controlBreakFatigueProgressThreshold ??
        frame.controlBreakFatigueRatioThreshold,
      0.9,
    );
    this.controlBreakMinContinuousPressureMs = this.#positive(
      frame.controlBreakMinContinuousPressureMs,
      8000,
    );
    this.delayAfterPressureMs = this.#positive(frame.delayAfterPressureMs);
    this.recoveryPerSecond = this.#positive(frame.recoveryPerSecond);
  }

  toFrame() {
    return Object.freeze({
      enabled: this.enabled,
      efficiency: this.efficiency,
      pressureHoldMs: this.pressureHoldMs,
      recoveryIdleMs: this.recoveryIdleMs,
      recoveryState: this.recoveryState,
      stateName: this.stateName,
      pressureActive: this.pressureActive,
      pressureKg: this.pressureKg,
      fatigueRatio: this.fatigueRatio,
      fatigueProgress: this.fatigueProgress,
      sourceMode: this.sourceMode,
      sourceActive: this.sourceActive,
      sourceReason: this.sourceReason,
      holdElapsedMs: this.holdElapsedMs,
      graceElapsedMs: this.graceElapsedMs,
      graceDurationMs: this.graceDurationMs,
      graceRemainingMs: this.graceRemainingMs,
      fatigueElapsedMs: this.fatigueElapsedMs,
      fatigueDurationMs: this.fatigueDurationMs,
      fatigueRemainingMs: this.fatigueRemainingMs,
      recoveryDelayElapsedMs: this.recoveryDelayElapsedMs,
      recoveryDelayMs: this.recoveryDelayMs,
      recoveryDelayRemainingMs: this.recoveryDelayRemainingMs,
      recoveryProgress: this.recoveryProgress,
      recoveryRemainingMs: this.recoveryRemainingMs,
      controlBreakEnabled: this.controlBreakEnabled,
      isControlExhausted: this.isControlExhausted,
      controlBreakFatigueProgressThreshold:
        this.controlBreakFatigueProgressThreshold,
      controlBreakFatigueRatioThreshold:
        this.controlBreakFatigueProgressThreshold,
      controlBreakMinContinuousPressureMs:
        this.controlBreakMinContinuousPressureMs,
      delayAfterPressureMs: this.delayAfterPressureMs,
      recoveryPerSecond: this.recoveryPerSecond,
    });
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #ratio(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, Math.min(1, number));
    return Math.max(0, Math.min(1, Number(fallback) || 0));
  }
}

if (typeof window !== "undefined") {
  window.PlayerPressureFatigueState = PlayerPressureFatigueState;
}
