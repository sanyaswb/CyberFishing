import { FRAME_GAUGES } from "../../../engine/diagnostics/inactive_frame_probe.js";
import { PixiBackgroundRenderer } from "./pixi_background_renderer.js";
import { PixiAnnotationRenderer } from "./pixi_annotation_renderer.js";
import { PixiFightAreaRenderer } from "./pixi_fight_area_renderer.js";
import { PixiFloatRenderer } from "./pixi_float_renderer.js";
import { PixiLineRenderer } from "./pixi_line_renderer.js";
import { PixiRodRenderer } from "./pixi_rod_renderer.js";
import { PixiWaterRenderer } from "./pixi_water_renderer.js";
import { PixiWorldEntitiesRenderer } from "./pixi_world_entities_renderer.js";
import { SceneTextTextures } from "./scene_text_textures.js";
import { SceneTextureCache } from "./scene_texture_cache.js";

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
// The game canvas drops its CSS background while the scene is under it (spec 104 D6).
const OVER_SCENE_CLASS = "game-shell__canvas--over-scene";

// The WebGL scene layer (specs 103-107): a Pixi Application on its own canvas, inserted right before the game canvas
// and drawn under it (game-shell.css). Init is async and ends with one warm-up render, so the first-frame cost (Pixi
// compiling its shaders) falls into loading; until then render draws nothing and isActive() is false. Each render
// updates the kinds the router puts on the scene, bottom first: the background with the water's ripples over it
// (spec 106), the world entities (bait boats, chum zones), the fight areas, the line, the rod (Spine or its static
// picture) and the float (spec 107),
// resizes the renderer only when the logical size or the scene's pixel ratio changed, and presents a frame only when
// something changed (spec 105 D3; the water changes at its own frame rate): the browser keeps showing the last one. The scene's pixel ratio follows the background art (D4): never more than the
// game canvas's, never more than the art's own pixels per drawn pixel. A lost WebGL context makes the layer inactive
// (the router sends every kind back to the 2D canvas) until the browser restores it; Pixi restores its GPU resources.
export class PixiSceneLayer {
  #annotations;
  #clearColor = null;
  #pixi;
  #canvas;
  #gameCanvas;
  #images;
  #router;
  #clock;
  #getWaterSettings;
  #getWakeSettings;
  #fightAreaStyles;
  #documentTarget;
  #textures = null;
  #texts = null;
  #background = null;
  #water = null;
  #worldEntities = null;
  #fightAreas = null;
  #line = null;
  #rod = null;
  #float = null;
  #needsFrame = true;
  #metrics;
  #probe;
  #logger;
  #ready;
  #app = null;
  #state = "starting";
  #released = false;
  #contextLost = false;
  #loseContextExtension = null;
  #width = -1;
  #height = -1;
  #pixelRatio = -1;
  #onContextLost = () => { this.#contextLost = true; };
  #onContextRestored = () => {
    this.#contextLost = false;
    this.#needsFrame = true;
  };

  // pixi: the vendored namespace (pixi_runtime_module.js); gameCanvas: the 2D game canvas the scene goes under;
  // canvasMetrics: the logical size and pixel ratio owner; background: the clear colour (any Pixi colour input);
  // images: the loaded images ({ tryGet }); router: which kinds the scene draws this frame ({ drawsOnScene }); clock:
  // the game clock ({ now }, the frame's time in ms); getWaterSettings: () => CONFIG.canvas.water (spec 106);
  // fightAreaStyles: { resolve() }, the fight area colours the 2D renderer uses too (spec 107).
  constructor({ pixi, documentTarget, gameCanvas, canvasMetrics, background, images, router, clock, getWaterSettings,
    fightAreaStyles, probe, logger, getWakeSettings = () => null }) {
    if (typeof pixi?.Application !== "function") throw new TypeError("PixiSceneLayer requires the Pixi namespace");
    if (typeof gameCanvas?.before !== "function") throw new TypeError("PixiSceneLayer requires the game canvas");
    if (typeof images?.tryGet !== "function") throw new TypeError("PixiSceneLayer requires images");
    if (typeof router?.drawsOnScene !== "function") throw new TypeError("PixiSceneLayer requires the router");
    if (typeof getWaterSettings !== "function") throw new TypeError("PixiSceneLayer requires getWaterSettings");
    if (typeof fightAreaStyles?.resolve !== "function") throw new TypeError("PixiSceneLayer requires fightAreaStyles");
    for (const [name, value] of Object.entries({ documentTarget, canvasMetrics, clock, probe, logger })) {
      if (value == null) throw new TypeError(`PixiSceneLayer requires ${name}`);
    }
    this.#pixi = pixi;
    this.#gameCanvas = gameCanvas;
    this.#images = images;
    this.#router = router;
    this.#clock = clock;
    this.#getWaterSettings = getWaterSettings;
    // Spec 156: CONFIG.ui.boat.wake.water, the boat wake's ripples in the water.
    this.#getWakeSettings = getWakeSettings;
    this.#fightAreaStyles = fightAreaStyles;
    this.#documentTarget = documentTarget;
    this.#metrics = canvasMetrics;
    this.#probe = probe;
    this.#logger = logger;
    this.#canvas = documentTarget.createElement("canvas");
    this.#canvas.className = "game-shell__scene";
    this.#canvas.setAttribute("aria-hidden", "true");
    this.#canvas.addEventListener("webglcontextlost", this.#onContextLost);
    this.#canvas.addEventListener("webglcontextrestored", this.#onContextRestored);
    gameCanvas.before(this.#canvas);
    gameCanvas.classList.add(OVER_SCENE_CLASS);
    this.#ready = this.#init(background);
  }

  render(frame) {
    const app = this.#app;
    if (app === null || this.#contextLost) return;
    const router = this.#router;
    const world = router.drawsOnScene("background") ? frame.world : null;
    let changed = this.#background.update(world);
    if (this.#water.update(world, this.#metrics.width, this.#metrics.height, this.#clock.now)) changed = true;
    const pixelRatio = this.#scenePixelRatio();
    if (this.#worldEntities.update(router.drawsOnScene("world-entities") ? frame.world : null, pixelRatio)) changed = true;
    const fishing = frame.fishing?.visible ? frame.fishing : null;
    if (this.#fightAreas.update(fishing && router.drawsOnScene("fight-areas") ? fishing.fightAreas : null)) changed = true;
    if (this.#line.update(fishing && router.drawsOnScene("line") ? fishing.rodLine : null)) changed = true;
    if (this.#rod.update(fishing && router.drawsOnScene("rod") ? fishing.rodLine : null)) changed = true;
    if (this.#float.update(fishing && router.drawsOnScene("float") ? fishing.float : null)) changed = true;
    if (this.#annotations.update(world?.annotations ?? null)) changed = true;
    if (this.#clearColor !== frame.world.backgroundColor) {
      this.#clearColor = frame.world.backgroundColor;
      app.renderer.background.color = this.#clearColor;
      changed = true;
    }
    if (this.#resizeIfChanged(app)) changed = true;
    if (!changed && !this.#needsFrame) return;
    this.#needsFrame = false;
    app.render();
  }

  isActive() {
    return this.#app !== null && !this.#contextLost;
  }

  // Spec 105 D2: startup uploads every background phase of the location under the loading screen; the staged order of
  // render() remains for images that load later.
  prepare(assetIds) {
    if (this.#app === null || this.#contextLost) return;
    for (const assetId of assetIds) this.#textures.get(assetId);
  }

  // Resolves true once the warm-up frame has rendered, false when the layer never will (no WebGL, or disposed first).
  whenReady() {
    return this.#ready;
  }

  getStatus() {
    const state = this.#app !== null && this.#contextLost ? "context-lost" : this.#state;
    if (this.#app === null) return { state };
    return { state, webglVersion: this.#app.renderer.context?.webGLVersion ?? null, width: this.#width,
      height: this.#height, pixelRatio: this.#pixelRatio, textures: this.#textures.size, textureBytes: this.#textures.bytes,
      water: this.#water.status };
  }

  // DEV fallback test (DevTools "СЦЕНА WebGL"): lose the context through WEBGL_lose_context until restoreContext().
  loseContext() {
    if (this.#app === null || this.#contextLost) return;
    this.#loseContextExtension = this.#app.renderer.gl?.getExtension("WEBGL_lose_context") ?? null;
    this.#loseContextExtension?.loseContext();
  }

  restoreContext() {
    if (this.#contextLost) this.#loseContextExtension?.restoreContext();
  }

  dispose() {
    if (this.#state !== "unavailable") this.#state = "disposed";
    if (this.#released) return;
    this.#released = true;
    this.#canvas.removeEventListener("webglcontextlost", this.#onContextLost);
    this.#canvas.removeEventListener("webglcontextrestored", this.#onContextRestored);
    this.#app?.destroy({ removeView: false }, { children: true });
    this.#app = null;
    this.#water?.dispose();
    this.#rod?.dispose();
    this.#float?.dispose();
    this.#worldEntities?.dispose();
    this.#texts?.dispose();
    this.#textures?.dispose();
    this.#canvas.remove();
    this.#gameCanvas.classList.remove(OVER_SCENE_CLASS);
  }

  async #init(background) {
    const app = new this.#pixi.Application();
    const width = this.#metrics.width;
    const height = this.#metrics.height;
    const resolution = this.#metrics.pixelRatio;
    try {
      await app.init({ ...APPLICATION_OPTIONS, canvas: this.#canvas, width, height, resolution, background });
      if (this.#released) {
        app.destroy({ removeView: false }, { children: true });
        return false;
      }
      this.#app = app;
      this.#textures = new SceneTextureCache({ pixi: this.#pixi, images: this.#images, renderer: app.renderer });
      this.#background = new PixiBackgroundRenderer({ pixi: this.#pixi, stage: app.stage, textures: this.#textures,
        renderer: app.renderer });
      this.#water = new PixiWaterRenderer({ pixi: this.#pixi, stage: app.stage, textures: this.#textures,
        documentTarget: this.#documentTarget, getSettings: this.#getWaterSettings,
        getWakeSettings: this.#getWakeSettings });
      this.#texts = new SceneTextTextures({ pixi: this.#pixi, documentTarget: this.#documentTarget });
      this.#worldEntities = new PixiWorldEntitiesRenderer({ pixi: this.#pixi, stage: app.stage, texts: this.#texts,
        documentTarget: this.#documentTarget });
      this.#fightAreas = new PixiFightAreaRenderer({ pixi: this.#pixi, stage: app.stage, styles: this.#fightAreaStyles });
      this.#line = new PixiLineRenderer({ pixi: this.#pixi, stage: app.stage });
      this.#rod = new PixiRodRenderer({ pixi: this.#pixi, stage: app.stage });
      this.#float = new PixiFloatRenderer({ pixi: this.#pixi, stage: app.stage, documentTarget: this.#documentTarget,
        textures: this.#textures });
      this.#annotations = new PixiAnnotationRenderer({ pixi: this.#pixi, stage: app.stage });
      this.#clearColor = background;
      this.#remember(app, width, height, resolution);
      app.render();
    } catch (error) {
      if (!this.#released) {
        this.#logger.warn("[Scene] WebGL scene layer is unavailable; the 2D canvas stays alone.", error);
        this.#state = "unavailable";
      }
      this.dispose();
      return false;
    }
    this.#state = "active";
    return true;
  }

  // Unchanged readings write nothing: a canvas resize clears the drawing buffer (DEVELOPMENT_RULES "Performance").
  #resizeIfChanged(app) {
    const width = this.#metrics.width;
    const height = this.#metrics.height;
    const pixelRatio = this.#scenePixelRatio();
    if (width === this.#width && height === this.#height && pixelRatio === this.#pixelRatio) return false;
    app.renderer.resize(width, height, pixelRatio);
    this.#remember(app, width, height, pixelRatio);
    return true;
  }

  // Spec 105 D4: the art drawn 1:1 where it would be enlarged (portrait), the game canvas's ratio where it is shrunk.
  #scenePixelRatio() {
    const canvasRatio = this.#metrics.pixelRatio;
    const density = this.#background.artDensity;
    if (density === null) return canvasRatio;
    return Math.min(canvasRatio, Math.max(1, Math.round(density * 100) / 100));
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
