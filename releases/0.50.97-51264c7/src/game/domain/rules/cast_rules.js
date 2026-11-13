export class CastRules {
  #equipmentRules;
  #devFlags;

  constructor(equipmentRules, devFlags = null) {
    this.#equipmentRules = equipmentRules;
    this.#devFlags = devFlags;
  }

  get equipmentRules() {
    return this.#equipmentRules;
  }

  // Cast distances are base pixels (ground metres times pixelsPerMeter); the water metric places them on the map.
  canCastAt(
    vx,
    vy,
    equipment,
    waterMetric,
    rodPos,
    selectedDepthMeters = null,
  ) {
    if (this.#devFlags?.isEnabled?.("infiniteCasting")) {
      return true;
    }
    const maxDistance = this.#equipmentRules.getEffectiveCastDistance(
      equipment,
      Infinity,
      null,
      selectedDepthMeters,
    );
    if (maxDistance === Infinity) return true;
    const maxInsideBounds = Math.min(maxDistance, waterMetric.topBasePixels);
    const castLineY = waterMetric.yAtBasePixels(maxInsideBounds);
    return (
      vy >= castLineY &&
      (!rodPos || waterMetric.distanceBasePixels(vx, vy, rodPos.x, rodPos.y) <= maxDistance)
    );
  }
}
