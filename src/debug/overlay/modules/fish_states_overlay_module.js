class FishStatesModule extends OverlayModule {
  constructor(options = {}) {
    super("fishStates", options);
  }

  shouldRender(data) {
    return (
      data.gameState === "playing" &&
      Object.keys(this.#selectBehaviorStates(data)).length > 0
    );
  }

  render(data) {
    let html = this.formatHeader("СИЛА РИБИ ЗА СТАНАМИ");
    const behaviors = this.#selectBehaviorStates(data);
    const passiveForceKg = this.#finiteNonNegative(data.fishPassiveKg);

    for (const [name, config] of Object.entries(behaviors)) {
      const color = this.getStateColor(name);
      const forceMultiplier = this.#finiteNonNegative(
        config?.forceMultiplier,
        1,
      );
      const speedMultiplier = this.#finiteNonNegative(
        config?.speedMultiplier,
        0,
      );
      const activeForceKg = passiveForceKg * forceMultiplier;
      const totalForceKg = passiveForceKg + activeForceKg;

      html += `<div style="margin-bottom: 2px; display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: ${color}; font-weight: bold;">${name.toUpperCase()}</span>
                <span style="color: #e6e6e6;">активна: <span style="color: ${color}; font-weight: bold;">${activeForceKg.toFixed(3)} кг</span> | загальна: <span style="color: ${color}; font-weight: bold;">${totalForceKg.toFixed(3)} кг</span> | сила: <span style="color: ${color}; font-weight: bold;">x${forceMultiplier.toFixed(2)}</span> | швидкість: <span style="color: ${color}; font-weight: bold;">x${speedMultiplier.toFixed(2)}</span></span>
              </div>`;
    }

    return html + `<div style="margin-bottom: 12px;"></div>`;
  }

  #selectBehaviorStates(data) {
    return (
      data.fishRuntimeBehaviorStates ||
      data.hookedFish?.physics?.behaviorProfile?.behaviors ||
      data.hookedFish?.physics?.behaviors ||
      {}
    );
  }

  #finiteNonNegative(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0
      ? normalized
      : fallback;
  }
}

window.FishStatesModule = FishStatesModule;
