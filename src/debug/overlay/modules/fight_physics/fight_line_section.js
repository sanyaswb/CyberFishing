class FightLineSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightLine", "LINE", options);
  }

  rows(d) {
    const f = this.formatter;
    const line = d.lineDebug || {};
    const total = line.totalLineMeters ?? d.lineTotalMeters ?? d.lineTotalLengthMeters;
    const fishDistance = line.fishDistanceMeters ?? d.lineDistanceMeters;
    const released = line.releasedLineMeters ?? d.lineReleasedMeters;
    const remaining = line.remainingLineMeters ?? d.lineRemainingMeters;
    const recoverable = line.recoverableLineMeters ?? d.lineRecoverableMeters ?? d.pumpCreditMeters;
    const releasedFrame = line.lineReleasedThisFrameMeters ?? d.lineReleasedThisFrameMeters;
    const recoveredFrame = line.lineRecoveredThisFrameMeters ?? d.lineRecoveredThisFrameMeters;
    const lineHasReserve = line.lineHasReserve ?? d.lineCanRelease;
    const spoolEmpty = line.spoolEmpty ?? d.lineSpoolEmpty;
    const fullyExtended = line.fullyExtended ?? d.isLineFullyExtended;
    const hardLimit = line.hardLineLimit ?? d.hardLineLimit;
    const hardLimitMeters = line.hardLineLimitMeters ?? released;

    return [
      this.row("Total line", f.meters(total, 2), "#73c2fb"),
      this.row("Fish distance", f.meters(fishDistance, 2), "#73c2fb"),
      this.row("Released line", f.meters(released, 2), "#ffaa00"),
      this.row("Remaining line", f.meters(remaining, 2), lineHasReserve ? "#00ff80" : "#ff8888"),
      this.row("Recoverable line", f.meters(recoverable, 2), "#00ff80"),
      this.row("Last released", f.meters(releasedFrame, 3), Number(releasedFrame) > 0 ? "#ff8888" : "#8a9bac"),
      this.row("Last recovered", f.meters(recoveredFrame, 3), Number(recoveredFrame) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Line has reserve", lineHasReserve ? "YES" : "NO", lineHasReserve ? "#00ff80" : "#ff8888"),
      this.row("Spool empty", spoolEmpty ? "YES" : "NO", spoolEmpty ? "#ff8888" : "#00ff80"),
      this.row("Fully extended", fullyExtended ? "YES" : "NO", fullyExtended ? "#ff8888" : "#00ff80"),
      this.row("Hard line limit", hardLimit ? `${f.meters(hardLimitMeters, 2)} / HIT` : f.meters(hardLimitMeters, 2), hardLimit ? "#ff8888" : "#8a9bac"),
    ];
  }
}

window.FightLineSection = FightLineSection;
