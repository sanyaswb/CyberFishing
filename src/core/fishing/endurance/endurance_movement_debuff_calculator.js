class EnduranceMovementDebuffCalculator {
  static DEFAULT_RADIAL_RANGE = Object.freeze([0.35, 1]);

  calculate({
    phase = "stamina",
    currentExhaustion = 0,
    maxEndurance = 0,
    baseRadialRange = null,
    config = {},
  } = {}) {
    const enabled = config?.enabled === true;
    const active = enabled && String(phase || "").toLowerCase() === "exhaustion";
    if (!active) {
      return Object.freeze({
        enabled,
        active: false,
        enduranceProgress: 0,
        debuffPower: 0,
        baseRadialRange: null,
        directionEnabled: false,
        exhaustedRadialRange: null,
        radialRangeOverride: null,
        behaviorWeightMultipliers: Object.freeze({}),
      });
    }

    const enduranceProgress = this.#calculateProgress({
      currentExhaustion,
      maxEndurance,
    });
    const curvePower = this.#positive(config.curvePower, 1);
    const debuffPower = Math.pow(enduranceProgress, curvePower);
    const resolvedBaseRadialRange = this.#normalizeRange(
      baseRadialRange,
      EnduranceMovementDebuffCalculator.DEFAULT_RADIAL_RANGE,
    );
    const radialRangeOverride = this.#calculateRadialRangeOverride({
      baseRadialRange: resolvedBaseRadialRange,
      debuffPower,
      config: config.direction || {},
    });
    const exhaustedRadialRange =
      config.direction?.enabled === true
        ? this.#normalizeRange(
            config.direction.exhaustedRadialRange,
            resolvedBaseRadialRange,
          )
        : null;
    const behaviorWeightMultipliers = this.#calculateBehaviorWeightMultipliers({
      debuffPower,
      config: config.behaviorWeights || {},
    });

    return Object.freeze({
      enabled,
      active,
      enduranceProgress,
      debuffPower,
      baseRadialRange: Object.freeze([...resolvedBaseRadialRange]),
      directionEnabled: config.direction?.enabled === true,
      exhaustedRadialRange: exhaustedRadialRange
        ? Object.freeze([...exhaustedRadialRange])
        : null,
      radialRangeOverride,
      behaviorWeightMultipliers,
    });
  }

  #calculateProgress({ currentExhaustion, maxEndurance }) {
    const max = Number(maxEndurance);
    if (!Number.isFinite(max) || max <= 0) return 0;
    return this.#clamp01(1 - (Number(currentExhaustion) || 0) / max);
  }

  #calculateRadialRangeOverride({ baseRadialRange, debuffPower, config }) {
    if (config?.enabled !== true) return null;
    const exhaustedRadialRange = this.#normalizeRange(
      config.exhaustedRadialRange,
      baseRadialRange,
    );
    return Object.freeze([
      this.#lerp(baseRadialRange[0], exhaustedRadialRange[0], debuffPower),
      this.#lerp(baseRadialRange[1], exhaustedRadialRange[1], debuffPower),
    ]);
  }

  #calculateBehaviorWeightMultipliers({ debuffPower, config }) {
    if (config?.enabled !== true) return Object.freeze({});
    const source = config.multipliersAtZeroEndurance || {};
    const multipliers = {};
    for (const [behaviorName, multiplier] of Object.entries(source)) {
      const target = this.#positive(multiplier, 1);
      multipliers[behaviorName] = this.#lerp(1, target, debuffPower);
    }
    return Object.freeze(multipliers);
  }

  #normalizeRange(value, fallback) {
    const range = Array.isArray(value) && value.length >= 2 ? value : fallback;
    const first = Number(range?.[0]);
    const second = Number(range?.[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return [...fallback];
    }
    return first <= second ? [first, second] : [second, first];
  }

  #positive(value, fallback) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
    return Number(fallback) || 1;
  }

  #lerp(a, b, t) {
    return a + (b - a) * this.#clamp01(t);
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
