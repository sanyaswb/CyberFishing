class FightLineSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightLine", "LINE", { ...options, categoryKey: "fightLineDrag" });
  }

  rows(d) {
    const f = this.formatter;
    const line = d.lineDebug || {};
    const total = line.totalLineMeters ?? d.lineTotalMeters ?? d.lineTotalLengthMeters;
    const fishDistance = line.fishDistanceMeters ?? d.lineDistanceMeters;
    const released = line.releasedLineMeters ?? d.lineReleasedMeters;
    const remaining = line.remainingLineMeters ?? d.lineRemainingMeters;
    const recoverable = line.recoverableLineMeters ?? d.lineRecoverableMeters;
    const releasedFrame = line.lineReleasedThisFrameMeters ?? d.lineReleasedThisFrameMeters;
    const recoveredFrame = line.lineRecoveredThisFrameMeters ?? d.lineRecoveredThisFrameMeters;
    const lineHasReserve = line.lineHasReserve ?? d.lineCanRelease;
    const spoolEmpty = line.spoolEmpty ?? d.lineSpoolEmpty;
    const fullyExtended = line.fullyExtended ?? d.isLineFullyExtended;
    const hardLimit = line.hardLineLimit ?? d.hardLineLimit;
    const hardLimitMeters = line.hardLineLimitMeters ?? released;
    const lineLengthLocked = line.lineLengthLocked ?? d.lineLengthLocked;
    const radialConstraintActive =
      line.radialConstraintActive ?? d.radialConstraintActive;
    const tautLine = line.tautLine ?? d.lineTaut;
    const dragCanPayout = line.dragCanPayout ?? d.lineDragCanPayout;
    const releaseBlockedReason =
      line.releaseBlockedReason ?? d.lineReleaseBlockedReason ?? "none";
    const constraintReason =
      line.constraintReason ?? d.lineConstraintReason ?? "none";

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
      this.row("Length locked", lineLengthLocked ? "YES" : "NO", lineLengthLocked ? "#ffaa00" : "#00ff80"),
      this.row("Taut line", tautLine ? "YES" : "NO", tautLine ? "#ffaa00" : "#8a9bac"),
      this.row("Line radial constraint", radialConstraintActive ? "ACTIVE" : "OFF", radialConstraintActive ? "#ffaa00" : "#8a9bac"),
      this.row("Drag can payout", dragCanPayout ? "YES" : "NO", dragCanPayout ? "#00ff80" : "#8a9bac"),
      this.row("Release blocked reason", releaseBlockedReason, releaseBlockedReason === "none" ? "#8a9bac" : "#ff8888"),
      this.row("Constraint reason", constraintReason, constraintReason === "none" ? "#8a9bac" : "#ffaa00"),
    ];
  }
}

window.FightLineSection = FightLineSection;
