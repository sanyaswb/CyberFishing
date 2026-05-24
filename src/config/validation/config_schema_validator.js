class ConfigValidationResult {
  constructor({ errors = [], warnings = [], summary = {} } = {}) {
    this.errors = errors;
    this.warnings = warnings;
    this.summary = summary;
  }

  get ok() {
    return this.errors.length === 0;
  }
}

class ConfigSchemaValidator {
  static FORBIDDEN_FLAT_FISH_PHYSICS_KEYS = Object.freeze([
    "basePower",
    "baseStamina",
    "maxSpeedMetersPerSec",
    "speedForceMultiplier",
    "waterResistanceMultiplier",
    "minPowerRatio",
    "agility",
    "bounceCooldownMs",
    "dirChangeMinMs",
    "dirChangeMaxMs",
    "lastDashTrigger",
    "behaviors",
    "pullResistance",
  ]);

  constructor({
    config = {},
    fishDb = [],
    itemDb = {},
    mapDb = {},
    parameterLabels = {},
    namingConvention = null,
  } = {}) {
    this.config = config || {};
    this.fishDb = Array.isArray(fishDb) ? fishDb : [];
    this.itemDb = itemDb || {};
    this.mapDb = mapDb || {};
    this.parameterLabels = parameterLabels || {};
    this.namingConvention = namingConvention ||
      (typeof PHYSICS_UNITS_AND_NAMING !== "undefined"
        ? PHYSICS_UNITS_AND_NAMING
        : null);
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    this.errors = [];
    this.warnings = [];

    this.#validateProjectVersion();
    this.#validatePhysicsConfig();
    this.#validateFishDb();
    this.#validateItemDb();
    this.#validateMapDb();

    return new ConfigValidationResult({
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        physicsLeaves: this.#collectLeaves(this.config.physics, "physics").length,
        fishCount: this.fishDb.length,
        itemCount: this.#countItemRecords(this.itemDb),
        mapCount: Object.keys(this.mapDb || {}).length,
      },
    });
  }

  #validateProjectVersion() {
    if (typeof PROJECT_VERSION_CONFIG === "undefined") {
      this.#warn("project.version", "PROJECT_VERSION_CONFIG is not loaded");
      return;
    }

    this.#requireNonEmptyString(
      "PROJECT_VERSION_CONFIG.version",
      PROJECT_VERSION_CONFIG.version,
    );
    this.#requirePattern(
      "PROJECT_VERSION_CONFIG.version",
      PROJECT_VERSION_CONFIG.version,
      /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/,
      "expected semantic patch version like 0.17.4",
    );
  }

  #validatePhysicsConfig() {
    const physics = this.config.physics;
    if (!physics || typeof physics !== "object") {
      this.#error("CONFIG.physics", "missing physics config object");
      return;
    }

    for (const { path, value, parentPath } of this.#collectLeaves(physics, "physics")) {
      if (typeof value === "number") {
        this.#requireFiniteNumber(path, value);
        this.#warnIfPhysicsNameIsTooVague(path);
      }
      if (typeof value === "boolean" || typeof value === "number") {
        if (!this.#hasParameterLabel(path, parentPath)) {
          this.#error(path, "missing parameter label in parameter_labels.json");
        }
      }
    }

    this.#validateMinMaxPairs(physics, "physics");
  }

  #validateFishDb() {
    if (!Array.isArray(this.fishDb) || this.fishDb.length === 0) {
      this.#error("FISH_DB", "must be a non-empty array");
      return;
    }

    const ids = new Set();
    for (const fish of this.fishDb) {
      const fishPath = `FISH_DB.${fish?.id || "<missing-id>"}`;
      this.#requireNonEmptyString(`${fishPath}.id`, fish?.id);
      this.#requireNonEmptyString(`${fishPath}.name`, fish?.name);
      if (fish?.id) {
        if (ids.has(fish.id)) this.#error(`${fishPath}.id`, "duplicate fish id");
        ids.add(fish.id);
      }

      this.#requireFiniteNumber(`${fishPath}.baseChance`, fish?.baseChance, {
        min: 0,
      });
      this.#requireFiniteNumber(`${fishPath}.maxHookSize`, fish?.maxHookSize, {
        min: 0,
      });
      this.#validateFiniteNumberLeaves(fish, fishPath);
      this.#validateFishPhysics(fishPath, fish?.physics);
      this.#validateWeightConfig(fishPath, fish?.weightConfig);
    }
  }

  #validateFishPhysics(fishPath, physics) {
    if (!physics || typeof physics !== "object") {
      this.#error(`${fishPath}.physics`, "missing fish physics object");
      return;
    }

    const requiredProfiles = [
      "forceProfile",
      "staminaProfile",
      "movementProfile",
      "resistanceProfile",
      "retrieveProfile",
      "behaviorProfile",
    ];
    for (const profileName of requiredProfiles) {
      if (!physics[profileName] || typeof physics[profileName] !== "object") {
        this.#error(`${fishPath}.physics.${profileName}`, "missing structured profile");
      }
    }

    for (const key of ConfigSchemaValidator.FORBIDDEN_FLAT_FISH_PHYSICS_KEYS) {
      if (Object.prototype.hasOwnProperty.call(physics, key)) {
        this.#error(
          `${fishPath}.physics.${key}`,
          "legacy flat fish physics field must not be stored in FISH_DB.physics",
        );
      }
    }

    this.#requireFiniteNumber(`${fishPath}.physics.forceProfile.basePower`, physics.forceProfile?.basePower, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.forceProfile.minPowerRatio`, physics.forceProfile?.minPowerRatio, { min: 0, max: 1 });
    this.#requireFiniteNumber(`${fishPath}.physics.staminaProfile.baseStamina`, physics.staminaProfile?.baseStamina, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.movementProfile.maxSpeedMetersPerSec`, physics.movementProfile?.maxSpeedMetersPerSec, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.movementProfile.agility`, physics.movementProfile?.agility, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.resistanceProfile.speedForceMultiplier`, physics.resistanceProfile?.speedForceMultiplier, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.resistanceProfile.waterResistanceMultiplier`, physics.resistanceProfile?.waterResistanceMultiplier, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.retrieveProfile.passiveBodyResistanceMultiplier`, physics.retrieveProfile?.passiveBodyResistanceMultiplier, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.retrieveProfile.activeAwayMultiplier`, physics.retrieveProfile?.activeAwayMultiplier, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.retrieveProfile.waterDragMultiplier`, physics.retrieveProfile?.waterDragMultiplier, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.retrieveProfile.referencePullSpeedMultiplier`, physics.retrieveProfile?.referencePullSpeedMultiplier, { min: 0 });

    const behaviors = physics.behaviorProfile?.behaviors;
    if (!behaviors || typeof behaviors !== "object") {
      this.#error(`${fishPath}.physics.behaviorProfile.behaviors`, "missing behavior map");
    } else {
      for (const [behaviorName, behavior] of Object.entries(behaviors)) {
        const path = `${fishPath}.physics.behaviorProfile.behaviors.${behaviorName}`;
        this.#requireFiniteNumber(`${path}.powerRatio`, behavior.powerRatio, { min: 0 });
        this.#requireFiniteNumber(`${path}.speedRatio`, behavior.speedRatio, { min: 0 });
        this.#requireFiniteNumber(`${path}.minTime`, behavior.minTime, { min: 0 });
        this.#requireFiniteNumber(`${path}.maxTime`, behavior.maxTime, { min: 0 });
        this.#requireFiniteNumber(`${path}.weight`, behavior.weight, { min: 0 });
        this.#requireMinLessOrEqualMax(`${path}.minTime`, behavior.minTime, `${path}.maxTime`, behavior.maxTime);
      }
    }
  }

  #validateWeightConfig(fishPath, weightConfig) {
    if (!weightConfig || typeof weightConfig !== "object") {
      this.#error(`${fishPath}.weightConfig`, "missing weight config");
      return;
    }
    this.#requireFiniteNumber(`${fishPath}.weightConfig.rarityCurve`, weightConfig.rarityCurve, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.weightConfig.maxLevel`, weightConfig.maxLevel, { min: 1 });

    if (Array.isArray(weightConfig.levelWeightRanges)) {
      for (const [index, range] of weightConfig.levelWeightRanges.entries()) {
        const path = `${fishPath}.weightConfig.levelWeightRanges[${index}]`;
        this.#requireFiniteNumber(`${path}.level`, range.level, { min: 1 });
        this.#requireFiniteNumber(`${path}.min`, range.min, { min: 0 });
        this.#requireFiniteNumber(`${path}.max`, range.max, { min: 0 });
        this.#requireFiniteNumber(`${path}.basePower`, range.basePower, { min: 0 });
        this.#requireMinLessOrEqualMax(`${path}.min`, range.min, `${path}.max`, range.max);
      }
    }
  }

  #validateItemDb() {
    if (!this.itemDb || typeof this.itemDb !== "object") {
      this.#error("ITEM_DB", "must be an object");
      return;
    }

    for (const [categoryName, category] of Object.entries(this.itemDb)) {
      if (!category || typeof category !== "object") continue;
      for (const [itemKey, item] of Object.entries(category)) {
        const path = `ITEM_DB.${categoryName}.${itemKey}`;
        this.#requireNonEmptyString(`${path}.id`, item?.id);
        this.#requireNonEmptyString(`${path}.name`, item?.name);
        this.#requireNonEmptyString(`${path}.type`, item?.type);
        this.#validateFiniteNumberLeaves(item, path);
        this.#validateMinMaxPairs(item, path);
      }
    }
  }

  #validateMapDb() {
    if (!this.mapDb || typeof this.mapDb !== "object") {
      this.#error("MAP_DB", "must be an object");
      return;
    }

    for (const [mapKey, map] of Object.entries(this.mapDb)) {
      const path = `MAP_DB.${mapKey}`;
      this.#requireNonEmptyString(`${path}.id`, map?.id);
      this.#requireNonEmptyString(`${path}.name`, map?.name);
      this.#validateFiniteNumberLeaves(map, path);
      this.#validateMinMaxPairs(map, path);
      this.#requireFiniteNumber(`${path}.depthBounds.min`, map?.depthBounds?.min, { min: 0 });
      this.#requireFiniteNumber(`${path}.depthBounds.max`, map?.depthBounds?.max, { min: 0 });
      this.#requireMinLessOrEqualMax(`${path}.depthBounds.min`, map?.depthBounds?.min, `${path}.depthBounds.max`, map?.depthBounds?.max);
      if (map?.environment?.current) {
        this.#requireFiniteNumber(`${path}.environment.current.speedPxPerSec`, map.environment.current.speedPxPerSec, { min: 0 });
      }
    }
  }

  #validateFiniteNumberLeaves(object, basePath) {
    for (const { path, value } of this.#collectLeaves(object, basePath)) {
      if (typeof value !== "number") continue;
      if (this.#isAllowedOpenEndedNumber(path, value)) {
        this.#warn(path, "uses Infinity as an open-ended range boundary");
        continue;
      }
      this.#requireFiniteNumber(path, value);
    }
  }

  #validateMinMaxPairs(object, basePath) {
    if (!object || typeof object !== "object") return;

    if (Array.isArray(object)) {
      object.forEach((value, index) => this.#validateMinMaxPairs(value, `${basePath}[${index}]`));
      return;
    }

    const entries = Object.entries(object);
    const localKeys = new Map(entries.map(([key, value]) => [key.toLowerCase(), { key, value }]));
    for (const [key, value] of entries) {
      if (/^min[A-Z_]?|^min$/u.test(key)) {
        const suffix = key === "min" ? "" : key.slice(3);
        const maxEntry = localKeys.get((suffix ? `max${suffix}` : "max").toLowerCase());
        if (maxEntry) {
          this.#requireMinLessOrEqualMax(
            `${basePath}.${key}`,
            value,
            `${basePath}.${maxEntry.key}`,
            maxEntry.value,
          );
        }
      }
      if (value && typeof value === "object") {
        this.#validateMinMaxPairs(value, `${basePath}.${key}`);
      }
    }
  }

  #collectLeaves(object, basePath, output = []) {
    if (object && typeof object === "object") {
      if (Array.isArray(object)) {
        object.forEach((value, index) => {
          this.#collectLeaves(value, `${basePath}[${index}]`, output);
        });
        return output;
      }

      for (const [key, value] of Object.entries(object)) {
        this.#collectLeaves(value, basePath ? `${basePath}.${key}` : key, output);
      }
      return output;
    }

    const parentPath = basePath.includes(".")
      ? basePath.slice(0, basePath.lastIndexOf("."))
      : "";
    output.push({ path: basePath, parentPath, value: object });
    return output;
  }

  #hasParameterLabel(path, parentPath) {
    if (this.parameterLabels[path]) return true;
    if (this.parameterLabels[parentPath]) return true;

    const arrayParent = path.replace(/\[\d+\]/gu, "");
    if (this.parameterLabels[arrayParent]) return true;

    const withoutIndexLeaf = path.replace(/\[\d+\]$/u, "");
    return !!this.parameterLabels[withoutIndexLeaf];
  }

  #warnIfPhysicsNameIsTooVague(path) {
    const key = path.split(".").pop() || "";
    if (!this.namingConvention) return;
    if (/^[a-z]+$/u.test(key) && ["force", "speed", "resistance", "distance", "power"].includes(key)) {
      this.#warn(path, "physics parameter name is too vague; add unit/context suffix");
    }
  }

  #isAllowedOpenEndedNumber(path, value) {
    return value === Infinity && /(\.|\])max$/u.test(path);
  }

  #countItemRecords(itemDb) {
    let count = 0;
    for (const category of Object.values(itemDb || {})) {
      if (category && typeof category === "object") count += Object.keys(category).length;
    }
    return count;
  }

  #requireFiniteNumber(path, value, { min = -Infinity, max = Infinity } = {}) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      this.#error(path, `expected finite number, got ${value}`);
      return false;
    }
    if (parsed < min) this.#error(path, `expected >= ${min}, got ${parsed}`);
    if (parsed > max) this.#error(path, `expected <= ${max}, got ${parsed}`);
    return true;
  }

  #requireNonEmptyString(path, value) {
    if (typeof value !== "string" || value.trim() === "") {
      this.#error(path, "expected non-empty string");
      return false;
    }
    return true;
  }

  #requirePattern(path, value, pattern, message) {
    if (typeof value !== "string" || !pattern.test(value)) {
      this.#error(path, message);
    }
  }

  #requireMinLessOrEqualMax(minPath, minValue, maxPath, maxValue) {
    const min = Number(minValue);
    const max = Number(maxValue);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return;
    if (min > max) this.#error(`${minPath} / ${maxPath}`, `min ${min} must be <= max ${max}`);
  }

  #error(path, message) {
    this.errors.push({ path, message });
  }

  #warn(path, message) {
    this.warnings.push({ path, message });
  }
}
