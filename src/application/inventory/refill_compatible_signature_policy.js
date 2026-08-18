class RefillCompatibleSignaturePolicy {
  static #ignoredKeys = new Set([
    "instanceId",
    "quantity",
    "location",
    "buildId",
    "freshnessState",
  ]);

  create(item) {
    if (!item?.itemId) {
      throw new TypeError("Refill-compatible signature requires item.itemId");
    }
    const properties = {};
    for (const key of Object.keys(item).sort()) {
      if (RefillCompatibleSignaturePolicy.#ignoredKeys.has(key)) continue;
      if (item[key] !== undefined) properties[key] = this.#clone(item[key]);
    }
    return this.#freeze({
      version: 1,
      itemId: item.itemId,
      properties,
      key: JSON.stringify(properties),
    });
  }

  matches(item, signature) {
    if (!item || !signature || item.itemId !== signature.itemId) return false;
    return this.create(item).key === signature.key;
  }

  toKey(signature) {
    if (signature?.key) return String(signature.key);
    return JSON.stringify(this.#clone(signature?.properties || signature || {}));
  }

  #clone(value) {
    if (Array.isArray(value)) return value.map((entry) => this.#clone(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, this.#clone(value[key])]),
    );
  }

  #freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) this.#freeze(child);
    return Object.freeze(value);
  }
}

globalThis.RefillCompatibleSignaturePolicy = RefillCompatibleSignaturePolicy;
