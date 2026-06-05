class FightRodControlSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightRodControl", "ROD CONTROL", options);
  }

  rows(d) {
    const f = this.formatter;
    const inputDirection = Number(d.rodControlInputDirectionX) || 0;
    const towardDirection = Number(d.rodControlTowardRodDirectionX) || 0;
    const inputLabel = inputDirection < 0 ? "left" : inputDirection > 0 ? "right" : "none";
    const towardLabel = towardDirection < 0 ? "left" : towardDirection > 0 ? "right" : "none";

    return [
      this.row("Active", d.rodControlActive ? "yes" : "no", d.rodControlActive ? "#00ff80" : "#8a9bac"),
      this.row("Input direction X", inputLabel, inputDirection ? "#00d4ff" : "#8a9bac"),
      this.row("Toward rod direction X", towardLabel, towardDirection ? "#00ff80" : "#8a9bac"),
      this.row("Input ratio", f.percent(d.rodControlInputRatio, 1), "#73c2fb"),
      this.row("Line angle", `${f.num(d.rodControlLineAngleDeg, 1)} deg`, "#73c2fb"),
      this.row("Angle ratio", f.percent(d.rodControlAngleRatio, 1), "#73c2fb"),
      this.row("Direction factor", f.percent(d.rodControlDirectionFactor, 1), Number(d.rodControlDirectionFactor) > 0 ? "#00ff80" : "#ff8888"),
      this.row("Geometric transfer", f.percent(d.rodControlGeometricTransferRatio, 1), "#73c2fb"),
      this.row("Load reserve", f.kg(d.rodControlLoadReserveKg, 3), Number(d.rodControlLoadReserveKg) > 0 ? "#00ff80" : "#ff8888"),
      this.row("Load reserve ratio", f.percent(d.rodControlLoadReserveRatio, 1), Number(d.rodControlLoadReserveRatio) > 0 ? "#00ff80" : "#ff8888"),
      this.row("Delivered force ratio", f.percent(d.rodControlDeliveredForceRatio, 1), f.stressColor(d.rodControlDeliveredForceRatio)),
      this.row("Potential force ratio", f.percent(d.rodControlPotentialDeliveredForceRatio, 1), f.stressColor(d.rodControlPotentialDeliveredForceRatio)),
      this.row("Actual move ratio", f.percent(d.rodControlActualMovementRatio, 1), f.stressColor(d.rodControlActualMovementRatio)),
      this.row("Max pull speed", f.mps(d.rodControlMaxPullSpeedMps, 3), "#73c2fb"),
      this.row("Free rod movement", d.rodControlFreeRodMovement ? "yes" : "no", d.rodControlFreeRodMovement ? "#ffaa00" : "#8a9bac"),
      this.row("Force", f.kg(d.rodControlForceKg, 3), Number(d.rodControlForceKg) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Move X", `${f.meters(d.rodControlMoveMeters, 3)} / ${f.num(d.rodControlMovePx, 1)}px`, Number(d.rodControlMoveMeters) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Lateral tension", f.kg(d.rodControlPlayerTensionKg, 3), Number(d.rodControlPlayerTensionKg) > 0 ? "#ffaa00" : "#8a9bac"),
      this.row("Tension multiplier", f.num(d.rodControlTensionMultiplier, 2), "#ffaa00"),
      this.row("Target rod X", `${f.num(d.rodControlTargetRodX, 1)}px`, "#73c2fb"),
      this.row("Target position mode", d.rodControlUsesActualRodPositionAsTarget ? "actual rod" : "stable base", "#73c2fb"),
      this.row("Initial offset X", `${f.num(d.rodControlInitialOffsetX, 1)}px`, "#ffaa00"),
      this.row("Current offset X", `${f.num(d.rodControlCurrentOffsetX, 1)}px`, "#ffaa00"),
      this.row("Alignment progress", f.percent(d.rodControlAlignmentProgress, 1), f.stressColor(d.rodControlAlignmentProgress)),
      this.row("Control phase", d.rodControlPhase || "inactive", "#00d4ff"),
      this.row("Visual control ratio", f.percent(d.rodControlVisualControlRatio, 1), f.stressColor(d.rodControlVisualControlRatio)),
      this.row("Coupling mode", d.rodControlCouplingMode || "free", "#00d4ff"),
      this.row("Visual driven by fish", d.rodControlVisualDrivenByFish ? "yes" : "no", d.rodControlVisualDrivenByFish ? "#00ff80" : "#8a9bac"),
      this.row("Visual driven by input", d.rodControlVisualDrivenByInput ? "yes" : "no", d.rodControlVisualDrivenByInput ? "#ffaa00" : "#8a9bac"),
      this.row("Rod visual offset X", `${f.num(d.rodVisualOffsetX, 1)}px`, "#00d4ff"),
      this.row("Rod visual delta X", `${f.num(d.rodVisualDeltaX, 1)}px`, "#73c2fb"),
      this.row("Rod visual max X", `${f.num(d.rodVisualMaxOffsetX, 1)}px`, "#73c2fb"),
      this.row("Rod visual stroke", f.percent(d.rodVisualStrokeRatio, 1), f.stressColor(d.rodVisualStrokeRatio)),
      this.row("Rod control at limit", d.rodControlAtLimit ? "yes" : "no", d.rodControlAtLimit ? "#ffaa00" : "#8a9bac"),
      this.row("Allowed move X", f.meters(d.rodControlAllowedMoveMeters, 3), "#73c2fb"),
      this.row("Lateral reel hold eligible", d.lateralReelHoldEligible ? "yes" : "no", d.lateralReelHoldEligible ? "#00ff80" : "#8a9bac"),
      this.row("Lateral reel hold active", d.lateralReelHoldActive ? "yes" : "no", d.lateralReelHoldActive ? "#00ff80" : "#8a9bac"),
      this.row("Lateral reel hold max move", f.meters(d.lateralReelHoldMaxMoveMeters, 3), "#73c2fb"),
      this.row("Lateral reel hold reason", d.lateralReelHoldBlockedReason || "not_checked", (d.lateralReelHoldBlockedReason || "ready") === "ready" ? "#00ff80" : "#ffaa00"),
      this.row("Rod visual clamped", d.rodVisualClamped ? "yes" : "no", d.rodVisualClamped ? "#ffaa00" : "#8a9bac"),
      this.row("Pull inertia", `${f.num(d.playerPullMotionInertiaSeconds, 3)}s`, d.playerPullMotionEnabled ? "#00d4ff" : "#8a9bac"),
      this.row("Desired move X", f.meters(d.playerPullDesiredMoveX, 3), "#73c2fb"),
      this.row("Actual move X", f.meters(d.playerPullActualMoveX, 3), "#00ff80"),
      this.row("Desired move Y", f.meters(d.playerPullDesiredMoveY, 3), "#73c2fb"),
      this.row("Actual move Y", f.meters(d.playerPullActualMoveY, 3), "#00ff80"),
      this.row("Pull velocity X", `${f.num(d.playerPullVelocityX, 3)}m/s`, "#73c2fb"),
      this.row("Pull velocity Y", `${f.num(d.playerPullVelocityY, 3)}m/s`, "#73c2fb"),
      this.row("Blocked reason", d.rodControlBlockedReason || d.rodControlMovementBlockReason || "none", (d.rodControlBlockedReason || "none") === "none" ? "#8a9bac" : "#ffaa00"),
    ];
  }
}

window.FightRodControlSection = FightRodControlSection;
