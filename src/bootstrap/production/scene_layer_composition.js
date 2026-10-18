import { DeferredSceneLayer } from "../../engine/scene/deferred_scene_layer.js";
import { InactiveSceneLayer } from "../../engine/scene/inactive_scene_layer.js";
import { SCENE_KINDS, SCENE_MODES, SceneLayerRouter } from "../../game/presentation/rendering/scene_layer_router.js";

// The kinds the Pixi scene can draw (spec 105: the background and its time of day).
const SCENE_RENDERED_KINDS = Object.freeze(["background"]);

// The page's WebGL scene layer and router (spec 104 D1, D2). Mode: CONFIG.canvas.scene, or DEV's ?scene= value for
// this page load (an unknown value keeps the config and warns).
// - "canvas": the inactive layer and an opaque 2D canvas; the Pixi bundle is never downloaded.
// - "webgl": the Pixi runtime loads lazily behind DeferredSceneLayer and the 2D canvas is transparent. Without WebGL, or
//   if the bundle fails to load, the layer stays inactive and the router keeps every kind on the 2D canvas.
// images: the page's ImageAssetProvider, whose loaded images become the scene's textures; clock: the game clock that
// times the water's animation (spec 106).
// Returns { sceneLayer, sceneRouter, transparentCanvas }.
export function composeSceneLayer({ config, modeOverride = null, documentTarget, gameCanvas, canvasMetrics, images, clock,
  probe, logger }) {
  let mode = config.canvas?.scene ?? "canvas";
  if (modeOverride != null) {
    if (SCENE_MODES.includes(modeOverride)) mode = modeOverride;
    else logger.warn(`[Scene] Unknown scene mode ${JSON.stringify(modeOverride)}; using "${mode}" from CONFIG.canvas.scene.`);
  }
  // The router asks the layer whether WebGL is active, and the Pixi layer asks the router which kinds to draw.
  let sceneLayer = null;
  const sceneRouter = new SceneLayerRouter({ kinds: SCENE_KINDS, sceneKinds: SCENE_RENDERED_KINDS,
    isSceneActive: () => sceneLayer.isActive(), mode });
  sceneLayer = mode === "webgl" ? new DeferredSceneLayer({
    load: () => import("../../platform/browser/scene/pixi_runtime_module.js").then((module) =>
      module.createPixiRuntime().createSceneLayer({ documentTarget, gameCanvas, canvasMetrics, images, router: sceneRouter,
        clock, getWaterSettings: () => config.canvas?.water, probe, logger, background: config.canvas?.backgroundColor })),
    onUnavailable: (error) => logger.warn("[Scene] The WebGL scene runtime did not load; the 2D canvas stays alone.", error),
  }) : new InactiveSceneLayer();
  return { sceneLayer, sceneRouter, transparentCanvas: mode === "webgl" };
}
