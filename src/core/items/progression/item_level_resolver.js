class ItemLevelResolver {
  resolve(power, scale = {}) {
    const minimum = Number(scale.minimum);
    const segments = Number(scale.segments);
    if (
      !Number.isInteger(minimum) ||
      minimum < 1 ||
      !Number.isInteger(segments) ||
      segments < 1 ||
      scale.source !== "power.normalized" ||
      scale.distribution !== "equal_segments"
    ) {
      return Object.freeze({
        available: false,
        reason: "level_config_invalid",
        current: null,
        maximum: null,
      });
    }
    const maximum = minimum + segments - 1;
    if (!power?.available || !Number.isFinite(Number(power.normalized))) {
      return Object.freeze({
        available: false,
        reason: power?.reason || "power_unavailable",
        current: null,
        maximum,
      });
    }
    const normalized = Math.max(0, Math.min(1, Number(power.normalized)));
    const segmentIndex = normalized >= 1
      ? segments - 1
      : Math.floor(normalized * segments);
    return Object.freeze({
      available: true,
      reason: null,
      source: "power_equal_segments",
      current: minimum + segmentIndex,
      minimum,
      maximum,
      segments,
      segmentIndex,
      normalized,
    });
  }
}
