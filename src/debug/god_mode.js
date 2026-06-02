class GodMode {
  static get isActive() {
    return typeof CONFIG !== "undefined" && CONFIG.debug?.godMode?.enabled;
  }

  static get infiniteResources() {
    return this.isActive && CONFIG.debug.godMode.infiniteResources;
  }

  static get noHookEscape() {
    return this.isActive && CONFIG.debug.godMode.noHookEscape;
  }

  static get noLineBreak() {
    return this.isActive && CONFIG.debug.godMode.noLineBreak;
  }

  static get noRodBreak() {
    return this.isActive && CONFIG.debug.godMode.noRodBreak;
  }

  static get noFishStaminaLoss() {
    return this.isActive && CONFIG.debug.godMode.noFishStaminaLoss;
  }

  static get infiniteCasting() {
    return this.isActive && CONFIG.debug.godMode.infiniteCasting;
  }

  static get noEquipmentLoss() {
    return this.isActive && CONFIG.debug.godMode.noEquipmentLoss;
  }

  static get fixedBiteChanceEnabled() {
    return this.isActive && CONFIG.debug.godMode.fixedBiteChanceEnabled;
  }

  static get fixedBiteChancePercent() {
    if (!this.fixedBiteChanceEnabled) return null;
    const value = Number(CONFIG.debug.godMode.fixedBiteChancePercent);
    return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 100));
  }

  static get biteSequenceMode() {
    if (!this.isActive) return "default";
    const mode = String(
      CONFIG.debug.godMode.biteSequenceMode || "default",
    ).toLowerCase();
    return mode === "guaranteed" || mode === "normal" ? mode : "default";
  }
}

window.GodMode = GodMode;
