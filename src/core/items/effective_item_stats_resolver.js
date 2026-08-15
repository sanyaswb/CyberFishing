class EffectiveItemStatsResolver {
  #overridePolicy;

  constructor({ overridePolicy = new ItemStatOverridePolicy() } = {}) {
    if (!overridePolicy || typeof overridePolicy.normalize !== "function") {
      throw new TypeError(
        "EffectiveItemStatsResolver requires ItemStatOverridePolicy",
      );
    }
    this.#overridePolicy = overridePolicy;
  }

  resolve({ definition = {}, instanceState = {} } = {}) {
    const authoredStats = definition.gameplayStats || {};
    const explicitOverrides = this.#overridePolicy.normalize({
      definition,
      overrides: instanceState.statOverrides || {},
    });
    const resolved = this.#clone(authoredStats);

    this.#applyOverrides(resolved, explicitOverrides);
    return this.#deepFreeze(resolved);
  }

  #applyOverrides(target, overrides) {
    if (!overrides || typeof overrides !== "object") return;
    for (const [key, override] of Object.entries(overrides)) {
      target[key] = this.#resolveOverride(target[key], override);
    }
  }

  #resolveOverride(baseValue, override) {
    if (
      !override ||
      typeof override !== "object" ||
      Array.isArray(override)
    ) {
      return this.#clone(override);
    }

    const hasOperation = ["add", "multiply", "set"].some((key) =>
      Object.prototype.hasOwnProperty.call(override, key),
    );
    if (!hasOperation) return this.#clone(override);

    if (Object.prototype.hasOwnProperty.call(override, "set")) {
      return this.#clone(override.set);
    }
    const base = Number(baseValue);
    if (!Number.isFinite(base)) return this.#clone(baseValue);
    const added = Number(override.add);
    const multiplied = Number(override.multiply);
    const afterAdd = base + (Number.isFinite(added) ? added : 0);
    return afterAdd * (Number.isFinite(multiplied) ? multiplied : 1);
  }

  #clone(value) {
    if (Array.isArray(value)) return value.map((entry) => this.#clone(entry));
    if (!value || typeof value !== "object") return value;
    const clone = {};
    for (const [key, entry] of Object.entries(value)) {
      clone[key] = this.#clone(entry);
    }
    return clone;
  }

  #deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }
    for (const entry of Object.values(value)) this.#deepFreeze(entry);
    return Object.freeze(value);
  }
}

globalThis.EffectiveItemStatsResolver = EffectiveItemStatsResolver;
