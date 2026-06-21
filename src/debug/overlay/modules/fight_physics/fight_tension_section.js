class FightTensionSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightTension", "TENSION", {
      ...options,
      categoryKey: "fightStress",
    });
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
      this.row("Effective tension", f.kg(d.effectiveTensionKg, 3), "#ffaa00"),
      this.row("Stress tension source", d.tensionStressSource || "raw", d.tensionStressSource === "visible" ? "#00ff80" : "#ffaa00"),
      this.row("Main tackle limit", f.kg(d.mainTackleLimitKg, 3), "#8a9bac"),
      this.row("Overload", f.kg(d.overloadKg, 3), Number(d.overloadKg) > 0 ? "#ff8888" : "#8a9bac"),
      this.row("Stress overloaded", d.stressWasOverloaded ? "yes" : "no", d.stressWasOverloaded ? "#ff8888" : "#8a9bac"),
      this.row("Stress value", f.num(d.stressValue, 3) + "/" + f.num(d.stressCapacity, 3), "#ffaa00"),
      this.row("Tackle stress", f.percent(d.stressRatio, 1), f.stressColor(d.stressRatio)),
      this.row("Stress gain/sec", f.num(d.stressGainPerSecond, 3), "#ffaa00"),
      this.row("Stress recovery/sec", f.num(d.stressRecoveryPerSecond, 3), "#8a9bac"),
      this.row("Failure timer", f.num(d.failureRollTimerMs, 0) + "ms", "#8a9bac"),
      this.row("Failure interval", f.num(d.failureRollIntervalMs, 0) + "ms", "#8a9bac"),
      this.row("Failure chance", f.percent(d.failureChance, 1), f.stressColor(d.failureChance)),
      this.row("Failure source", d.failureSource || "-", d.failureSource ? "#ff4444" : "#8a9bac"),
      this.row("Last roll", d.lastRollValue === null || d.lastRollValue === undefined ? "-" : f.num(d.lastRollValue, 3), d.lastRollPassed ? "#ff4444" : "#8a9bac"),
      this.row("Roll passed", d.lastRollPassed ? "yes" : "no", d.lastRollPassed ? "#ff4444" : "#8a9bac"),
      this.row("Guaranteed failure", d.guaranteedFailure ? "yes" : "no", d.guaranteedFailure ? "#ff4444" : "#8a9bac"),
      this.row("Selected component", d.selectedFailureComponent || "-", "#ffaa00"),
      this.row("Tie priority", Array.isArray(d.tieBreakPriority) ? d.tieBreakPriority.join(" > ") : "-", "#8a9bac"),
    ];
  }
}

window.FightTensionSection = FightTensionSection;
