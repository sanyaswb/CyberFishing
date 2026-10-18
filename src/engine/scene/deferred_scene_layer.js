import { SCENE_LAYER_METHODS } from "./inactive_scene_layer.js";

// A scene layer whose implementation loads lazily (spec 103): the session gets this port at composition time, it
// draws nothing until load() resolves the real layer, and a layer that arrives after dispose() is disposed at once.
// A failed load or an invalid layer leaves it inactive (the 2D game is unchanged) and reports the error to onUnavailable.
export class DeferredSceneLayer {
  #layer = null;
  #disposed = false;

  constructor({ load, onUnavailable }) {
    if (typeof load !== "function") throw new TypeError("DeferredSceneLayer requires load");
    if (typeof onUnavailable !== "function") throw new TypeError("DeferredSceneLayer requires onUnavailable");
    // Resolves true once the loaded layer is attached, false when it never will be.
    this.ready = Promise.resolve().then(load).then((layer) => this.#attach(layer)).catch((error) => {
      onUnavailable(error);
      return false;
    });
  }

  render(frame) {
    this.#layer?.render(frame);
  }

  dispose() {
    this.#disposed = true;
    this.#layer?.dispose();
    this.#layer = null;
  }

  #attach(layer) {
    for (const method of SCENE_LAYER_METHODS) {
      if (typeof layer?.[method] !== "function") throw new TypeError(`DeferredSceneLayer: the loaded layer lacks ${method}`);
    }
    if (this.#disposed) {
      layer.dispose();
      return false;
    }
    this.#layer = layer;
    return true;
  }
}
