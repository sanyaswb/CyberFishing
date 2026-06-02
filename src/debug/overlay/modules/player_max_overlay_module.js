class PlayerMaxModule extends OverlayModule {
  constructor(options = {}) {
    super("playerMax", options);
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    let html = this.formatHeader("📊 СИЛА ГРАВЦЯ", "#00ff80");
    html += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>ЛІМІТ СНАСТІ:</span> <span style="color: #00ff80; font-weight: bold;">${(d.maxTackleLoadKg || d.playerMaxPowerY || 0).toFixed(3)} кг</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Rod hold:</span><span style="color:#00ff80;">${(d.rodPullForceKg || 0).toFixed(3)}kg</span></div>`;
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:2px;"><span>Simple speed:</span><span style="color:#00ff80;">${(d.simpleFightSpeedMps || 0).toFixed(2)}m/s</span></div>`;
    if (d.dragSupported) {
      html += `<div style="display: flex; justify-content: space-between; margin-bottom: 12px;"><span>ФРИКЦІОН:</span> <span style="color: #00ccff; font-weight: bold;">${(d.dragLimitKg || 0).toFixed(3)} кг</span></div>`;
    }
    return html;
  }
}

window.PlayerMaxModule = PlayerMaxModule;
