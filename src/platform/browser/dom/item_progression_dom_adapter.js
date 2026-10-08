export class ItemProgressionDomAdapter {
  static #properties = Object.freeze([
    "--item-rating-percent",
    "--item-rating-color",
    "--item-capacity-percent",
    "--item-capacity-color",
    "--item-quality-color",
    "--item-quality-sections",
  ]);

  #visualResolver;
  #labels;

  constructor({ visualResolver, labels } = {}) {
    if (!visualResolver || typeof visualResolver.resolve !== "function") {
      throw new TypeError(
        "ItemProgressionDomAdapter requires visualResolver",
      );
    }
    this.#visualResolver = visualResolver;
    this.#labels = labels;
  }

  resolveVisual(progression) {
    if (!progression?.available) return null;
    return this.#visualResolver.resolve(progression);
  }

  apply(element, progression, visual = null, options = {}) {
    this.clear(element);
    if (!element?.style || !progression?.available) return null;
    const resolvedVisual = visual || this.#visualResolver.resolve(progression);
    if (!resolvedVisual.available) return resolvedVisual;
    this.#applyVariables(element, progression, resolvedVisual);
    element.classList?.add("has-item-progression");

    const documentRef = element.ownerDocument || globalThis.document;
    if (!documentRef?.createElement) return resolvedVisual;
    if (
      progression.ratingTier?.available &&
      options.renderRatingTierBadge !== false
    ) {
      element.appendChild(this.#createRatingTierBadge(
        documentRef,
        progression.ratingTier,
      ));
    }
    return resolvedVisual;
  }

  clear(element) {
    if (!element) return;
    element.classList?.remove("has-item-progression");
    for (const node of element.querySelectorAll?.(".inv-slot__rating-tier-badge") || []) {
      node.remove();
    }
    if (!element.style) return;
    for (const property of ItemProgressionDomAdapter.#properties) {
      element.style.removeProperty(property);
    }
  }

  #applyVariables(element, progression, visual) {
    if (!element?.style) return;
    const percent = Number(progression.rating?.percent) || 0;
    element.style.setProperty("--item-rating-percent", `${percent}%`);
    element.style.setProperty(
      "--item-rating-color",
      visual.rating?.cssColor || "transparent",
    );
    const capacityPercent = Number(progression.capacity?.percent) || 0;
    element.style.setProperty(
      "--item-capacity-percent",
      `${capacityPercent}%`,
    );
    element.style.setProperty(
      "--item-capacity-color",
      visual.capacity?.cssColor || "transparent",
    );
    element.style.setProperty(
      "--item-quality-color",
      visual.quality?.cssColor || "transparent",
    );
    element.style.setProperty(
      "--item-quality-sections",
      String(progression.quality?.totalSections || 0),
    );
  }

  #createRatingTierBadge(documentRef, ratingTier) {
    const badge = documentRef.createElement("div");
    badge.className = "inv-slot__rating-tier-badge";
    badge.textContent = String(ratingTier.current);
    badge.setAttribute(
      "aria-label",
      this.#labels.ratingTierOf(ratingTier.current, ratingTier.maximum),
    );
    return badge;
  }
}
