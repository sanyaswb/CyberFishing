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
    const reason = d.reelHoldBlockedReason || d.holdReelRecoverBlockedReason || "not_checked";
    const sessionActive = d.playerReelFatigueSessionActive === true;
    const source = d.playerPressureFatigueSourceMode || "reel_hold_session";
    const sourceActive = d.playerPressureFatigueSourceActive === true;
    const canPull = d.reelHoldCanPull === true;
    const engaged = !!(d.reelHoldEngaged ?? d.holdReelRecoverEngaged);
    const active = !!(d.reelHoldActive ?? d.holdReelRecoverActive);
    const recoveringLine = !!(d.reelHoldRecoveringLine ?? d.holdReelRecoveringLine);
    const eligible = !!d.holdReelRecoverEligible;
    const state = canPull ? "CAN_PULL" : "BLOCKED";
    const color = canPull ? "#00ff80" : "#ffaa00";

    return [
      this.row("Player Reel Fatigue Session", sessionActive ? "ACTIVE" : "INACTIVE", sessionActive ? "#00ff80" : "#8a9bac"),
      this.row("Fatigue source", source, sourceActive ? "#00ff80" : "#8a9bac"),
      this.row("Fatigue source active", sourceActive ? "YES" : "NO", sourceActive ? "#00ff80" : "#8a9bac"),
      this.row("ReelHold capability", state, color),
      this.row("ReelHold blocked reason", reason, canPull ? "#00ff80" : "#ffaa00"),
      this.row("ReelHold active", active ? "YES" : eligible ? "WAIT" : "NO", active ? "#00ff80" : eligible ? "#ffaa00" : "#8a9bac"),
      this.row("ReelHold engaged", engaged ? "YES" : "NO", engaged ? "#00ff80" : "#8a9bac"),
      this.row("ReelHold can pull", canPull ? "YES" : "NO", canPull ? "#00ff80" : "#8a9bac"),
      this.row("Recovering line", recoveringLine ? "YES" : "NO", recoveringLine ? "#00ff80" : "#8a9bac"),
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
      this.row("Line recovery block", d.holdReelRecoverLineBlockedReason || "not_checked", recoveringLine ? "#00ff80" : "#8a9bac"),
    ];
  }
}

window.FightReelHoldSection = FightReelHoldSection;
