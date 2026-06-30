class FishLiveForceSummarySection {
  #formatter;

  constructor() {
    this.#formatter = new OverlayValueFormatter();
  }

  hasData(data) {
    return (
      this.#isFinite(data?.fishBaseForceCurrentKg) ||
      this.#isFinite(data?.fishCurrentStateMaxForceKg) ||
      this.#isFinite(data?.fishPassiveKg) ||
      this.#isFinite(data?.fishOppositionKg)
    );
  }

  render(data, module) {
    if (!this.hasData(data)) return "";

    const f = this.#formatter;
    const baseForceKg = this.#finiteNonNegative(
      data.fishBaseForceCurrentKg,
      data.fishPassiveKg,
    );
    const baseForceWithoutDebuffKg = this.#finiteNonNegative(
      data.fishBaseForceWithoutPowerDebuffKg,
      baseForceKg + this.#finiteNonNegative(data.fishBaseForcePowerLossKg),
    );
    const baseForceLossKg = this.#finiteNonNegative(
      data.fishBaseForcePowerLossKg,
      Math.max(0, baseForceWithoutDebuffKg - baseForceKg),
    );
    const currentStateMaxForceKg = this.#finiteNonNegative(
      data.fishCurrentStateMaxForceKg,
      data.fishOppositionKg,
    );
    const stateMaxWithoutDebuffKg = this.#finiteNonNegative(
      data.fishStateMaxForceWithoutPowerDebuffKg,
      currentStateMaxForceKg +
        this.#finiteNonNegative(data.fishStateMaxForcePowerLossKg),
    );
    const stateMaxLossKg = this.#finiteNonNegative(
      data.fishStateMaxForcePowerLossKg,
      Math.max(0, stateMaxWithoutDebuffKg - currentStateMaxForceKg),
    );
    const stateMultiplier = this.#finiteNonNegative(
      data.fishStateTargetForceMultiplier,
      data.fishStateForceMultiplier ?? data.pullMult ?? 1,
    );
    const directionMultiplier = this.#finiteNonNegative(
      data.directionResistanceMultiplier,
      1,
    );
    const directionLabel = this.#formatDirection(data.fishDirectionState);
    const powerRatio = this.#finiteNonNegative(data.fishPowerRatio, 1);

    let html = `<div style="color: #73c2fb; margin: 2px 0 5px; font-weight: bold; font-size: 12px;">ПОТОЧНА СИЛА</div>`;
    html += module.metricRow(
      "База",
      `${f.kg(baseForceKg, 3)} ${this.#lossText(baseForceLossKg)}`,
      {
        metricKey: "fishBalance.currentBaseForce",
        color: baseForceLossKg > 0.000001 ? "#ffaa00" : "#ffaa00",
      },
    );
    html += module.metricRow(
      "З множниками",
      `${f.kg(currentStateMaxForceKg, 3)} ${this.#lossText(stateMaxLossKg)}`,
      {
        metricKey: "fishBalance.currentStateMaxForce",
        color: "#ff8888",
      },
    );
    html += module.metricRow(
      "State",
      `${data.fishState || "unknown"} x${f.num(stateMultiplier, 2)}`,
      {
        metricKey: "fishBalance.stateTargetForceMultiplier",
        color: "#73c2fb",
      },
    );
    html += module.metricRow(
      "Direction",
      `${directionLabel} x${f.num(directionMultiplier, 2)}`,
      {
        metricKey: "fishBalance.directionMultiplier",
        color: "#73c2fb",
      },
    );
    html += module.metricRow("Power", `x${f.num(powerRatio, 2)}`, {
      metricKey: "fishBalance.powerRatio",
      color: powerRatio < 0.999 ? "#ffaa00" : "#8a9bac",
    });
    return html;
  }

  #lossText(lossKg) {
    const loss = this.#finiteNonNegative(lossKg);
    if (loss <= 0.000001) return "(-0.000 кг)";
    return `(-${loss.toFixed(3)} кг)`;
  }

  #formatDirection(direction) {
    const value = String(direction || "side").toLowerCase();
    if (["away", "away_from_player", "from_player"].includes(value)) {
      return "away";
    }
    if (["toward", "toward_player", "to_player"].includes(value)) {
      return "toward";
    }
    return "side";
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
