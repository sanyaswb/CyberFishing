// The one Pixi entry (spec 103): the pinned Pixi 8 + spine-pixi-v8 scene bundle from vendor/ (the architecture check
// allows only this module to import it). It is imported lazily, so the library loads only when a scene layer is
// composed. Pixi's own tickers never start a frame loop: GameLoop is the only frame driver (docs/rendering.md).
// createSceneLayer(options) returns a PixiSceneLayer over this namespace; createSpineRuntime() the Spine runtime that
// draws the rod inside that scene (spec 107), for SpineRuntimeProvider.
import * as pixi from "../../../../vendor/pixi/8.22.0/pixi-scene.js";
import { createPixiSpineRuntime } from "./pixi_spine_runtime.js";
import { PixiSceneLayer } from "./pixi_scene_layer.js";

const RUNTIME_VERSION = "8.22.0";

// allowsEval: () => boolean, whether the page may compile code from strings (the scene-layer check passes its own).
export function createPixiRuntime({ allowsEval = allowsEvalInPage } = {}) {
  // Ticker.system drives Pixi's renderer scheduler and Ticker.shared library animation; both would request their own
  // animation frames as soon as anything subscribes.
  for (const ticker of [pixi.Ticker.system, pixi.Ticker.shared]) {
    ticker.autoStart = false;
    ticker.stop();
  }
  // Pixi 8 compiles its uniform and buffer sync code with `new Function` and refuses to start where the page's CSP
  // forbids eval (docs/deployment.md, TK-256). Only there does it get its eval-free systems, installed once before the
  // renderer starts; every other page keeps the faster generated code.
  let evalFreeSystems = null;
  const prepareRenderer = () => {
    if (allowsEval()) return null;
    evalFreeSystems ??= pixi.installEvalFreeSystems();
    return evalFreeSystems;
  };
  return Object.freeze({
    version: RUNTIME_VERSION,
    prepareRenderer,
    createSceneLayer: (options) => new PixiSceneLayer({ ...options, pixi, prepareRenderer }),
  });
}

// The same probe Pixi runs before it compiles anything: a CSP without 'unsafe-eval' makes the Function constructor throw.
function allowsEvalInPage() {
  try {
    return new Function("return true")() === true;
  } catch {
    return false;
  }
}

export function createSpineRuntime() {
  return createPixiSpineRuntime(pixi);
}
