class FishPowerModule extends OverlayModule {
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
    html += `<div style="margin-bottom: 4px;">Вага: <span style="color: #8a9bac;">${fishWeightKg.toFixed(3)} кг</span></div>`;
    html += `<div style="margin-bottom: 4px;">Базовий коефіцієнт сили: <span style="color: #8a9bac;">${basePowerCoefficient.toFixed(3)}</span></div>`;
    html += `<div style="margin-bottom: 4px;">Пасивна сила у воді: <span style="color: #e6e6e6; font-weight: bold;">${passiveForceKg.toFixed(3)} кг</span></div>`;
    html += `<div style="margin-bottom: 12px; font-size: 16px;">Активна сила поточного стану: <span style="color: #00ff80; font-weight: bold;">${activeForceKg.toFixed(3)} кг</span></div>`;
    return html;
  }

  #finiteNonNegative(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;
  }
}

window.FishPowerModule = FishPowerModule;
