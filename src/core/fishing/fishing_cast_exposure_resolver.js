class FishingCastExposureResolver {
  resolve({ nowMs, castStartTimeMs, timeScale = 1, active = true } = {}) {
    if (!active) return 0;
    const now = Number(nowMs);
    const startedAt = Number(castStartTimeMs);
    const scale = Number(timeScale);
    if (!Number.isFinite(now) || !Number.isFinite(startedAt)) return 0;
    return Math.max(0, now - startedAt) *
      (Number.isFinite(scale) && scale > 0 ? scale : 1);
  }
}

globalThis.FishingCastExposureResolver = FishingCastExposureResolver;
