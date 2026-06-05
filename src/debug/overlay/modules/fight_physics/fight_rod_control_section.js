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
      this.row("Delivered force ratio", f.percent(d.rodControlDeliveredForceRatio, 1), f.stressColor(d.rodControlDeliveredForceRatio)),
      this.row("Actual move ratio", f.percent(d.rodControlActualMovementRatio, 1), f.stressColor(d.rodControlActualMovementRatio)),
      this.row("Max pull speed", f.mps(d.rodControlMaxPullSpeedMps, 3), "#73c2fb"),
      this.row("Force", f.kg(d.rodControlForceKg, 3), Number(d.rodControlForceKg) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Lateral tension", f.kg(d.rodControlPlayerTensionKg, 3), Number(d.rodControlPlayerTensionKg) > 0 ? "#ffaa00" : "#8a9bac"),
      this.row("Tension multiplier", f.num(d.rodControlTensionMultiplier, 2), "#ffaa00"),
      this.row("Control phase", d.rodControlPhase || "inactive", "#00d4ff"),
      this.row("Desired move X", f.meters(d.rodControlDesiredMoveMeters, 3), "#73c2fb"),
      this.row("Allowed move X", f.meters(d.rodControlAllowedMoveMeters, 3), "#73c2fb"),
      this.row("Applied move X", `${f.meters(d.rodControlMoveMeters, 3)} / ${f.num(d.rodControlMovePx, 1)}px`, Number(d.rodControlMoveMeters) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Rod visual offset X", `${f.num(d.rodVisualOffsetX, 1)}px`, "#00d4ff"),
      this.row("Rod visual target X", `${f.num(d.rodVisualTargetOffsetX, 1)}px`, "#73c2fb"),
      this.row("Rod visual delta X", `${f.num(d.rodVisualDeltaX, 1)}px`, "#73c2fb"),
      this.row("Rod visual max X", `${f.num(d.rodVisualMaxOffsetX, 1)}px`, "#73c2fb"),
      this.row("Rod visual stroke", f.percent(d.rodVisualStrokeRatio, 1), f.stressColor(d.rodVisualStrokeRatio)),
      this.row("Rod visual weight speed", f.percent(d.rodVisualWeightSpeedRatio, 1), "#73c2fb"),
      this.row("Visual driven by input", d.rodControlVisualDrivenByInput ? "yes" : "no", d.rodControlVisualDrivenByInput ? "#00ff80" : "#8a9bac"),
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
