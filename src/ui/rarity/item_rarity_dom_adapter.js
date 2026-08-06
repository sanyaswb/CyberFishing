class ItemRarityDomAdapter {
  static #properties = Object.freeze([
    "--rarity-color",
    "--rarity-border-width",
    "--rarity-background-color",
    "--rarity-background-alpha",
    "--rarity-glow-blur",
    "--rarity-animation-duration",
  ]);

  #visualResolver;

  constructor({ visualResolver }) {
    if (!visualResolver || typeof visualResolver.resolve !== "function") {
      throw new TypeError("ItemRarityDomAdapter requires visualResolver");
    }
    this.#visualResolver = visualResolver;
  }

  apply(element, rarity) {
    if (!element?.style || !element.classList || !rarity) {
      this.clear(element);
      return null;
    }
    const visual = this.#visualResolver.resolve(rarity);
    element.classList.add("has-rarity");
    element.classList.toggle("rarity-unique", visual.isUnique);
    element.classList.toggle("rarity-glow", visual.glow.enabled);
    element.dataset.rarity = visual.id;
    element.style.setProperty("--rarity-color", visual.cssColor);
    element.style.setProperty(
      "--rarity-border-width",
      `${visual.borderWidth}px`,
    );
    element.style.setProperty(
      "--rarity-background-color",
      this.#rgba(visual.background.color, visual.background.alpha),
    );
    element.style.setProperty(
      "--rarity-background-alpha",
      String(visual.background.alpha),
    );
    element.style.setProperty("--rarity-glow-blur", `${visual.glow.blur}px`);
    element.style.setProperty(
      "--rarity-animation-duration",
      `${visual.animation.durationMs}ms`,
    );
    return visual;
  }

  clear(element) {
    if (!element?.style || !element.classList) return;
    element.classList.remove("has-rarity", "rarity-unique", "rarity-glow");
    if (element.dataset) delete element.dataset.rarity;
    for (const property of ItemRarityDomAdapter.#properties) {
      element.style.removeProperty(property);
    }
  }

  #rgba(color, alpha) {
    const channels = Array.isArray(color) ? color.slice(0, 3) : [0, 0, 0];
    return `rgba(${channels.join(", ")}, ${alpha})`;
  }
}
