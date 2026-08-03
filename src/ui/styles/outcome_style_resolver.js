class OutcomeStyleResolver {
  #configProvider;
  #cache = null;

  constructor({ configProvider }) {
    if (typeof configProvider !== "function") {
      throw new TypeError("OutcomeStyleResolver requires configProvider");
    }
    this.#configProvider = configProvider;
  }

  resolveVictory() {
    if (this.#cache) return this.#cache;
    const config = this.#configProvider() || {};
    const defaults = {
      panelWidth: 540,
      panelMinHeight: 560,
      viewportMargin: 24,
      panelPadding: 24,
      panelRadius: 8,
      imageBoxSize: 260,
      imageBorderWidth: 3,
      statPillHeight: 42,
      rarityRowHeight: 50,
      rarityStarGap: 7,
      rarityStarRadius: 12,
      buttonWidth: 150,
      buttonHeight: 42,
      buttonGap: 14,
      blurPx: 3,
    };
    this.#cache = {
      ...defaults,
      ...config,
    };
    return this.#cache;
  }

  invalidate() {
    this.#cache = null;
  }
}
