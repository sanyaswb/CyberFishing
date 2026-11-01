import { clampUnitFinite, nonNegativeOr } from "../../../../engine/math/number_normalization.js";

export class PlayerPressureFatigueCalculator {
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
    const dtMs = nonNegativeOr(dtSec) * 1000;
    const minEfficiency = clampUnitFinite(config?.minEfficiency ?? 0.45);
    const pressureThresholdKg = nonNegativeOr(
      config?.pressureThresholdKg,
      0.01,
    );
    const recovery = config?.recovery || {};
    const delayAfterPressureMs = nonNegativeOr(
      recovery.delayAfterPressureMs,
      400,
    );
    const recoveryPerSecond = nonNegativeOr(
      recovery.recoveryPerSecond,
      0.8,
    );
    const pressure = nonNegativeOr(pressureKg);
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
      dtSec: nonNegativeOr(dtSec),
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
    const graceDurationMs = nonNegativeOr(config?.graceDurationMs, 3000);
    const fatigueDurationMs = Math.max(
      1,
      nonNegativeOr(config?.fatigueDurationMs, 6000),
    );
    const curvePower = Math.max(0.000001, nonNegativeOr(config?.curvePower, 1.2));
    const previousHoldMs = nonNegativeOr(state?.pressureHoldMs);
    const pressureHoldMs = previousHoldMs + Math.max(0, dtMs);
    const graceElapsedMs = Math.min(pressureHoldMs, graceDurationMs);
    const graceRemainingMs = Math.max(0, graceDurationMs - graceElapsedMs);
    const fatigueElapsedMs = Math.max(0, pressureHoldMs - graceDurationMs);
    const fatigueRemainingMs = Math.max(
      0,
      fatigueDurationMs - fatigueElapsedMs,
    );
    const fatigueProgress = clampUnitFinite(
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
    const fatigueProgressThreshold = clampUnitFinite(
      controlBreak.fatigueProgressThreshold ??
        controlBreak.fatigueRatioThreshold ??
        0.9,
    );
    const minContinuousPressureMs = nonNegativeOr(
      controlBreak.minContinuousPressureMs,
      8000,
    );
    const isControlExhausted =
      enabled &&
      pressureActive === true &&
      nonNegativeOr(pressureHoldMs) >= minContinuousPressureMs &&
      clampUnitFinite(fatigueProgress) >= fatigueProgressThreshold;

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
    const previousEfficiency = clampUnitFinite(state?.efficiency ?? 1);
    const previousIdleMs = nonNegativeOr(state?.recoveryIdleMs);
    const recoveryIdleMs = previousIdleMs + Math.max(0, dtMs);
    const waiting = previousEfficiency < 1 && recoveryIdleMs < delayAfterPressureMs;
    const recoveredEfficiency = waiting
      ? previousEfficiency
      : Math.min(1, previousEfficiency + recoveryPerSecond * dtSec);
    const fatigueProgress = this.#fatigueProgressFromEfficiency({
      efficiency: recoveredEfficiency,
      minEfficiency,
      curvePower: Math.max(0.000001, nonNegativeOr(config?.curvePower, 1.2)),
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
    const recoveryProgress = clampUnitFinite(1 - fatigueProgress);
    const pressureHoldMs = this.#holdMsFromEfficiency({
      efficiency: recoveredEfficiency,
      minEfficiency,
      graceDurationMs: nonNegativeOr(config?.graceDurationMs, 3000),
      fatigueDurationMs: Math.max(
        1,
        nonNegativeOr(config?.fatigueDurationMs, 6000),
      ),
      curvePower: Math.max(0.000001, nonNegativeOr(config?.curvePower, 1.2)),
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
      graceDurationMs: nonNegativeOr(config?.graceDurationMs, 3000),
      fatigueDurationMs: Math.max(
        1,
        nonNegativeOr(config?.fatigueDurationMs, 6000),
      ),
      curvePower: Math.max(0.000001, nonNegativeOr(config?.curvePower, 1.2)),
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
    const fatigueRatio = clampUnitFinite((1 - efficiency) / (1 - minEfficiency));
    return Math.pow(fatigueRatio, 1 / Math.max(0.000001, curvePower));
  }

  #frame(data = {}) {
    const efficiency = clampUnitFinite(data.efficiency ?? 1);
    const graceDurationMs = nonNegativeOr(data.graceDurationMs, 3000);
    const fatigueDurationMs = nonNegativeOr(data.fatigueDurationMs, 6000);
    const holdElapsedMs = nonNegativeOr(
      data.holdElapsedMs ?? data.pressureHoldMs,
    );
    const graceElapsedMs = nonNegativeOr(
      data.graceElapsedMs,
      Math.min(holdElapsedMs, graceDurationMs),
    );
    const fatigueElapsedMs = nonNegativeOr(
      data.fatigueElapsedMs,
      Math.max(0, holdElapsedMs - graceDurationMs),
    );
    const recoveryDelayMs = nonNegativeOr(
      data.recoveryDelayMs ?? data.delayAfterPressureMs,
      400,
    );
    return Object.freeze({
      enabled: data.enabled === true,
      efficiency,
      stateName: data.stateName || "idle",
      sourceMode: data.sourceMode || "reel_hold_session",
      sourceActive: data.sourceActive === true,
      sourceReason:
        data.sourceReason || "reel_hold_session_inactive",
      pressureHoldMs: nonNegativeOr(data.pressureHoldMs ?? holdElapsedMs),
      holdElapsedMs,
      recoveryIdleMs: nonNegativeOr(data.recoveryIdleMs),
      recoveryState: data.recoveryState || "full",
      pressureActive: data.pressureActive === true,
      pressureKg: nonNegativeOr(data.pressureKg),
      pressureThresholdKg: nonNegativeOr(data.pressureThresholdKg, 0.01),
      fatigueRatio: clampUnitFinite(data.fatigueRatio ?? (1 - efficiency)),
      fatigueProgress: clampUnitFinite(data.fatigueProgress),
      graceElapsedMs,
      graceDurationMs,
      graceRemainingMs: nonNegativeOr(
        data.graceRemainingMs,
        Math.max(0, graceDurationMs - graceElapsedMs),
      ),
      fatigueElapsedMs,
      fatigueDurationMs,
      fatigueRemainingMs: nonNegativeOr(
        data.fatigueRemainingMs,
        Math.max(0, fatigueDurationMs - fatigueElapsedMs),
      ),
      recoveryDelayElapsedMs: nonNegativeOr(data.recoveryDelayElapsedMs),
      recoveryDelayMs,
      recoveryDelayRemainingMs: nonNegativeOr(
        data.recoveryDelayRemainingMs,
        Math.max(0, recoveryDelayMs - nonNegativeOr(data.recoveryDelayElapsedMs)),
      ),
      recoveryProgress: clampUnitFinite(data.recoveryProgress),
      recoveryRemainingMs: nonNegativeOr(data.recoveryRemainingMs),
      controlBreakEnabled: data.controlBreakEnabled === true,
      isControlExhausted: data.isControlExhausted === true,
      controlBreakFatigueProgressThreshold: clampUnitFinite(
        data.controlBreakFatigueProgressThreshold ??
          data.controlBreakFatigueRatioThreshold ??
          0.9,
      ),
      controlBreakFatigueRatioThreshold: clampUnitFinite(
        data.controlBreakFatigueProgressThreshold ??
          data.controlBreakFatigueRatioThreshold ??
          0.9,
      ),
      controlBreakMinContinuousPressureMs: nonNegativeOr(
        data.controlBreakMinContinuousPressureMs,
        8000,
      ),
      minEfficiency: clampUnitFinite(data.minEfficiency ?? 0.45),
      curvePower: nonNegativeOr(data.curvePower, 1.2),
      delayAfterPressureMs: nonNegativeOr(data.delayAfterPressureMs, 400),
      recoveryPerSecond: nonNegativeOr(data.recoveryPerSecond, 0.8),
    });
  }

  #lerp(a, b, t) {
    return a + (b - a) * clampUnitFinite(t);
  }

  #sourceFrame({
    config = {},
    sourceResult = null,
    sourceActive,
    sourceMode,
    sourceReason,
  } = {}) {
    const configuredMode = config?.source?.mode || "reel_hold_session";
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
