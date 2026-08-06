class ItemMetricStrategy {
  #id;

  constructor(id) {
    if (!id) throw new TypeError("ItemMetricStrategy requires id");
    this.#id = String(id);
  }

  get id() {
    return this.#id;
  }

  evaluate(_context) {
    throw new Error(`${this.constructor.name}.evaluate must be implemented`);
  }

  readPath(source, path) {
    if (!source || !path) return undefined;
    const parts = String(path).split(".");
    let current = source;
    for (let index = 0; index < parts.length; index += 1) {
      if (!current || typeof current !== "object") return undefined;
      current = current[parts[index]];
    }
    return current;
  }

  finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  unavailable(reason, extra = {}) {
    return Object.freeze({
      available: false,
      reason,
      strategyId: this.id,
      ...extra,
    });
  }

  available(values = {}) {
    return Object.freeze({
      available: true,
      reason: null,
      strategyId: this.id,
      ...values,
    });
  }

  static normalizeValue(value, minimum, maximum, direction) {
    const raw = Number(value);
    const min = Number(minimum);
    const max = Number(maximum);
    if (![raw, min, max].every(Number.isFinite) || min >= max) return null;
    const normalized = direction === "lower_is_better"
      ? (max - raw) / (max - min)
      : (raw - min) / (max - min);
    return Math.max(0, Math.min(1, normalized));
  }
}
