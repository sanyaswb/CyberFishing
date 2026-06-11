class FightRodControlSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightRodControl", "ROD CONTROL", options);
  }

  rows(d) {
    const f = this.formatter;
    const inputDirection = Number(d.rodControlInputDirectionX) || 0;
    const inputLabel = inputDirection < 0 ? "left" : inputDirection > 0 ? "right" : "none";

    return [
      this.row("Active", d.rodControlActive ? "yes" : "no", d.rodControlActive ? "#00ff80" : "#8a9bac"),
      this.row("Input direction X", inputLabel, inputDirection ? "#00d4ff" : "#8a9bac"),
      this.row("Input ratio", f.percent(d.rodControlInputRatio, 1), "#73c2fb"),
      this.row("Requested force", f.percent(d.rodControlRequestedForceRatio, 1), "#73c2fb"),
      this.row("Load reserve", f.kg(d.rodControlLoadReserveKg, 3), Number(d.rodControlLoadReserveKg) > 0 ? "#00ff80" : "#ff8888"),
      this.row("Load reserve ratio", f.percent(d.rodControlLoadReserveRatio, 1), Number(d.rodControlLoadReserveRatio) > 0 ? "#00ff80" : "#ff8888"),
      this.row("Drag can slip", d.rodControlCanSlipDrag ? "yes" : "no", d.rodControlCanSlipDrag ? "#00ff80" : "#8a9bac"),
      this.row("Drag reserve", f.kg(d.rodControlDragReserveKg, 3), Number(d.rodControlDragReserveKg) > 0 ? "#00ff80" : "#ffaa00"),
      this.row("Drag limited", d.rodControlDragLimited ? "yes" : "no", d.rodControlDragLimited ? "#ffaa00" : "#8a9bac"),
      this.row("Effective force limit", f.kg(d.rodControlEffectiveForceLimitKg, 3), "#73c2fb"),
      this.row("Delivered force ratio", f.percent(d.rodControlDeliveredForceRatio, 1), f.stressColor(d.rodControlDeliveredForceRatio)),
      this.row("Actual move ratio", f.percent(d.rodControlActualMovementRatio, 1), f.stressColor(d.rodControlActualMovementRatio)),
      this.row("Target mode", d.rodControlTargetMode || "input_direction", "#00d4ff"),
      this.row("Target rod X", `${f.num(d.rodControlTargetRodX, 1)}px`, "#73c2fb"),
      this.row("Fish offset X", `${f.num(d.rodControlFishOffsetX, 1)}px`, "#73c2fb"),
      this.row("Line angle", `${f.num(d.rodControlLineAngleDeg, 1)}°`, "#73c2fb"),
      this.row("Angle ratio", f.percent(d.rodControlAngleRatio, 1), f.stressColor(d.rodControlAngleRatio)),
      this.row("Direction factor", f.percent(d.rodControlDirectionFactor, 1), f.stressColor(d.rodControlDirectionFactor)),
      this.row("Max pull speed", f.mps(d.rodControlMaxPullSpeedMps, 3), "#73c2fb"),
      this.row("Force", f.kg(d.rodControlForceKg, 3), Number(d.rodControlForceKg) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Lateral tension", f.kg(d.rodControlPlayerTensionKg, 3), Number(d.rodControlPlayerTensionKg) > 0 ? "#ffaa00" : "#8a9bac"),
      this.row("Tension multiplier", f.num(d.rodControlTensionMultiplier, 2), "#ffaa00"),
      this.row("Tension mode", d.rodControlTensionMode || "side", "#00d4ff"),
      this.row("Fish/control alignment", f.num(d.rodControlFishControlAxisAlignment, 3), "#73c2fb"),
      this.row("Fish velocity on control axis", `${f.num(d.rodControlFishControlAxisVelocity, 2)}px/s`, "#73c2fb"),
      this.row("Fish autonomous speed", `${f.num(d.rodControlFishAutonomousSpeed, 2)}px/s`, "#73c2fb"),
      this.row("Control axis", `${f.num(d.rodControlAxisX, 2)}, ${f.num(d.rodControlAxisY, 2)}`, "#73c2fb"),
      this.row("Control phase", d.rodControlPhase || "inactive", "#00d4ff"),
      this.row("Desired move X", f.meters(d.rodControlDesiredMoveMeters, 3), "#73c2fb"),
      this.row("Allowed move X", f.meters(d.rodControlAllowedMoveMeters, 3), "#73c2fb"),
      this.row("Applied move X", `${f.meters(d.rodControlMoveMeters, 3)} / ${f.num(d.rodControlMovePx, 1)}px`, Number(d.rodControlMoveMeters) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Movement geometry", d.rodControlMovementMode || "none", d.rodControlMovementMode === "locked_arc" ? "#ffaa00" : "#73c2fb"),
      this.row("Line length locked", d.rodControlLineLengthLocked ? "yes" : "no", d.rodControlLineLengthLocked ? "#ffaa00" : "#8a9bac"),
      this.row("Radial constraint", d.rodControlRadialConstraintActive ? "active" : "off", d.rodControlRadialConstraintActive ? "#ffaa00" : "#8a9bac"),
      this.row("Rod visual offset X", `${f.num(d.rodVisualOffsetX, 1)}px`, "#00d4ff"),
      this.row("Rod visual target X", `${f.num(d.rodVisualTargetOffsetX, 1)}px`, "#73c2fb"),
      this.row("Rod visual delta X", `${f.num(d.rodVisualDeltaX, 1)}px`, "#73c2fb"),
      this.row("Rod visual max X", `${f.num(d.rodVisualMaxOffsetX, 1)}px`, "#73c2fb"),
      this.row("Rod visual stroke", f.percent(d.rodVisualStrokeRatio, 1), f.stressColor(d.rodVisualStrokeRatio)),
      this.row("Rod visual weight speed", f.percent(d.rodVisualWeightSpeedRatio, 1), "#73c2fb"),
      this.row("Rod aim speed", `${f.num(d.rodAimSpeedPxPerSecond, 1)}px/s`, "#73c2fb"),
      this.row("Rod aim fish load", `${f.kg(d.rodAimEffectiveFishLoadKg, 3)} / ${f.kg(d.rodAimLoadLimitKg, 3)}`, "#73c2fb"),
      this.row("Rod aim fish load ratio", f.percent(d.rodAimFishLoadRatio, 1), f.stressColor(d.rodAimFishLoadRatio)),
      this.row("Rod aim weight speed", f.percent(d.rodAimWeightSpeedRatio, 1), "#73c2fb"),
      this.row("Rod aim weight curve", f.num(d.rodAimWeightCurvePower, 2), "#73c2fb"),
      this.row("Rod aim line mode", d.rodAimLineMode || "n/a", "#00d4ff"),
      this.row("Rod aim line speed", f.percent(d.rodAimLineSpeedRatio, 1), "#73c2fb"),
      this.row("Rod aim direction mode", d.rodAimDirectionSpeedMode || "n/a", d.rodAimWithFishDirection ? "#00ff80" : "#73c2fb"),
      this.row("Rod aim direction speed", f.percent(d.rodAimDirectionSpeedRatio, 1), d.rodAimWithFishDirection ? "#00ff80" : "#73c2fb"),
      this.row("Rod aim fish dir X", f.num(d.rodAimFishDirectionX, 0), Number(d.rodAimFishDirectionX) ? "#73c2fb" : "#8a9bac"),
      this.row("Rod aim with fish", d.rodAimWithFishDirection ? "yes" : "no", d.rodAimWithFishDirection ? "#00ff80" : "#8a9bac"),
      this.row("Rod aim load speed", f.percent(d.rodAimLoadSpeedRatio, 1), "#73c2fb"),
      this.row("Visual mode", d.rodControlVisualMode || "n/a", "#00d4ff"),
      this.row("Visual free-line mode", d.rodControlFreeLineVisualMode ? "yes" : "no", d.rodControlFreeLineVisualMode ? "#00ff80" : "#8a9bac"),
      this.row("Visual driven by input", d.rodControlVisualDrivenByInput ? "yes" : "no", d.rodControlVisualDrivenByInput ? "#00ff80" : "#8a9bac"),
      this.row("Visual driven by fish", d.rodControlVisualDrivenByFish ? "yes" : "no", d.rodControlVisualDrivenByFish ? "#00ff80" : "#8a9bac"),
      this.row("Rod visual at limit", d.rodVisualAtLimit ? "yes" : "no", d.rodVisualAtLimit ? "#ffaa00" : "#8a9bac"),
      this.row("Rod visual clamped", d.rodVisualClamped ? "yes" : "no", d.rodVisualClamped ? "#ffaa00" : "#8a9bac"),
      this.row("Pull inertia", `${f.num(d.playerPullMotionInertiaSeconds, 3)}s`, d.playerPullMotionEnabled ? "#00d4ff" : "#8a9bac"),
      this.row("Smoothed move X", f.meters(d.playerPullActualMoveX, 3), "#00ff80"),
      this.row("Pull velocity X", `${f.num(d.playerPullVelocityX, 3)}m/s`, "#73c2fb"),
      this.row("Blocked reason", d.rodControlBlockedReason || d.rodControlMovementBlockReason || "none", (d.rodControlBlockedReason || "none") === "none" ? "#8a9bac" : "#ffaa00"),
    ];
  }
}

window.FightRodControlSection = FightRodControlSection;
