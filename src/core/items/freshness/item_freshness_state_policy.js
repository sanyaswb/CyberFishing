class ItemFreshnessStatePolicy {
  #minimum;
  #maximum;
  #defaultPercent;

  constructor({ minimum = 0, maximum = 100, defaultPercent = 100 } = {}) {
    this.#minimum = Number(minimum);
    this.#maximum = Number(maximum);
    this.#defaultPercent = Number(defaultPercent);
    if (
      !Number.isFinite(this.#minimum) ||
      !Number.isFinite(this.#maximum) ||
      this.#minimum >= this.#maximum ||
      !Number.isFinite(this.#defaultPercent) ||
      this.#defaultPercent < this.#minimum ||
      this.#defaultPercent > this.#maximum
    ) {
      throw new RangeError("Invalid freshness state bounds");
    }
  }

  resolvePercent(state) {
    if (state === undefined || state === null) return this.#defaultPercent;
    return this.normalize(state).percent;
  }

  normalize(state, { omitDefault = false } = {}) {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new TypeError("freshnessState must be an object");
    }
    const keys = Object.keys(state);
    if (keys.length !== 1 || keys[0] !== "percent") {
      throw new TypeError("freshnessState supports only percent");
    }
    const percent = Number(state.percent);
    if (!Number.isFinite(percent)) {
      throw new TypeError("freshnessState.percent must be finite");
    }
    if (percent < this.#minimum || percent > this.#maximum) {
      throw new RangeError(
        `freshnessState.percent must be in [${this.#minimum}, ${this.#maximum}]`,
      );
    }
    const rounded = Math.round(percent * 100) / 100;
    if (omitDefault && rounded === this.#defaultPercent) return null;
    return Object.freeze({ percent: rounded });
  }

  create(percent, { omitDefault = false } = {}) {
    return this.normalize({ percent }, { omitDefault });
  }
}

globalThis.ItemFreshnessStatePolicy = ItemFreshnessStatePolicy;
