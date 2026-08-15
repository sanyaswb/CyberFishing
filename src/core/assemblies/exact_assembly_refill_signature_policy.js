class ExactAssemblyRefillSignaturePolicy {
  static #ignoredKeys = new Set([
    "instanceId",
    "quantity",
    "location",
    "buildId",
    "progression",
    "ratingPercent",
    "progressionLevel",
    "ratingTier",
    "normalizedRating",
    "ratingColor",
    "ratingGradient",
    "powerPercent",
    "powerLevel",
    "normalizedPower",
    "powerColor",
    "powerGradient",
    "qualityMax",
    "capacityPercent",
    "conditionPercent",
    "freshness",
    "freshnessPercent",
  ]);

  create(item) {
    if (!item || typeof item !== "object") {
      throw new TypeError("Cannot create a refill signature without an item");
    }
    const properties = {};
    for (const key of Object.keys(item).sort()) {
      if (ExactAssemblyRefillSignaturePolicy.#ignoredKeys.has(key)) continue;
      if (item[key] !== undefined) {
        properties[key] = this.#canonicalClone(item[key]);
      }
    }
    return this.#deepFreeze({
      version: 1,
      itemId: item.itemId,
      properties,
      key: this.#stableSerialize(properties),
    });
  }

  matches(item, signature) {
    if (!item || !signature || item.itemId !== signature.itemId) return false;
    const candidate = this.create(item);
    return candidate.key === signature.key;
  }

  toKey(signature) {
    if (signature?.key) return String(signature.key);
    return this.#stableSerialize(signature?.properties || signature || {});
  }

  #canonicalClone(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => this.#canonicalClone(entry));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .filter((key) => value[key] !== undefined)
          .map((key) => [key, this.#canonicalClone(value[key])]),
      );
    }
    return value;
  }

  #stableSerialize(value) {
    return JSON.stringify(this.#canonicalClone(value));
  }

  #deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const entry of Object.values(value)) this.#deepFreeze(entry);
    return Object.freeze(value);
  }
}
