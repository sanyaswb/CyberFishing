class FightMovementSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightMovement", "MOVEMENT", {
      ...options,
      categoryKey: "fightCore",
    });
  }

  rows(d) {
    const f = this.formatter;
    return [
      this.row("Net force", f.kg(d.netForceKg, 3), f.netForceColor(d.netForceKg)),
      this.row("Winner", f.winner(d.netForceKg), f.netForceColor(d.netForceKg)),
      this.row("Water resistance", f.num(d.waterMotionResistance, 1)),
      this.row("Speed multiplier", `x${f.num(d.waterSpeedMultiplier, 2)}`),
      this.row("Movement mode", d.movementMode || "none", d.movementMode === "none" ? "#8a9bac" : "#00ff80"),
      this.row("Model fight speed", f.mps(d.modelFightSpeedMps ?? d.simpleFightSpeedMps, 3), "#73c2fb"),
      this.row("Fish own toward speed", f.mps(d.fishOwnTowardSpeedMps, 3), "#73c2fb"),
      this.row("Rod pull speed", f.mps(d.totalAppliedPullSpeedMps, 3), "#00ff80"),
      this.row("Combined toward speed", f.mps(d.combinedTowardSpeedMps, 3), "#00d4ff"),
      this.row("Applied move", f.meters(d.totalAppliedPullMoveMeters, 3), Number(d.totalAppliedPullMoveMeters) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Model speed px/s", `${f.num(d.simpleFightSpeedPxPerSec ?? d.fishSpeedPxPerSec, 1)}px/s`, "#73c2fb"),
    ];
  }
}

window.FightMovementSection = FightMovementSection;
