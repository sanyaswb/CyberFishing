class FightMovementSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightMovement", "MOVEMENT", {
      ...options,
      categoryKey: "fightCore",
    });
  }

  rows(d) {
    const f = this.formatter;
    const relationColor = this.#movementRelationColor(d.fishMovementRelation);
    const pressureColor = this.#movementRelationColor(d.fishPressureRelation);
    return [
      this.row(
        "Fish pressure",
        `${d.fishPressureRelationLabel || "немає тиску"} · ${f.kg(d.fishPressureStrengthKg, 3)} · ${f.num(d.fishPressureSpeedPxPerSec, 1)}px/s`,
        pressureColor,
      ),
      this.row(
        "Pressure direction",
        d.fishPressureDirectionLabel || "немає",
        pressureColor,
      ),
      this.row(
        "Fish actual move",
        `${d.fishMovementRelationLabel || "немає руху"} · ${f.kg(d.fishMovementStrengthKg, 3)} · ${f.num(d.fishMovementActualSpeedPxPerSec, 1)}px/s`,
        relationColor,
      ),
      this.row(
        "Actual direction",
        d.fishMovementDirectionLabel || "немає",
        relationColor,
      ),
      this.row(
        "Actual blocker",
        d.fishActualBlockedReason || "none",
        d.fishActualBlockedReason && d.fishActualBlockedReason !== "none"
          ? "#ffaa00"
          : "#8a9bac",
      ),
      this.row("Net force", f.kg(d.netForceKg, 3), f.netForceColor(d.netForceKg)),
      this.row("Winner", f.winner(d.netForceKg), f.netForceColor(d.netForceKg)),
      this.row("Water resistance", f.num(d.waterMotionResistance, 1)),
      this.row("Speed multiplier", `x${f.num(d.waterSpeedMultiplier, 2)}`),
      this.row("Fish movement mode", d.fishMovementMode || "none", d.fishMovementMode === "none" ? "#8a9bac" : "#00ff80"),
      this.row("Player pull movement mode", d.playerPullMovementMode || "none", (d.playerPullMovementMode || "none") === "none" ? "#8a9bac" : "#00ff80"),
      this.row("Raw velocity", `${f.num(d.fishMoveRawVelocityX, 1)}, ${f.num(d.fishMoveRawVelocityY, 1)}px/s`, "#73c2fb"),
      this.row("Allowed velocity", `${f.num(d.fishMoveAllowedVelocityX, 1)}, ${f.num(d.fishMoveAllowedVelocityY, 1)}px/s`, "#00ff80"),
      this.row("Radial speed", `${f.num(d.fishMoveRadialSpeedPxPerSec, 1)}px/s`, Number(d.fishMoveRadialSpeedPxPerSec) > 0 ? "#ffaa00" : "#8a9bac"),
      this.row("Blocked radial", `${f.num(d.fishMoveBlockedRadialSpeedPxPerSec, 1)}px/s`, Number(d.fishMoveBlockedRadialSpeedPxPerSec) > 0 ? "#ffaa00" : "#8a9bac"),
      this.row("Allowed tangent", `${f.num(d.fishMoveAllowedTangentSpeedPxPerSec, 1)}px/s`, Number(d.fishMoveAllowedTangentSpeedPxPerSec) > 0.001 ? "#00ff80" : "#8a9bac"),
      this.row("Move constraint", d.fishMoveConstraintActive ? "active" : "free", d.fishMoveConstraintActive ? "#ffaa00" : "#8a9bac"),
      this.row("Projection reason", d.fishMoveProjectionReason || "free", d.fishMoveProjectionReason === "radial_outward_projected" ? "#ffaa00" : "#8a9bac"),
      this.row(
        "Sector constraint",
        `${d.fishMoveSectorActive ? "active" : "inactive"} · ${d.fishMoveSectorClamped ? "clamped" : "free"} · ${d.fishMoveSectorBoundaryType || "none"} · radius ${d.fishMoveSectorEnforceRadius ? "on" : "off"}`,
        d.fishMoveSectorClamped ? "#ffaa00" : "#8a9bac",
      ),
      this.row(
        "Sector angle",
        `${f.num(d.fishMoveSectorAngleDeg, 1)}deg · ${d.fishMoveSectorSide || "none"}`,
        d.fishMoveSectorActive ? "#73c2fb" : "#8a9bac",
      ),
      this.row(
        "Sector move ratio",
        f.percent(d.fishMoveSectorAllowedMoveRatio, 1),
        Number(d.fishMoveSectorAllowedMoveRatio) < 0.999
          ? "#ffaa00"
          : "#8a9bac",
      ),
      this.row("Line constraint", d.fightMovementLineConstraintReason || "none", d.fightMovementLineConstraintReason && d.fightMovementLineConstraintReason !== "none" ? "#ffaa00" : "#8a9bac"),
      this.row("Radial constraint", d.fightMovementRadialConstraintActive ? "yes" : "no", d.fightMovementRadialConstraintActive ? "#ffaa00" : "#8a9bac"),
      this.row("Target speed", `${f.num(d.fightMovementTargetSpeedPxPerSec, 1)}px/s`, "#73c2fb"),
      this.row("Actual speed", `${f.num(d.fightMovementActualSpeedPxPerSec, 1)}px/s`, Number(d.fightMovementActualSpeedPxPerSec) > 0.001 ? "#00ff80" : "#8a9bac"),
      this.row("Model fight speed", f.mps(d.modelFightSpeedMps, 3), "#73c2fb"),
      this.row("Fish own toward speed", f.mps(d.fishOwnTowardSpeedMps, 3), "#73c2fb"),
      this.row("Rod pull speed", f.mps(d.totalAppliedPullSpeedMps, 3), "#00ff80"),
      this.row("Combined toward speed", f.mps(d.combinedTowardSpeedMps, 3), "#00d4ff"),
      this.row("Applied move", f.meters(d.totalAppliedPullMoveMeters, 3), Number(d.totalAppliedPullMoveMeters) > 0 ? "#00ff80" : "#8a9bac"),
    ];
  }

  #movementRelationColor(relation) {
    if (relation === "away_from_player") return "#ff8888";
    if (relation === "toward_player") return "#00ff80";
    if (relation === "sideways") return "#73c2fb";
    return "#8a9bac";
  }
}

window.FightMovementSection = FightMovementSection;
