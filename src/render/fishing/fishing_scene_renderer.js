class FishingSceneRenderer {
  #fightAreaRenderer;
  #rodLineRenderer;
  #floatRenderer;

  constructor({ fightAreaRenderer, rodLineRenderer, floatRenderer }) {
    if (!fightAreaRenderer || typeof fightAreaRenderer.render !== "function") {
      throw new TypeError("FishingSceneRenderer requires fightAreaRenderer");
    }
    if (!rodLineRenderer || typeof rodLineRenderer.render !== "function") {
      throw new TypeError("FishingSceneRenderer requires rodLineRenderer");
    }
    if (!floatRenderer || typeof floatRenderer.render !== "function") {
      throw new TypeError("FishingSceneRenderer requires floatRenderer");
    }
    this.#fightAreaRenderer = fightAreaRenderer;
    this.#rodLineRenderer = rodLineRenderer;
    this.#floatRenderer = floatRenderer;
  }

  render(model) {
    if (!model.visible) return;
    this.#fightAreaRenderer.render(model.fightAreas);
    this.#rodLineRenderer.render(model.rodLine);
    this.#floatRenderer.render(model.float);
  }
}
