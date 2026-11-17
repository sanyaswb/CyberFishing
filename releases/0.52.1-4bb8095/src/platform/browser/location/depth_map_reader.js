export class DepthMapReader {
  #width;
  #height;
  #pixels;

  constructor({ width, height, pixels }) {
    this.#width = Math.max(1, Math.floor(Number(width) || 1));
    this.#height = Math.max(1, Math.floor(Number(height) || 1));
    if (!pixels || typeof pixels.length !== "number") {
      throw new TypeError("DepthMapReader requires decoded pixel data");
    }
    this.#pixels = pixels;
  }

  // Piecewise non-linear calibration mapping grayscale pixel intensity to physical depth (TK-266).
  // Control points:
  //   rgb(254, 254, 254) and brighter -> 0 m
  //   rgb(217, 217, 217)              -> 0.5 m
  //   rgb(147, 147, 147)              -> 1.0 m
  //   rgb(54, 54, 54)                 -> 5.0 m
  //   rgb(35, 35, 35)                 -> 7.5 m
  //   rgb(10, 10, 10) and darker      -> 15.0 m
  static calculateDepthFromColor(color, minDepth = 0.1, maxDepth = 15.0) {
    const c = Math.max(0, Math.min(255, Number(color) || 0));
    let baseDepth;
    if (c >= 254) {
      baseDepth = 0;
    } else if (c >= 217) {
      baseDepth = ((254 - c) / (254 - 217)) * 0.5;
    } else if (c >= 147) {
      baseDepth = 0.5 + ((217 - c) / (217 - 147)) * 0.5;
    } else if (c >= 54) {
      baseDepth = 1.0 + ((147 - c) / (147 - 54)) * 4.0;
    } else if (c >= 35) {
      baseDepth = 5.0 + ((54 - c) / (54 - 35)) * 2.5;
    } else if (c >= 10) {
      baseDepth = 7.5 + ((35 - c) / (35 - 10)) * 7.5;
    } else {
      baseDepth = 15.0;
    }

    const min = Number(minDepth) || 0;
    const max = Number(maxDepth) || 0;

    if (max === 15) {
      return Math.max(min, Math.min(max, baseDepth));
    }

    const ratio = baseDepth / 15.0;
    return min + ratio * (max - min);
  }

  getDepthAtPixel(x, y, minDepth = 0.1, maxDepth = 15.0) {
    const px = Math.max(0, Math.min(this.#width - 1, Math.floor(Number(x) || 0)));
    const py = Math.max(0, Math.min(this.#height - 1, Math.floor(Number(y) || 0)));
    const index = (py * this.#width + px) * 4;
    const color = this.#pixels[index] || 0;
    return DepthMapReader.calculateDepthFromColor(color, minDepth, maxDepth);
  }
}
