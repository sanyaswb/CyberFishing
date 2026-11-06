export class DisplayStatsResolver {
  static resolve(item) {
    const schema = item?.displayStats || {};
    const effectiveStats =
      item?.effectiveStats ||
      item?.gameplayStats ||
      {};
    const resolved = {};

    for (const [key, descriptor] of Object.entries(schema)) {
      const value = this.#resolveValue(key, descriptor, item, effectiveStats);
      const stat = this.#buildStat(key, descriptor, value);
      if (!stat) continue;
      resolved[stat.label] = stat.value;
    }

    return resolved;
  }

  static #resolveValue(key, descriptor, item, effectiveStats) {
    if (descriptor && typeof descriptor === "object") {
      if (descriptor.byLevel) {
        const table = this.#readPath(descriptor.byLevel, item, effectiveStats);
        const level = this.#readPath(
          descriptor.levelKey,
          item,
          effectiveStats,
        );
        return table?.[level]?.[descriptor.stat];
      }

      if (descriptor.range) {
        const from = this.#readPath(descriptor.range[0], item, effectiveStats);
        const to = this.#readPath(descriptor.range[1], item, effectiveStats);
        if (from === undefined || to === undefined) return undefined;
        return `${this.#formatScalar(from)}-${this.#formatScalar(to)}`;
      }

      const valueKey = descriptor.key || key;
      return this.#readPath(valueKey, item, effectiveStats);
    }

    if (Object.prototype.hasOwnProperty.call(effectiveStats, key)) {
      return effectiveStats[key];
    }

    if (Object.prototype.hasOwnProperty.call(item || {}, key)) {
      return item[key];
    }

    if (typeof descriptor === "string" && descriptor.includes(":")) {
      return undefined;
    }

    return descriptor;
  }

  static #buildStat(key, descriptor, value) {
    if (value === undefined || value === null) return null;

    if (descriptor && typeof descriptor === "object") {
      const label = descriptor.label || key;
      const mappedValue =
        descriptor.map && Object.prototype.hasOwnProperty.call(descriptor.map, value)
          ? descriptor.map[value]
          : value;
      const formatted = this.#formatScalar(mappedValue, descriptor.decimals);
      return {
        label,
        value: this.#joinSuffix(formatted, descriptor.suffix || ""),
      };
    }

    if (typeof descriptor === "string") {
      const parsed = this.#parseTextDescriptor(key, descriptor, value);
      return {
        label: parsed.label,
        value: this.#joinSuffix(this.#formatScalar(value), parsed.suffix),
      };
    }

    return {
      label: key,
      value: this.#formatScalar(value),
    };
  }

  static #parseTextDescriptor(key, descriptor, value) {
    if (descriptor.includes(":")) {
      const separatorIndex = descriptor.indexOf(":");
      return {
        label: descriptor.slice(0, separatorIndex).trim() || key,
        suffix: descriptor.slice(separatorIndex + 1).trim(),
      };
    }

    return {
      label: key,
      suffix: "",
    };
  }

  static #readPath(path, item, effectiveStats) {
    if (!path) return undefined;
    if (Object.prototype.hasOwnProperty.call(effectiveStats, path)) {
      return effectiveStats[path];
    }
    if (Object.prototype.hasOwnProperty.call(item || {}, path)) {
      return item[path];
    }

    const parts = String(path).split(".");
    let current = { ...item, effectiveStats };
    for (let i = 0; i < parts.length; i++) {
      if (!current || typeof current !== "object") return undefined;
      current = current[parts[i]];
    }
    return current;
  }

  static #formatScalar(value, decimals) {
    if (typeof value === "number") {
      if (Number.isInteger(value)) return String(value);
      const precision = Number.isInteger(decimals) ? decimals : 2;
      return value
        .toFixed(precision)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
    }
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  }

  static #joinSuffix(value, suffix) {
    const normalized = String(suffix || "").trim();
    if (!normalized) return value;
    const glue = normalized.startsWith("%") ? "" : " ";
    return `${value}${glue}${normalized}`;
  }
}
