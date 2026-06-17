class FightHudRenderer {
  #statusBarsRenderer;
  #holdChargesRenderer;

  constructor({ statusBarsRenderer, holdChargesRenderer }) {
    if (
      !statusBarsRenderer ||
      typeof statusBarsRenderer.render !== "function"
    ) {
      throw new TypeError(
        "FightHudRenderer requires statusBarsRenderer",
      );
    }
    if (
      !holdChargesRenderer ||
      typeof holdChargesRenderer.render !== "function"
    ) {
      throw new TypeError(
        "FightHudRenderer requires holdChargesRenderer",
      );
    }
    this.#statusBarsRenderer = statusBarsRenderer;
    this.#holdChargesRenderer = holdChargesRenderer;
  }

  render(model) {
    if (!model.visible) return;
    this.#statusBarsRenderer.render(model);
    this.#holdChargesRenderer.render(model.holdCharges);
  }
}
