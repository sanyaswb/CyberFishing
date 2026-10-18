// The one Pixi entry (spec 103): the pinned Pixi 8 + spine-pixi-v8 scene bundle from vendor/ (the architecture check
// allows only this module to import it). It is imported lazily, so the library loads only when a scene layer is
// composed. Pixi's own tickers never start a frame loop: GameLoop is the only frame driver (docs/rendering.md).
// createSceneLayer(options) returns a PixiSceneLayer over this namespace; createSpineRuntime() the Spine runtime that
// draws the rod inside that scene (spec 107), for SpineRuntimeProvider.
import * as pixi from "../../../../vendor/pixi/8.22.0/pixi-scene.js";
import { createPixiSpineRuntime } from "./pixi_spine_runtime.js";
import { PixiSceneLayer } from "./pixi_scene_layer.js";

const RUNTIME_VERSION = "8.22.0";

export function createPixiRuntime() {
  // Ticker.system drives Pixi's renderer scheduler and Ticker.shared library animation; both would request their own
  // animation frames as soon as anything subscribes.
  for (const ticker of [pixi.Ticker.system, pixi.Ticker.shared]) {
    ticker.autoStart = false;
    ticker.stop();
  }
  return Object.freeze({
    version: RUNTIME_VERSION,
    createSceneLayer: (options) => new PixiSceneLayer({ ...options, pixi }),
  });
}

export function createSpineRuntime() {
  return createPixiSpineRuntime(pixi);
}
