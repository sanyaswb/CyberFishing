class FightRodControlGeometrySection extends FightSectionBase {
  constructor(options = {}) {
    super("fightRodControlGeometry", "ROD CONTROL / GEOMETRY", {
      ...options,
      categoryKey: "fightRodControl",
    });
  }

  rows(d) {
    const f = this.formatter;
    return [
      this.row("Target rod X", `${f.num(d.rodControlTargetRodX, 1)}px`, "#73c2fb"),
      this.row("Fish offset X", `${f.num(d.rodControlFishOffsetX, 1)}px`, "#73c2fb"),
      this.row("Line angle", `${f.num(d.rodControlLineAngleDeg, 1)}deg`, "#73c2fb"),
      this.row(
        "Angle ratio",
        f.percent(d.rodControlAngleRatio, 1),
        f.stressColor(d.rodControlAngleRatio),
      ),
      this.row(
        "Direction factor",
        f.percent(d.rodControlDirectionFactor, 1),
        f.stressColor(d.rodControlDirectionFactor),
      ),
      this.row("Fish/control alignment", f.num(d.rodControlFishControlAxisAlignment, 3), "#73c2fb"),
      this.row(
        "Fish velocity on control axis",
        `${f.num(d.rodControlFishControlAxisVelocity, 2)}px/s`,
        "#73c2fb",
      ),
      this.row("Fish autonomous speed", `${f.num(d.rodControlFishAutonomousSpeed, 2)}px/s`, "#73c2fb"),
      this.row("Control axis", `${f.num(d.rodControlAxisX, 2)}, ${f.num(d.rodControlAxisY, 2)}`, "#73c2fb"),
      this.row("Control phase", d.rodControlPhase || "inactive", "#00d4ff"),
      this.row("Desired move X", f.meters(d.rodControlDesiredMoveMeters, 3), "#73c2fb"),
      this.row("Allowed move X", f.meters(d.rodControlAllowedMoveMeters, 3), "#73c2fb"),
      this.row(
        "Applied move X",
        `${f.meters(d.rodControlMoveMeters, 3)} / ${f.num(d.rodControlMovePx, 1)}px`,
        Number(d.rodControlMoveMeters) > 0 ? "#00ff80" : "#8a9bac",
      ),
      this.row(
        "Movement geometry",
        d.rodControlMovementMode || "none",
        d.rodControlMovementMode === "locked_arc" ? "#ffaa00" : "#73c2fb",
      ),
      this.row(
        "Line length locked",
        d.rodControlLineLengthLocked ? "yes" : "no",
        d.rodControlLineLengthLocked ? "#ffaa00" : "#8a9bac",
      ),
      this.row(
        "Control radial constraint",
        d.rodControlRadialConstraintActive ? "active" : "off",
        d.rodControlRadialConstraintActive ? "#ffaa00" : "#8a9bac",
      ),
    ];
  }
}

window.FightRodControlGeometrySection = FightRodControlGeometrySection;
