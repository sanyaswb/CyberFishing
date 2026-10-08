import { OverlayModule } from "../overlay_module.js";

export class PlayerMaxOverlayModule extends OverlayModule {
  constructor(options = {}) {
    super("playerMax", options);
  }

  shouldRender(d) {
    return d.gameState === "playing";
  }

  render(d) {
    let html = this.formatHeader("📊 СИЛА ГРАВЦЯ", "#00ff80");
    html += `<div class="debug-overlay__pair debug-overlay__pair--tight"><span>ЛІМІТ СНАСТІ:</span> <span class="debug-overlay__text debug-overlay__text--success debug-overlay__text--emphasis">${(d.maxTackleLoadKg || d.playerMaxPowerY || 0).toFixed(3)} кг</span></div>`;
    html += `<div class="debug-overlay__pair debug-overlay__pair--tight"><span>Rod hold:</span><span class="debug-overlay__text debug-overlay__text--success">${(d.rodPullForceKg || 0).toFixed(3)}kg</span></div>`;
    html += `<div class="debug-overlay__pair debug-overlay__pair--tight"><span>Model speed:</span><span class="debug-overlay__text debug-overlay__text--success">${(d.modelFightSpeedMps || 0).toFixed(2)}m/s</span></div>`;
    if (d.dragSupported) {
      html += `<div class="debug-overlay__pair debug-overlay__pair--spaced"><span>ФРИКЦІОН:</span> <span class="debug-overlay__text debug-overlay__text--accent debug-overlay__text--emphasis">${(d.dragLimitKg || 0).toFixed(3)} кг</span></div>`;
    }
    return html;
  }
}
