import { formatEightWayDirection, formatMovementRelation, formatPressureRelation } from "../../formatting/fish_movement_labels.js";
import { OverlayModule } from "../overlay_module.js";

export class FishMovementSummaryOverlayModule extends OverlayModule {
  #formatter;

  constructor(options = {}) {
    super("fishMovementSummary", options);
    this.#formatter = options.formatter;
  }

  shouldRender(data) {
    return data.gameState === "playing";
  }

  render(data) {
    const f = this.#formatter;
    const pressureColor = this.#relationColor(data.fishPressureRelation);
    const moveColor = this.#relationColor(data.fishMovementRelation);
    const blocker = data.fishActualBlockedReason || data.fightMovementLineConstraintReason || "none";

    let html = this.formatHeader("FISH MOVEMENT SUMMARY", "#73c2fb");
    html += this.metricRow(
      "Fish pressure",
      `${formatPressureRelation(data.fishPressureRelation)} · ${f.kg(data.fishPressureStrengthKg, 3)} · ${f.num(data.fishPressureSpeedPxPerSec, 1)}px/s`,
      { metricKey: "fishMovementSummary.pressure", color: pressureColor },
    );
    html += this.metricRow("Pressure direction", formatEightWayDirection(data.fishPressureDirection), {
      metricKey: "fishMovementSummary.pressureDirection",
      color: pressureColor,
    });
    html += this.metricRow(
      "Actual move",
      `${formatMovementRelation(data.fishMovementRelation)} · ${f.kg(data.fishMovementStrengthKg, 3)} · ${f.num(data.fishMovementActualSpeedPxPerSec, 1)}px/s`,
      { metricKey: "fishMovementSummary.actualMove", color: moveColor },
    );
    html += this.metricRow("Actual direction", formatEightWayDirection(data.fishMovementDirection), {
      metricKey: "fishMovementSummary.actualDirection",
      color: moveColor,
    });
    html += this.metricRow("Blocker", blocker, {
      metricKey: "fishMovementSummary.blocker",
      color: blocker === "none" ? "#8a9bac" : "#ffaa00",
    });
    html += this.metricRow("Target speed", `${f.num(data.fightMovementTargetSpeedPxPerSec, 1)}px/s`, {
      metricKey: "fishMovementSummary.targetSpeed",
      color: "#73c2fb",
    });
    html += this.metricRow("Actual speed", `${f.num(data.fightMovementActualSpeedPxPerSec, 1)}px/s`, {
      metricKey: "fishMovementSummary.actualSpeed",
      color: Number(data.fightMovementActualSpeedPxPerSec) > 0 ? "#00ff80" : "#8a9bac",
    });
    html += this.metricRow("Movement mode", data.fishMovementMode || "none", {
      metricKey: "fishMovementSummary.mode",
      color: data.fishMovementMode && data.fishMovementMode !== "none" ? "#00ff80" : "#8a9bac",
    });
    html += this.metricRow("Net force", f.kg(data.netForceKg, 3), {
      metricKey: "fishMovementSummary.netForce",
      color: f.netForceColor(data.netForceKg),
    });
    html += this.metricRow("Winner", f.winner(data.netForceKg), {
      metricKey: "fishMovementSummary.winner",
      color: f.netForceColor(data.netForceKg),
    });
    return html + `<div style="margin-bottom: 12px;"></div>`;
  }

  #relationColor(relation) {
    if (relation === "away_from_player") return "#ff8888";
    if (relation === "toward_player") return "#00ff80";
    if (relation === "sideways") return "#73c2fb";
    return "#8a9bac";
  }
}
