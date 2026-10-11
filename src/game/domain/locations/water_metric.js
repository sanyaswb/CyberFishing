// Metres on the water plane of one location. The castable water runs from the shore line (its bottom edge, 0 m) to
// its top edge. The lower `linearShare` of that height keeps the base scale (pixelsPerMeter). Above it, the metres
// per pixel grow linearly with height, so the scale changes without a kink and the top edge lies at `maxMeters`.
// The lateral scale at a height is the square root of the depth-axis compression (pinhole camera: lateral pixels per
// metre fall with distance, depth pixels per metre fall with its square). Without `maxMeters` the metric is uniform
// and every conversion equals the plain pixelsPerMeter arithmetic.
//
// Ground coordinates are metres: X sideways from the vertical centre line `centerX`, Y away from the shore. All
// methods are allocation-free; `toGround`/`toVirtual` write into the given target.
//
// Base pixels are ground metres times pixelsPerMeter: the unit gameplay code measured water distances in before the
// metric existed. The *BasePixels methods let that code keep its unit; on a uniform metric they return the plain
// virtual pixel arithmetic exactly (base pixels equal virtual pixels).
export class WaterMetric {
  #pixelsPerMeter;
  #metersPerPixel;
  #shoreY;
  #heightPx;
  #centerX;
  #joinHeightPx;
  #curveHeightPx;
  #curveCoefficient;
  #joinMeters;
  #topMeters;
  #topMetersPerPixel;
  #isUniform;
  #jacobianXX = 1;
  #jacobianXY = 0;
  #jacobianYY = 1;

  constructor({ pixelsPerMeter, shoreY, topY, centerX = 0, maxMeters = null, linearShare = 0.5 }) {
    const scale = Number(pixelsPerMeter);
    if (!(scale > 0)) throw new RangeError("WaterMetric requires a positive pixelsPerMeter");
    const heightPx = Number(shoreY) - Number(topY);
    if (!(heightPx > 0)) throw new RangeError("WaterMetric requires the shore below the top edge");
    this.#pixelsPerMeter = scale;
    this.#metersPerPixel = 1 / scale;
    this.#shoreY = Number(shoreY);
    this.#heightPx = heightPx;
    this.#centerX = Number(centerX) || 0;
    this.#isUniform = maxMeters === null || maxMeters === undefined;
    if (this.#isUniform) {
      this.#joinHeightPx = heightPx;
      this.#curveHeightPx = 0;
      this.#curveCoefficient = 0;
    } else {
      const share = Number(linearShare);
      if (!(share >= 0 && share < 1)) throw new RangeError("WaterMetric linearShare must be in [0, 1)");
      this.#joinHeightPx = heightPx * share;
      this.#curveHeightPx = heightPx - this.#joinHeightPx;
      const uniformTopMeters = heightPx / scale;
      const extraMeters = Number(maxMeters) - uniformTopMeters;
      if (!(extraMeters >= 0)) {
        throw new RangeError(
          `WaterMetric maxMeters ${maxMeters} is below the uniform ${uniformTopMeters.toFixed(2)} m of this water`,
        );
      }
      this.#curveCoefficient = extraMeters / (this.#curveHeightPx * this.#curveHeightPx);
    }
    this.#joinMeters = this.#joinHeightPx / scale;
    this.#topMeters = this.#joinMeters + this.#curveHeightPx / scale +
      this.#curveCoefficient * this.#curveHeightPx * this.#curveHeightPx;
    this.#topMetersPerPixel = this.#metersPerPixel + 2 * this.#curveCoefficient * this.#curveHeightPx;
  }

  get isUniform() {
    return this.#isUniform;
  }

  get pixelsPerMeter() {
    return this.#pixelsPerMeter;
  }

  get shoreY() {
    return this.#shoreY;
  }

  get topMeters() {
    return this.#topMeters;
  }

  // Base pixels from the shore line to the top edge of the water.
  get topBasePixels() {
    if (this.#isUniform) return this.#heightPx;
    return this.#topMeters * this.#pixelsPerMeter;
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

  // Virtual pixels covered sideways at height y by the given base pixels.
  lateralVirtualPixels(basePixels, y) {
    if (this.#isUniform) return basePixels;
    return basePixels * this.pixelsPerMeterX(y) / this.#pixelsPerMeter;
  }

  // Metres from the shore line to the virtual height y (negative below the shore).
  metersFromShore(y) {
    if (this.#isUniform) return (this.#shoreY - y) / this.#pixelsPerMeter;
    const heightPx = this.#shoreY - y;
    if (heightPx <= this.#joinHeightPx) return heightPx / this.#pixelsPerMeter;
    const curvePx = heightPx - this.#joinHeightPx;
    if (curvePx <= this.#curveHeightPx) {
      return this.#joinMeters + curvePx / this.#pixelsPerMeter + this.#curveCoefficient * curvePx * curvePx;
    }
    return this.#topMeters + (curvePx - this.#curveHeightPx) * this.#topMetersPerPixel;
  }

  // Virtual height y at the given metres from the shore (inverse of metersFromShore).
  yAtMeters(meters) {
    if (this.#isUniform) return this.#shoreY - meters * this.#pixelsPerMeter;
    if (meters <= this.#joinMeters) return this.#shoreY - meters * this.#pixelsPerMeter;
    if (meters <= this.#topMeters) {
      const extra = meters - this.#joinMeters;
      const k = this.#curveCoefficient;
      const r = this.#metersPerPixel;
      const curvePx = k > 0 ? (Math.sqrt(r * r + 4 * k * extra) - r) / (2 * k) : extra * this.#pixelsPerMeter;
      return this.#shoreY - this.#joinHeightPx - curvePx;
    }
    return this.#shoreY - this.#joinHeightPx - this.#curveHeightPx -
      (meters - this.#topMeters) / this.#topMetersPerPixel;
  }

  // Pixels per metre along the depth (vertical) axis at height y.
  pixelsPerMeterY(y) {
    return 1 / this.#metersPerPixelAt(y);
  }

  // Pixels per metre sideways at height y.
  pixelsPerMeterX(y) {
    if (this.#isUniform) return this.#pixelsPerMeter;
    return this.#pixelsPerMeter * Math.sqrt(this.#metersPerPixel / this.#metersPerPixelAt(y));
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
    const metersPerPixel = this.#metersPerPixelAt(y);
    const lateralScale = this.pixelsPerMeterX(y);
    const curvePx = this.#shoreY - y - this.#joinHeightPx;
    const lateralScaleSlope = curvePx > 0 && curvePx < this.#curveHeightPx
      ? this.#pixelsPerMeter * Math.sqrt(this.#metersPerPixel) * this.#curveCoefficient * metersPerPixel ** -1.5
      : 0;
    this.#jacobianXX = lateralScale / this.#pixelsPerMeter;
    this.#jacobianYY = 1 / (metersPerPixel * this.#pixelsPerMeter);
    this.#jacobianXY = (x - this.#centerX) / lateralScale * lateralScaleSlope * this.#jacobianYY;
  }

  #metersPerPixelAt(y) {
    if (this.#isUniform) return this.#metersPerPixel;
    const curvePx = this.#shoreY - y - this.#joinHeightPx;
    if (curvePx <= 0) return this.#metersPerPixel;
    if (curvePx >= this.#curveHeightPx) return this.#topMetersPerPixel;
    return this.#metersPerPixel + 2 * this.#curveCoefficient * curvePx;
  }
}
