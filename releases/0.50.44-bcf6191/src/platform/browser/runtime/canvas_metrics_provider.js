// The one owner of the game canvas element's size (spec 100 D1). Logical size = CSS pixels: what gameplay, input,
// layout and render models use (InputController reads clientX/Y as canvas coordinates). The backing store is
// logical x pixelRatio, pixelRatio = clamp(devicePixelRatio, 1, maxPixelRatio), and the element's CSS size is set to
// the logical size, so a sharper bitmap never changes the layout. Unchanged readings write nothing: assigning a
// canvas dimension clears the bitmap and resets the 2D context state.
export class CanvasMetricsProvider {
  #canvas;
  #viewport;
  #readDevicePixelRatio;
  #maxPixelRatio;
  #width;
  #height;
  #pixelRatio = 1;
  #cssWidth = null;
  #cssHeight = null;

  constructor(canvas, viewport = null, {
    devicePixelRatio = () => window.devicePixelRatio,
    maxPixelRatio = 2,
  } = {}) {
    this.#canvas = canvas;
    this.#viewport =
      viewport ||
      (() => ({ width: window.innerWidth, height: window.innerHeight }));
    this.#readDevicePixelRatio = devicePixelRatio;
    this.#maxPixelRatio = Math.max(1, Number(maxPixelRatio) || 1);
    this.#width = canvas.width;
    this.#height = canvas.height;
  }

  // Logical (CSS) pixels.
  get width() {
    return this.#width;
  }

  get height() {
    return this.#height;
  }

  // Backing-store pixels per logical pixel.
  get pixelRatio() {
    return this.#pixelRatio;
  }

  resizeToViewport() {
    const viewport = this.#viewport();
    // Truncated like the canvas attribute always truncated it, so logical sizes stay what they were.
    const width = Math.max(0, Math.trunc(Number(viewport.width) || 0));
    const height = Math.max(0, Math.trunc(Number(viewport.height) || 0));
    const device = Number(this.#readDevicePixelRatio());
    const pixelRatio = Math.min(this.#maxPixelRatio, Math.max(1, Number.isFinite(device) ? device : 1));
    const backingWidth = Math.round(width * pixelRatio);
    const backingHeight = Math.round(height * pixelRatio);
    if (this.#canvas.width !== backingWidth) this.#canvas.width = backingWidth;
    if (this.#canvas.height !== backingHeight) this.#canvas.height = backingHeight;
    if (this.#cssWidth !== width) {
      this.#canvas.style.width = `${width}px`;
      this.#cssWidth = width;
    }
    if (this.#cssHeight !== height) {
      this.#canvas.style.height = `${height}px`;
      this.#cssHeight = height;
    }
    this.#width = width;
    this.#height = height;
    this.#pixelRatio = pixelRatio;
  }
}
