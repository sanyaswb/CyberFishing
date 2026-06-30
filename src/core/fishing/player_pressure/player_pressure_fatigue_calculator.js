class PlayerPressureFatigueCalculator {
  calculate({
    state = null,
    dtSec = 0,
    pressureKg = 0,
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
    const pressureActive = enabled && pressure > pressureThresholdKg;

    if (!enabled) {
      return this.#frame({
        enabled: false,
        pressureThresholdKg,
        minEfficiency,
        delayAfterPressureMs,
        recoveryPerSecond,
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
  }) {
    const graceDurationMs = this.#positive(config?.graceDurationMs, 3000);
    const fatigueDurationMs = Math.max(
      1,
      this.#positive(config?.fatigueDurationMs, 6000),
    );
    const curvePower = Math.max(0.000001, this.#positive(config?.curvePower, 1.2));
    const previousHoldMs = this.#positive(state?.pressureHoldMs);
    const pressureHoldMs = previousHoldMs + Math.max(0, dtMs);
    const fatigueProgress = this.#clamp01(
      (pressureHoldMs - graceDurationMs) / fatigueDurationMs,
    );
    const curvedProgress = Math.pow(fatigueProgress, curvePower);
    const efficiency = this.#lerp(1, minEfficiency, curvedProgress);

    return this.#frame({
      enabled: true,
      efficiency,
      pressureHoldMs,
      recoveryIdleMs: 0,
      recoveryState: "pressuring",
      pressureActive: true,
      pressureKg: pressure,
      fatigueRatio: 1 - efficiency,
      fatigueProgress,
      pressureThresholdKg,
      minEfficiency,
      graceDurationMs,
      fatigueDurationMs,
      curvePower,
      delayAfterPressureMs,
      recoveryPerSecond,
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
  }) {
    const previousEfficiency = this.#clamp01(state?.efficiency ?? 1);
    const previousIdleMs = this.#positive(state?.recoveryIdleMs);
    const recoveryIdleMs = previousIdleMs + Math.max(0, dtMs);
    const waiting = previousEfficiency < 1 && recoveryIdleMs < delayAfterPressureMs;
    const recoveredEfficiency = waiting
      ? previousEfficiency
      : Math.min(1, previousEfficiency + recoveryPerSecond * dtSec);
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

    return this.#frame({
      enabled: true,
      efficiency: recoveredEfficiency,
      pressureHoldMs,
      recoveryIdleMs,
      recoveryState,
      pressureActive: false,
      pressureKg: pressure,
      fatigueRatio: 1 - recoveredEfficiency,
      fatigueProgress: this.#fatigueProgressFromEfficiency({
        efficiency: recoveredEfficiency,
        minEfficiency,
        curvePower: Math.max(0.000001, this.#positive(config?.curvePower, 1.2)),
      }),
      pressureThresholdKg,
      minEfficiency,
      graceDurationMs: this.#positive(config?.graceDurationMs, 3000),
      fatigueDurationMs: Math.max(
        1,
        this.#positive(config?.fatigueDurationMs, 6000),
      ),
      curvePower: Math.max(0.000001, this.#positive(config?.curvePower, 1.2)),
      delayAfterPressureMs,
      recoveryPerSecond,
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
    return Object.freeze({
      enabled: data.enabled === true,
      efficiency,
      pressureHoldMs: this.#positive(data.pressureHoldMs),
      recoveryIdleMs: this.#positive(data.recoveryIdleMs),
      recoveryState: data.recoveryState || "full",
      pressureActive: data.pressureActive === true,
      pressureKg: this.#positive(data.pressureKg),
      pressureThresholdKg: this.#positive(data.pressureThresholdKg, 0.01),
      fatigueRatio: this.#clamp01(data.fatigueRatio ?? (1 - efficiency)),
      fatigueProgress: this.#clamp01(data.fatigueProgress),
      minEfficiency: this.#clamp01(data.minEfficiency ?? 0.45),
      graceDurationMs: this.#positive(data.graceDurationMs, 3000),
      fatigueDurationMs: this.#positive(data.fatigueDurationMs, 6000),
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
}

if (typeof window !== "undefined") {
  window.PlayerPressureFatigueCalculator = PlayerPressureFatigueCalculator;
}
