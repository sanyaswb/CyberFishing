class DebugContext {
  #live = null;
  #fight = null;
  #lastNetRoll = null;

  setLiveData(detail) {
    this.#live = detail || null;
  }

  setFightData(detail) {
    this.#fight = detail || null;
  }

  setNetRoll(detail) {
    this.#lastNetRoll = detail || null;
  }

  get live() {
    return this.#live;
  }

  get fight() {
    return this.#fight;
  }

  get lastNetRoll() {
    return this.#lastNetRoll;
  }

  get gameState() {
    return this.#live?.gameState || "no-live-state";
  }

  toRenderPayload() {
    return {
      live: this.#live,
      fight: this.#fight,
      lastNetRoll: this.#lastNetRoll,
    };
  }
}

window.DebugContext = DebugContext;
