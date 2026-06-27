class PassiveEnduranceDrainCalculator {
  calculate({
    fishWonRadialForceKg = 0,
    dragBlockedForceKg = 0,
    lineTaut = false,
    lineTautRatio = null,
    fishBehaviorName = "unknown",
    weakestTackleLimitKg = 0,
    dtSec = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const fishEffortKg = this.#positive(fishWonRadialForceKg);
    const blockedForceKg = this.#positive(dragBlockedForceKg);
    const weakestLimit = this.#positive(weakestTackleLimitKg);
    const dt = this.#positive(dtSec);
    const drainPerSecondBase = enabled
      ? this.#positive(config.drainPerSecond, 15)
      : 0;
    const curvePower = Math.max(0.001, this.#positive(config.curvePower, 1));
    const resolvedLineTautRatio = this.#resolveLineTautRatio({
      lineTaut,
      lineTautRatio,
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
    const rawPassiveEnduranceDrainRatio = enabled
      ? fishEffortRatio *
        resistanceRatio *
        resolvedLineTautRatio *
        behaviorMultiplier
      : 0;
    const passiveEnduranceDrainRatio = this.#clamp01(
      rawPassiveEnduranceDrainRatio,
    );
    const curvedPassiveEnduranceDrainRatio = Math.pow(
      passiveEnduranceDrainRatio,
      curvePower,
    );
    const passiveEnduranceDrainPerSecond =
      drainPerSecondBase * curvedPassiveEnduranceDrainRatio;
    const passiveEnduranceDrain = passiveEnduranceDrainPerSecond * dt;

    return Object.freeze({
      enabled,
      fishWonRadialForceKg: fishEffortKg,
      dragBlockedForceKg: blockedForceKg,
      weakestTackleLimitKg: weakestLimit,
      lineTaut: resolvedLineTautRatio > 0,
      rawLineTautRatio: this.#rawLineTautRatio({ lineTaut, lineTautRatio }),
      lineTautRatio: resolvedLineTautRatio,
      fishBehaviorName: behaviorName,
      behaviorMultiplier,
      fishEffortRatio,
      resistanceRatio,
      rawPassiveEnduranceDrainRatio,
      passiveEnduranceDrainRatio,
      curvedPassiveEnduranceDrainRatio,
      passiveEnduranceDrainPerSecond,
      passiveEnduranceDrain,
      curvePower,
      dtSec: dt,
    });
  }

  #resolveLineTautRatio({ lineTaut, lineTautRatio }) {
    return this.#rawLineTautRatio({ lineTaut, lineTautRatio });
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
  window.PassiveEnduranceDrainCalculator = PassiveEnduranceDrainCalculator;
}
