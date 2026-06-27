class ActiveEnduranceDrainCalculator {
  calculate({
    activePressureRatio = 0,
    dtSec = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const ratio = this.#clamp01(activePressureRatio);
    const curvePower = Math.max(0.001, this.#positive(config.curvePower, 1));
    const curvedRatio = Math.pow(ratio, curvePower);
    const drainPerSecondBase = enabled
      ? this.#positive(config.drainPerSecond, 80)
      : 0;
    const dt = this.#positive(dtSec);
    const activeEnduranceDrainPerSecond = drainPerSecondBase * curvedRatio;
    const activeEnduranceDrain = activeEnduranceDrainPerSecond * dt;

    return Object.freeze({
      enabled,
      activePressureRatio: ratio,
      activeEnduranceDrainRatio: ratio,
      curvedActiveEnduranceDrainRatio: curvedRatio,
      activeEnduranceDrainPerSecond,
      activeEnduranceDrain,
      curvePower,
      dtSec: dt,
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

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }
}

if (typeof window !== "undefined") {
  window.ActiveEnduranceDrainCalculator = ActiveEnduranceDrainCalculator;
}
