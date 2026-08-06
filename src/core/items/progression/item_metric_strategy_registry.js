class ItemMetricStrategyRegistry {
  #strategies = new Map();

  constructor(strategies = []) {
    for (const strategy of strategies) this.register(strategy);
  }

  register(strategy) {
    if (!strategy?.id || typeof strategy.evaluate !== "function") {
      throw new TypeError("Invalid item metric strategy");
    }
    if (this.#strategies.has(strategy.id)) {
      throw new Error(`Duplicate item metric strategy: ${strategy.id}`);
    }
    this.#strategies.set(strategy.id, strategy);
    return this;
  }

  get(strategyId) {
    return this.#strategies.get(String(strategyId || "")) || null;
  }

  has(strategyId) {
    return this.#strategies.has(String(strategyId || ""));
  }

  get ids() {
    return Object.freeze(Array.from(this.#strategies.keys()));
  }
}
