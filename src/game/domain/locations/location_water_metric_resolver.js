import { WaterMetric } from "./water_metric.js";

// The water metric of the current location: the castable water bounds (shore line at the bottom edge, centre line
// between the side edges) and the location's optional `distanceProfile: { maxMeters, linearShare }`. A location
// without a profile gets a uniform metric. The metric is rebuilt only when its inputs change, so per-frame queries
// allocate nothing.
export class LocationWaterMetricResolver {
  #pixelsPerMeter;
  #metric = null;
  #shoreY = NaN;
  #topY = NaN;
  #centerX = NaN;
  #maxMeters = null;
  #linearShare = null;

  constructor({ pixelsPerMeter }) {
    this.#pixelsPerMeter = pixelsPerMeter;
  }

  resolve(castableBounds, distanceProfile = null) {
    const shoreY = castableBounds.bottom;
    const topY = castableBounds.top;
    const centerX = (castableBounds.left + castableBounds.right) / 2;
    const maxMeters = distanceProfile?.maxMeters ?? null;
    const linearShare = distanceProfile?.linearShare ?? null;
    if (
      this.#metric !== null &&
      shoreY === this.#shoreY &&
      topY === this.#topY &&
      centerX === this.#centerX &&
      maxMeters === this.#maxMeters &&
      linearShare === this.#linearShare
    ) {
      return this.#metric;
    }
    this.#metric = new WaterMetric({
      pixelsPerMeter: this.#pixelsPerMeter,
      shoreY,
      topY,
      centerX,
      maxMeters,
      linearShare: linearShare ?? undefined,
    });
    this.#shoreY = shoreY;
    this.#topY = topY;
    this.#centerX = centerX;
    this.#maxMeters = maxMeters;
    this.#linearShare = linearShare;
    return this.#metric;
  }
}
