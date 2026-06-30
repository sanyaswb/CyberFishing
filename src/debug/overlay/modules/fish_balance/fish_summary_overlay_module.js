class FishSummaryOverlayModule extends OverlayModule {
  #formatter;

  constructor(options = {}) {
    super("fishSummary", options);
    this.#formatter = new OverlayValueFormatter();
  }

  shouldRender(data) {
    return data.gameState === "playing";
  }

  render(data) {
    const f = this.#formatter;
    const direction = data.fishDirectionState || data.directionCategory || "unknown";
    const behavior = data.fishState || data.currentFishBehavior || "unknown";
    const directionMultiplier = this.#finite(data.directionResistanceMultiplier, 1);
    const lastDashActive = !!data.lastDashActive;

    let html = this.formatHeader("FISH SUMMARY", "#ffaa00");
    html += this.metricRow("Fish weight", f.kg(data.fishWeightKg, 3), {
      metricKey: "fishBalance.weight",
      color: "#8a9bac",
    });
    html += this.metricRow("Base power", `x${f.num(data.fishBasePower, 2)}`, {
      metricKey: "fishBalance.basePower",
      color: "#8a9bac",
    });
    html += this.metricRow("Behavior", behavior, {
      metricKey: "fishBalance.currentBehavior",
      color: this.getStateColor(behavior),
    });
    html += this.metricRow("Direction", direction, {
      metricKey: "fishBalance.currentDirection",
      color: this.#directionColor(direction),
    });
    html += this.metricRow("Direction force", `x${f.num(directionMultiplier, 2)}`, {
      metricKey: "fishBalance.directionMultiplier",
      color: "#ffaa00",
    });
    html += this.metricRow("Last dash", lastDashActive ? "yes" : "no", {
      metricKey: "fishBalance.lastDash",
      color: lastDashActive ? "#ff5cf4" : "#8a9bac",
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }

  #directionColor(direction) {
    const value = String(direction || "").toLowerCase();
    if (value.includes("away")) return "#ff8888";
    if (value.includes("toward")) return "#00ff80";
    if (value.includes("side")) return "#73c2fb";
    return "#8a9bac";
  }

  #finite(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
  }
}

window.FishSummaryOverlayModule = FishSummaryOverlayModule;
