class FightRodControlForceSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightRodControlForce", "ROD CONTROL / FORCE", {
      ...options,
      categoryKey: "fightRodControl",
    });
  }

  rows(d) {
    const f = this.formatter;
    return [
      this.row("Requested force", f.percent(d.rodControlRequestedForceRatio, 1), "#73c2fb"),
      this.row(
        "Rod control tension ceiling",
        `${f.kg(d.rodControlTensionCeilingKg, 3)} (${f.percent(d.rodControlTensionCeilingMultiplier, 1)} of rod limit)`,
        Number(d.rodControlTensionCeilingMultiplier) > 1
          ? "#ff8888"
          : "#73c2fb",
      ),
      this.row(
        "Load reserve",
        f.kg(d.rodControlLoadReserveKg, 3),
        Number(d.rodControlLoadReserveKg) > 0 ? "#00ff80" : "#ff8888",
      ),
      this.row(
        "Load reserve ratio",
        f.percent(d.rodControlLoadReserveRatio, 1),
        Number(d.rodControlLoadReserveRatio) > 0 ? "#00ff80" : "#ff8888",
      ),
      this.row(
        "Drag can slip",
        d.rodControlCanSlipDrag ? "yes" : "no",
        d.rodControlCanSlipDrag ? "#00ff80" : "#8a9bac",
      ),
      this.row(
        "Drag reserve",
        f.kg(d.rodControlDragReserveKg, 3),
        Number(d.rodControlDragReserveKg) > 0 ? "#00ff80" : "#ffaa00",
      ),
      this.row(
        "Drag limited",
        d.rodControlDragLimited ? "yes" : "no",
        d.rodControlDragLimited ? "#ffaa00" : "#8a9bac",
      ),
      this.row("Movement force limit", f.kg(d.rodControlEffectiveForceLimitKg, 3), "#73c2fb"),
      this.row(
        "Delivered force ratio",
        f.percent(d.rodControlDeliveredForceRatio, 1),
        f.stressColor(d.rodControlDeliveredForceRatio),
      ),
      this.row(
        "Actual move ratio",
        f.percent(d.rodControlActualMovementRatio, 1),
        f.stressColor(d.rodControlActualMovementRatio),
      ),
      this.row("Max pull speed", f.mps(d.rodControlMaxPullSpeedMps, 3), "#73c2fb"),
      this.row(
        "Movement force",
        f.kg(d.rodControlForceKg, 3),
        Number(d.rodControlForceKg) > 0 ? "#00ff80" : "#8a9bac",
      ),
      this.row(
        "Applied tension",
        f.kg(d.rodControlPlayerTensionKg, 3),
        Number(d.rodControlPlayerTensionKg) > 0 ? "#ffaa00" : "#8a9bac",
      ),
      this.row("Tension multiplier", f.num(d.rodControlTensionMultiplier, 2), "#ffaa00"),
      this.row("Tension mode", d.rodControlTensionMode || "side", "#00d4ff"),
    ];
  }
}

window.FightRodControlForceSection = FightRodControlForceSection;
