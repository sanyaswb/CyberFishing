class ItemProgressionVisualResolver {
  #rarityVisualResolver;
  #degradationColorResolver;
  #gradient = null;

  constructor({ rarityVisualResolver, degradationColorResolver } = {}) {
    if (
      !rarityVisualResolver ||
      typeof rarityVisualResolver.resolvePosition !== "function"
    ) {
      throw new TypeError(
        "ItemProgressionVisualResolver requires rarityVisualResolver",
      );
    }
    if (
      !degradationColorResolver ||
      typeof degradationColorResolver.resolvePercent !== "function"
    ) {
      throw new TypeError(
        "ItemProgressionVisualResolver requires degradationColorResolver",
      );
    }
    this.#rarityVisualResolver = rarityVisualResolver;
    this.#degradationColorResolver = degradationColorResolver;
  }

  resolve(progression) {
    if (!progression?.available) return this.#unavailable();
    const rating = this.#resolvePosition(progression.rating?.normalized);
    const progressionLevel = this.#resolveProgressionLevel(
      progression.progressionLevel,
    );
    const quality = this.#resolvePosition(
      progression.quality?.available
        ? progression.quality.visualPosition
        : null,
    );
    const capacity = progression.capacity?.available
      ? this.#degradationColorResolver.resolvePercent(
          progression.capacity.percent,
        )
      : this.#unavailableVisual();
    return Object.freeze({
      available:
        rating.available ||
        progressionLevel.available ||
        quality.available ||
        capacity.available,
      gradient: this.#ordinaryGradient(),
      rating,
      progressionLevel,
      quality,
      capacity,
    });
  }

  invalidate() {
    this.#gradient = null;
  }

  #resolvePosition(normalized) {
    if (!Number.isFinite(Number(normalized))) {
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

  #resolveProgressionLevel(progressionLevel) {
    return Object.freeze({
      available: Boolean(progressionLevel?.available),
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
      progressionLevel: unavailable,
      quality: unavailable,
      capacity: unavailable,
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
