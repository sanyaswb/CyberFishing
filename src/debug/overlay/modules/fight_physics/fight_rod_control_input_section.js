class FightRodControlInputSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightRodControlInput", "ROD CONTROL / INPUT", {
      ...options,
      categoryKey: "fightRodControl",
    });
  }

  rows(d) {
    const f = this.formatter;
    const inputDirection = Number(d.rodControlInputDirectionX) || 0;
    const inputLabel =
      inputDirection < 0 ? "left" : inputDirection > 0 ? "right" : "none";
    const blockedReason =
      d.rodControlBlockedReason ||
      d.rodControlMovementBlockReason ||
      "none";

    return [
      this.row(
        "Active",
        d.rodControlActive ? "yes" : "no",
        d.rodControlActive ? "#00ff80" : "#8a9bac",
      ),
      this.row(
        "Input direction X",
        inputLabel,
        inputDirection ? "#00d4ff" : "#8a9bac",
      ),
      this.row("Input ratio", f.percent(d.rodControlInputRatio, 1), "#73c2fb"),
      this.row("Target mode", d.rodControlTargetMode || "input_direction", "#00d4ff"),
      this.row(
        "Centered start",
        d.rodControlCenterStartActive
          ? "active"
          : d.rodControlCentered
            ? "ready"
            : "no",
        d.rodControlCenterStartActive
          ? "#00ff80"
          : d.rodControlCentered
            ? "#73c2fb"
            : "#8a9bac",
      ),
      this.row(
        "Blocked reason",
        blockedReason,
        blockedReason === "none" ? "#8a9bac" : "#ffaa00",
      ),
    ];
  }
}

window.FightRodControlInputSection = FightRodControlInputSection;
