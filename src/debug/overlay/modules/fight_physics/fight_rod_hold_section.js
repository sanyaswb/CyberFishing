class FightRodHoldSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightRodHold", "ROD HOLD", options);
  }

  rows(d) {
    const f = this.formatter;
    return [
      this.row("Rod hold", f.kg(d.rodPullForceKg, 3), "#00ff80"),
      this.row("Rod hold max", f.kg(d.rodHoldMaxKg, 3), "#ffaa00"),
      this.row("Rod stroke", `${f.meters(d.rodStrokeUsed, 2)} / ${f.meters(d.rodStrokeCapacity, 2)}`),
      this.row("Rod pull move", f.meters(d.rodPullMoveMeters, 3), Number(d.rodPullMoveMeters) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Rod applied speed", f.mps(d.rodPullAppliedSpeedMps, 3), Number(d.rodPullAppliedSpeedMps) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Angle multiplier", `x${f.num(d.anglePenalty || 1, 2)}`),
      this.row("Effective rod hold", f.kg(d.effectiveRodHoldKg, 3), "#00ff80"),
      this.row("Hold tension ratio", f.percent(d.holdTensionRatio, 1)),
      this.row("Raw hold tension", f.kg(d.rawPlayerHoldTensionKg, 3), "#00ff80"),
      this.row("Movable tension cap", f.kg(d.movableHoldTensionCapKg, 3), "#73c2fb"),
      this.row("Hold to tension", f.kg(d.playerHoldTensionKg, 3), "#00ff80"),
    ];
  }
}

window.FightRodHoldSection = FightRodHoldSection;
