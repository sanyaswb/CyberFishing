import { IllustratedDepthProfile, WATER_PROJECTION_RANGES } from "./illustrated_depth_profile.js";

// Illustrated 2D water (spec 126): ground positions/velocities and local surface-area footprints share this
// immutable metric owner. A depth profile maps the water height to exact authored metres; this class keeps the
// parts every profile shares: boundary tangents outside the water, the ground plane, velocities, surface distance
// and the surface tilt. Without a profile the metric is uniform and every conversion equals the plain
// pixelsPerMeter arithmetic.
//
// Ground coordinates are metres: X sideways from the vertical centre line `centerX`, Y away from the shore. All
// methods are allocation-free; `toGround`/`toVirtual` write into the given target.
//
// Base pixels are ground metres times pixelsPerMeter: the unit gameplay code measured water distances in before the
// metric existed. The *BasePixels methods let that code keep its unit; on a uniform metric they return the plain
// virtual pixel arithmetic exactly (base pixels equal virtual pixels).
export class WaterMetric {
  #pixelsPerMeter;
  #shoreY;
  #heightPx;
  #centerX;
  #profile;
  #isUniform;
  #lateralContraction;
  #tiltDegrees = null;
  #surfaceSquashY = 1;
  #jacobianXX = 1;
  #jacobianXY = 0;
  #jacobianYY = 1;

  // The illustrated water of a location's `waterProjection`; omitted fields take WATER_PROJECTION_RANGES defaults.
  static illustrated({ pixelsPerMeter, shoreY, topY, centerX = 0, maxMeters, tiltDegrees, farScale, lateralContraction }) {
    const ranges = WATER_PROJECTION_RANGES;
    return new WaterMetric({
      pixelsPerMeter, shoreY, topY, centerX,
      depthProfile: new IllustratedDepthProfile({ heightPx: Number(shoreY) - Number(topY), maxMeters,
        farScale: farScale ?? ranges.farScale.default }),
      tiltDegrees: tiltDegrees ?? ranges.tiltDegrees.default,
      lateralContraction: lateralContraction ?? ranges.lateralContraction.default,
    });
  }

  constructor({ pixelsPerMeter, shoreY, topY, centerX = 0, depthProfile = null, tiltDegrees = null,
    lateralContraction = false }) {
    const scale = Number(pixelsPerMeter);
    if (!(scale > 0) || !Number.isFinite(scale)) throw new RangeError("WaterMetric requires a positive pixelsPerMeter");
    const heightPx = Number(shoreY) - Number(topY);
    if (!(heightPx > 0) || !Number.isFinite(heightPx)) throw new RangeError("WaterMetric requires the shore below the top edge");
    this.#pixelsPerMeter = scale;
    this.#shoreY = Number(shoreY);
    this.#heightPx = heightPx;
    this.#centerX = Number(centerX) || 0;
    this.#profile = depthProfile;
    this.#isUniform = depthProfile === null;
    this.#lateralContraction = !this.#isUniform && lateralContraction === true;
    if (this.#isUniform) return;
    if (depthProfile.heightPx !== heightPx) throw new RangeError("WaterMetric depth profile height differs from the water");
    const tilt = Number(tiltDegrees), range = WATER_PROJECTION_RANGES.tiltDegrees;
    if (!Number.isFinite(tilt) || tilt < range.min || tilt > range.max) {
      throw new RangeError(`WaterMetric tiltDegrees must be in [${range.min}, ${range.max}]`);
    }
    this.#tiltDegrees = tilt;
    this.#surfaceSquashY = Math.sin(tilt * Math.PI / 180);
  }

  get isUniform() { return this.#isUniform; }
  get lateralContraction() { return this.#lateralContraction; }
  get tiltDegrees() { return this.#tiltDegrees; }
  get farScale() { return this.#profile?.farScale ?? null; }
  get surfaceSquashY() { return this.#surfaceSquashY; }
  get pixelsPerMeter() { return this.#pixelsPerMeter; }
  get shoreY() { return this.#shoreY; }
  get topY() { return this.#shoreY - this.#heightPx; }
  get topMeters() { return this.#isUniform ? this.#heightPx / this.#pixelsPerMeter : this.#profile.lengthMeters; }

  // Base pixels from the shore line to the top edge of the water.
  get topBasePixels() {
    if (this.#isUniform) return this.#heightPx;
    return this.topMeters * this.#pixelsPerMeter;
  }

  // Local illustrated area scale, also used for sprite sizes. Tilt never recalibrates ground metres.
  surfaceScaleAt(y) {
    if (this.#isUniform) return 1;
    return this.#profile.surfaceScaleAt(this.#waterHeightAt(y));
  }

  // Inverse of the rendered local ellipse; default samples its centre, overlap may sample the midpoint.
  surfaceDistanceBasePixels(x1, y1, x2, y2, sampleY = y1) {
    if (this.#isUniform) return Math.hypot(x1 - x2, y1 - y2);
    const scale = this.surfaceScaleAt(sampleY);
    return Math.hypot((x1 - x2) / scale, (y1 - y2) / (scale * this.#surfaceSquashY));
  }

  // Virtual height y at the given base pixels from the shore.
  yAtBasePixels(basePixels) {
    if (this.#isUniform) return this.#shoreY - basePixels;
    return this.yAtMeters(basePixels / this.#pixelsPerMeter);
  }

  // Ground distance in base pixels between two virtual points.
  distanceBasePixels(x1, y1, x2, y2) {
    if (this.#isUniform) return Math.hypot(x1 - x2, y1 - y2);
    return this.distanceMeters(x1, y1, x2, y2) * this.#pixelsPerMeter;
  }

  // The ground plane in base pixels: X = centerX + sideways metres x pixelsPerMeter, Y = shoreY - metres from the
  // shore x pixelsPerMeter. Distances and speeds on it are ground metres x pixelsPerMeter everywhere on the water.
  // A uniform metric maps the plane 1:1 (exactly the same coordinates).
  toBasePlane(x, y, target) {
    if (this.#isUniform) {
      target.x = x;
      target.y = y;
      return target;
    }
    target.x = this.#centerX + (x - this.#centerX) / this.pixelsPerMeterX(y) * this.#pixelsPerMeter;
    target.y = this.#shoreY - this.metersFromShore(y) * this.#pixelsPerMeter;
    return target;
  }

  fromBasePlane(baseX, baseY, target) {
    if (this.#isUniform) {
      target.x = baseX;
      target.y = baseY;
      return target;
    }
    const y = this.yAtMeters((this.#shoreY - baseY) / this.#pixelsPerMeter);
    target.x = this.#centerX + (baseX - this.#centerX) / this.#pixelsPerMeter * this.pixelsPerMeterX(y);
    target.y = y;
    return target;
  }

  // Velocity (or any small displacement) at virtual point (x, y) converted to the ground plane and back. Uses the
  // exact derivative of fromBasePlane: virtual X depends on the height through the lateral scale.
  velocityToBasePlane(x, y, velocityX, velocityY, target) {
    if (this.#isUniform) {
      target.x = velocityX;
      target.y = velocityY;
      return target;
    }
    this.#writeJacobian(x, y);
    const baseVelocityY = velocityY / this.#jacobianYY;
    target.x = (velocityX - this.#jacobianXY * baseVelocityY) / this.#jacobianXX;
    target.y = baseVelocityY;
    return target;
  }

  velocityFromBasePlane(x, y, baseVelocityX, baseVelocityY, target) {
    if (this.#isUniform) {
      target.x = baseVelocityX;
      target.y = baseVelocityY;
      return target;
    }
    this.#writeJacobian(x, y);
    target.x = this.#jacobianXX * baseVelocityX + this.#jacobianXY * baseVelocityY;
    target.y = this.#jacobianYY * baseVelocityY;
    return target;
  }

  // Virtual pixels from the shore line up to the height the given base pixels reach (what the base pixels were on
  // the map before the metric). Map-pixel mechanics such as the cast accuracy spread measure with it.
  virtualPixelsFromShore(basePixels) {
    if (this.#isUniform) return basePixels;
    return this.#shoreY - this.yAtBasePixels(basePixels);
  }

  // Metres from the shore line to the virtual height y (negative below the shore). Outside the water the profile
  // continues along its boundary tangents.
  metersFromShore(y) {
    if (this.#isUniform) return (this.#shoreY - y) / this.#pixelsPerMeter;
    const heightPx = this.#shoreY - y, profile = this.#profile;
    if (heightPx <= 0) return heightPx / profile.nearPixelsPerMeter;
    if (heightPx >= this.#heightPx) return profile.lengthMeters + (heightPx - this.#heightPx) * profile.farMetersPerPixel;
    return profile.metersAt(heightPx);
  }

  // Virtual height y at the given metres from the shore (inverse of metersFromShore).
  yAtMeters(meters) {
    if (this.#isUniform) return this.#shoreY - meters * this.#pixelsPerMeter;
    const profile = this.#profile;
    if (meters <= 0) return this.#shoreY - meters * profile.nearPixelsPerMeter;
    if (meters >= profile.lengthMeters) return this.topY - (meters - profile.lengthMeters) / profile.farMetersPerPixel;
    return this.#shoreY - profile.heightAt(meters);
  }

  // Pixels per metre along the depth (vertical) axis at height y.
  pixelsPerMeterY(y) {
    if (this.#isUniform) return this.#pixelsPerMeter;
    return 1 / this.#profile.metersPerPixelAt(this.#waterHeightAt(y));
  }

  // Pixels per metre sideways at height y: the base scale, or the surface scale with lateral contraction.
  pixelsPerMeterX(y) {
    if (!this.#lateralContraction) return this.#pixelsPerMeter;
    return this.#pixelsPerMeter * this.surfaceScaleAt(y);
  }

  // Ground distance in metres between two virtual points.
  distanceMeters(x1, y1, x2, y2) {
    if (this.#isUniform) return Math.hypot(x1 - x2, y1 - y2) / this.#pixelsPerMeter;
    const lateral1 = (x1 - this.#centerX) / this.pixelsPerMeterX(y1);
    const lateral2 = (x2 - this.#centerX) / this.pixelsPerMeterX(y2);
    return Math.hypot(lateral1 - lateral2, this.metersFromShore(y1) - this.metersFromShore(y2));
  }

  toGround(x, y, target) {
    target.x = (x - this.#centerX) / this.pixelsPerMeterX(y);
    target.y = this.metersFromShore(y);
    return target;
  }

  toVirtual(groundX, groundY, target) {
    const y = this.yAtMeters(groundY);
    target.x = this.#centerX + groundX * this.pixelsPerMeterX(y);
    target.y = y;
    return target;
  }

  // Derivatives of virtual (x, y) by base-plane (X, Y) at virtual point (x, y): dx/dX, dx/dY and dy/dY (dy/dX = 0).
  #writeJacobian(x, y) {
    const height = this.#waterHeightAt(y);
    const metersPerPixel = this.#profile.metersPerPixelAt(height);
    const lateralScale = this.pixelsPerMeterX(y);
    // d(pixelsPerMeterX)/dy; the height grows as y falls, and the clamped profile is flat outside the water.
    const lateralScaleSlope = this.#lateralContraction && y > this.topY && y < this.#shoreY
      ? -this.#pixelsPerMeter * this.#profile.surfaceScaleSlopeAt(height) : 0;
    this.#jacobianXX = lateralScale / this.#pixelsPerMeter;
    this.#jacobianYY = 1 / (metersPerPixel * this.#pixelsPerMeter);
    this.#jacobianXY = (x - this.#centerX) / lateralScale * lateralScaleSlope * this.#jacobianYY;
  }

  #waterHeightAt(y) {
    return Math.max(0, Math.min(this.#heightPx, this.#shoreY - y));
  }
}
