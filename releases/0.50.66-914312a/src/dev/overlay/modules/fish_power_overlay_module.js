import { OverlayModule } from "../overlay_module.js";

export class FishPowerOverlayModule extends OverlayModule {
  constructor(options = {}) {
    super("fishBase", options);
  }

  shouldRender(data) {
    return data.gameState === "playing";
  }

  render(data) {
    const fishWeightKg = this.#finiteNonNegative(data.fishWeightKg);
    const basePowerCoefficient = this.#finiteNonNegative(data.fishBasePower);
    const passiveForceKg = this.#finiteNonNegative(data.fishPassiveKg);
    const activeForceKg = this.#finiteNonNegative(data.fishActiveKg);

    let html = this.formatHeader("ПОТОЧНА СИЛА РИБИ", "#ffaa00");
    html += `<div class="debug-overlay__line">Вага: <span class="debug-overlay__text debug-overlay__text--muted">${fishWeightKg.toFixed(3)} кг</span></div>`;
    html += `<div class="debug-overlay__line">Базовий коефіцієнт сили: <span class="debug-overlay__text debug-overlay__text--muted">${basePowerCoefficient.toFixed(3)}</span></div>`;
    html += `<div class="debug-overlay__line">Пасивна сила у воді: <span class="debug-overlay__text debug-overlay__text--body debug-overlay__text--emphasis">${passiveForceKg.toFixed(3)} кг</span></div>`;
    html += `<div class="debug-overlay__lead">Активна сила поточного стану: <span class="debug-overlay__text debug-overlay__text--success debug-overlay__text--emphasis">${activeForceKg.toFixed(3)} кг</span></div>`;
    return html;
  }

  #finiteNonNegative(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;
  }
}
