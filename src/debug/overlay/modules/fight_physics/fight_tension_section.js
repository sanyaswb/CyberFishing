class FightTensionSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightTension", "TENSION", options);
  }

  rows(d) {
    const f = this.formatter;
    return [
      this.row("Fish tension", f.kg(d.fishTensionKg, 3), "#ff8888"),
      this.row("Player tension", f.kg(d.playerHoldTensionKg, 3), "#00ff80"),
      this.row("Total tension", f.kg(d.totalTensionKg ?? d.calculatedTensionKg, 3), "#ffaa00"),
      this.row("Rod stress", f.percent(d.rodStressRatio, 1), f.stressColor(d.rodStressRatio)),
      this.row("Line stress", f.percent(d.lineStressRatio, 1), f.stressColor(d.lineStressRatio)),
      this.row("Hook stress", f.percent(d.hookStressRatio, 1), f.stressColor(d.hookStressRatio)),
    ];
  }
}

window.FightTensionSection = FightTensionSection;
