// Authored ranges and defaults of a location's `waterProjection` (spec 126). The schema validator, the water metric
// and the DEV zone editor read these; nothing else keeps a copy.
export const WATER_PROJECTION_RANGES = Object.freeze({
  tiltDegrees: Object.freeze({ min: 1, max: 90, default: 30 }),
  farScale: Object.freeze({ min: 0.05, max: 1, default: 0.3 }),
  lateralContraction: Object.freeze({ default: false }),
});

// Ground metres along the illustrated water (spec 126): metres from the shore d(h) = a*h + b*h*h over the water
// height h in [0, H], with d(H) = L exactly. The depth pixels per metre fall linearly from 1/a at the shore to
// farScale/a at the far edge, and the surface size s(h) = a / (a + 2*b*h) follows them from 1 to farScale.
// Immutable and allocation-free; WaterMetric clamps h and extends the profile with its boundary tangents.
export class IllustratedDepthProfile {
  #heightPx;
  #lengthMeters;
  #farScale;
  #nearPixelsPerMeter;
  #quadratic;

  constructor({ heightPx, maxMeters, farScale }) {
    const height = Number(heightPx), length = Number(maxMeters), ratio = Number(farScale);
    const range = WATER_PROJECTION_RANGES.farScale;
    if (!(height > 0) || !Number.isFinite(height)) throw new RangeError("IllustratedDepthProfile requires a positive heightPx");
    if (!(length > 0) || !Number.isFinite(length)) throw new RangeError("WaterMetric maxMeters must be positive and finite");
    if (!Number.isFinite(ratio) || ratio < range.min || ratio > range.max) {
      throw new RangeError(`WaterMetric farScale must be in [${range.min}, ${range.max}]`);
    }
    const curve = (1 - ratio) / (2 * ratio);
    this.#heightPx = height;
    this.#lengthMeters = length;
    this.#farScale = ratio;
    // Same arithmetic as the first implementation: 1/a pixels per metre at the shore, b = c / (H / a).
    this.#nearPixelsPerMeter = height / length * (1 + curve);
    this.#quadratic = curve / (this.#nearPixelsPerMeter * height);
    if (!Number.isFinite(this.#nearPixelsPerMeter + this.#quadratic) || !(this.#nearPixelsPerMeter > 0)) {
      throw new RangeError("WaterMetric projection is outside the representable range");
    }
  }

  get heightPx() { return this.#heightPx; }
  get lengthMeters() { return this.#lengthMeters; }
  get farScale() { return this.#farScale; }
  // Boundary tangents: depth pixels per metre at the shore, metres per pixel at the far edge.
  get nearPixelsPerMeter() { return this.#nearPixelsPerMeter; }
  get farMetersPerPixel() { return 1 / (this.#farScale * this.#nearPixelsPerMeter); }

  metersAt(height) {
    return height / this.#nearPixelsPerMeter + this.#quadratic * height * height;
  }

  // Stable inverse of metersAt for meters in [0, L].
  heightAt(meters) {
    const a = 1 / this.#nearPixelsPerMeter;
    return 2 * meters / (a + Math.sqrt(a * a + 4 * this.#quadratic * meters));
  }

  metersPerPixelAt(height) {
    return 1 / this.#nearPixelsPerMeter + 2 * this.#quadratic * height;
  }

  surfaceScaleAt(height) {
    return 1 / (1 + 2 * this.#quadratic * this.#nearPixelsPerMeter * height);
  }

  // d s / d h.
  surfaceScaleSlopeAt(height) {
    const scale = this.surfaceScaleAt(height);
    return -2 * this.#quadratic * this.#nearPixelsPerMeter * scale * scale;
  }
}
