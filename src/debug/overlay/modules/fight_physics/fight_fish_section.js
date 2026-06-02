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
      this.row("Direction multiplier", `x${f.num(d.directionResistanceMultiplier, 2)}`),
      this.row("Active fish force", f.kg(d.fishActiveKg, 3), "#ff8888"),
      this.row("Fish opposition", f.kg(d.fishOppositionKg, 3), "#ff8888"),
    ];
  }
}

window.FightFishSection = FightFishSection;
