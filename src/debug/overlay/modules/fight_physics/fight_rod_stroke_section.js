class FightRodStrokeSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightRodStroke", "ROD STROKE", options);
  }

  rows(d) {
    const f = this.formatter;
    const line = d.lineDebug || {};
    const capacity = line.rodStrokeCapacityMeters ?? d.rodStrokeCapacityMeters;
    const won = line.rodStrokeWonMeters ?? d.rodStrokeWonMeters;
    const used = line.rodStrokeUsedMeters ?? d.rodStrokeUsedMeters ?? won;
    const unrecovered = line.rodStrokeUnrecoveredMeters ?? d.rodStrokeUnrecoveredMeters;
    const ratio = line.rodStrokeRatio ?? d.rodStrokeRatio;
    const yGained = line.strokeYGainedMeters ?? d.strokeYGainedMeters;
    const yLost = line.strokeYLostMeters ?? d.strokeYLostMeters;
    const initialCredit = line.initialPumpCreditMeters ?? d.pumpCreditPenaltyMeters;
    const finalCredit = line.finalPumpCreditMeters ?? d.pumpCreditMeters;
    const releasedFrame = line.lineReleasedThisFrameMeters ?? d.lineReleasedThisFrameMeters;
    const recoveredFrame = line.lineRecoveredThisFrameMeters ?? d.lineRecoveredThisFrameMeters;
    const resetReason = line.strokeResetReason ?? d.strokeResetReason ?? "none";
    const syncReason = line.strokeSyncReason ?? d.strokeSyncReason ?? "none";

    return [
      this.row("Stroke capacity", f.meters(capacity, 2), "#73c2fb"),
      this.row("Stroke won", f.meters(won ?? used, 2), "#ffaa00"),
      this.row("Stroke unrecovered", f.meters(unrecovered, 2), Number(unrecovered) > 0 ? "#ffaa00" : "#00ff80"),
      this.row("Stroke ratio", f.percent(ratio, 1), f.stressColor(ratio)),
      this.row("Y gained frame", f.meters(yGained, 3), Number(yGained) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Y lost frame", f.meters(yLost, 3), Number(yLost) > 0 ? "#ff8888" : "#8a9bac"),
      this.row("Initial pump credit", f.meters(initialCredit, 2), "#8a9bac"),
      this.row("Final pump credit", f.meters(finalCredit, 2), "#8a9bac"),
      this.row("Released this frame", f.meters(releasedFrame, 3), Number(releasedFrame) > 0 ? "#ff8888" : "#8a9bac"),
      this.row("Recovered this frame", f.meters(recoveredFrame, 3), Number(recoveredFrame) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Stroke reset reason", resetReason, resetReason === "none" ? "#8a9bac" : "#ffaa00"),
      this.row("Stroke sync reason", syncReason, syncReason === "none" ? "#8a9bac" : "#ffaa00"),
    ];
  }
}

window.FightRodStrokeSection = FightRodStrokeSection;
