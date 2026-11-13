// Draws a config or catalog object as DevTools rows (spec 174 B2, moved from DevTools): nested objects become sections,
// scalars become the control their DevParameterSchema description names (segments, list, switch, number, text),
// number arrays a text row; keys that are not editable data are skipped. Every row edits through the edit service
// and is inactive while a switch it depends on is off (TK-292).
const EXCLUDED_KEYS = Object.freeze(["id", "name", "icon", "backgroundAssets", "depthAsset", "endpoint", "backgroundColor",
  "colorGradient", "statuses"]);
// Legacy HOOKED_FISH fields the panel no longer shows (their profiles are edited instead).
const HOOKED_FISH_LEGACY_KEYS = new Set(["weight", "level", "maxLevel", "resistance", "biteSequence"]);
const HOOKED_FISH_PHYSICS_COMPATIBILITY_KEYS = new Set(["basePower", "baseStamina", "levelBasePower", "staminaWeightMultiplier",
  "minStaminaActivityMultiplier", "exhaustedSpeedRatio", "baseSpeedMetersPerSec", "agility", "bounceCooldownMs",
  "dirChangeMinMs", "dirChangeMaxMs", "lastDashTrigger", "behaviors", "pullResistance", "fishRetrieve"]);
const SCALAR_TYPES = new Set(["number", "boolean", "string"]);

export class ConfigTreeRenderer {
  #ui;
  #schema;
  #aliases;
  #edits;
  #createSection;

  // createSection(label, parent, path) -> the content element of a remembered disclosure.
  constructor({ ui, schema, aliases, edits, createSection }) {
    this.#ui = ui;
    this.#schema = schema;
    this.#aliases = aliases;
    this.#edits = edits;
    this.#createSection = createSection;
  }

  // Keys of a catalog that are no data group (the shop and the database skip them as well).
  static isExcludedKey(key) {
    return EXCLUDED_KEYS.includes(key);
  }

  // Whether obj[key] under path is not drawn (not editable data, or drawn in its own section elsewhere).
  skips(path, key, options = {}) {
    return this.#shouldSkipKey(path, key, options);
  }

  // options: { visibilityPolicy, applyHookedFishLegacySkips, groupedDebug }
  render(obj, parentElement, path, options = {}) {
    for (const key in obj) {
      if (this.#shouldSkipKey(path, key, options)) continue;
      const value = obj[key];
      const currentPath = [...path, key];
      if (options.visibilityPolicy?.isVisible?.(currentPath, value) === false) continue;

      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === "number") {
          this.#ui.addParameter(parentElement, { control: "numberList", label: this.#formatKey(key, currentPath), value,
            onCommit: (next) => this.#edits.update(currentPath, next), path: currentPath });
        } else if (value.length > 0 && typeof value[0] === "object") {
          const content = this.#createSection(key, parentElement, currentPath);
          value.forEach((item, index) => {
            const itemLabel = item.id || item.variant || item.itemType || `Item [${index}]`;
            const itemContent = this.#createSection(itemLabel, content, [...currentPath, index]);
            this.render(item, itemContent, [...currentPath, index], options);
          });
        }
      } else if (value !== null && typeof value === "object") {
        this.render(value, this.#createSection(key, parentElement, currentPath), currentPath, options);
      } else if (SCALAR_TYPES.has(typeof value)) {
        this.renderScalar({ key, value, parentElement, displayPath: currentPath, canonicalPath: currentPath });
      }
    }
    this.#renderAliases(obj, parentElement, path);
  }

  // The dotted paths of every visible scalar under obj: the shape of the hooked fish's tree, to tell when it must be drawn
  // again.
  visibleScalarPaths(obj, path, options = {}) {
    const output = [];
    this.#collect(obj, path, output, options);
    return output;
  }

  renderScalar({ key, value, parentElement, displayPath, canonicalPath }) {
    // TK-283: parameters with a list of values are described in one place (DevParameterSchema).
    const described = this.#schema.describe(canonicalPath, value);
    const control = described?.control ?? (typeof value === "boolean" ? "switch" : typeof value === "number" ? "number" : "text");
    this.#ui.addParameter(parentElement, {
      control,
      label: this.#formatKey(key, canonicalPath),
      value,
      options: described?.options,
      onCommit: (next) => this.#edits.update(canonicalPath, next),
      path: displayPath,
      bindingPath: canonicalPath,
      // TK-292: the switches this parameter depends on; its row is inactive while one of them is off.
      requires: this.#prerequisites(canonicalPath),
      // Spec 174 C3: a value changed in this session is marked and can be put back to the code's one by one.
      isChanged: () => this.#edits.isOverridden(canonicalPath),
      onReset: () => this.#edits.resetParameter(canonicalPath),
    });
  }

  #collect(obj, path, output, options) {
    if (!obj || typeof obj !== "object") return;
    for (const key in obj) {
      if (this.#shouldSkipKey(path, key, options)) continue;
      const value = obj[key];
      const currentPath = [...path, key];
      if (options.visibilityPolicy?.isVisible?.(currentPath, value) === false) continue;
      if (value && typeof value === "object") this.#collect(value, currentPath, output, options);
      else if (SCALAR_TYPES.has(typeof value)) output.push(currentPath.join("."));
    }
  }

  // Spec 131 prerequisites of a parameter, read live (DevParameterSchema names the switches).
  #prerequisites(canonicalPath) {
    const read = (path) => this.#edits.read(path);
    return this.#schema.prerequisitesOf(canonicalPath, read)
      .map((path) => ({ path, isEnabled: () => read(path) === true }));
  }

  // The label of a key (spec 174 C3: a changed value is marked by its row, not by a "*" in its label).
  #formatKey(key, path) {
    return path.join(".") === "CONFIG.debug.timeAccelerationEnabled" ? "Прискорення часу" : key;
  }

  #renderAliases(obj, parentElement, parentPath) {
    for (const alias of this.#aliases.getAliasesForParent(parentPath)) {
      if (Object.prototype.hasOwnProperty.call(obj, alias.key)) continue;
      const value = this.#edits.read(alias.canonicalPath);
      if (!SCALAR_TYPES.has(typeof value)) continue;
      this.renderScalar({ key: alias.key, value, parentElement, displayPath: alias.displayPath,
        canonicalPath: alias.canonicalPath });
    }
  }

  #shouldSkipKey(path, key, options) {
    if (options.groupedDebug && path.join(".") === "CONFIG.debug" &&
      (key.startsWith("overlay") || key === "inventory" || key === "inventorySplit")) return true;
    if (!options.visibilityPolicy && EXCLUDED_KEYS.includes(key)) return true;
    if (path[0] === "CONFIG" && path.length === 1 && key === "debug") return true;
    if (options.applyHookedFishLegacySkips !== false && path[0] === "HOOKED_FISH") {
      if (HOOKED_FISH_LEGACY_KEYS.has(key)) return true;
      if (path[1] === "physics" && HOOKED_FISH_PHYSICS_COMPATIBILITY_KEYS.has(key)) return true;
    }
    return (path[0] === "CONFIG" && path[1] === "locations" && key === "map") ||
      (path[0] === "CONFIG" && path[1] === "spawns" && key === "fishes");
  }
}
