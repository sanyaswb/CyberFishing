class FishDebuffsSummaryOverlayModule extends OverlayModule {
  #formatter;

  constructor(options = {}) {
    super("fishDebuffsSummary", options);
    this.#formatter = new OverlayValueFormatter();
  }

  shouldRender(data) {
    return data.gameState === "playing";
  }

  render(data) {
    const f = this.#formatter;
    const randomDebuff = data.activeDebuffName || "none";
    const movementActive = !!data.enduranceMovementDebuffActive;
    const progress = this.#resolveFirstFinite(
      data.enduranceMovementDebuffProgress,
      data.enduranceMovementDebuffPower,
      0,
    );
    const power = this.#resolveFirstFinite(
      data.enduranceMovementDebuffPower,
      progress,
      0,
    );
    const radialMin = this.#resolveFirstFiniteOrNull(
      data.enduranceEffectiveRadialMin,
      data.enduranceSelectedEffectiveRadialMin,
    );
    const radialMax = this.#resolveFirstFiniteOrNull(
      data.enduranceEffectiveRadialMax,
      data.enduranceSelectedEffectiveRadialMax,
    );
    const radial = Number.isFinite(radialMin) && Number.isFinite(radialMax)
      ? `[${f.num(radialMin, 2)}, ${f.num(radialMax, 2)}]`
      : "—";
    const mastery = data.isMasteryActive ? "active" : "inactive";

    let html = this.formatHeader("FISH DEBUFFS", "#ff00ff");
    html += this.metricRow("Random debuff", randomDebuff, {
      metricKey: "fishBalance.randomDebuff",
      color: randomDebuff === "none" ? "#8a9bac" : "#ff00ff",
    });
    html += this.metricRow("Mastery", mastery, {
      metricKey: "fishBalance.mastery",
      color: data.isMasteryActive ? "#ff4444" : "#8a9bac",
    });
    html += this.metricRow("Mastery multiplier", `x${f.num(data.masteryCurrentMult ?? 1, 2)}`, {
      metricKey: "fishBalance.masteryMultiplier",
      color: "#ffaa00",
    });
    html += this.metricRow("Movement debuff", movementActive ? f.percent(progress, 1) : "inactive", {
      metricKey: "fishBalance.movementDebuffProgress",
      color: movementActive ? "#00ff80" : "#8a9bac",
    });
    html += this.metricRow("Debuff power", f.percent(power, 1), {
      metricKey: "fishBalance.movementDebuffPower",
      color: "#73c2fb",
    });
    html += this.metricRow("Effective radial", radial, {
      metricKey: "fishBalance.effectiveRadial",
      color: "#73c2fb",
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }

  #resolveFirstFinite(...values) {
    for (const value of values) {
      const normalized = Number(value);
      if (Number.isFinite(normalized)) return normalized;
    }
    return 0;
  }

  #resolveFirstFiniteOrNull(...values) {
    for (const value of values) {
      const normalized = Number(value);
      if (Number.isFinite(normalized)) return normalized;
    }
    return null;
  }
}

window.FishDebuffsSummaryOverlayModule = FishDebuffsSummaryOverlayModule;
