class StaminaLateralPositionResolver {
  resolve({
    fishLateralOffsetPx = 0,
    maxAllowedLateralOffsetPx = 0,
    angleRatio = null,
    config = {},
  } = {}) {
    const offset = Number(fishLateralOffsetPx) || 0;
    const absOffset = Math.abs(offset);
    const maxOffset = this.#positive(maxAllowedLateralOffsetPx);
    const explicitRatio = Number(angleRatio);
    const lateralEdgeRatio =
      maxOffset > 0
        ? this.#clamp01(absOffset / maxOffset)
        : Number.isFinite(explicitRatio)
          ? this.#clamp01(explicitRatio)
          : 0;
    const fishSide = offset > 0 ? "right" : offset < 0 ? "left" : "center";
    const centerDeadZoneRatio = this.#clamp01(config.centerDeadZoneRatio ?? 0);
    const expectedControlDirectionToCenter =
      lateralEdgeRatio <= centerDeadZoneRatio ? 0 : -Math.sign(offset);

    return Object.freeze({
      lateralEdgeRatio,
      fishSide,
      expectedControlDirectionToCenter,
      fishLateralOffsetPx: offset,
      maxAllowedLateralOffsetPx: maxOffset,
    });
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }
}

if (typeof window !== "undefined") {
  window.StaminaLateralPositionResolver = StaminaLateralPositionResolver;
}
