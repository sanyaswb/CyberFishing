import { DeferredSceneLayer } from "../../engine/scene/deferred_scene_layer.js";
import { InactiveSceneLayer } from "../../engine/scene/inactive_scene_layer.js";
import { SCENE_KINDS, SCENE_MODES, SceneLayerRouter } from "../../game/presentation/rendering/scene_layer_router.js";

// The kinds the Pixi scene can draw. Stage 1 (spec 104) has none, so every kind stays on the 2D canvas; stage 2 adds
// "background".
const SCENE_RENDERED_KINDS = Object.freeze([]);

// The page's WebGL scene layer and router (spec 104 D1, D2). Mode: CONFIG.canvas.scene, or DEV's ?scene= value for
// this page load (an unknown value keeps the config and warns).
// - "canvas": the inactive layer and an opaque 2D canvas; the Pixi bundle is never downloaded.
// - "webgl": the Pixi runtime loads lazily behind DeferredSceneLayer and the 2D canvas is transparent. Without WebGL, or
//   if the bundle fails to load, the layer stays inactive and the router keeps every kind on the 2D canvas.
// Returns { sceneLayer, sceneRouter, transparentCanvas }.
export function composeSceneLayer({ config, modeOverride = null, documentTarget, gameCanvas, canvasMetrics, probe, logger }) {
  let mode = config.canvas?.scene ?? "canvas";
  if (modeOverride != null) {
    if (SCENE_MODES.includes(modeOverride)) mode = modeOverride;
    else logger.warn(`[Scene] Unknown scene mode ${JSON.stringify(modeOverride)}; using "${mode}" from CONFIG.canvas.scene.`);
  }
  const sceneLayer = mode === "webgl" ? new DeferredSceneLayer({
    load: () => import("../../platform/browser/scene/pixi_runtime_module.js").then((module) =>
      module.createPixiRuntime().createSceneLayer({ documentTarget, gameCanvas, canvasMetrics, probe, logger,
        background: config.canvas?.backgroundColor })),
    onUnavailable: (error) => logger.warn("[Scene] The WebGL scene runtime did not load; the 2D canvas stays alone.", error),
  }) : new InactiveSceneLayer();
  const sceneRouter = new SceneLayerRouter({ kinds: SCENE_KINDS, sceneKinds: SCENE_RENDERED_KINDS,
    isSceneActive: () => sceneLayer.isActive(), mode });
  return { sceneLayer, sceneRouter, transparentCanvas: mode === "webgl" };
}
