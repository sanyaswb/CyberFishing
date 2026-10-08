export class ItemProgressionDomAdapter {
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
    for (const node of element.querySelectorAll?.(".inv-slot__rating-tier-badge") || []) {
      node.remove();
    }
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
