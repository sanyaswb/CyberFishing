class DistanceUnitConverter {
  #pixelsPerMeter;

  constructor(config = {}) {
    const physicsConfig = config?.physics || config || {};
    this.#pixelsPerMeter = Math.max(
      1,
      Number(
        physicsConfig.simulation?.pixelsPerMeter ??
          physicsConfig.pixelsPerMeter,
      ) || 50,
    );
  }

  get pixelsPerMeter() {
    return this.#pixelsPerMeter;
  }

  metersToPixels(meters) {
    const value = Number(meters);
    if (!Number.isFinite(value)) return 0;
    return value * this.#pixelsPerMeter;
  }

  pixelsToMeters(pixels) {
    const value = Number(pixels);
    if (!Number.isFinite(value)) return 0;
    return value / this.#pixelsPerMeter;
  }
}
