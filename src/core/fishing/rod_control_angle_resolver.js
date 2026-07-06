/**
 * Resolves Rod Control X line angle and geometric force ratio.
 *
 * Responsibility boundary:
 * - reads only geometry inputs and alignment config;
 * - owns the single formula for converting fish/rod offset into angleRatio;
 * - does not know input devices, tension, drag, movement or rendering.
 */
class RodControlAngleResolver {
  resolve({
    absOffsetX,
    targetRodY,
    fishY,
    aligned = false,
    centerStartActive = false,
    config = {},
  } = {}) {
    const maxEffectiveAngleDeg = Math.max(
      0.000001,
      this.#number(config.maxEffectiveAngleDeg, 20),
    );
    const dy = Math.abs(
      this.#number(targetRodY) - this.#number(fishY),
    );
    const lineAngleDeg =
      Math.atan2(
        Math.max(0, this.#number(absOffsetX)),
        Math.max(1, dy),
      ) * 180 / Math.PI;
    const angleRatio = centerStartActive
      ? 1
      : aligned
        ? 0
        : this.#clamp01(lineAngleDeg / maxEffectiveAngleDeg);

    return Object.freeze({
      lineAngleDeg,
      angleRatio,
      maxEffectiveAngleDeg,
    });
  }

  #number(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  #clamp01(value) {
    const number = this.#number(value);
    return Math.max(0, Math.min(1, number));
  }
}

if (typeof window !== "undefined") {
  window.RodControlAngleResolver = RodControlAngleResolver;
}
