class ItemProgressionLevelResolver {
  resolve(rating, scale = {}) {
    const minimum = Number(scale.minimum);
    const segments = Number(scale.segments);
    if (
      !Number.isInteger(minimum) ||
      minimum < 1 ||
      !Number.isInteger(segments) ||
      segments < 1 ||
      scale.source !== "rating.normalized" ||
      scale.distribution !== "equal_segments"
    ) {
      return Object.freeze({
        available: false,
        reason: "progression_level_config_invalid",
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
        maximum,
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
