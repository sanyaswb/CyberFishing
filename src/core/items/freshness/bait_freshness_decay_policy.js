class BaitFreshnessDecayPolicy {
  resolve({ percent, exposureMs = 0, lossPerMinute = 0 } = {}) {
    const current = Number(percent);
    const elapsed = Math.max(0, Number(exposureMs) || 0);
    const loss = Math.max(0, Number(lossPerMinute) || 0);
    if (!Number.isFinite(current)) {
      throw new TypeError("BaitFreshnessDecayPolicy requires finite percent");
    }
    return Math.max(0, Math.min(100, current - (elapsed / 60000) * loss));
  }
}

globalThis.BaitFreshnessDecayPolicy = BaitFreshnessDecayPolicy;
