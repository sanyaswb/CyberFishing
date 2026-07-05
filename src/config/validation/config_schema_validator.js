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
    this.#validateImmutableBaseConfig();
    this.#validatePhysicsConfig();
    this.#validateLocationDebugConfig();
    this.#validateStaminaMechanicsConfig();
    this.#validateFishCategories();
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


  #validateImmutableBaseConfig() {
    if (typeof BASE_CONFIG === "undefined") {
      this.#error("BASE_CONFIG", "missing immutable base config snapshot");
      return;
    }
    if (!Object.isFrozen(BASE_CONFIG)) {
      this.#error("BASE_CONFIG", "base config must be frozen");
    }
    if (BASE_CONFIG.physics && !Object.isFrozen(BASE_CONFIG.physics)) {
      this.#error("BASE_CONFIG.physics", "base physics config must be deeply frozen");
    }
    if (typeof CONFIG_OVERRIDE_STORE === "undefined" || !CONFIG_OVERRIDE_STORE) {
      this.#error("CONFIG_OVERRIDE_STORE", "missing runtime override store");
    }
  }

  #validateFishCategories() {
    if (typeof FISH_CATEGORIES === "undefined") {
      this.#error("FISH_CATEGORIES", "missing fish category registry");
      return;
    }
    const seen = new Set();
    for (const [categoryName, fishList] of Object.entries(FISH_CATEGORIES)) {
      if (!Array.isArray(fishList)) {
        this.#error(`FISH_CATEGORIES.${categoryName}`, "category must be an array");
        continue;
      }
      for (const fish of fishList) {
        if (!fish?.id) continue;
        if (seen.has(fish.id)) {
          this.#error(`FISH_CATEGORIES.${categoryName}.${fish.id}`, "duplicate fish id across categories");
        }
        seen.add(fish.id);
      }
    }
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
    this.#validatePlayerPressureFatigueConfig();
    this.#validatePlayerPressureGainConfig();
    this.#validatePlayerTensionBuildRateConfig();
  }

  #validatePlayerPressureGainConfig() {
    const config = this.config.physics?.fight?.playerPressureGain;
    if (!config || typeof config !== "object") {
      this.#error(
        "physics.fight.playerPressureGain",
        "missing player pressure gain config",
      );
      return;
    }

    this.#requireBooleanWithLabel(
      "physics.fight.playerPressureGain.enabled",
      config.enabled,
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureGain.inputThresholds.holdForceKg",
      config.inputThresholds?.holdForceKg,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureGain.inputThresholds.controlInputRatio",
      config.inputThresholds?.controlInputRatio,
      { min: 0, max: 1 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureGain.inputThresholds.controlForceKg",
      config.inputThresholds?.controlForceKg,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureGain.multipliers.holdOnly",
      config.multipliers?.holdOnly,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureGain.multipliers.controlOnly",
      config.multipliers?.controlOnly,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureGain.multipliers.holdAndControl",
      config.multipliers?.holdAndControl,
      { min: 0 },
    );
  }

  #validatePlayerTensionBuildRateConfig() {
    const config = this.config.physics?.fight?.playerTensionBuildRate;
    if (!config || typeof config !== "object") {
      this.#error(
        "physics.fight.playerTensionBuildRate",
        "missing player tension build rate config",
      );
      return;
    }

    this.#requireBooleanWithLabel(
      "physics.fight.playerTensionBuildRate.enabled",
      config.enabled,
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerTensionBuildRate.rodControlBuildPerSecond",
      config.rodControlBuildPerSecond,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerTensionBuildRate.inputThresholds.holdForceKg",
      config.inputThresholds?.holdForceKg,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerTensionBuildRate.inputThresholds.controlForceKg",
      config.inputThresholds?.controlForceKg,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerTensionBuildRate.inputThresholds.holdInputRatio",
      config.inputThresholds?.holdInputRatio,
      { min: 0, max: 1 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerTensionBuildRate.inputThresholds.controlInputRatio",
      config.inputThresholds?.controlInputRatio,
      { min: 0, max: 1 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerTensionBuildRate.multipliers.none",
      config.multipliers?.none,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerTensionBuildRate.multipliers.holdOnly",
      config.multipliers?.holdOnly,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerTensionBuildRate.multipliers.controlOnly",
      config.multipliers?.controlOnly,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerTensionBuildRate.multipliers.holdAndControl",
      config.multipliers?.holdAndControl,
      { min: 0 },
    );
    this.#requireBooleanWithLabel(
      "physics.fight.playerTensionBuildRate.applyTo.rodHoldCharge",
      config.applyTo?.rodHoldCharge,
    );
    this.#requireBooleanWithLabel(
      "physics.fight.playerTensionBuildRate.applyTo.rodControlBuild",
      config.applyTo?.rodControlBuild,
    );
  }

  #validatePlayerPressureFatigueConfig() {
    const config = this.config.physics?.fight?.playerPressureFatigue;
    if (!config || typeof config !== "object") {
      this.#error(
        "physics.fight.playerPressureFatigue",
        "missing player pressure fatigue config",
      );
      return;
    }

    this.#requireBooleanWithLabel(
      "physics.fight.playerPressureFatigue.enabled",
      config.enabled,
    );
    if ((config.source?.mode || "reel_hold") !== "reel_hold") {
      this.#error(
        "physics.fight.playerPressureFatigue.source.mode",
        "unsupported player pressure fatigue source mode",
      );
    }
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.pressureThresholdKg",
      config.pressureThresholdKg,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.graceDurationMs",
      config.graceDurationMs,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.fatigueDurationMs",
      config.fatigueDurationMs,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.minEfficiency",
      config.minEfficiency,
      { min: 0, max: 1 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.curvePower",
      config.curvePower,
      { min: 0 },
    );
    this.#requireBooleanWithLabel(
      "physics.fight.playerPressureFatigue.controlBreak.enabled",
      config.controlBreak?.enabled,
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.controlBreak.fatigueProgressThreshold",
      config.controlBreak?.fatigueProgressThreshold,
      { min: 0, max: 1 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.controlBreak.minContinuousPressureMs",
      config.controlBreak?.minContinuousPressureMs,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.recovery.delayAfterPressureMs",
      config.recovery?.delayAfterPressureMs,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.recovery.recoveryPerSecond",
      config.recovery?.recoveryPerSecond,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.recovery.holdCompleteVisibleMs",
      config.recovery?.holdCompleteVisibleMs,
      { min: 0 },
    );
    this.#requireBooleanWithLabel(
      "physics.fight.playerPressureFatigue.channels.rodHold",
      config.channels?.rodHold,
    );
    this.#requireBooleanWithLabel(
      "physics.fight.playerPressureFatigue.channels.rodControl",
      config.channels?.rodControl,
    );
    this.#requireBooleanWithLabel(
      "physics.fight.playerPressureFatigue.visual.enabled",
      config.visual?.enabled,
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.visual.position.offsetX",
      config.visual?.position?.offsetX,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.visual.position.offsetY",
      config.visual?.position?.offsetY,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.visual.radius",
      config.visual?.radius,
      { min: 1 },
    );
    this.#requireFiniteNumberWithLabel(
      "physics.fight.playerPressureFatigue.visual.ringWidth",
      config.visual?.ringWidth,
      { min: 1 },
    );
    this.#requireBooleanWithLabel(
      "physics.fight.playerPressureFatigue.visual.idleVisible",
      config.visual?.idleVisible,
    );
  }

  #validateLocationDebugConfig() {
    const locations = this.config.locations || {};
    const keys = [
      "showPoleFightSector",
      "showFightLineRadius",
    ];
    for (const key of keys) {
      const path = `locations.${key}`;
      if (typeof locations[key] !== "boolean") {
        this.#error(path, "expected boolean location debug toggle");
      }
      if (!this.#hasParameterLabel(path, "locations")) {
        this.#error(path, "missing parameter label in parameter_labels.json");
      }
    }
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
    if (Object.prototype.hasOwnProperty.call(physics, "resistanceProfile")) {
      this.#error(`${fishPath}.physics.resistanceProfile`, "old resistanceProfile is not part of simplified fight physics");
    }
    if (Object.prototype.hasOwnProperty.call(physics, "retrieveProfile")) {
      this.#error(`${fishPath}.physics.retrieveProfile`, "old retrieveProfile is not part of simplified fight physics");
    }

    this.#requireFiniteNumber(`${fishPath}.physics.forceProfile.basePower`, physics.forceProfile?.basePower, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.staminaProfile.baseStamina`, physics.staminaProfile?.baseStamina, { min: 0 });
    if (Object.prototype.hasOwnProperty.call(Object(physics.staminaProfile), "staminaBossMultiplier")) {
      this.#requireFiniteNumber(`${fishPath}.physics.staminaProfile.staminaBossMultiplier`, physics.staminaProfile?.staminaBossMultiplier, { min: 0 });
    }
    if (Object.prototype.hasOwnProperty.call(Object(physics.staminaProfile), "staminaRatioFromEndurance")) {
      this.#requireFiniteNumber(`${fishPath}.physics.staminaProfile.staminaRatioFromEndurance`, physics.staminaProfile?.staminaRatioFromEndurance, { min: 0 });
    }
    this.#requireFiniteNumber(`${fishPath}.physics.movementProfile.baseSpeed`, physics.movementProfile?.baseSpeed, { min: 0 });
    this.#requireFiniteNumber(`${fishPath}.physics.movementProfile.agility`, physics.movementProfile?.agility, { min: 0 });
    if (Object.prototype.hasOwnProperty.call(Object(physics.movementProfile), "radialRange")) {
      this.#requireNumericRange(
        `${fishPath}.physics.movementProfile.radialRange`,
        physics.movementProfile.radialRange,
      );
    }
    if (Object.prototype.hasOwnProperty.call(Object(physics.movementProfile), "lateralRange")) {
      this.#requireNumericRange(
        `${fishPath}.physics.movementProfile.lateralRange`,
        physics.movementProfile.lateralRange,
      );
    }

    const behaviors = physics.behaviorProfile?.behaviors;
    if (!behaviors || typeof behaviors !== "object") {
      this.#error(`${fishPath}.physics.behaviorProfile.behaviors`, "missing behavior map");
    } else {
      for (const [behaviorName, behavior] of Object.entries(behaviors)) {
        const path = `${fishPath}.physics.behaviorProfile.behaviors.${behaviorName}`;
        this.#requireFiniteNumber(`${path}.forceMultiplier`, behavior.forceMultiplier, { min: 0 });
        this.#requireFiniteNumber(`${path}.speedMultiplier`, behavior.speedMultiplier, { min: 0 });
        if (Object.prototype.hasOwnProperty.call(Object(behavior), "powerRatio")) {
          this.#error(`${path}.powerRatio`, "old powerRatio must be replaced by forceMultiplier");
        }
        if (Object.prototype.hasOwnProperty.call(Object(behavior), "speedRatio")) {
          this.#error(`${path}.speedRatio`, "old speedRatio must be replaced by speedMultiplier");
        }
        this.#requireFiniteNumber(`${path}.minTime`, behavior.minTime, { min: 0 });
        this.#requireFiniteNumber(`${path}.maxTime`, behavior.maxTime, { min: 0 });
        this.#requireFiniteNumber(`${path}.weight`, behavior.weight, { min: 0 });
        this.#requireMinLessOrEqualMax(`${path}.minTime`, behavior.minTime, `${path}.maxTime`, behavior.maxTime);
        if (behavior.direction && typeof behavior.direction === "object") {
          if (Object.prototype.hasOwnProperty.call(behavior.direction, "radialRange")) {
            this.#requireNumericRange(
              `${path}.direction.radialRange`,
              behavior.direction.radialRange,
            );
          }
          if (Object.prototype.hasOwnProperty.call(behavior.direction, "lateralRange")) {
            this.#requireNumericRange(
              `${path}.direction.lateralRange`,
              behavior.direction.lateralRange,
            );
          }
          if (Object.prototype.hasOwnProperty.call(behavior.direction, "agility")) {
            this.#requireFiniteNumber(
              `${path}.direction.agility`,
              behavior.direction.agility,
              { min: 0 },
            );
          }
        }
      }
    }
  }

  #validateStaminaMechanicsConfig() {
    const mechanics = this.config.stamina?.mechanics || {};
    this.#validateSimplifiedStaminaModelConfig(mechanics);
    const powerDebuff = mechanics.powerDebuff || {};
    if (!powerDebuff || typeof powerDebuff !== "object") {
      this.#error(
        "stamina.mechanics.powerDebuff",
        "missing frame-based power debuff config",
      );
    } else {
      this.#requireBooleanWithLabel(
        "stamina.mechanics.powerDebuff.enabled",
        powerDebuff.enabled,
      );
      this.#requireFiniteNumberWithLabel(
        "stamina.mechanics.powerDebuff.minBasePowerRatio",
        powerDebuff.minBasePowerRatio,
        { min: 0, max: 1 },
      );
      this.#requireFiniteNumberWithLabel(
        "stamina.mechanics.powerDebuff.curvePower",
        powerDebuff.curvePower,
        { min: 0 },
      );
    }

    const config = mechanics.enduranceMovementDebuff;
    if (!config || typeof config !== "object") {
      this.#error(
        "stamina.mechanics.enduranceMovementDebuff",
        "missing endurance movement debuff config",
      );
      return;
    }

    this.#requireBooleanWithLabel(
      "stamina.mechanics.enduranceMovementDebuff.enabled",
      config.enabled,
    );
    this.#requireFiniteNumberWithLabel(
      "stamina.mechanics.enduranceMovementDebuff.curvePower",
      config.curvePower,
      { min: 0 },
    );

    const direction = config.direction || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.enduranceMovementDebuff.direction.enabled",
      direction.enabled,
    );
    this.#requireNumericRangeWithLabel(
      "stamina.mechanics.enduranceMovementDebuff.direction.exhaustedRadialRange",
      direction.exhaustedRadialRange,
    );

    const behaviorWeights = config.behaviorWeights || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.enduranceMovementDebuff.behaviorWeights.enabled",
      behaviorWeights.enabled,
    );
    const multipliers = behaviorWeights.multipliersAtZeroEndurance || {};
    for (const behaviorName of ["dash", "lastDash", "swim", "idle", "rest"]) {
      this.#requireFiniteNumberWithLabel(
        `stamina.mechanics.enduranceMovementDebuff.behaviorWeights.multipliersAtZeroEndurance.${behaviorName}`,
        multipliers[behaviorName],
        { min: 0 },
      );
    }

    const enduranceRecovery = mechanics.enduranceRecovery || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.enduranceRecovery.enabled",
      enduranceRecovery.enabled,
    );
    this.#requireBooleanWithLabel(
      "stamina.mechanics.enduranceRecovery.requiresFullStamina",
      enduranceRecovery.requiresFullStamina,
    );
    this.#requireFiniteNumberWithLabel(
      "stamina.mechanics.enduranceRecovery.recoveryPerSecond",
      enduranceRecovery.recoveryPerSecond,
      { min: 0 },
    );
    this.#requireFiniteNumberWithLabel(
      "stamina.mechanics.enduranceRecovery.maxRecoveryRatio",
      enduranceRecovery.maxRecoveryRatio,
      { min: 0, max: 1 },
    );
  }

  #validateSimplifiedStaminaModelConfig(mechanics) {
    const simplifiedModel = mechanics.simplifiedModel || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.simplifiedModel.enabled",
      simplifiedModel.enabled,
    );

    const pressure = mechanics.pressure || {};
    this.#requireFiniteNumberWithLabel(
      "stamina.mechanics.pressure.thresholdKg",
      pressure.thresholdKg,
      { min: 0 },
    );
    const inputWeights = pressure.inputWeights || {};
    for (const key of ["rodHold", "reelHold", "control"]) {
      this.#requireFiniteNumberWithLabel(
        `stamina.mechanics.pressure.inputWeights.${key}`,
        inputWeights[key],
        { min: 0 },
      );
    }

    const lateral = pressure.lateralPositionWeights || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.pressure.lateralPositionWeights.enabled",
      lateral.enabled,
    );
    for (const key of [
      "centerHoldMultiplier",
      "edgeHoldMultiplier",
      "centerControlMultiplier",
      "edgeControlMultiplier",
      "curvePower",
    ]) {
      this.#requireFiniteNumberWithLabel(
        `stamina.mechanics.pressure.lateralPositionWeights.${key}`,
        lateral[key],
        { min: 0 },
      );
    }

    const controlDirection = pressure.controlDirection || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.pressure.controlDirection.enabled",
      controlDirection.enabled,
    );
    for (const key of [
      "centeringMultiplier",
      "wrongDirectionMultiplier",
      "neutralMultiplier",
    ]) {
      this.#requireFiniteNumberWithLabel(
        `stamina.mechanics.pressure.controlDirection.${key}`,
        controlDirection[key],
        { min: 0 },
      );
    }
    this.#requireFiniteNumberWithLabel(
      "stamina.mechanics.pressure.controlDirection.centerDeadZoneRatio",
      controlDirection.centerDeadZoneRatio,
      { min: 0, max: 1 },
    );

    const drain = mechanics.drain || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.drain.enabled",
      drain.enabled,
    );
    this.#requireFiniteNumberWithLabel(
      "stamina.mechanics.drain.baseDrainPerSecond",
      drain.baseDrainPerSecond,
      { min: 0 },
    );
    const advantageDrain = drain.advantageDrain || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.drain.advantageDrain.enabled",
      advantageDrain.enabled,
    );
    for (const key of [
      "minAdvantageRatio",
      "maxAdvantageRatio",
      "minDrainMultiplier",
      "maxDrainMultiplier",
      "curvePower",
    ]) {
      this.#requireFiniteNumberWithLabel(
        `stamina.mechanics.drain.advantageDrain.${key}`,
        advantageDrain[key],
        { min: 0 },
      );
    }

    const regen = mechanics.regen || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.regen.enabled",
      regen.enabled,
    );
    this.#requireFiniteNumberWithLabel(
      "stamina.mechanics.regen.baseRegenPerSecond",
      regen.baseRegenPerSecond,
      { min: 0 },
    );
    const beforeExhaustion = regen.beforeExhaustion || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.regen.beforeExhaustion.immediateOnNoPressure",
      beforeExhaustion.immediateOnNoPressure,
    );
    this.#requireBooleanWithLabel(
      "stamina.mechanics.regen.beforeExhaustion.allowWhenPlayerFatigueFull",
      beforeExhaustion.allowWhenPlayerFatigueFull,
    );
    const afterExhaustion = regen.afterExhaustion || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.regen.afterExhaustion.allowOnlyWhenPlayerFatigueFull",
      afterExhaustion.allowOnlyWhenPlayerFatigueFull,
    );
    this.#requireFiniteNumberWithLabel(
      "stamina.mechanics.regen.afterExhaustion.phaseReturnThresholdRatio",
      afterExhaustion.phaseReturnThresholdRatio,
      { min: 0, max: 1 },
    );
    const inactivityRecovery = afterExhaustion.inactivityRecovery || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.regen.afterExhaustion.inactivityRecovery.enabled",
      inactivityRecovery.enabled,
    );
    this.#requireFiniteNumberWithLabel(
      "stamina.mechanics.regen.afterExhaustion.inactivityRecovery.noInputTimeoutMs",
      inactivityRecovery.noInputTimeoutMs,
      { min: 0 },
    );

    const angleMultiplier = regen.angleMultiplier || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.regen.angleMultiplier.enabled",
      angleMultiplier.enabled,
    );
    for (const key of [
      "centerAngleDeg",
      "centerMultiplier",
      "sideAngleDeg",
      "sideMultiplier",
      "edgeAngleDeg",
      "edgeMultiplier",
    ]) {
      this.#requireFiniteNumberWithLabel(
        `stamina.mechanics.regen.angleMultiplier.${key}`,
        angleMultiplier[key],
        { min: 0 },
      );
    }

    const fatigueMultiplier = regen.fatigueMultiplier || {};
    this.#requireBooleanWithLabel(
      "stamina.mechanics.regen.fatigueMultiplier.enabled",
      fatigueMultiplier.enabled,
    );
    this.#requireFiniteNumberWithLabel(
      "stamina.mechanics.regen.fatigueMultiplier.maxBonusMultiplier",
      fatigueMultiplier.maxBonusMultiplier,
      { min: 0 },
    );
  }

  #requireNumericRange(path, value) {
    if (!Array.isArray(value) || value.length < 2) {
      this.#error(path, "must contain [min, max]");
      return;
    }
    this.#requireFiniteNumber(`${path}[0]`, value[0]);
    this.#requireFiniteNumber(`${path}[1]`, value[1]);
    this.#requireMinLessOrEqualMax(
      `${path}[0]`,
      value[0],
      `${path}[1]`,
      value[1],
    );
  }

  #requireNumericRangeWithLabel(path, value) {
    this.#requireNumericRange(path, value);
    this.#requireParameterLabel(path);
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
          if (!(maxEntry.value === null && object.openEnded === true)) {
            this.#requireMinLessOrEqualMax(
              `${basePath}.${key}`,
              value,
              `${basePath}.${maxEntry.key}`,
              maxEntry.value,
            );
          }
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

  #isAllowedOpenEndedNumber(_path, _value) {
    return false;
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

  #requireFiniteNumberWithLabel(path, value, options = {}) {
    const ok = this.#requireFiniteNumber(path, value, options);
    this.#requireParameterLabel(path);
    return ok;
  }

  #requireBooleanWithLabel(path, value) {
    if (typeof value !== "boolean") {
      this.#error(path, "expected boolean");
    }
    this.#requireParameterLabel(path);
  }

  #requireParameterLabel(path) {
    const parentPath = path.includes(".")
      ? path.slice(0, path.lastIndexOf("."))
      : "";
    if (!this.#hasParameterLabel(path, parentPath)) {
      this.#error(path, "missing parameter label in parameter_labels.json");
    }
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
