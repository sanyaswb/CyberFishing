class FishStatesModule extends OverlayModule {
  constructor() {
    super("fishStates");
  }

  shouldRender(d) {
    return (
      d.gameState === "playing" &&
      (d.hookedFish?.physics?.behaviors ||
        d.hookedFish?.physics?.behaviorProfile?.behaviors)
    );
  }

  render(d) {
    let html = this.formatHeader("📊 СИЛА РИБИ ЗА СТАНАМИ");
    const behaviors =
      d.hookedFish.physics.behaviors ||
      d.hookedFish.physics.behaviorProfile?.behaviors ||
      {};
    const basePower = d.fishBasePower || 0;

    for (const [name, cfg] of Object.entries(behaviors)) {
      const color = this.getStateColor(name);
      const forceMultiplier = Number(cfg.forceMultiplier ?? 1) || 1;
      const speedMultiplier = Number(cfg.speedMultiplier ?? 0) || 0;
      const stateForceKg = basePower * forceMultiplier;

      html += `<div style="margin-bottom: 2px; display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: ${color}; font-weight: bold;">${name.toUpperCase()}</span>
                <span style="color: #e6e6e6;">kg: <span style="color: ${color}; font-weight: bold;">${stateForceKg.toFixed(3)}</span> | speed: <span style="color: ${color}; font-weight: bold;">${speedMultiplier.toFixed(2)}</span></span>
              </div>`;
    }
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

window.FishStatesModule = FishStatesModule;
