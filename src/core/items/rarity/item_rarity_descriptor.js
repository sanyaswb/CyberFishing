class ItemRarityDescriptor {
  constructor({
    mode,
    tier,
    maxTier,
    normalized,
    isUnique,
    uniqueId = null,
  }) {
    this.mode = mode;
    this.tier = tier;
    this.maxTier = maxTier;
    this.normalized = normalized;
    this.isUnique = isUnique;
    this.uniqueId = uniqueId;
    Object.freeze(this);
  }
}
