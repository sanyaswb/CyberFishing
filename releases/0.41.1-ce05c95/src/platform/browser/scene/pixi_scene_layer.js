import { FRAME_GAUGES } from "../../../engine/diagnostics/inactive_frame_probe.js";

// Pixi Application options (spec 103 D1): Pixi is a renderer behind the scene port, not a framework.
// - autoStart / sharedTicker: no Pixi ticker; GameLoop renders the scene once per frame through the coordinator.
// - skipExtensionImports: Pixi's browser extensions (event system, accessibility, DOM pipe) never register, so input
//   stays with InputController; eventMode "none" keeps that true even if they ever load.
// - autoDensity off, size and resolution from CanvasMetricsProvider: logical pixels, docs/rendering.md rules 1-2.
// - preference ["webgl"]: WebGL 2 with Pixi's WebGL 1 fallback, never WebGPU or Pixi's canvas renderer (D3).
// - gcActive off: the scene releases its textures itself (rule 19), and no Pixi scheduler runs between frames.
const APPLICATION_OPTIONS = Object.freeze({
  autoStart: false,
  sharedTicker: false,
  skipExtensionImports: true,
  eventMode: "none",
  autoDensity: false,
  preference: Object.freeze(["webgl"]),
  gcActive: false,
});

// The WebGL scene layer (spec 103 stage 0): a Pixi Application on its own canvas, inserted right before the game canvas
// and drawn under it (game-shell.css). Init is async; until it resolves, render draws nothing. Each render resizes the
// renderer only when the logical size or pixel ratio changed, then draws the stage once. A lost WebGL context skips
// rendering until the browser restores it (Pixi restores its GPU resources); the 2D game never depends on this layer.
export class PixiSceneLayer {
  #pixi;
  #canvas;
  #metrics;
  #probe;
  #logger;
  #app = null;
  #disposed = false;
  #contextLost = false;
  #width = -1;
  #height = -1;
  #pixelRatio = -1;
  #onContextLost = () => { this.#contextLost = true; };
  #onContextRestored = () => { this.#contextLost = false; };

  // pixi: the vendored namespace (pixi_runtime_module.js); gameCanvas: the 2D game canvas the scene goes under;
  // canvasMetrics: the logical size and pixel ratio owner; background: the clear colour (any Pixi colour input).
  constructor({ pixi, documentTarget, gameCanvas, canvasMetrics, background, probe, logger }) {
    if (typeof pixi?.Application !== "function") throw new TypeError("PixiSceneLayer requires the Pixi namespace");
    if (typeof gameCanvas?.before !== "function") throw new TypeError("PixiSceneLayer requires the game canvas");
    for (const [name, value] of Object.entries({ documentTarget, canvasMetrics, probe, logger })) {
      if (value == null) throw new TypeError(`PixiSceneLayer requires ${name}`);
    }
    this.#pixi = pixi;
    this.#metrics = canvasMetrics;
    this.#probe = probe;
    this.#logger = logger;
    this.#canvas = documentTarget.createElement("canvas");
    this.#canvas.className = "game-shell__scene";
    this.#canvas.setAttribute("aria-hidden", "true");
    this.#canvas.addEventListener("webglcontextlost", this.#onContextLost);
    this.#canvas.addEventListener("webglcontextrestored", this.#onContextRestored);
    gameCanvas.before(this.#canvas);
    // Resolves true once the scene renders, false when it never will (no WebGL, or disposed first).
    this.ready = this.#init(background);
  }

  render() {
    const app = this.#app;
    if (app === null || this.#contextLost) return;
    this.#resizeIfChanged(app);
    app.render();
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#canvas.removeEventListener("webglcontextlost", this.#onContextLost);
    this.#canvas.removeEventListener("webglcontextrestored", this.#onContextRestored);
    this.#app?.destroy({ removeView: false }, { children: true });
    this.#app = null;
    this.#canvas.remove();
  }

  async #init(background) {
    const app = new this.#pixi.Application();
    const width = this.#metrics.width;
    const height = this.#metrics.height;
    const resolution = this.#metrics.pixelRatio;
    try {
      await app.init({ ...APPLICATION_OPTIONS, canvas: this.#canvas, width, height, resolution, background });
    } catch (error) {
      if (!this.#disposed) this.#logger.warn("[Scene] WebGL scene layer is unavailable; the 2D canvas stays alone.", error);
      this.dispose();
      return false;
    }
    if (this.#disposed) {
      app.destroy({ removeView: false }, { children: true });
      return false;
    }
    this.#app = app;
    this.#remember(app, width, height, resolution);
    return true;
  }

  // Unchanged readings write nothing: a canvas resize clears the drawing buffer (DEVELOPMENT_RULES "Performance").
  #resizeIfChanged(app) {
    const width = this.#metrics.width;
    const height = this.#metrics.height;
    const pixelRatio = this.#metrics.pixelRatio;
    if (width === this.#width && height === this.#height && pixelRatio === this.#pixelRatio) return;
    app.renderer.resize(width, height, pixelRatio);
    this.#remember(app, width, height, pixelRatio);
  }

  // The element's CSS size is the logical size (autoDensity is off); the probe shows the backing pixels it fills.
  #remember(app, width, height, pixelRatio) {
    this.#width = width;
    this.#height = height;
    this.#pixelRatio = pixelRatio;
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;
    this.#probe.gauge(FRAME_GAUGES.scenePixels, app.renderer.canvas.width * app.renderer.canvas.height);
  }
}
