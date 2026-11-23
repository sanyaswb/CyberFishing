// An item instance's percent fact ({ percent } under one save key: freshnessState, chargeState): bounds, rounding to
// hundredths and the omitted default share one rule.
export class ItemPercentStatePolicy {
  #stateName;
  #minimum;
  #maximum;
  #defaultPercent;

  constructor({ stateName, minimum = 0, maximum = 100, defaultPercent = 100 } = {}) {
    this.#stateName = String(stateName || "");
    this.#minimum = Number(minimum);
    this.#maximum = Number(maximum);
    this.#defaultPercent = Number(defaultPercent);
    if (
      !this.#stateName ||
      !Number.isFinite(this.#minimum) ||
      !Number.isFinite(this.#maximum) ||
      this.#minimum >= this.#maximum ||
      !Number.isFinite(this.#defaultPercent) ||
      this.#defaultPercent < this.#minimum ||
      this.#defaultPercent > this.#maximum
    ) {
      throw new RangeError(`Invalid ${this.#stateName || "percent"} state bounds`);
    }
  }

  resolvePercent(state) {
    if (state === undefined || state === null) return this.#defaultPercent;
    return this.normalize(state).percent;
  }

  normalize(state, { omitDefault = false } = {}) {
    const name = this.#stateName;
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new TypeError(`${name} must be an object`);
    }
    const keys = Object.keys(state);
    if (keys.length !== 1 || keys[0] !== "percent") {
      throw new TypeError(`${name} supports only percent`);
    }
    const percent = Number(state.percent);
    if (!Number.isFinite(percent)) {
      throw new TypeError(`${name}.percent must be finite`);
    }
    if (percent < this.#minimum || percent > this.#maximum) {
      throw new RangeError(
        `${name}.percent must be in [${this.#minimum}, ${this.#maximum}]`,
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
