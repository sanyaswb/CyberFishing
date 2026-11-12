// Read-only illustrated surface sample of the session's authoritative metric (spec 126).
export class WorldPerspective {
  #getWaterMetric;
  #sample = { scale: 1, squashY: 1 };

  constructor({ getWaterMetric }) {
    if (typeof getWaterMetric !== "function") throw new TypeError("WorldPerspective requires getWaterMetric");
    this.#getWaterMetric = getWaterMetric;
  }

  getPerspective(virtualY) {
    const metric = this.#getWaterMetric();
    this.#sample.scale = metric?.surfaceScaleAt(virtualY) ?? 1;
    this.#sample.squashY = metric?.surfaceSquashY ?? 1;
    return this.#sample;
  }
}
