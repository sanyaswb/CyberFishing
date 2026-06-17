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
      buttonWidth: 150,
      buttonHeight: 42,
      buttonGap: 14,
      blurPx: 3,
      uniqueGlowPulseMs: 1200,
      levelColors: {
        1: [145, 150, 160],
        2: [0, 210, 120],
        3: [0, 160, 255],
        4: [170, 100, 255],
        preUnique: [255, 70, 70],
        unique: [255, 205, 55],
      },
    };
    this.#cache = {
      ...defaults,
      ...config,
      levelColors: {
        ...defaults.levelColors,
        ...(config.levelColors || {}),
      },
    };
    return this.#cache;
  }

  invalidate() {
    this.#cache = null;
  }
}
