/**
 * Converts legacy item records into canonical instance facts.
 *
 * Legacy authored values are deliberately not promoted to overrides. Current
 * balance always comes from the current ItemDefinition.
 */
class LegacyItemStateMigration {
  static #legacyMutableStatKeys = Object.freeze([
    "lengthMeters",
    "durability",
  ]);

  static #instanceFactKeys = Object.freeze([
    "rolledStats",
    "rarity",
    "recipe",
    "recipeVariant",
    "qualityGrade",
    "freshnessState",
    "conditionState",
    "upgradeState",
    "resourceState",
    "detachedLineSegment",
    "sourceLineItemId",
    "sourceLineInstanceId",
  ]);

  #overridePolicy;

  constructor({ overridePolicy = new ItemStatOverridePolicy() } = {}) {
    if (!overridePolicy || typeof overridePolicy.normalize !== "function") {
      throw new TypeError(
        "LegacyItemStateMigration requires ItemStatOverridePolicy",
      );
    }
    this.#overridePolicy = overridePolicy;
  }

  migrate(source, definition = {}, { warnings = null } = {}) {
    if (!source || typeof source !== "object") return source;
    this.#reportClassificationMismatch(source, definition, warnings);

    const normalized = {
      instanceId: source.instanceId,
      itemId: source.itemId,
      quantity: source.quantity ?? 1,
    };
    if (source.location && typeof source.location === "object") {
      normalized.location = this.#clone(source.location);
    }
    for (const key of LegacyItemStateMigration.#instanceFactKeys) {
      if (source[key] !== undefined) normalized[key] = this.#clone(source[key]);
    }

    const candidates = this.#legacyMutableCandidates(source);
    const statOverrides = this.#overridePolicy.normalize({
      definition,
      overrides: candidates,
      allowedKeys: LegacyItemStateMigration.#legacyMutableStatKeys,
      rejectInvalid: false,
      onRejected: ({ key, error }) => {
        warnings?.push?.(
          `Dropped legacy override ${source.instanceId || source.itemId || "item"}.${key}: ${error.message}`,
        );
      },
    });
    if (Object.keys(statOverrides).length > 0) {
      normalized.statOverrides = statOverrides;
    }
    this.#reportDiscardedAuthoredStats(source, definition, warnings);
    return normalized;
  }

  #legacyMutableCandidates(source) {
    const candidates = {};
    const explicitOverrides = source.statOverrides;
    if (explicitOverrides && typeof explicitOverrides === "object") {
      for (const key of LegacyItemStateMigration.#legacyMutableStatKeys) {
        if (Object.prototype.hasOwnProperty.call(explicitOverrides, key)) {
          candidates[key] = explicitOverrides[key];
        }
      }
    }
    for (const key of LegacyItemStateMigration.#legacyMutableStatKeys) {
      if (
        !Object.prototype.hasOwnProperty.call(candidates, key) &&
        Object.prototype.hasOwnProperty.call(source, key)
      ) {
        candidates[key] = source[key];
      }
    }
    return candidates;
  }

  #reportClassificationMismatch(source, definition, warnings) {
    if (!warnings?.push) return;
    for (const key of ["itemType", "variant"]) {
      if (
        source[key] != null &&
        definition[key] != null &&
        source[key] !== definition[key]
      ) {
        warnings.push(
          `Ignored mutable ${key} on ${source.instanceId || source.itemId}: ${source[key]} != ${definition[key]}.`,
        );
      }
    }
  }

  #reportDiscardedAuthoredStats(source, definition, warnings) {
    if (!warnings?.push) return;
    const authoredKeys = Object.keys(definition?.gameplayStats || {});
    const discarded = new Set();
    for (const key of Object.keys(source.engineStats || {})) {
      if (!["type", "variant"].includes(key)) discarded.add(key);
    }
    for (const key of authoredKeys) {
      if (
        !LegacyItemStateMigration.#legacyMutableStatKeys.includes(key) &&
        Object.prototype.hasOwnProperty.call(source, key)
      ) {
        discarded.add(key);
      }
    }
    for (const key of Object.keys(source.statOverrides || {})) {
      if (!LegacyItemStateMigration.#legacyMutableStatKeys.includes(key)) {
        discarded.add(key);
      }
    }
    if (discarded.size > 0) {
      warnings.push(
        `Discarded authored legacy stats for ${source.instanceId || source.itemId}: ${[...discarded].sort().join(", ")}.`,
      );
    }
  }

  #clone(value) {
    if (Array.isArray(value)) return value.map((entry) => this.#clone(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, this.#clone(entry)]),
    );
  }
}

globalThis.LegacyItemStateMigration = LegacyItemStateMigration;
