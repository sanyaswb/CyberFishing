export class WorldPerspective {
  #getWaterMetric;
  #sample = { scale: 1, squashY: 1 };

  constructor({ getWaterMetric }) {
    this.#getWaterMetric = getWaterMetric;
  }

  getPerspective(virtualY) {
    const metric = this.#getWaterMetric();
    const lateral = metric.pixelsPerMeterX(virtualY);
    this.#sample.scale = lateral / metric.pixelsPerMeter;
    this.#sample.squashY = metric.pixelsPerMeterY(virtualY) / lateral;
    return this.#sample;
  }
}
