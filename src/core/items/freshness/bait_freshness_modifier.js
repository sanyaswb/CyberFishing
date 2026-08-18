class BaitFreshnessModifier {
  resolve({ percent, minimumMultiplier = 0.5 } = {}) {
    const freshness = Math.max(0, Math.min(100, Number(percent) || 0));
    const floor = Number(minimumMultiplier);
    if (!Number.isFinite(floor) || floor < 0 || floor > 1) {
      throw new RangeError("minimumMultiplier must be in [0, 1]");
    }
    return floor + (freshness / 100) * (1 - floor);
  }
}

globalThis.BaitFreshnessModifier = BaitFreshnessModifier;
