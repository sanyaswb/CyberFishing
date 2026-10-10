export class ItemProgressionVisualResolver {
  #rarityVisualResolver;
  #gradient = null;

  constructor({ rarityVisualResolver } = {}) {
    if (
      !rarityVisualResolver ||
      typeof rarityVisualResolver.resolvePosition !== "function"
    ) {
      throw new TypeError(
        "ItemProgressionVisualResolver requires rarityVisualResolver",
      );
    }
    this.#rarityVisualResolver = rarityVisualResolver;
  }

  resolve(progression) {
    if (!progression?.available) return this.#unavailable();
    const rating = this.#resolvePosition(progression.rating?.normalized);
    const ratingTier = this.#resolveRatingTier(
      progression.ratingTier,
    );
    const quality = this.#resolvePosition(
      progression.quality?.available
        ? progression.quality.visualPosition
        : null,
    );
    return Object.freeze({
      available:
        rating.available ||
        ratingTier.available ||
        quality.available,
      gradient: this.#ordinaryGradient(),
      rating,
      ratingTier,
      quality,
    });
  }

  invalidate() {
    this.#gradient = null;
  }

  #resolvePosition(normalized) {
    if (
      normalized === null ||
      normalized === undefined ||
      normalized === "" ||
      !Number.isFinite(Number(normalized))
    ) {
      return Object.freeze({ available: false, color: null, cssColor: "" });
    }
    const position = Math.max(0, Math.min(1, Number(normalized))) *
      this.#rarityVisualResolver.preMaximumPosition;
    const visual = this.#rarityVisualResolver.resolvePosition(position);
    return Object.freeze({
      available: true,
      position,
      color: visual.color,
      cssColor: `rgb(${visual.color.join(", ")})`,
    });
  }

  #resolveRatingTier(ratingTier) {
    return Object.freeze({
      available: Boolean(ratingTier?.available),
      color: null,
      cssColor: "",
    });
  }

  #ordinaryGradient() {
    if (this.#gradient) return this.#gradient;
    const maximumPosition = this.#rarityVisualResolver.preMaximumPosition || 1;
    const stops = this.#rarityVisualResolver.ordinaryStops || [];
    const cssStops = stops.map((stop) => {
      const percent = Math.max(
        0,
        Math.min(100, (stop.position / maximumPosition) * 100),
      );
      return `rgb(${stop.color.join(", ")}) ${percent}%`;
    });
    this.#gradient = `linear-gradient(90deg, ${cssStops.join(", ")})`;
    return this.#gradient;
  }

  #unavailable() {
    const unavailable = this.#unavailableVisual();
    return Object.freeze({
      available: false,
      gradient: "",
      rating: unavailable,
      ratingTier: unavailable,
      quality: unavailable,
    });
  }

  #unavailableVisual() {
    return Object.freeze({
      available: false,
      color: null,
      cssColor: "",
    });
  }
}
