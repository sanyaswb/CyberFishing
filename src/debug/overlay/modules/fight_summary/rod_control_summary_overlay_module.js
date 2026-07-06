class RodControlSummaryOverlayModule extends OverlayModule {
  #formatter;

  constructor(options = {}) {
    super("rodControlSummary", options);
    this.#formatter = new OverlayValueFormatter();
  }

  shouldRender(data) {
    return data.gameState === "playing";
  }

  render(data) {
    const f = this.#formatter;
    const inputDirection = Number(data.rodControlInputDirectionX) || 0;
    const inputLabel = inputDirection < 0 ? "left" : inputDirection > 0 ? "right" : "none";
    const blockedReason = data.rodControlBlockedReason || data.rodControlMovementBlockReason || "none";

    let html = this.formatHeader("ROD CONTROL SUMMARY", "#00d4ff");
    html += this.metricRow("Hold", `${f.kg(data.rodPullForceKg, 3)} / ${f.kg(data.rodHoldMaxKg, 3)}`, {
      metricKey: "rodControlSummary.hold",
      color: "#00ff80",
    });
    html += this.metricRow("Stroke", `${f.meters(data.rodStrokeUsed ?? data.rodStrokeUsedMeters, 2)} / ${f.meters(data.rodStrokeCapacity ?? data.rodStrokeCapacityMeters, 2)}`, {
      metricKey: "rodControlSummary.stroke",
      color: "#73c2fb",
    });
    html += this.metricRow("Control", data.rodControlActive ? "active" : "inactive", {
      metricKey: "rodControlSummary.active",
      color: data.rodControlActive ? "#00ff80" : "#8a9bac",
    });
    html += this.metricRow("Input", `${inputLabel} ${f.percent(data.rodControlInputRatio, 1)}`, {
      metricKey: "rodControlSummary.input",
      color: inputDirection ? "#00d4ff" : "#8a9bac",
    });
    html += this.metricRow("Requested", f.percent(data.rodControlRequestedForceRatio, 1), {
      metricKey: "rodControlSummary.requested",
      color: "#73c2fb",
    });
    html += this.metricRow("Delivered", f.percent(data.rodControlDeliveredForceRatio, 1), {
      metricKey: "rodControlSummary.delivered",
      color: f.stressColor(data.rodControlDeliveredForceRatio),
    });
    html += this.metricRow("Line angle", `${f.num(data.rodControlLineAngleDeg, 1)}°`, {
      metricKey: "rodControlSummary.angle",
      color: "#73c2fb",
    });
    html += this.metricRow("Direction factor", f.percent(data.rodControlDirectionFactor, 1), {
      metricKey: "rodControlSummary.directionFactor",
      color: "#ffaa00",
    });
    html += this.metricRow("Load reserve", f.kg(data.rodControlLoadReserveKg, 3), {
      metricKey: "rodControlSummary.loadReserve",
      color: Number(data.rodControlLoadReserveKg) > 0 ? "#00ff80" : "#ff8888",
    });
    html += this.metricRow("Lateral force", f.kg(data.rodControlForceKg, 3), {
      metricKey: "rodControlSummary.lateralForce",
      color: Number(data.rodControlForceKg) > 0 ? "#00ff80" : "#8a9bac",
    });
    html += this.metricRow("Blocked", blockedReason, {
      metricKey: "rodControlSummary.blockedReason",
      color: blockedReason === "none" ? "#8a9bac" : "#ffaa00",
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }
}

window.RodControlSummaryOverlayModule = RodControlSummaryOverlayModule;
