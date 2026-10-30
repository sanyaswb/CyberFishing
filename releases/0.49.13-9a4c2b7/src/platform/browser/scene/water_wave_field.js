// Spec 106 D2: crossing waves per axis on the water plane. Each: wavelength multiple, direction (radians from the
// horizontal), share of the amplitude (an axis's shares add up to 1) and phase.
const wave = (multiple, angle, share, phase) =>
  Object.freeze({ multiple, dirX: Math.cos(angle), dirY: Math.sin(angle), share, phase });
const WAVES_X = Object.freeze([wave(1, 0.17, 0.5, 0), wave(0.58, -0.44, 0.3, 1.7), wave(0.34, 1.05, 0.2, 4.1)]);
const WAVES_Y = Object.freeze([wave(0.8, 0.52, 0.6, 0.9), wave(0.45, -0.87, 0.4, 2.6)]);
// Shares of the map over which the waves fade to nothing, so the displaced water meets the still art without a seam.
const FADE_TOP = 0.18;
const FADE_BOTTOM = 0.08;
const FADE_SIDE = 0.03;
const TWO_PI = Math.PI * 2;

const smoothstep = (value) => {
  const t = value <= 0 ? 0 : value >= 1 ? 1 : value;
  return t * t * (3 - 2 * t);
};

// The water's displacement map (spec 106 D2): a small RGBA image whose red channel shifts the art horizontally and green
// vertically (128 = no shift), stretched over the water by DisplacementFilter. write(time, settings) refills it for a
// moment of the animation: crossing sine waves on the water plane, smaller and calmer toward the far edge (perspective)
// and fading out at the edges of every water region (TK-066: each castable zone; the whole map by default). The image is
// small (the filter interpolates it), so one step costs a fraction of a millisecond and uploads a few kilobytes.
export class WaterWaveField {
  #width;
  #height;
  #pixels;
  #envelope;
  #rowX;
  #rowY;
  #regions = [0, 0, 1, 1];
  #union = false;
  #distance;

  constructor({ width, height }) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
      throw new TypeError("WaterWaveField requires an integer size of at least 2×2");
    }
    this.#width = width;
    this.#height = height;
    this.#pixels = new Uint8ClampedArray(width * height * 4);
    this.#envelope = new Float32Array(width * height);
    this.#distance = new Float32Array(width * height);
    this.#rowX = new Float64Array(width);
    this.#rowY = new Float64Array(width);
    this.#buildEnvelope();
    for (let index = 3; index < this.#pixels.length; index += 4) this.#pixels[index] = 255;
  }

  // regions: count rectangles as shares of the map, flat [u0, v0, u1, v1, ...]; the waves live inside them only and fade
  // out at each one's own edges (the shares FADE_* of that region). One region (0, 0, 1, 1) is the whole map. Called
  // when the regions change, not per step.
  setRegions(regions, count, union = false) {
    const next = this.#regions;
    let same = this.#union === union && next.length === count * 4;
    for (let index = 0; same && index < count * 4; index += 1) same = next[index] === regions[index];
    if (same) return false;
    this.#union = union;
    next.length = count * 4;
    for (let index = 0; index < count * 4; index += 1) next[index] = regions[index];
    this.#buildEnvelope();
    return true;
  }

  #buildEnvelope() {
    if (this.#union) { this.#buildUnionEnvelope(); return; }
    const width = this.#width, height = this.#height, regions = this.#regions;
    for (let row = 0; row < height; row += 1) {
      const v = (row + 0.5) / height;
      for (let column = 0; column < width; column += 1) {
        const u = (column + 0.5) / width;
        let value = 0;
        for (let index = 0; index < regions.length; index += 4) {
          const u0 = regions[index], v0 = regions[index + 1], u1 = regions[index + 2], v1 = regions[index + 3];
          if (u < u0 || u > u1 || v < v0 || v > v1) continue;
          const lu = (u - u0) / (u1 - u0), lv = (v - v0) / (v1 - v0);
          const inside = smoothstep(lv / FADE_TOP) * smoothstep((1 - lv) / FADE_BOTTOM) *
            smoothstep(lu / FADE_SIDE) * smoothstep((1 - lu) / FADE_SIDE);
          if (inside > value) value = inside;
        }
        this.#envelope[row * width + column] = value;
      }
    }
  }

  // A baked mask is a union: internal rectangle seams must not become still lines in the waves.
  // Rasterize only the small displacement map, then propagate distance from its exposed coastline in two passes.
  #buildUnionEnvelope() {
    const width = this.#width, height = this.#height, distance = this.#distance;
    distance.fill(0);
    for (let index = 0; index < this.#regions.length; index += 4) {
      const left = Math.max(0, Math.ceil(this.#regions[index] * width - .5));
      const right = Math.min(width - 1, Math.floor(this.#regions[index + 2] * width - .5));
      const top = Math.max(0, Math.ceil(this.#regions[index + 1] * height - .5));
      const bottom = Math.min(height - 1, Math.floor(this.#regions[index + 3] * height - .5));
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) distance[y * width + x] = Infinity;
    }
    const sideStep = 1 / (width * FADE_SIDE), topStep = 1 / (height * FADE_TOP), bottomStep = 1 / (height * FADE_BOTTOM);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!distance[i]) continue;
      distance[i] = Math.min(distance[i], x ? distance[i - 1] + sideStep : sideStep / 2,
        y ? distance[i - width] + topStep : topStep / 2);
    }
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (distance[i]) distance[i] = Math.min(distance[i], x < width - 1 ? distance[i + 1] + sideStep : sideStep / 2,
        y < height - 1 ? distance[i + width] + bottomStep : bottomStep / 2);
      this.#envelope[i] = smoothstep(distance[i]);
    }
  }

  get width() {
    return this.#width;
  }

  get height() {
    return this.#height;
  }

  // RGBA bytes, row by row from the far edge; refilled in place by write().
  get pixels() {
    return this.#pixels;
  }

  // timeSec: the animation clock; artWidth / artHeight: the water's size in art pixels; wavelength: art pixels between
  // crests at the near edge; speed: art pixels per second the crests travel; driftX / driftY: how far the current has
  // carried the whole pattern, in art pixels at the near edge (the far water drifts slower on screen: perspective).
  // plane: the location's water metric and the virtual bounds this field covers (GameRenderFrame world.waterPlane).
  //
  // The waves are a surface pattern (spec 126 R4): on a row whose surface size is s (1 at the shore, farScale at the
  // far edge) crests are s times as far apart and s times as high in both axes, whether or not the grid contracts
  // sideways. Rows run in calibrated ground metres (near-edge art pixels per metre), columns in surface units about
  // the field's centre line.
  write(timeSec, { artWidth, artHeight, wavelength, speed, driftX = 0, driftY = 0, plane = null }) {
    const width = this.#width;
    const height = this.#height;
    const pixels = this.#pixels;
    const k = TWO_PI / Math.max(1, wavelength);
    const travel = k * speed * timeSec;
    const rowX = this.#rowX;
    const rowY = this.#rowY;
    const metric = plane?.metric ?? null;
    const artPerVirtual = metric ? artWidth / (plane.right - plane.left) : 1;
    const nearArtPerMeter = metric ? metric.pixelsPerMeterY(metric.shoreY) * artPerVirtual : 0;
    for (let row = 0; row < height; row += 1) {
      const v = (row + .5) / height;
      let y = v * artHeight;
      let scale = 1;
      if (metric) {
        const mapY = plane.top + v * (plane.bottom - plane.top);
        scale = metric.surfaceScaleAt(mapY);
        y = -metric.metersFromShore(mapY) * nearArtPerMeter;
      }
      const xScale = artWidth / width / scale;
      // Column 0's surface position is (0.5 * xScale - driftX); centre the surface units on the field's middle.
      const columnDrift = metric ? driftX + artWidth / (2 * scale) : driftX;
      rowX.fill(0);
      rowY.fill(0);
      WaterWaveField.#addRow(WAVES_X, rowX, k, xScale, y - driftY, columnDrift, travel);
      WaterWaveField.#addRow(WAVES_Y, rowY, k, xScale, y - driftY, columnDrift, travel);
      for (let column = 0; column < width; column += 1) {
        const index = row * width + column;
        const envelope = this.#envelope[index] * scale;
        const offset = index * 4;
        pixels[offset] = 128 + 127 * envelope * rowX[column];
        pixels[offset + 1] = 128 + 127 * envelope * rowY[column];
        pixels[offset + 2] = 128;
      }
    }
    return pixels;
  }

  // Adds each wave's sine along one row. Its phase grows by the same step per column, so rotating (sin, cos) by that
  // step replaces a sine per pixel: two sines per wave and row instead of one per pixel.
  static #addRow(waves, target, k, xScale, y, driftX, travel) {
    for (let index = 0; index < waves.length; index += 1) {
      const current = waves[index];
      const step = (k * current.dirX * xScale) / current.multiple;
      const phase = (k * ((0.5 * xScale - driftX) * current.dirX + y * current.dirY) - travel) / current.multiple
        + current.phase;
      const stepSin = Math.sin(step);
      const stepCos = Math.cos(step);
      let sin = Math.sin(phase);
      let cos = Math.cos(phase);
      for (let column = 0; column < target.length; column += 1) {
        target[column] += current.share * sin;
        const next = sin * stepCos + cos * stepSin;
        cos = cos * stepCos - sin * stepSin;
        sin = next;
      }
    }
  }
}
