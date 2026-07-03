class PlayerPressureFatigueCalculator {
  calculate({
    state = null,
    dtSec = 0,
    pressureKg = 0,
    sourceResult = null,
    sourceActive = null,
    sourceMode = null,
    sourceReason = null,
    config = {},
  } = {}) {
    const enabled = config?.enabled === true;
    const dtMs = this.#positive(dtSec) * 1000;
    const minEfficiency = this.#clamp01(config?.minEfficiency ?? 0.45);
    const pressureThresholdKg = this.#positive(
      config?.pressureThresholdKg,
      0.01,
    );
    const recovery = config?.recovery || {};
    const delayAfterPressureMs = this.#positive(
      recovery.delayAfterPressureMs,
      400,
    );
    const recoveryPerSecond = this.#positive(
      recovery.recoveryPerSecond,
      0.8,
    );
    const pressure = this.#positive(pressureKg);
    const resolvedSourceActive =
      typeof sourceActive === "boolean"
        ? sourceActive
        : sourceResult?.active;
    const pressureActive =
      enabled &&
      resolvedSourceActive === true;
    const sourceFrame = this.#sourceFrame({
      config,
      sourceResult,
      sourceActive: pressureActive,
      sourceMode,
      sourceReason,
    });

    if (!enabled) {
      const controlBreak = this.#controlBreakFrame({ config });
      return this.#frame({
        enabled: false,
        stateName: "idle",
        ...sourceFrame,
        sourceActive: false,
        pressureThresholdKg,
        minEfficiency,
        delayAfterPressureMs,
        recoveryDelayMs: delayAfterPressureMs,
        recoveryPerSecond,
        controlBreakEnabled: controlBreak.enabled,
        isControlExhausted: false,
        controlBreakFatigueProgressThreshold:
          controlBreak.fatigueProgressThreshold,
        controlBreakMinContinuousPressureMs:
          controlBreak.minContinuousPressureMs,
      });
    }

    if (pressureActive) {
      return this.#pressureFrame({
        state,
        dtMs,
        pressure,
        config,
        minEfficiency,
        pressureThresholdKg,
        delayAfterPressureMs,
        recoveryPerSecond,
        sourceFrame,
      });
    }

    return this.#recoveryFrame({
      state,
      dtSec: this.#positive(dtSec),
      dtMs,
      pressure,
      minEfficiency,
      pressureThresholdKg,
      delayAfterPressureMs,
      recoveryPerSecond,
      config,
      sourceFrame,
    });
  }

  #pressureFrame({
    state,
    dtMs,
    pressure,
    config,
    minEfficiency,
    pressureThresholdKg,
    delayAfterPressureMs,
    recoveryPerSecond,
    sourceFrame,
  }) {
    const graceDurationMs = this.#positive(config?.graceDurationMs, 3000);
    const fatigueDurationMs = Math.max(
      1,
      this.#positive(config?.fatigueDurationMs, 6000),
    );
    const curvePower = Math.max(0.000001, this.#positive(config?.curvePower, 1.2));
    const previousHoldMs = this.#positive(state?.pressureHoldMs);
    const pressureHoldMs = previousHoldMs + Math.max(0, dtMs);
    const graceElapsedMs = Math.min(pressureHoldMs, graceDurationMs);
    const graceRemainingMs = Math.max(0, graceDurationMs - graceElapsedMs);
    const fatigueElapsedMs = Math.max(0, pressureHoldMs - graceDurationMs);
    const fatigueRemainingMs = Math.max(
      0,
      fatigueDurationMs - fatigueElapsedMs,
    );
    const fatigueProgress = this.#clamp01(
      (pressureHoldMs - graceDurationMs) / fatigueDurationMs,
    );
    const curvedProgress = Math.pow(fatigueProgress, curvePower);
    const efficiency = this.#lerp(1, minEfficiency, curvedProgress);
    const controlBreak = this.#controlBreakFrame({
      config,
      pressureActive: true,
      pressureHoldMs,
      fatigueProgress,
    });

    return this.#frame({
      enabled: true,
      stateName: pressureHoldMs < graceDurationMs ? "grace" : "fatiguing",
      ...sourceFrame,
      efficiency,
      pressureHoldMs,
      holdElapsedMs: pressureHoldMs,
      recoveryIdleMs: 0,
      recoveryState: pressureHoldMs < graceDurationMs
        ? "grace"
        : "pressuring",
      pressureActive: true,
      pressureKg: pressure,
      fatigueRatio: 1 - efficiency,
      fatigueProgress,
      graceElapsedMs,
      graceDurationMs,
      graceRemainingMs,
      fatigueElapsedMs,
      fatigueDurationMs,
      fatigueRemainingMs,
      recoveryDelayElapsedMs: 0,
      recoveryDelayMs: delayAfterPressureMs,
      recoveryDelayRemainingMs: 0,
      recoveryProgress: 0,
      recoveryRemainingMs: 0,
      controlBreakEnabled: controlBreak.enabled,
      isControlExhausted: controlBreak.isControlExhausted,
      controlBreakFatigueProgressThreshold:
        controlBreak.fatigueProgressThreshold,
      controlBreakMinContinuousPressureMs:
        controlBreak.minContinuousPressureMs,
      pressureThresholdKg,
      minEfficiency,
      graceDurationMs,
      fatigueDurationMs,
      curvePower,
      delayAfterPressureMs,
      recoveryPerSecond,
    });
  }

  #controlBreakFrame({
    config = {},
    pressureActive = false,
    pressureHoldMs = 0,
    fatigueProgress = 0,
  } = {}) {
    const controlBreak = config?.controlBreak || {};
    const enabled = controlBreak.enabled === true;
    const fatigueProgressThreshold = this.#clamp01(
      controlBreak.fatigueProgressThreshold ??
        controlBreak.fatigueRatioThreshold ??
        0.9,
    );
    const minContinuousPressureMs = this.#positive(
      controlBreak.minContinuousPressureMs,
      8000,
    );
    const isControlExhausted =
      enabled &&
      pressureActive === true &&
      this.#positive(pressureHoldMs) >= minContinuousPressureMs &&
      this.#clamp01(fatigueProgress) >= fatigueProgressThreshold;

    return Object.freeze({
      enabled,
      isControlExhausted,
      fatigueProgressThreshold,
      fatigueRatioThreshold: fatigueProgressThreshold,
      minContinuousPressureMs,
    });
  }

  #recoveryFrame({
    state,
    dtSec,
    dtMs,
    pressure,
    minEfficiency,
    pressureThresholdKg,
    delayAfterPressureMs,
    recoveryPerSecond,
    config,
    sourceFrame,
  }) {
    const previousEfficiency = this.#clamp01(state?.efficiency ?? 1);
    const previousIdleMs = this.#positive(state?.recoveryIdleMs);
    const recoveryIdleMs = previousIdleMs + Math.max(0, dtMs);
    const waiting = previousEfficiency < 1 && recoveryIdleMs < delayAfterPressureMs;
    const recoveredEfficiency = waiting
      ? previousEfficiency
      : Math.min(1, previousEfficiency + recoveryPerSecond * dtSec);
    const fatigueProgress = this.#fatigueProgressFromEfficiency({
      efficiency: recoveredEfficiency,
      minEfficiency,
      curvePower: Math.max(0.000001, this.#positive(config?.curvePower, 1.2)),
    });
    const recoveryDelayElapsedMs = Math.min(
      recoveryIdleMs,
      delayAfterPressureMs,
    );
    const recoveryDelayRemainingMs = Math.max(
      0,
      delayAfterPressureMs - recoveryDelayElapsedMs,
    );
    const recoveryRemainingMs =
      recoveredEfficiency >= 0.999999 || recoveryPerSecond <= 0
        ? 0
        : Math.ceil(((1 - recoveredEfficiency) / recoveryPerSecond) * 1000);
    const recoveryProgress = this.#clamp01(1 - fatigueProgress);
    const pressureHoldMs = this.#holdMsFromEfficiency({
      efficiency: recoveredEfficiency,
      minEfficiency,
      graceDurationMs: this.#positive(config?.graceDurationMs, 3000),
      fatigueDurationMs: Math.max(
        1,
        this.#positive(config?.fatigueDurationMs, 6000),
      ),
      curvePower: Math.max(0.000001, this.#positive(config?.curvePower, 1.2)),
    });
    const recoveryState = recoveredEfficiency >= 0.999999
      ? "full"
      : waiting
        ? "waiting"
        : "active";
    const controlBreak = this.#controlBreakFrame({ config });

    return this.#frame({
      enabled: true,
      stateName: recoveredEfficiency >= 0.999999 ? "idle" : "recovering",
      ...sourceFrame,
      efficiency: recoveredEfficiency,
      pressureHoldMs,
      holdElapsedMs: pressureHoldMs,
      recoveryIdleMs,
      recoveryState,
      pressureActive: false,
      pressureKg: pressure,
      fatigueRatio: 1 - recoveredEfficiency,
      fatigueProgress,
      pressureThresholdKg,
      minEfficiency,
      graceDurationMs: this.#positive(config?.graceDurationMs, 3000),
      fatigueDurationMs: Math.max(
        1,
        this.#positive(config?.fatigueDurationMs, 6000),
      ),
      curvePower: Math.max(0.000001, this.#positive(config?.curvePower, 1.2)),
      delayAfterPressureMs,
      recoveryDelayMs: delayAfterPressureMs,
      recoveryDelayElapsedMs,
      recoveryDelayRemainingMs,
      recoveryProgress,
      recoveryRemainingMs,
      recoveryPerSecond,
      controlBreakEnabled: controlBreak.enabled,
      isControlExhausted: false,
      controlBreakFatigueProgressThreshold:
        controlBreak.fatigueProgressThreshold,
      controlBreakMinContinuousPressureMs:
        controlBreak.minContinuousPressureMs,
    });
  }

  #holdMsFromEfficiency({
    efficiency,
    minEfficiency,
    graceDurationMs,
    fatigueDurationMs,
    curvePower,
  }) {
    if (efficiency >= 0.999999) return 0;
    const progress = this.#fatigueProgressFromEfficiency({
      efficiency,
      minEfficiency,
      curvePower,
    });
    return graceDurationMs + progress * fatigueDurationMs;
  }

  #fatigueProgressFromEfficiency({ efficiency, minEfficiency, curvePower }) {
    if (efficiency >= 0.999999 || minEfficiency >= 0.999999) return 0;
    const fatigueRatio = this.#clamp01((1 - efficiency) / (1 - minEfficiency));
    return Math.pow(fatigueRatio, 1 / Math.max(0.000001, curvePower));
  }

  #frame(data = {}) {
    const efficiency = this.#clamp01(data.efficiency ?? 1);
    const graceDurationMs = this.#positive(data.graceDurationMs, 3000);
    const fatigueDurationMs = this.#positive(data.fatigueDurationMs, 6000);
    const holdElapsedMs = this.#positive(
      data.holdElapsedMs ?? data.pressureHoldMs,
    );
    const graceElapsedMs = this.#positive(
      data.graceElapsedMs,
      Math.min(holdElapsedMs, graceDurationMs),
    );
    const fatigueElapsedMs = this.#positive(
      data.fatigueElapsedMs,
      Math.max(0, holdElapsedMs - graceDurationMs),
    );
    const recoveryDelayMs = this.#positive(
      data.recoveryDelayMs ?? data.delayAfterPressureMs,
      400,
    );
    return Object.freeze({
      enabled: data.enabled === true,
      efficiency,
      stateName: data.stateName || "idle",
      sourceMode: data.sourceMode || "reel_hold",
      sourceActive: data.sourceActive === true,
      sourceReason: data.sourceReason || "reel_hold_inactive",
      pressureHoldMs: this.#positive(data.pressureHoldMs ?? holdElapsedMs),
      holdElapsedMs,
      recoveryIdleMs: this.#positive(data.recoveryIdleMs),
      recoveryState: data.recoveryState || "full",
      pressureActive: data.pressureActive === true,
      pressureKg: this.#positive(data.pressureKg),
      pressureThresholdKg: this.#positive(data.pressureThresholdKg, 0.01),
      fatigueRatio: this.#clamp01(data.fatigueRatio ?? (1 - efficiency)),
      fatigueProgress: this.#clamp01(data.fatigueProgress),
      graceElapsedMs,
      graceDurationMs,
      graceRemainingMs: this.#positive(
        data.graceRemainingMs,
        Math.max(0, graceDurationMs - graceElapsedMs),
      ),
      fatigueElapsedMs,
      fatigueDurationMs,
      fatigueRemainingMs: this.#positive(
        data.fatigueRemainingMs,
        Math.max(0, fatigueDurationMs - fatigueElapsedMs),
      ),
      recoveryDelayElapsedMs: this.#positive(data.recoveryDelayElapsedMs),
      recoveryDelayMs,
      recoveryDelayRemainingMs: this.#positive(
        data.recoveryDelayRemainingMs,
        Math.max(0, recoveryDelayMs - this.#positive(data.recoveryDelayElapsedMs)),
      ),
      recoveryProgress: this.#clamp01(data.recoveryProgress),
      recoveryRemainingMs: this.#positive(data.recoveryRemainingMs),
      controlBreakEnabled: data.controlBreakEnabled === true,
      isControlExhausted: data.isControlExhausted === true,
      controlBreakFatigueProgressThreshold: this.#clamp01(
        data.controlBreakFatigueProgressThreshold ??
          data.controlBreakFatigueRatioThreshold ??
          0.9,
      ),
      controlBreakFatigueRatioThreshold: this.#clamp01(
        data.controlBreakFatigueProgressThreshold ??
          data.controlBreakFatigueRatioThreshold ??
          0.9,
      ),
      controlBreakMinContinuousPressureMs: this.#positive(
        data.controlBreakMinContinuousPressureMs,
        8000,
      ),
      minEfficiency: this.#clamp01(data.minEfficiency ?? 0.45),
      curvePower: this.#positive(data.curvePower, 1.2),
      delayAfterPressureMs: this.#positive(data.delayAfterPressureMs, 400),
      recoveryPerSecond: this.#positive(data.recoveryPerSecond, 0.8),
    });
  }

  #lerp(a, b, t) {
    return a + (b - a) * this.#clamp01(t);
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }

  #sourceFrame({
    config = {},
    sourceResult = null,
    sourceActive,
    sourceMode,
    sourceReason,
  } = {}) {
    const configuredMode = config?.source?.mode || "reel_hold";
    return Object.freeze({
      sourceMode:
        sourceMode ||
        sourceResult?.sourceMode ||
        configuredMode,
      sourceActive: sourceActive === true,
      sourceReason:
        sourceReason ||
        sourceResult?.reason ||
        (sourceActive ? "source_active" : "missing_source"),
    });
  }
}

if (typeof window !== "undefined") {
  window.PlayerPressureFatigueCalculator = PlayerPressureFatigueCalculator;
}
