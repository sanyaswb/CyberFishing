class PassiveStaminaDrainCalculator {
  #delegate;

  constructor({
    delegate = typeof PassiveEnduranceDrainCalculator !== "undefined"
      ? new PassiveEnduranceDrainCalculator()
      : null,
  } = {}) {
    this.#delegate = delegate;
  }

  calculate(args = {}) {
    const frame = this.#delegate?.calculate?.(args) || this.#disabledFrame();
    return Object.freeze({
      ...frame,
      passiveDrainRatio: frame.passiveEnduranceDrainRatio ?? 0,
      curvedPassiveDrainRatio:
        frame.curvedPassiveEnduranceDrainRatio ?? 0,
      passiveDrainPerSecond:
        frame.passiveEnduranceDrainPerSecond ?? 0,
      passiveStaminaDrain: 0,
      passiveEnduranceDrain:
        frame.passiveEnduranceDrain ?? 0,
      note: "Deprecated compatibility alias. Passive drain now belongs to endurance.",
    });
  }

  #disabledFrame() {
    return Object.freeze({
      enabled: false,
      fishWonRadialForceKg: 0,
      dragBlockedForceKg: 0,
      weakestTackleLimitKg: 0,
      lineTaut: false,
      rawLineTautRatio: 0,
      lineTautRatio: 0,
      fishBehaviorName: "unknown",
      behaviorMultiplier: 0,
      fishEffortRatio: 0,
      resistanceRatio: 0,
      rawPassiveEnduranceDrainRatio: 0,
      passiveEnduranceDrainRatio: 0,
      curvedPassiveEnduranceDrainRatio: 0,
      passiveEnduranceDrainPerSecond: 0,
      passiveEnduranceDrain: 0,
      curvePower: 1,
    });
  }
}

if (typeof window !== "undefined") {
  window.PassiveStaminaDrainCalculator = PassiveStaminaDrainCalculator;
}
