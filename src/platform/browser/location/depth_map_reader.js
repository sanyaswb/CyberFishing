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

  getDepthAtPixel(x, y, minDepth, maxDepth) {
    const px = Math.max(0, Math.min(this.#width - 1, Math.floor(Number(x) || 0)));
    const py = Math.max(0, Math.min(this.#height - 1, Math.floor(Number(y) || 0)));
    const index = (py * this.#width + px) * 4;
    const ratio = (this.#pixels[index] || 0) / 255;
    return Number(maxDepth) - ratio * (Number(maxDepth) - Number(minDepth));
  }
}
