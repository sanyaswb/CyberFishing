class ExactItemSignaturePolicy {
  static #ignoredKeys = new Set([
    "instanceId",
    "quantity",
    "location",
    "buildId",
    "progression",
    "powerPercent",
    "powerLevel",
    "normalizedPower",
    "powerColor",
    "powerGradient",
    "qualityMax",
    "capacityPercent",
    "conditionPercent",
  ]);

  create(item) {
    if (!item?.itemId) {
      throw new TypeError("Exact item signature requires item.itemId");
    }
    const properties = {};
    for (const key of Object.keys(item).sort()) {
      if (ExactItemSignaturePolicy.#ignoredKeys.has(key)) continue;
      properties[key] = this.#canonicalize(item[key]);
    }
    const canonicalProperties = this.#canonicalize(properties);
    const key = JSON.stringify(canonicalProperties);
    return this.#deepFreeze({
      version: 1,
      itemId: item.itemId,
      properties: canonicalProperties,
      key,
    });
  }

  matches(item, signature) {
    if (!item || !signature) return false;
    const actual = this.create(item);
    return actual.itemId === signature.itemId && actual.key === signature.key;
  }

  toKey(signature) {
    if (signature?.key) return String(signature.key);
    return JSON.stringify(this.#canonicalize(signature?.properties || signature));
  }

  #canonicalize(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => this.#canonicalize(entry));
    }
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const key of Object.keys(value).sort()) {
      const entry = value[key];
      if (entry !== undefined) result[key] = this.#canonicalize(entry);
    }
    return result;
  }

  #deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const entry of Object.values(value)) this.#deepFreeze(entry);
    return Object.freeze(value);
  }
}
