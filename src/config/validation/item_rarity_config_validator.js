class ItemRarityConfigValidator {
  static DEFAULT_NULL_PROFILE_TYPES = Object.freeze([
    "build_box",
    "build_template",
  ]);

  #errors = [];
  #supportedModes;
  #nullProfileTypes;

  constructor({
    supportedModes = ["authored"],
    nullProfileTypes = ItemRarityConfigValidator.DEFAULT_NULL_PROFILE_TYPES,
  } = {}) {
    this.#supportedModes = new Set(supportedModes);
    this.#nullProfileTypes = new Set(nullProfileTypes);
  }

  validate({ itemDb = {} } = {}) {
    this.#errors = [];
    const uniqueIds = new Set();
    for (const [categoryName, category] of Object.entries(itemDb || {})) {
      if (!category || typeof category !== "object") continue;
      for (const [itemKey, item] of Object.entries(category)) {
        const path = `ITEM_DB.${categoryName}.${itemKey}`;
        this.#validateItem(path, item, uniqueIds);
        this.#validateNoVisualOverrides(path, item);
      }
    }
    return this.#errors.slice();
  }

  assertValid(input = {}) {
    const issues = this.validate(input);
    if (issues.length === 0) return true;
    const details = issues
      .map((issue) => `- ${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid item rarity configuration:\n${details}`);
  }

  #validateItem(path, item, uniqueIds) {
    if (!item || typeof item !== "object") {
      this.#error(path, "expected item object");
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(item, "rarityProfile")) {
      this.#error(`${path}.rarityProfile`, "missing explicit rarityProfile");
      return;
    }

    const profile = item.rarityProfile;
    const itemType = String(item.itemType || "").trim();
    if (profile === null) {
      if (!this.#nullProfileTypes.has(itemType)) {
        this.#error(
          `${path}.rarityProfile`,
          `null rarityProfile is not allowed for item type: ${itemType}`,
        );
      }
      return;
    }
    if (!profile || typeof profile !== "object") {
      this.#error(`${path}.rarityProfile`, "expected object or allowlisted null");
      return;
    }

    const profilePath = `${path}.rarityProfile`;
    if (!this.#supportedModes.has(profile.mode)) {
      this.#error(`${profilePath}.mode`, `unsupported mode: ${profile.mode}`);
    }
    const tier = profile.tier;
    const maxTier = profile.maxTier;
    if (typeof tier !== "number" || !Number.isInteger(tier) || tier < 1) {
      this.#error(`${profilePath}.tier`, "expected integer >= 1");
    }
    if (
      typeof maxTier !== "number" ||
      !Number.isInteger(maxTier) ||
      maxTier < 1
    ) {
      this.#error(`${profilePath}.maxTier`, "expected integer >= 1");
    }
    if (
      typeof tier === "number" &&
      typeof maxTier === "number" &&
      Number.isInteger(tier) &&
      Number.isInteger(maxTier) &&
      tier > maxTier
    ) {
      this.#error(`${profilePath}.tier`, "must not exceed maxTier");
    }
    if (typeof profile.isUnique !== "boolean") {
      this.#error(`${profilePath}.isUnique`, "expected boolean");
    }

    const uniqueId = String(profile.uniqueId || "").trim();
    if (profile.isUnique === true) {
      if (!uniqueId) {
        this.#error(`${profilePath}.uniqueId`, "unique item requires uniqueId");
      } else if (uniqueIds.has(uniqueId)) {
        this.#error(`${profilePath}.uniqueId`, "duplicate uniqueId");
      } else {
        uniqueIds.add(uniqueId);
      }
    } else if (uniqueId) {
      this.#error(
        `${profilePath}.uniqueId`,
        "ordinary item must not define uniqueId",
      );
    }
  }

  #validateNoVisualOverrides(path, value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (this.#isForbiddenVisualKey(key)) {
        this.#error(
          `${path}.${key}`,
          "item must not define a hardcoded rarity color or visual effect",
        );
      }
      this.#validateNoVisualOverrides(`${path}.${key}`, child, seen);
    }
  }

  #isForbiddenVisualKey(key) {
    const normalized = String(key || "").replace(/[-_]/g, "").toLowerCase();
    return [
      "color",
      "colour",
      "csscolor",
      "bordercolor",
      "glowcolor",
      "raritycolor",
      "rarityvisual",
      "rarityframe",
    ].includes(normalized);
  }

  #error(path, message) {
    this.#errors.push({ path, message });
  }
}
