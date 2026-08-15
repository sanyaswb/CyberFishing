class ItemRatingTierResolver {
  resolve(rating, config = {}) {
    const minimum = Number(config.minimum);
    const segments = Number(config.segments);
    if (
      !Number.isInteger(minimum) ||
      minimum < 1 ||
      !Number.isInteger(segments) ||
      segments < 1 ||
      config.source !== "rating.normalized" ||
      config.distribution !== "equal_segments"
    ) {
      return Object.freeze({
        available: false,
        reason: "rating_tier_config_invalid",
        current: null,
        maximum: null,
      });
    }
    const maximum = minimum + segments - 1;
    if (!rating?.available || !Number.isFinite(Number(rating.normalized))) {
      return Object.freeze({
        available: false,
        reason: rating?.reason || "rating_unavailable",
        current: null,
        minimum,
        maximum,
        segments,
      });
    }
    const normalized = Math.max(0, Math.min(1, Number(rating.normalized)));
    const segmentIndex = normalized >= 1
      ? segments - 1
      : Math.floor(normalized * segments);
    return Object.freeze({
      available: true,
      reason: null,
      source: "rating_equal_segments",
      current: minimum + segmentIndex,
      minimum,
      maximum,
      segments,
      segmentIndex,
      normalized,
    });
  }
}

globalThis.ItemRatingTierResolver = ItemRatingTierResolver;
