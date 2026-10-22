import { CrossingWavePattern } from "../../../engine/animation/crossing_wave_pattern.js";

// Spec 106 D2: crossing waves per axis on the water plane, shared with the float's rocking (spec 128).
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
    this.#rowX = new Float64Array(width);
    this.#rowY = new Float64Array(width);
    for (let row = 0; row < height; row += 1) {
      const v = (row + 0.5) / height;
      const vertical = smoothstep(v / FADE_TOP) * smoothstep((1 - v) / FADE_BOTTOM);
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
      const x0 = 0.5 * xScale - columnDrift;
      CrossingWavePattern.addRow(CrossingWavePattern.WAVES_X, rowX, k, x0, xScale, y - driftY, travel);
      CrossingWavePattern.addRow(CrossingWavePattern.WAVES_Y, rowY, k, x0, xScale, y - driftY, travel);
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
}
