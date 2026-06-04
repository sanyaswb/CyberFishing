class HudStyleResolver {
  #hudStylesProvider;

  constructor({ hudStylesProvider = null } = {}) {
    this.#hudStylesProvider = typeof hudStylesProvider === "function"
      ? hudStylesProvider
      : () => (typeof CONFIG !== "undefined" ? CONFIG.ui?.hudStyles : null);
  }

  resolveBarStyle(path, { overrides = null } = {}) {
    const bars = this.#getBarsConfig();
    const sharedStyle = bars.shared || {};
    const componentStyle = this.#getPathValue(bars, path) || {};
    return HudStyleResolver.merge(sharedStyle, componentStyle, overrides);
  }

  static merge(...sources) {
    const target = {};
    for (const source of sources) {
      HudStyleResolver.#mergeInto(target, source);
    }
    return target;
  }

  #getBarsConfig() {
    const hudStyles = this.#hudStylesProvider() || {};
    return hudStyles.bars || {};
  }

  #getPathValue(source, path) {
    if (!source || !path) return null;
    let cursor = source;
    for (const segment of String(path).split(".")) {
      if (!cursor || typeof cursor !== "object") return null;
      cursor = cursor[segment];
    }
    return cursor && typeof cursor === "object" ? cursor : null;
  }

  static #mergeInto(target, source) {
    if (!source || typeof source !== "object") return target;
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        target[key] = value.slice();
      } else if (value && typeof value === "object") {
        const base = target[key] && typeof target[key] === "object" && !Array.isArray(target[key])
          ? target[key]
          : {};
        target[key] = HudStyleResolver.#mergeInto(base, value);
      } else {
        target[key] = value;
      }
    }
    return target;
  }
}
