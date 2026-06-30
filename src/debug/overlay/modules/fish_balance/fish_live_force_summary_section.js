class FishLiveForceSummarySection {
  #formatter;

  constructor() {
    this.#formatter = new OverlayValueFormatter();
  }

  hasData(data) {
    return (
      this.#isFinite(data?.fishPassiveKg) ||
      this.#isFinite(data?.fishOppositionKg)
    );
  }

  render(data, module) {
    if (!this.hasData(data)) return "";

    const f = this.#formatter;
    const passiveForceKg = this.#finiteNonNegative(data.fishPassiveKg);
    const activeForceKg = this.#finiteNonNegative(data.fishActiveKg);
    const totalForceKg = this.#finiteNonNegative(
      data.fishOppositionKg,
      passiveForceKg + activeForceKg,
    );
    const stateMultiplier = this.#finiteNonNegative(
      data.fishStateForceMultiplier ?? data.pullMult,
      1,
    );
    const directionMultiplier = this.#finiteNonNegative(
      data.directionResistanceMultiplier,
      1,
    );
    const beforeExhaustionKg = this.#finiteNonNegative(
      data.fishOppositionWithoutExhaustionKg,
      totalForceKg + this.#finiteNonNegative(data.fishOppositionExhaustionLossKg),
    );
    const exhaustionLossKg = this.#finiteNonNegative(
      data.fishOppositionExhaustionLossKg,
      Math.max(0, beforeExhaustionKg - totalForceKg),
    );

    let html = `<div style="color: #73c2fb; margin: 2px 0 5px; font-weight: bold; font-size: 12px;">ПОТОЧНА СИЛА</div>`;
    html += module.metricRow("База", f.kg(passiveForceKg, 3), {
      metricKey: "fishBalance.liveBaseForce",
      color: "#ffaa00",
    });
    html += module.metricRow("З множниками", f.kg(totalForceKg, 3), {
      metricKey: "fishBalance.liveTotalForce",
      color: "#ff8888",
    });
    html += module.metricRow(
      "Множник",
      `стан x${f.num(stateMultiplier, 2)} / напрям x${f.num(directionMultiplier, 2)}`,
      {
        metricKey: "fishBalance.liveMultipliers",
        color: "#73c2fb",
      },
    );
    html += module.metricRow(
      "Виснаження",
      `${f.kg(beforeExhaustionKg, 3)} -> ${f.kg(totalForceKg, 3)} (-${f.kg(exhaustionLossKg, 3)})`,
      {
        metricKey: "fishBalance.exhaustionForceLoss",
        color: exhaustionLossKg > 0.000001 ? "#ffaa00" : "#8a9bac",
      },
    );
    return html;
  }

  #finiteNonNegative(value, fallback = 0) {
    const normalized = Number(value);
    if (Number.isFinite(normalized)) return Math.max(0, normalized);
    return Math.max(0, Number(fallback) || 0);
  }

  #isFinite(value) {
    return Number.isFinite(Number(value));
  }
}

window.FishLiveForceSummarySection = FishLiveForceSummarySection;
