const DEFAULT_FISH_RADIAL_RANGE = Object.freeze([0.35, 1]);
const DEFAULT_FISH_LATERAL_RANGE = Object.freeze([-1, 1]);

class FishDirectionIntentSampler {
  #rng;

  constructor(rng = null) {
    this.#rng = rng || { next: () => Math.random() };
  }

  sample({
    radialRange = DEFAULT_FISH_RADIAL_RANGE,
    lateralRange = DEFAULT_FISH_LATERAL_RANGE,
  } = {}) {
    const radial = this.#normalizeRange(
      radialRange,
      DEFAULT_FISH_RADIAL_RANGE,
    );
    const lateral = this.#normalizeRange(
      lateralRange,
      DEFAULT_FISH_LATERAL_RANGE,
    );
    return Object.freeze({
      radial: this.#range(radial[0], radial[1]),
      lateral: this.#range(lateral[0], lateral[1]),
    });
  }

  #range(min, max) {
    return typeof this.#rng.range === "function"
      ? this.#rng.range(min, max)
      : min + this.#rng.next() * (max - min);
  }

  #normalizeRange(value, fallback) {
    if (!Array.isArray(value) || value.length < 2) return fallback;
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return fallback;
    }
    return first <= second ? [first, second] : [second, first];
  }
}
