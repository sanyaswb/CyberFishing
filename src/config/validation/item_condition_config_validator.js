class ItemConditionConfigValidator {
  #errors = [];

  validate({ conditionConfig, itemDb = {} } = {}) {
    this.#errors = [];
    const minimum = Number(conditionConfig?.minimum);
    const maximum = Number(conditionConfig?.maximum);
    const defaultCurrent = Number(conditionConfig?.defaultCurrent);
    if (!String(conditionConfig?.statPath || "").trim()) {
      this.#error("ITEM_CONDITION_CONFIG.statPath", "expected non-empty path");
    }
    if (!String(conditionConfig?.runtimeOverridePath || "").trim()) {
      this.#error(
        "ITEM_CONDITION_CONFIG.runtimeOverridePath",
        "expected non-empty path",
      );
    }
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
      this.#error(
        "ITEM_CONDITION_CONFIG",
        "expected finite minimum below maximum",
      );
      return this.#errors.slice();
    }
    if (
      !Number.isFinite(defaultCurrent) ||
      defaultCurrent < minimum ||
      defaultCurrent > maximum
    ) {
      this.#error(
        "ITEM_CONDITION_CONFIG.defaultCurrent",
        "expected value inside the configured range",
      );
    }
    this.#validateAuthoredValues(conditionConfig, itemDb, minimum, maximum);
    return this.#errors.slice();
  }

  assertValid(input = {}) {
    const issues = this.validate(input);
    if (issues.length === 0) return true;
    const details = issues
      .map((issue) => `- ${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid item condition configuration:\n${details}`);
  }

  #validateAuthoredValues(config, itemDb, minimum, maximum) {
    for (const [categoryId, category] of Object.entries(itemDb || {})) {
      for (const [itemId, item] of Object.entries(category || {})) {
        const value = this.#readPath(item, config.statPath);
        if (value === undefined || value === null) continue;
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) {
          this.#error(
            `ITEM_DB.${categoryId}.${itemId}.${config.statPath}`,
            `expected numeric condition in [${minimum}, ${maximum}]`,
          );
        }
      }
    }
  }

  #readPath(source, path) {
    let current = source;
    for (const part of String(path || "").split(".")) {
      if (!part) continue;
      if (!current || typeof current !== "object") return undefined;
      current = current[part];
    }
    return current;
  }

  #error(path, message) {
    this.#errors.push(Object.freeze({ path, message }));
  }
}
