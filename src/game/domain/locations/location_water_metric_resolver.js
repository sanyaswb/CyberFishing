import { WaterMetric } from "./water_metric.js";

// The water metric of the current location: the castable water bounds (shore line at the bottom edge, centre line
// between the side edges), exact distance profile and illustrated surface tilt. Missing/disabled legacy profiles
// give a uniform metric. The metric is rebuilt only when its inputs change, so per-frame queries
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
  #lateralExpansion = true;
  #tiltDegrees = null;
  #farScale = null;

  constructor({ pixelsPerMeter, logger }) {
    this.#pixelsPerMeter = pixelsPerMeter;
    this.#logger = logger;
  }

  resolve(castableBounds, distanceProfile = null, perspective = null) {
    const shoreY = castableBounds.bottom;
    const topY = castableBounds.top;
    const centerX = (castableBounds.left + castableBounds.right) / 2;
    const isModern = perspective?.tiltDegrees !== undefined;
    const isProfiled = isModern || distanceProfile?.enabled === true;
    const maxMeters = isProfiled ? distanceProfile.maxMeters ?? null : null;
    const linearShare = isProfiled && !isModern ? distanceProfile.linearShare ?? null : null;
    const tiltDegrees = isProfiled ? perspective?.tiltDegrees ?? null : null;
    const lateralExpansion = isProfiled
      ? (tiltDegrees === null ? distanceProfile.lateralExpansion !== false : distanceProfile.lateralExpansion === true)
      : true;
    const farScale = tiltDegrees === null ? null : distanceProfile.farScale ?? null;
    if (
      shoreY === this.#shoreY &&
      topY === this.#topY &&
      centerX === this.#centerX &&
      maxMeters === this.#maxMeters &&
      linearShare === this.#linearShare &&
      lateralExpansion === this.#lateralExpansion && tiltDegrees === this.#tiltDegrees &&
      farScale === this.#farScale
    ) {
      return this.#metric;
    }
    this.#shoreY = shoreY;
    this.#topY = topY;
    this.#centerX = centerX;
    this.#maxMeters = maxMeters;
    this.#linearShare = linearShare;
    this.#lateralExpansion = lateralExpansion;
    this.#tiltDegrees = tiltDegrees;
    this.#farScale = farScale;
    let metric;
    try {
      metric = new WaterMetric({
        pixelsPerMeter: this.#pixelsPerMeter,
        shoreY,
        topY,
        centerX,
        maxMeters,
        linearShare: linearShare ?? undefined,
        lateralExpansion,
        tiltDegrees,
        farScale: farScale ?? undefined,
      });
    } catch (error) {
      if (this.#metric === null) throw error;
      this.#logger?.error(`[Location] distanceProfile rejected, the previous water metric stays: ${error.message}`);
      return this.#metric;
    }
    this.#metric = metric;
    return metric;
  }
}
