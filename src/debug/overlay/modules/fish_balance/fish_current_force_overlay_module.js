class FishCurrentForceOverlayModule extends OverlayModule {
  #formatter;

  constructor(options = {}) {
    super("fishCurrentForce", options);
    this.#formatter = new OverlayValueFormatter();
  }

  shouldRender(data) {
    return data.gameState === "playing";
  }

  render(data) {
    const f = this.#formatter;
    const stateForceMultiplier = data.fishStateForceMultiplier ?? data.pullMult;

    let html = this.formatHeader("CURRENT FISH FORCE", "#ff8888");
    html += this.metricRow("Passive force", f.kg(data.fishPassiveKg, 3), {
      metricKey: "fishBalance.passiveForce",
      color: "#ffaa00",
    });
    html += this.metricRow("Active force", f.kg(data.fishActiveKg, 3), {
      metricKey: "fishBalance.activeForce",
      color: "#ff8888",
    });
    html += this.metricRow("Fish opposition", f.kg(data.fishOppositionKg, 3), {
      metricKey: "fishBalance.opposition",
      color: "#ff8888",
    });
    html += this.metricRow("State force", `x${f.num(stateForceMultiplier, 2)}`, {
      metricKey: "fishBalance.stateForceMultiplier",
      color: "#73c2fb",
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

window.FishCurrentForceOverlayModule = FishCurrentForceOverlayModule;
