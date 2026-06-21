class FightReelHoldSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightReelHold", "REEL HOLD", {
      ...options,
      categoryKey: "fightPlayerForce",
    });
  }

  rows(d) {
    const f = this.formatter;
    const reelLimit = Number(d.holdReelRecoverReelMaxLoadKg) || 0;
    const totalTension = Number(d.totalTensionKg ?? d.calculatedTensionKg) || 0;
    const safeMarginKg = Math.max(0, reelLimit - totalTension);
    const reason = d.holdReelRecoverBlockedReason || "not_checked";
    const active = !!d.holdReelRecoverActive;
    const eligible = !!d.holdReelRecoverEligible;
    const state = active ? "YES" : eligible ? "WAIT" : "NO";
    const color = active ? "#00ff80" : eligible ? "#ffaa00" : "#8a9bac";

    return [
      this.row("Reel hold active", state, color),
      this.row("Stroke source", d.holdReelRecoverSource || "none", "#73c2fb"),
      this.row("Reel safe margin", f.kg(safeMarginKg, 3), safeMarginKg > 0 ? "#00ff80" : "#ff8888"),
      this.row("Reel hold limit", f.kg(reelLimit, 3)),
      this.row("Reel hold retrieve speed", f.mps(d.holdReelRecoverSpeedMps, 3), "#00ff80"),
      this.row(
        "Reel hold move",
        f.meters(d.reelHoldMoveMeters ?? d.holdReelRecoverMoveMeters, 3),
        Number(d.reelHoldMoveMeters ?? d.holdReelRecoverMoveMeters) > 0 ? "#00ff80" : "#8a9bac",
      ),
      this.row("Reel applied speed", f.mps(d.reelHoldAppliedSpeedMps, 3), Number(d.reelHoldAppliedSpeedMps) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Reel blocked reason", reason, active ? "#00ff80" : "#8a9bac"),
    ];
  }
}

window.FightReelHoldSection = FightReelHoldSection;
