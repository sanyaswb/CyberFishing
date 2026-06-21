class FightAutoRecoverySection extends FightSectionBase {
  constructor(options = {}) {
    super("fightAutoRecovery", "AUTO RECOVERY", {
      ...options,
      categoryKey: "fightPlayerForce",
    });
  }

  rows(d) {
    const f = this.formatter;
    const line = d.lineDebug || {};
    const active = line.autoRecoverActive ?? d.autoRecoverActive;
    const reason = line.autoRecoverBlockedReason ?? d.autoRecoverBlockedReason ?? "not_checked";
    const speed = line.autoRecoverSpeedMetersPerSec ?? d.autoRecoverSpeedMps;
    const baseSpeed = line.autoRecoverBaseRetrieveSpeedMetersPerSec ?? d.autoRecoverBaseRetrieveSpeedMps;
    const efficiency = line.autoRecoverReelEfficiency ?? d.autoRecoverReelEfficiency;
    const loadRatio = line.autoRecoverReelLoadRatio ?? d.autoRecoverReelLoadRatio;
    const recovered = line.autoRecoveredMeters ?? d.autoRecoveredMeters;
    const tension = d.totalTensionKg ?? d.calculatedTensionKg;
    const reelLimit =
      line.autoRecoverReelMaxLoadKg ??
      d.autoRecoverReelMaxLoadKg ??
      d.holdReelRecoverReelMaxLoadKg ??
      d.reelMaxLoadKg;

    return [
      this.row("Auto recover active", active ? "YES" : "NO", active ? "#00ff80" : "#8a9bac"),
      this.row("Auto recover base speed", f.mps(baseSpeed, 3), "#00ff80"),
      this.row("Tension", f.kg(tension, 3), "#ffaa00"),
      this.row("Reel max load", f.kg(reelLimit, 3), "#73c2fb"),
      this.row("Reel load", f.percent(loadRatio, 1), f.stressColor(loadRatio)),
      this.row("Reel efficiency", f.percent(efficiency, 1), efficiency > 0 ? "#00ff80" : "#ff8888"),
      this.row("Actual recover speed", f.mps(speed, 3), "#00ff80"),
      this.row("Recovered frame", f.meters(recovered, 3), Number(recovered) > 0 ? "#00ff80" : "#8a9bac"),
      this.row("Recover blocked", reason, active ? "#00ff80" : "#8a9bac"),
    ];
  }
}

window.FightAutoRecoverySection = FightAutoRecoverySection;
