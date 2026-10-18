import { WaterMetric } from "./water_metric.js";

// The water metric of the current location: the castable water bounds (shore line at the bottom edge, centre line
// between the side edges) and the location's `distanceProfile: { enabled, linearShare, maxMeters, tiltDegrees }`. A missing or
// disabled profile gives a uniform metric. The metric is rebuilt only when its inputs change, so per-frame queries
// allocate nothing.
//
// An invalid profile fails fast when there is no metric yet (startup). A live config edit that makes the profile
// invalid is rejected: the previous metric stays and the error is logged once for that input.
export class LocationWaterMetricResolver {
  #pixelsPerMeter;
  #logger;
  #metric = null;
  #shoreY = NaN;
  #topY = NaN;
  #centerX = NaN;
  #maxMeters = null;
  #linearShare = null;
  #tiltDegrees = 90;

  constructor({ pixelsPerMeter, logger }) {
    this.#pixelsPerMeter = pixelsPerMeter;
    this.#logger = logger;
  }

  resolve(castableBounds, distanceProfile = null) {
    const shoreY = castableBounds.bottom;
    const topY = castableBounds.top;
    const centerX = (castableBounds.left + castableBounds.right) / 2;
    const isProfiled = distanceProfile?.enabled === true;
    const maxMeters = isProfiled ? distanceProfile.maxMeters ?? null : null;
    const linearShare = isProfiled ? distanceProfile.linearShare ?? null : null;
    const tiltDegrees = isProfiled ? distanceProfile.tiltDegrees ?? 90 : 90;
    if (
      shoreY === this.#shoreY &&
      topY === this.#topY &&
      centerX === this.#centerX &&
      maxMeters === this.#maxMeters &&
      linearShare === this.#linearShare &&
      tiltDegrees === this.#tiltDegrees
    ) {
      return this.#metric;
    }
    this.#shoreY = shoreY;
    this.#topY = topY;
    this.#centerX = centerX;
    this.#maxMeters = maxMeters;
    this.#linearShare = linearShare;
    this.#tiltDegrees = tiltDegrees;
    let metric;
    try {
      metric = new WaterMetric({
        pixelsPerMeter: this.#pixelsPerMeter,
        shoreY,
        topY,
        centerX,
        maxMeters,
        linearShare: linearShare ?? undefined,
        tiltDegrees,
      });
    } catch (error) {
      if (this.#metric === null) throw error;
      this.#logger.error(`[Location] distanceProfile rejected, the previous water metric stays: ${error.message}`);
      return this.#metric;
    }
    this.#metric = metric;
    return metric;
  }
}
