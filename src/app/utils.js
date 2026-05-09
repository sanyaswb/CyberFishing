function normalizeDistance(raw, fallback = Infinity) {
  if (raw === "max") return Infinity;
  if (raw == null) return fallback;

  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(1, value) : fallback;
}

class SeededRng {
  #state;

  constructor(seed = 0x9e3779b9) {
    this.#state = this.#normalizeSeed(seed);
  }

  #normalizeSeed(seed) {
    if (typeof seed === "number" && Number.isFinite(seed)) {
      return seed >>> 0 || 0x9e3779b9;
    }

    const value = String(seed ?? "cyber-fishing");
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 0x9e3779b9;
  }

  next() {
    this.#state = Math.imul(1664525, this.#state) + 1013904223;
    return (this.#state >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(items) {
    return items[this.int(0, items.length - 1)];
  }
}
