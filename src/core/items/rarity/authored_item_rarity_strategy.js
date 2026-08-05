class AuthoredItemRarityStrategy extends ItemRarityStrategy {
  #descriptors = new Map();

  supports(profile) {
    return profile?.mode === "authored";
  }

  resolve(profile) {
    if (!this.supports(profile)) {
      throw new TypeError("Authored rarity strategy requires mode=authored");
    }

    const tier = profile.tier;
    const maxTier = profile.maxTier;
    if (typeof tier !== "number" || !Number.isInteger(tier) || tier < 1) {
      throw new RangeError("Item rarity tier must be an integer >= 1");
    }
    if (
      typeof maxTier !== "number" ||
      !Number.isInteger(maxTier) ||
      maxTier < 1
    ) {
      throw new RangeError("Item rarity maxTier must be an integer >= 1");
    }
    if (tier > maxTier) {
      throw new RangeError("Item rarity tier must not exceed maxTier");
    }
    if (typeof profile.isUnique !== "boolean") {
      throw new TypeError("Item rarity isUnique must be boolean");
    }

    const uniqueId = String(profile.uniqueId || "").trim();
    if (profile.isUnique && !uniqueId) {
      throw new TypeError("Unique item rarity requires uniqueId");
    }
    if (!profile.isUnique && uniqueId) {
      throw new TypeError("Ordinary item rarity must not define uniqueId");
    }

    const cacheKey = [tier, maxTier, profile.isUnique ? 1 : 0, uniqueId].join(
      ":",
    );
    const cached = this.#descriptors.get(cacheKey);
    if (cached) return cached;

    const descriptor = new ItemRarityDescriptor({
      mode: "authored",
      tier,
      maxTier,
      normalized: maxTier === 1 ? 0 : (tier - 1) / (maxTier - 1),
      isUnique: profile.isUnique,
      uniqueId: profile.isUnique ? uniqueId : null,
    });
    this.#descriptors.set(cacheKey, descriptor);
    return descriptor;
  }
}
