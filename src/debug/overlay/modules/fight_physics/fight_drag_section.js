class FightDragSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightDrag", "DRAG / RADIAL ESCAPE", options);
  }

  rows(d) {
    const f = this.formatter;
    const dragRatio = Number(d.dragRatio) || 0;
    const dragLimitKg = Number(d.effectiveDragLimitKg ?? d.dragLimitKg) || 0;
    const fishWonRadialForceKg =
      Number(d.fishWonRadialForceKg ?? d.fishWonYForceKg) || 0;
    const radialEscapeForceKg =
      Number(d.radialEscapeForceKg ?? d.yEscapeForceKg) || 0;
    const shouldSlip = !!d.shouldSlipDrag;
    const canHoldRadial =
      fishWonRadialForceKg <= dragLimitKg + 0.000001 && dragRatio > 0;
    return [
      this.row("Drag ratio", f.percent(dragRatio, 1)),
      this.row("Drag limit", f.kg(dragLimitKg, 3), "#00ccff"),
      this.row("Fish won radial force", f.kg(fishWonRadialForceKg, 3), "#ff8888"),
      this.row("Drag blocked force", f.kg(d.dragBlockedForceKg, 3), "#ffaa00"),
      this.row("Radial escape force", f.kg(radialEscapeForceKg, 3), radialEscapeForceKg > 0 ? "#ff8888" : "#00ff80"),
      this.row("Radial speed", `${f.num(d.radialSpeedPxPerSec, 1)}px/s`),
      this.row("Outward radial speed", `${f.num(d.outwardRadialSpeedPxPerSec, 1)}px/s`),
      this.row("Tangent speed", `${f.num(d.tangentSpeedPxPerSec, 1)}px/s`, "#73c2fb"),
      this.row("Final X speed", `${f.num(d.finalXSpeedPxPerSec, 1)}px/s`, "#73c2fb"),
      this.row(
        "Final radial speed",
        `${f.num(d.finalRadialSpeedPxPerSec ?? d.finalYSpeedPxPerSec, 1)}px/s`,
        "#73c2fb",
      ),
      this.row("Drag state", shouldSlip ? "SLIPPING" : canHoldRadial ? "HOLDING_RADIAL" : "OPEN/NO_OUTWARD", shouldSlip ? "#ff8888" : "#00ff80"),
    ];
  }
}

window.FightDragSection = FightDragSection;
