// One offscreen canvas with a WebGL context for Spine scenes (spec 099, D1). The 2D game copies it with drawImage in
// the same frame, so the drawing buffer need not be preserved. Its pixels are the game canvas pixels (1:1), so it
// has no pixel ratio of its own. The context is created on first need; lost/restored events reach the listeners.
const CONTEXT_ATTRIBUTES = Object.freeze({
  alpha: true,
  premultipliedAlpha: true,
  antialias: true,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
});

export class SpineGlSurface {
  #createCanvas;
  #canvas = null;
  #gl = null;
  #lost = false;
  #listeners = new Set();
  #disposed = false;

  constructor({ createCanvas = () => document.createElement("canvas") } = {}) {
    if (typeof createCanvas !== "function") throw new TypeError("SpineGlSurface requires createCanvas");
    this.#createCanvas = createCanvas;
  }

  // True when a usable context exists (created now if needed); false without WebGL or after dispose.
  ensureContext() {
    if (this.#disposed) return false;
    if (this.#gl) return !this.#lost;
    const canvas = this.#createCanvas();
    const gl = canvas.getContext("webgl2", CONTEXT_ATTRIBUTES) || canvas.getContext("webgl", CONTEXT_ATTRIBUTES);
    if (!gl) return false;
    canvas.width = 1;
    canvas.height = 1;
    canvas.addEventListener("webglcontextlost", this.#onLost);
    canvas.addEventListener("webglcontextrestored", this.#onRestored);
    this.#canvas = canvas;
    this.#gl = gl;
    return true;
  }

  get canvas() {
    return this.#canvas;
  }

  get gl() {
    return this.#gl;
  }

  get width() {
    return this.#canvas?.width ?? 0;
  }

  get height() {
    return this.#canvas?.height ?? 0;
  }

  get maxTextureSize() {
    return this.#gl && !this.#lost ? this.#gl.getParameter(this.#gl.MAX_TEXTURE_SIZE) : 0;
  }

  get isWebGl2() {
    return typeof WebGL2RenderingContext !== "undefined" && this.#gl instanceof WebGL2RenderingContext;
  }

  // Mipmaps for a texture of that size (spec 100 D3): WebGL 2 builds them for any size, WebGL 1 only for
  // power-of-two sizes.
  canMipmap(width, height) {
    const powerOfTwo = (value) => value > 0 && (value & (value - 1)) === 0;
    return this.isWebGl2 || (powerOfTwo(width) && powerOfTwo(height));
  }

  isContextLost() {
    return this.#lost || !this.#gl;
  }

  // Integer canvas pixels, at least 1; nothing happens when the size is unchanged.
  resize(width, height) {
    if (!this.#canvas) return;
    const nextWidth = Math.max(1, Math.ceil(Number(width) || 1));
    const nextHeight = Math.max(1, Math.ceil(Number(height) || 1));
    if (this.#canvas.width !== nextWidth) this.#canvas.width = nextWidth;
    if (this.#canvas.height !== nextHeight) this.#canvas.height = nextHeight;
  }

  // listener(lost: boolean); returns the unsubscribe function.
  onContextChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // DEV and checks: drop and bring back the context through WEBGL_lose_context.
  simulateContextLoss(lose) {
    const extension = this.#gl?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    if (lose) extension.loseContext();
    else extension.restoreContext();
    return true;
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#listeners.clear();
    if (this.#canvas) {
      this.#canvas.removeEventListener("webglcontextlost", this.#onLost);
      this.#canvas.removeEventListener("webglcontextrestored", this.#onRestored);
      this.#canvas.width = 0;
      this.#canvas.height = 0;
    }
    this.#gl = null;
    this.#canvas = null;
  }

  #onLost = (event) => {
    event.preventDefault();
    this.#lost = true;
    for (const listener of this.#listeners) listener(true);
  };

  #onRestored = () => {
    this.#lost = false;
    for (const listener of this.#listeners) listener(false);
  };
}
