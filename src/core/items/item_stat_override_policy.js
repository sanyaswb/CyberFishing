class ItemStatOverridePolicy {
  #config;

  constructor({ config = globalThis.ITEM_STAT_OVERRIDE_CONFIG } = {}) {
    if (!config?.stats || typeof config.stats !== "object") {
      throw new TypeError("ItemStatOverridePolicy requires override config");
    }
    this.#assertConfig(config);
    this.#config = config;
  }

  normalize({
    definition = {},
    overrides = {},
    allowedKeys = null,
    rejectInvalid = true,
    onRejected = null,
  } = {}) {
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
      throw new TypeError("statOverrides must be an object");
    }
    const allowed = allowedKeys == null ? null : new Set(allowedKeys);
    const normalized = {};
    for (const [key, value] of Object.entries(overrides)) {
      try {
        if (allowed && !allowed.has(key)) {
          throw new RangeError(`Runtime override is not allowed here: ${key}`);
        }
        normalized[key] = this.#normalizeEntry(definition, key, value);
      } catch (error) {
        onRejected?.({ key, value, error });
        if (rejectInvalid) throw error;
      }
    }
    return normalized;
  }

  #normalizeEntry(definition, key, value) {
    const authoredStats = definition?.gameplayStats;
    if (
      !authoredStats ||
      typeof authoredStats !== "object" ||
      !Object.prototype.hasOwnProperty.call(authoredStats, key)
    ) {
      throw new RangeError(`Unknown authored gameplay stat override: ${key}`);
    }
    const rule = this.#config.stats[key];
    if (!rule) {
      throw new RangeError(`Gameplay stat is immutable at runtime: ${key}`);
    }
    if (
      Array.isArray(rule.itemTypes) &&
      !rule.itemTypes.includes(definition.itemType)
    ) {
      throw new RangeError(
        `Gameplay stat ${key} is immutable for ${definition.itemType || "unknown item type"}`,
      );
    }
    if (this.#isOperation(value)) {
      return this.#normalizeOperation(key, value, rule, authoredStats[key]);
    }
    this.#assertValue(key, value, rule);
    return this.#clone(value);
  }

  #assertConfig(config) {
    const supportedTypes = new Set(["number", "integer"]);
    const supportedOperations = new Set(["set", "add", "multiply"]);
    for (const [key, rule] of Object.entries(config.stats)) {
      if (!key || !rule || typeof rule !== "object") {
        throw new TypeError("Override config requires named stat rules");
      }
      if (!supportedTypes.has(rule.valueType)) {
        throw new RangeError(`Unsupported override value type for ${key}`);
      }
      if (!Array.isArray(rule.operations) || rule.operations.length === 0) {
        throw new TypeError(`Override config requires operations for ${key}`);
      }
      for (const operation of rule.operations) {
        if (!supportedOperations.has(operation)) {
          throw new RangeError(
            `Unsupported configured override operation for ${key}: ${operation}`,
          );
        }
      }
      if (
        rule.minimum !== undefined &&
        (!Number.isFinite(rule.minimum) ||
          (rule.maximum !== undefined && rule.minimum > rule.maximum))
      ) {
        throw new RangeError(`Invalid override bounds for ${key}`);
      }
      if (rule.maximum !== undefined && !Number.isFinite(rule.maximum)) {
        throw new RangeError(`Invalid override maximum for ${key}`);
      }
      if (
        rule.itemTypes !== undefined &&
        (!Array.isArray(rule.itemTypes) ||
          rule.itemTypes.length === 0 ||
          rule.itemTypes.some((itemType) => !String(itemType || "").trim()))
      ) {
        throw new TypeError(`Invalid override itemTypes for ${key}`);
      }
    }
  }

  #isOperation(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    return ["set", "add", "multiply"].some((operation) =>
      Object.prototype.hasOwnProperty.call(value, operation),
    );
  }

  #normalizeOperation(key, value, rule, authoredValue) {
    const operationKeys = Object.keys(value);
    const supportedKeys = new Set(["set", "add", "multiply"]);
    for (const operation of operationKeys) {
      if (!supportedKeys.has(operation)) {
        throw new RangeError(`Unsupported override operation for ${key}: ${operation}`);
      }
      if (!(rule.operations || []).includes(operation)) {
        throw new RangeError(`Override operation ${operation} is not allowed for ${key}`);
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(value, "set") &&
      operationKeys.length > 1
    ) {
      throw new RangeError(`Override set cannot be combined for ${key}`);
    }
    const normalized = {};
    for (const operation of operationKeys) {
      const operand = value[operation];
      if (typeof operand !== "number" || !Number.isFinite(operand)) {
        throw new TypeError(`Override operation ${operation} for ${key} must be finite`);
      }
      normalized[operation] = operand;
    }
    const effectiveValue = Object.prototype.hasOwnProperty.call(normalized, "set")
      ? normalized.set
      : (Number(authoredValue) + (normalized.add || 0)) *
        (normalized.multiply ?? 1);
    this.#assertValue(key, effectiveValue, rule);
    return normalized;
  }

  #assertValue(key, value, rule) {
    if (rule.valueType === "number" || rule.valueType === "integer") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new TypeError(`Runtime override ${key} must be a finite number`);
      }
      const numeric = value;
      if (rule.valueType === "integer" && !Number.isInteger(numeric)) {
        throw new TypeError(`Runtime override ${key} must be an integer`);
      }
      if (Number.isFinite(Number(rule.minimum)) && numeric < Number(rule.minimum)) {
        throw new RangeError(`Runtime override ${key} is below its minimum`);
      }
      if (Number.isFinite(Number(rule.maximum)) && numeric > Number(rule.maximum)) {
        throw new RangeError(`Runtime override ${key} is above its maximum`);
      }
      return;
    }
    throw new RangeError(`Unsupported override value type for ${key}`);
  }

  #clone(value) {
    if (Array.isArray(value)) return value.map((entry) => this.#clone(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, this.#clone(entry)]),
    );
  }
}

globalThis.ItemStatOverridePolicy = ItemStatOverridePolicy;
