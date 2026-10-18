// Spec 106 D2: crossing waves per axis on the water plane. Each: wavelength multiple, direction (radians from the
// horizontal), share of the amplitude (an axis's shares add up to 1) and phase.
const wave = (multiple, angle, share, phase) =>
  Object.freeze({ multiple, dirX: Math.cos(angle), dirY: Math.sin(angle), share, phase });
const WAVES_X = Object.freeze([wave(1, 0.17, 0.5, 0), wave(0.58, -0.44, 0.3, 1.7), wave(0.34, 1.05, 0.2, 4.1)]);
const WAVES_Y = Object.freeze([wave(0.8, 0.52, 0.6, 0.9), wave(0.45, -0.87, 0.4, 2.6)]);
// The far edge of the water is drawn this much smaller than the near edge: waves shrink and calm toward it.
const FAR_SCALE = 0.35;
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
// and fading out at the edges. The image is small (the filter interpolates it), so one step costs a fraction of a
// millisecond and uploads a few kilobytes.
export class WaterWaveField {
  #width;
  #height;
  #pixels;
  #envelope;
  #perspective;
  #rowX;
  #rowY;

  constructor({ width, height }) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
      throw new TypeError("WaterWaveField requires an integer size of at least 2×2");
    }
    this.#width = width;
    this.#height = height;
    this.#pixels = new Uint8ClampedArray(width * height * 4);
    this.#envelope = new Float32Array(width * height);
    this.#perspective = new Float32Array(height);
    this.#rowX = new Float64Array(width);
    this.#rowY = new Float64Array(width);
    for (let row = 0; row < height; row += 1) {
      const v = (row + 0.5) / height;
      const perspective = FAR_SCALE + (1 - FAR_SCALE) * v;
      this.#perspective[row] = perspective;
      const vertical = perspective * smoothstep(v / FADE_TOP) * smoothstep((1 - v) / FADE_BOTTOM);
      for (let column = 0; column < width; column += 1) {
        const u = (column + 0.5) / width;
        this.#envelope[row * width + column] = vertical * smoothstep(u / FADE_SIDE) * smoothstep((1 - u) / FADE_SIDE);
      }
    }
    for (let index = 3; index < this.#pixels.length; index += 4) this.#pixels[index] = 255;
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
  // crests at the near edge; speed: art pixels per second the crests travel.
  write(timeSec, { artWidth, artHeight, wavelength, speed }) {
    const width = this.#width;
    const height = this.#height;
    const pixels = this.#pixels;
    const k = TWO_PI / Math.max(1, wavelength);
    const travel = k * speed * timeSec;
    const rowX = this.#rowX;
    const rowY = this.#rowY;
    for (let row = 0; row < height; row += 1) {
      const perspective = this.#perspective[row];
      // Positions on the water plane: the far rows cover more water per art pixel.
      const y = (((row + 0.5) / height) * artHeight) / perspective;
      const xScale = artWidth / (width * perspective);
      rowX.fill(0);
      rowY.fill(0);
      WaterWaveField.#addRow(WAVES_X, rowX, k, xScale, y, travel);
      WaterWaveField.#addRow(WAVES_Y, rowY, k, xScale, y, travel);
      for (let column = 0; column < width; column += 1) {
        const index = row * width + column;
        const envelope = this.#envelope[index];
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
  static #addRow(waves, target, k, xScale, y, travel) {
    for (let index = 0; index < waves.length; index += 1) {
      const current = waves[index];
      const step = (k * current.dirX * xScale) / current.multiple;
      const phase = (k * (0.5 * xScale * current.dirX + y * current.dirY) - travel) / current.multiple + current.phase;
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
