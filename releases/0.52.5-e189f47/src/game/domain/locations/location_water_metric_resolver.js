import { WaterMetric } from "./water_metric.js";

// The water metric of a location: the castable water bounds (shore line at the bottom edge, centre line between the
// side edges) and the location's `waterProjection: { maxMeters, tiltDegrees, farScale, lateralContraction }`
// (spec 126). A location without a projection gets a uniform metric. The metric is rebuilt only when its inputs
// change, so per-frame queries allocate nothing.
//
// An invalid projection fails fast when there is no metric yet (startup). A live config edit that makes the
// projection invalid is rejected: the previous metric stays and the error is logged once for that input.
export class LocationWaterMetricResolver {
  #pixelsPerMeter;
  #logger;
  #metric = null;
  #shoreY = NaN;
  #topY = NaN;
  #centerX = NaN;
  #hasProjection = false;
  #maxMeters;
  #tiltDegrees;
  #farScale;
  #lateralContraction;

  constructor({ pixelsPerMeter, logger }) {
    this.#pixelsPerMeter = pixelsPerMeter;
    this.#logger = logger;
  }

  resolve(castableBounds, waterProjection = null) {
    const shoreY = castableBounds.bottom;
    const topY = castableBounds.top;
    const centerX = (castableBounds.left + castableBounds.right) / 2;
    const hasProjection = waterProjection !== null && waterProjection !== undefined;
    const maxMeters = waterProjection?.maxMeters;
    const tiltDegrees = waterProjection?.tiltDegrees;
    const farScale = waterProjection?.farScale;
    const lateralContraction = waterProjection?.lateralContraction;
    if (
      this.#metric !== null &&
      shoreY === this.#shoreY && topY === this.#topY && centerX === this.#centerX &&
      hasProjection === this.#hasProjection && maxMeters === this.#maxMeters && tiltDegrees === this.#tiltDegrees &&
      farScale === this.#farScale && lateralContraction === this.#lateralContraction
    ) {
      return this.#metric;
    }
    this.#shoreY = shoreY;
    this.#topY = topY;
    this.#centerX = centerX;
    this.#hasProjection = hasProjection;
    this.#maxMeters = maxMeters;
    this.#tiltDegrees = tiltDegrees;
    this.#farScale = farScale;
    this.#lateralContraction = lateralContraction;
    let metric;
    try {
      const water = { pixelsPerMeter: this.#pixelsPerMeter, shoreY, topY, centerX };
      metric = hasProjection
        ? WaterMetric.illustrated({ ...water, maxMeters, tiltDegrees, farScale, lateralContraction })
        : new WaterMetric(water);
    } catch (error) {
      if (this.#metric === null) throw error;
      this.#logger?.error(`[Location] waterProjection rejected, the previous water metric stays: ${error.message}`);
      return this.#metric;
    }
    this.#metric = metric;
    return metric;
  }
}
