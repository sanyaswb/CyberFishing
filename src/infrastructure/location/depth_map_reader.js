class DepthMapReader {
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

  getDepthAtNormalizedPosition(xRatio, yRatio, minDepth, maxDepth) {
    const x = Math.round(this.#clamp01(xRatio) * (this.#width - 1));
    const y = Math.round(this.#clamp01(yRatio) * (this.#height - 1));
    return this.getDepthAtPixel(x, y, minDepth, maxDepth);
  }

  getDepthAtPixel(x, y, minDepth, maxDepth) {
    const px = Math.max(0, Math.min(this.#width - 1, Math.floor(Number(x) || 0)));
    const py = Math.max(0, Math.min(this.#height - 1, Math.floor(Number(y) || 0)));
    const index = (py * this.#width + px) * 4;
    const ratio = (this.#pixels[index] || 0) / 255;
    return Number(maxDepth) - ratio * (Number(maxDepth) - Number(minDepth));
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
