class PassiveStaminaDrainCalculator {
  calculate({
    fishWonRadialForceKg = 0,
    dragBlockedForceKg = 0,
    lineTaut = false,
    lineTautRatio = null,
    fishBehaviorName = "unknown",
    weakestTackleLimitKg = 0,
    shouldSlipDrag = false,
    hardLineLimit = false,
    dtSec = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled === true;
    const fishEffortKg = this.#positive(fishWonRadialForceKg);
    const blockedForceKg = this.#positive(dragBlockedForceKg);
    const weakestLimit = this.#positive(weakestTackleLimitKg);
    const dt = this.#positive(dtSec);
    const drainPerSecondBase = enabled
      ? this.#positive(config.drainPerSecond, 15)
      : 0;
    const curvePower = Math.max(0.001, this.#positive(config.curvePower, 1));
    const tautThreshold = this.#clamp01(config.lineTautThresholdRatio ?? 0.995);
    const resolvedLineTautRatio = this.#resolveLineTautRatio({
      lineTaut,
      lineTautRatio,
      threshold: tautThreshold,
    });
    const behaviorName = this.#normalizeBehaviorName(fishBehaviorName);
    const behaviorMultiplier = this.#behaviorMultiplier({
      behaviorName,
      config,
    });
    const fishEffortRatio = weakestLimit > 0
      ? this.#clamp01(fishEffortKg / weakestLimit)
      : 0;
    const resistanceRatio = fishEffortKg > 0.000001
      ? this.#clamp01(blockedForceKg / Math.max(fishEffortKg, 0.000001))
      : 0;
    const slippingDragMultiplier = shouldSlipDrag
      ? this.#positive(config.slippingDragMultiplier, 1)
      : 1;
    const hardLimitMultiplier = hardLineLimit
      ? this.#positive(config.hardLimitMultiplier, 1)
      : 1;
    const rawPassiveDrainRatio = enabled
      ? fishEffortRatio *
        resistanceRatio *
        resolvedLineTautRatio *
        behaviorMultiplier *
        slippingDragMultiplier *
        hardLimitMultiplier
      : 0;
    const passiveDrainRatio = this.#clamp01(rawPassiveDrainRatio);
    const curvedPassiveDrainRatio = Math.pow(passiveDrainRatio, curvePower);
    const passiveDrainPerSecond = drainPerSecondBase * curvedPassiveDrainRatio;
    const passiveStaminaDrain = passiveDrainPerSecond * dt;

    return Object.freeze({
      enabled,
      fishWonRadialForceKg: fishEffortKg,
      dragBlockedForceKg: blockedForceKg,
      weakestTackleLimitKg: weakestLimit,
      lineTaut: resolvedLineTautRatio > 0,
      rawLineTautRatio: this.#rawLineTautRatio({ lineTaut, lineTautRatio }),
      lineTautRatio: resolvedLineTautRatio,
      lineTautThresholdRatio: tautThreshold,
      fishBehaviorName: behaviorName,
      behaviorMultiplier,
      fishEffortRatio,
      resistanceRatio,
      shouldSlipDrag: !!shouldSlipDrag,
      hardLineLimit: !!hardLineLimit,
      slippingDragMultiplier,
      hardLimitMultiplier,
      rawPassiveDrainRatio,
      passiveDrainRatio,
      curvedPassiveDrainRatio,
      passiveDrainPerSecond,
      passiveStaminaDrain,
      curvePower,
    });
  }

  #resolveLineTautRatio({ lineTaut, lineTautRatio, threshold }) {
    const rawRatio = this.#rawLineTautRatio({ lineTaut, lineTautRatio });
    if (rawRatio < threshold) return 0;
    return this.#clamp01(rawRatio);
  }

  #rawLineTautRatio({ lineTaut, lineTautRatio }) {
    if (lineTautRatio !== null && lineTautRatio !== undefined) {
      const explicit = Number(lineTautRatio);
      if (Number.isFinite(explicit)) return this.#clamp01(explicit);
    }
    return lineTaut ? 1 : 0;
  }

  #behaviorMultiplier({ behaviorName, config }) {
    const multipliers = config.behaviorMultipliers || {};
    const specific = Number(multipliers[behaviorName]);
    if (Number.isFinite(specific) && specific >= 0) return specific;
    return this.#positive(config.defaultBehaviorMultiplier, 0.5);
  }

  #normalizeBehaviorName(value) {
    const text = String(value || "unknown").trim().toLowerCase();
    return text || "unknown";
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
  window.PassiveStaminaDrainCalculator = PassiveStaminaDrainCalculator;
}
