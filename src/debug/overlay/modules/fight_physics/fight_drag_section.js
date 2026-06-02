class FightDragSection extends FightSectionBase {
  constructor(options = {}) {
    super("fightDrag", "DRAG / Y ESCAPE", options);
  }

  rows(d) {
    const f = this.formatter;
    const dragRatio = Number(d.dragRatio) || 0;
    const dragLimitKg = Number(d.effectiveDragLimitKg ?? d.dragLimitKg) || 0;
    const fishWonYForceKg = Number(d.fishWonYForceKg) || 0;
    const yEscapeForceKg = Number(d.yEscapeForceKg ?? d.excessYForceKg) || 0;
    const finalYSpeed = Number(d.finalYSpeedPxPerSec) || 0;
    const shouldSlip = !!d.shouldSlipDrag;
    const canHoldY = fishWonYForceKg <= dragLimitKg + 0.000001 && dragRatio > 0;
    return [
      this.row("Drag ratio", f.percent(dragRatio, 1)),
      this.row("Drag limit", f.kg(dragLimitKg, 3), "#00ccff"),
      this.row("Fish won Y force", f.kg(fishWonYForceKg, 3), "#ff8888"),
      this.row("Drag blocked force", f.kg(d.dragBlockedForceKg, 3), "#ffaa00"),
      this.row("Y escape force", f.kg(yEscapeForceKg, 3), yEscapeForceKg > 0 ? "#ff8888" : "#00ff80"),
      this.row("Final X speed", `${f.num(d.finalXSpeedPxPerSec, 1)}px/s`, "#73c2fb"),
      this.row("Final Y speed", `${f.num(finalYSpeed, 1)}px/s`, finalYSpeed === 0 ? "#00ff80" : "#ff8888"),
      this.row("Drag state", shouldSlip ? "SLIPPING" : canHoldY ? "HOLDING_Y" : "OPEN/NO_Y", shouldSlip ? "#ff8888" : "#00ff80"),
    ];
  }
}

window.FightDragSection = FightDragSection;
