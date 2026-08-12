class LegacyItemStateMigration {
  static #equipmentPowerTypes = new Set([
    "rod",
    "reel",
    "hook",
    "spinning",
    "feeder",
    "float",
    "pole",
    "spinning_reel",
  ]);

  static #derivedRuntimeKeys = new Set([
    "progression",
    "ratingPercent",
    "progressionLevel",
    "normalizedRating",
    "ratingColor",
    "ratingGradient",
    "powerPercent",
    "powerLevel",
    "normalizedPower",
    "powerColor",
    "powerGradient",
    "qualityMax",
    "capacityPercent",
    "capacityMeters",
    "capacityMaximumMeters",
    "condition",
    "conditionPercent",
    "effectiveStats",
  ]);

  migrate(source, definition = {}) {
    if (!source || typeof source !== "object") return source;
    const normalized = { ...source };
    const legacyStats = source.engineStats || {};
    const definitionStats = definition.gameplayStats || {};
    const itemType =
      source.itemType || definition.itemType || source.type || null;
    const variant =
      source.variant ||
      legacyStats.variant ||
      legacyStats.type ||
      (source.type && source.type !== itemType ? source.type : null) ||
      definition.variant ||
      null;
    const statOverrides = { ...(source.statOverrides || {}) };

    for (const [key, value] of Object.entries(legacyStats)) {
      if (["type", "variant", "level"].includes(key)) continue;
      statOverrides[key] = value;
    }
    for (const key of Object.keys(definitionStats)) {
      if (["type", "variant"].includes(key)) continue;
      if (!Object.prototype.hasOwnProperty.call(normalized, key)) continue;
      statOverrides[key] = normalized[key];
      delete normalized[key];
    }

    const legacyLevel = source.level ?? legacyStats.level;
    if (legacyLevel !== undefined && legacyLevel !== null) {
      if (this.#hasUpgradeLevels(source, legacyStats, definitionStats)) {
        this.#assignCanonicalLevel(
          statOverrides,
          "upgradeLevel",
          legacyLevel,
        );
      } else if (
        LegacyItemStateMigration.#equipmentPowerTypes.has(itemType) ||
        LegacyItemStateMigration.#equipmentPowerTypes.has(variant)
      ) {
        this.#assignCanonicalLevel(
          statOverrides,
          "equipmentPowerLevel",
          legacyLevel,
        );
      }
    }

    delete normalized.type;
    delete normalized.level;
    delete normalized.engineStats;
    for (const key of LegacyItemStateMigration.#derivedRuntimeKeys) {
      delete normalized[key];
    }
    normalized.itemType = itemType;
    if (variant) normalized.variant = variant;
    else delete normalized.variant;
    if (Object.keys(statOverrides).length > 0) {
      normalized.statOverrides = statOverrides;
    } else {
      delete normalized.statOverrides;
    }
    return normalized;
  }

  #hasUpgradeLevels(source, legacyStats, definitionStats) {
    return Boolean(
      source.statsByLevel ||
      source.statOverrides?.statsByLevel ||
      legacyStats.statsByLevel ||
      definitionStats.statsByLevel
    );
  }

  #assignCanonicalLevel(statOverrides, key, value) {
    if (statOverrides[key] === undefined) statOverrides[key] = value;
  }
}

globalThis.LegacyItemStateMigration = LegacyItemStateMigration;
