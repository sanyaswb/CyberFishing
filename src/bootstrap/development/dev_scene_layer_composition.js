import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { DeferredSceneLayer } from "../../engine/scene/deferred_scene_layer.js";

// Spec 103 stage 0: dev.html?scene=webgl composes the WebGL scene layer, an empty Pixi stage under the 2D canvas, for
// measuring its cost against plain dev.html. Without the flag (and in production) the session keeps the inactive layer.
// Returns GameCompositionRoot's createSceneLayer factory, or null.
export function createDevSceneLayerFactory({ windowTarget, documentTarget, probe }) {
  const mode = new windowTarget.URLSearchParams(windowTarget.location.search).get("scene");
  if (mode !== "webgl") return null;
  const logger = new ConsoleLogger();
  return ({ canvas, canvasMetrics }) => new DeferredSceneLayer({
    load: () => import("../../platform/browser/scene/pixi_runtime_module.js").then((module) =>
      module.createPixiRuntime().createSceneLayer({
        documentTarget, gameCanvas: canvas, canvasMetrics, probe, logger,
        // The scene clears to the game canvas's own CSS background, so CSS stays its one source.
        background: windowTarget.getComputedStyle(canvas).backgroundColor,
      })),
    onUnavailable: (error) => logger.warn("[Scene] The WebGL scene runtime did not load; the 2D canvas stays alone.", error),
  });
}
