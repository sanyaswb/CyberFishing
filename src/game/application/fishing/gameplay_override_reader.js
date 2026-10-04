export class GameplayOverrideReader {
  #config;

  constructor(config) {
    this.#config = config;
  }

  get isActive() {
    return this.#config !== undefined && this.#config.debug?.godMode?.enabled;
  }

  get infiniteResources() {
    return this.isActive && this.#config.debug.godMode.infiniteResources;
  }

  get noHookEscape() {
    return this.isActive && this.#config.debug.godMode.noHookEscape;
  }

  get noLineBreak() {
    return this.isActive && this.#config.debug.godMode.noLineBreak;
  }

  get noRodBreak() {
    return this.isActive && this.#config.debug.godMode.noRodBreak;
  }

  get noFishStaminaLoss() {
    return this.isActive && this.#config.debug.godMode.noFishStaminaLoss;
  }

  get infiniteCasting() {
    return this.isActive && this.#config.debug.godMode.infiniteCasting;
  }

  get noEquipmentLoss() {
    return this.isActive && this.#config.debug.godMode.noEquipmentLoss;
  }

  get fixedBiteChanceEnabled() {
    return this.isActive && this.#config.debug.godMode.fixedBiteChanceEnabled;
  }

  get fixedBiteChancePercent() {
    if (!this.fixedBiteChanceEnabled) return null;
    const value = Number(this.#config.debug.godMode.fixedBiteChancePercent);
    return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 100));
  }

  get forceAnomalyChance() {
    return this.isActive && this.#config.debug.godMode.forceAnomalyChance === true;
  }

  get biteSequenceMode() {
    if (!this.isActive) return "default";
    const mode = String(
      this.#config.debug.godMode.biteSequenceMode || "default",
    ).toLowerCase();
    return mode === "guaranteed" || mode === "normal" ? mode : "default";
  }
}

