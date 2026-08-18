class BaitEffectivenessMatch {
  constructor({
    baitId = "",
    instanceId = null,
    candidate = null,
    affinityMultiplier = 0,
    freshnessPercent = 100,
    freshnessMultiplier = 1,
    effectiveMultiplier = 0,
  } = {}) {
    this.baitId = String(baitId || "");
    this.instanceId = instanceId ? String(instanceId) : null;
    this.candidate = candidate || null;
    this.affinityMultiplier = Number(affinityMultiplier) || 0;
    this.freshnessPercent = Number(freshnessPercent);
    this.freshnessMultiplier = Number(freshnessMultiplier) || 0;
    this.effectiveMultiplier = Number(effectiveMultiplier) || 0;
    Object.freeze(this);
  }
}

globalThis.BaitEffectivenessMatch = BaitEffectivenessMatch;
