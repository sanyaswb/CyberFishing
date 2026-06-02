class FightRodControlSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightRodControl", "ROD CONTROL", options);
  }

  rows(d) {
    const f = this.formatter;
    const direction = Number(d.rodControlDirectionX) || 0;
    const directionLabel = direction < 0 ? "left" : direction > 0 ? "right" : "none";

    return [
      this.row("Active", d.rodControlActive ? "yes" : "no", d.rodControlActive ? "#00ff80" : "#8a9bac"),
      this.row("Direction X", directionLabel, direction ? "#00d4ff" : "#8a9bac"),
      this.row("Input ratio", f.percent(d.rodControlInputRatio, 1), "#73c2fb"),
      this.row("Stroke used", `${f.meters(d.rodControlUsedMeters, 2)} / ${f.meters(d.rodControlCapacityMeters, 2)}`, "#ffaa00"),
      this.row("Stroke remaining", f.meters(d.rodControlRemainingMeters, 2), Number(d.rodControlRemainingMeters) > 0 ? "#00ff80" : "#ff8888"),
      this.row("Stroke ratio", f.percent(d.rodControlRatio, 1), f.stressColor(d.rodControlRatio)),
      this.row("Force", f.kg(d.rodControlForceKg, 3), Number(d.rodControlForceKg) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Lateral tension", f.kg(d.rodControlPlayerTensionKg, 3), Number(d.rodControlPlayerTensionKg) > 0 ? "#ffaa00" : "#8a9bac"),
      this.row("Tension multiplier", f.num(d.rodControlTensionMultiplier, 2), "#ffaa00"),
      this.row("Move X", `${f.meters(d.rodControlMoveMeters, 3)} / ${f.num(d.rodControlMovePx, 1)}px`, Number(d.rodControlMoveMeters) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Blocked reason", d.rodControlBlockedReason || d.rodControlMovementBlockReason || "none", (d.rodControlBlockedReason || "none") === "none" ? "#8a9bac" : "#ffaa00"),
    ];
  }
}

window.FightRodControlSection = FightRodControlSection;
