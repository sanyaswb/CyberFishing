class BaitEffectivenessDescriptor {
  constructor({
    baitId,
    fishId,
    fishName,
    available = true,
    reason = null,
    discovered = true,
    compatible = false,
    multiplier = null,
    referenceMultiplier = null,
    relativeEffectiveness = null,
    stars = null,
    maximumStars = 5,
    gradeId = null,
    freshnessPercent = null,
    freshnessMultiplier = null,
    effectiveMultiplier = null,
  } = {}) {
    this.capabilityId = "baitEffectiveness";
    this.baitId = String(baitId || "");
    this.fishId = String(fishId || "");
    this.fishName = String(fishName || fishId || "");
    this.available = Boolean(available);
    this.reason = reason;
    this.discovered = Boolean(discovered);
    this.compatible = Boolean(compatible);
    this.multiplier = multiplier;
    this.referenceMultiplier = referenceMultiplier;
    this.relativeEffectiveness = relativeEffectiveness;
    this.stars = stars;
    this.maximumStars = maximumStars;
    this.gradeId = gradeId;
    this.freshnessPercent = freshnessPercent;
    this.freshnessMultiplier = freshnessMultiplier;
    this.effectiveMultiplier = effectiveMultiplier;
    Object.freeze(this);
  }
}

globalThis.BaitEffectivenessDescriptor = BaitEffectivenessDescriptor;
