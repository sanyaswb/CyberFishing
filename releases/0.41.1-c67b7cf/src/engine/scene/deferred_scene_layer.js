import { SCENE_LAYER_METHODS } from "./inactive_scene_layer.js";

// A scene layer whose implementation loads lazily (specs 103, 104): the session gets this port at composition time, it
// draws nothing and reports inactive until load() resolves the real layer, and a layer that arrives after dispose() is
// disposed at once. A failed load or an invalid layer leaves it inactive (the 2D game is unchanged) and reports the
// error to onUnavailable. whenReady() waits for the loaded layer's own readiness (its warm-up frame).
export class DeferredSceneLayer {
  #layer = null;
  #disposed = false;
  #failed = false;
  #ready;

  constructor({ load, onUnavailable }) {
    if (typeof load !== "function") throw new TypeError("DeferredSceneLayer requires load");
    if (typeof onUnavailable !== "function") throw new TypeError("DeferredSceneLayer requires onUnavailable");
    this.#ready = Promise.resolve().then(load).then((layer) => this.#attach(layer)).catch((error) => {
      this.#failed = true;
      onUnavailable(error);
      return false;
    });
  }

  render(frame) {
    this.#layer?.render(frame);
  }

  isActive() {
    return this.#layer?.isActive() === true;
  }

  whenReady() {
    return this.#ready;
  }

  getStatus() {
    if (this.#layer) return this.#layer.getStatus();
    return { state: this.#disposed ? "disposed" : this.#failed ? "unavailable" : "loading" };
  }

  loseContext() {
    this.#layer?.loseContext();
  }

  restoreContext() {
    this.#layer?.restoreContext();
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
    return layer.whenReady();
  }
}
