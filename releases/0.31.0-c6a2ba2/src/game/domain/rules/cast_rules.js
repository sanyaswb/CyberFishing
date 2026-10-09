export class CastRules {
  constructor(equipmentRules) {
    this.equipmentRules = equipmentRules;
  }

  canCastAt(
    vx,
    vy,
    equipment,
    bounds,
    rodPos,
    selectedDepthMeters = null,
  ) {
    const maxDistance = this.equipmentRules.getEffectiveCastDistance(
      equipment,
      Infinity,
      null,
      selectedDepthMeters,
    );
    if (maxDistance === Infinity) return true;
    const maxInsideBounds = Math.min(maxDistance, bounds.bottom - bounds.top);
    const castLineY = bounds.bottom - maxInsideBounds;
    return (
      vy >= castLineY &&
      (!rodPos || Math.hypot(vx - rodPos.x, vy - rodPos.y) <= maxDistance)
    );
  }
}
