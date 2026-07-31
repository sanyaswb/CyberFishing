class RarityVisualResolver {
  #configProvider;
  #stops = null;
  #resolvedByPosition = new Map();
  #preMaximumPosition = 1;

  constructor({ configProvider }) {
    if (typeof configProvider !== "function") {
      throw new TypeError("RarityVisualResolver requires configProvider");
    }
    this.#configProvider = configProvider;
  }

  resolvePosition(position) {
    this.#ensureConfig();
    const normalized = this.#clamp01(position);
    const cacheKey = normalized.toFixed(6);
    const cached = this.#resolvedByPosition.get(cacheKey);
    if (cached) return cached;

    const upperIndex = this.#stops.findIndex(
      (stop) => stop.position >= normalized,
    );
    const resolvedUpperIndex =
      upperIndex < 0 ? this.#stops.length - 1 : upperIndex;
    const upper = this.#stops[resolvedUpperIndex];
    const lower = this.#stops[Math.max(0, resolvedUpperIndex - 1)] || upper;
    const span = upper.position - lower.position;
    const ratio = span > 0 ? (normalized - lower.position) / span : 0;
    const resolved = Object.freeze({
      position: normalized,
      id: ratio >= 0.5 ? upper.id : lower.id,
      color: Object.freeze(this.#mixRgb(lower.color, upper.color, ratio)),
    });
    this.#resolvedByPosition.set(cacheKey, resolved);
    return resolved;
  }

  resolveLevel(level, maxLevel, reserveMaximum = false) {
    const normalizedLevel = Math.max(1, Math.round(Number(level) || 1));
    const normalizedMax = Math.max(
      normalizedLevel,
      Math.round(Number(maxLevel) || normalizedLevel),
    );
    const ratio =
      normalizedMax <= 1
        ? 0
        : (normalizedLevel - 1) / (normalizedMax - 1);
    const upperPosition = reserveMaximum
      ? this.preMaximumPosition
      : 1;
    return this.resolvePosition(ratio * upperPosition);
  }

  get neutral() {
    return this.resolvePosition(0);
  }

  get maximum() {
    return this.resolvePosition(1);
  }

  get preMaximumPosition() {
    this.#ensureConfig();
    return this.#preMaximumPosition;
  }

  invalidate() {
    this.#stops = null;
    this.#resolvedByPosition.clear();
  }

  #ensureConfig() {
    if (this.#stops) return;
    const config = this.#configProvider() || {};
    const sourceStops = Array.isArray(config.colorStops)
      ? config.colorStops
      : [];
    const normalized = sourceStops
      .map((stop, index) => ({
        id: String(stop?.id || `rarity-${index}`),
        position: this.#clamp01(stop?.position),
        color: this.#normalizeRgb(stop?.color),
      }))
      .sort((left, right) => left.position - right.position);

    this.#stops = normalized.length > 0
      ? normalized
      : [{ id: "unknown", position: 0, color: [145, 150, 160] }];
    this.#preMaximumPosition = this.#clamp01(
      config.preMaximumPosition ??
        this.#stops[Math.max(0, this.#stops.length - 2)]?.position ??
        1,
    );
  }

  #normalizeRgb(color) {
    if (!Array.isArray(color) || color.length < 3) {
      return [145, 150, 160];
    }
    return color.slice(0, 3).map((channel) =>
      Math.max(0, Math.min(255, Math.round(Number(channel) || 0))),
    );
  }

  #mixRgb(from, to, ratio) {
    const t = this.#clamp01(ratio);
    return [0, 1, 2].map((index) =>
      Math.round(from[index] + (to[index] - from[index]) * t),
    );
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
