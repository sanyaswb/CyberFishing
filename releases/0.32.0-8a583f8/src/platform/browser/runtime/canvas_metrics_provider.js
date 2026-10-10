export class CanvasMetricsProvider {
  #canvas;
  #viewport;

  constructor(canvas, viewport = null) {
    this.#canvas = canvas;
    this.#viewport =
      viewport ||
      (() => ({ width: window.innerWidth, height: window.innerHeight }));
  }

  get width() {
    return this.#canvas.width;
  }

  get height() {
    return this.#canvas.height;
  }

  resizeToViewport() {
    const viewport = this.#viewport();
    this.#canvas.width = viewport.width;
    this.#canvas.height = viewport.height;
  }
}
