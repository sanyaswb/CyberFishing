// A feature loaded after the first frame (spec 157 R12): its module comes through the asset load plan's queue — the
// plan's warm-up after ready, or request() on the player's first use — and compose(module) builds the feature once.
// Until then get() is null: a consumer shows "loading" (or nothing) without an error, and a first action waits on
// request() instead of being lost. onReady listeners run once the feature is composed (at once if it already is).
export class LazyFeature {
  #name;
  #preload;
  #compose;
  #feature = null;
  #composing = null;
  #listeners = new Set();
  #disposed = false;

  // preload: { loadModule(name), whenModule(name) } (GameAssetPreloadFacade); compose(module) -> feature.
  constructor({ name, preload, compose }) {
    if (typeof preload?.loadModule !== "function" || typeof preload.whenModule !== "function") {
      throw new TypeError("LazyFeature requires the preload facade");
    }
    if (typeof compose !== "function") throw new TypeError("LazyFeature requires compose");
    this.#name = name;
    this.#preload = preload;
    this.#compose = compose;
    void preload.whenModule(name).then((module) => this.#adopt(module));
  }

  get name() {
    return this.#name;
  }

  // The composed feature, or null while its module has not arrived.
  get() {
    return this.#feature;
  }

  // The feature for a first use: its module is asked for as "interactive". Resolves null if it cannot load.
  async request() {
    if (this.#feature) return this.#feature;
    const outcome = await this.#preload.loadModule(this.#name);
    return outcome.status === "ready" ? this.#adopt(outcome.module) : null;
  }

  // listener(feature) once the feature is composed; returns the unsubscribe.
  onReady(listener) {
    if (this.#feature) {
      listener(this.#feature);
      return () => {};
    }
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose() {
    this.#disposed = true;
    this.#listeners.clear();
    this.#feature?.dispose?.();
  }

  #adopt(module) {
    if (this.#disposed) return null;
    if (this.#feature) return this.#feature;
    if (!this.#composing) {
      this.#composing = true;
      this.#feature = this.#compose(module);
      for (const listener of [...this.#listeners]) listener(this.#feature);
      this.#listeners.clear();
    }
    return this.#feature;
  }
}
