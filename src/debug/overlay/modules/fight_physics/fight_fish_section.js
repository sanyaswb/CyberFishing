class FightFishSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightFish", "FISH", options);
  }

  rows(d) {
    const f = this.formatter;
    return [
      this.row("Fish weight", f.kg(d.fishWeightKg, 3)),
      this.row("Water weight / passive force", f.kg(d.fishPassiveKg, 3), "#ffaa00"),
      this.row("State force multiplier", `x${f.num(d.fishStateForceMultiplier ?? d.pullMult, 2)}`),
      this.row("Direction state", d.fishDirectionState || "unknown"),
      this.row("Direction multiplier", `x${f.num(d.directionResistanceMultiplier, 2)}`),
      this.row("Radial intent", f.num(d.fishMoveIntentRadial, 3)),
      this.row("Lateral intent", f.num(d.fishMoveIntentLateral, 3)),
      this.row(
        "World move direction",
        `${f.num(d.fishMoveDirX, 3)}, ${f.num(d.fishMoveDirY, 3)}`,
      ),
      this.row("Active fish force", f.kg(d.fishActiveKg, 3), "#ff8888"),
      this.row("Fish opposition", f.kg(d.fishOppositionKg, 3), "#ff8888"),
      this.row("Active rod hold", f.kg(d.activeRodHoldKgForEscape, 3), "#73c2fb"),
      this.row("Hold opposition ratio", f.percent(d.holdOppositionRatio, 1), "#73c2fb"),
      this.row("Escape opposing hold", f.kg(d.escapeOpposingHoldKg, 3), "#ffaa00"),
      this.row("Last dash active", d.lastDashActive ? "yes" : "no", d.lastDashActive ? "#ff5cf4" : "#8a9bac"),
      this.row("Last dash trigger zone", d.lastDashInZone ? "inside" : "outside", d.lastDashInZone ? "#ff5cf4" : "#8a9bac"),
      this.row("Last dash catch block", d.lastDashBlockedByCatchZone ? "blocked" : "ready", d.lastDashBlockedByCatchZone ? "#ffaa00" : "#8a9bac"),
    ];
  }
}

window.FightFishSection = FightFishSection;
