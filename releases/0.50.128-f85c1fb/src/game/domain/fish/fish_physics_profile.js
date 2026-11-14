export class FishPhysicsProfile {
  #raw;

  constructor(raw = {}) {
    this.#raw = raw && typeof raw === "object" ? raw : {};
  }

  static from(raw = {}) {
    return new FishPhysicsProfile(raw);
  }

  static toRuntimeConfig(raw = {}, overrides = {}) {
    return FishPhysicsProfile.from(raw).toRuntimeConfig(overrides);
  }

  toRuntimeConfig(overrides = {}) {
    const raw = this.#raw;
    const forceProfile = this.#object(raw.forceProfile);
    const staminaProfile = this.#object(raw.staminaProfile);
    const movementProfile = this.#object(raw.movementProfile);
    const behaviorProfile = this.#object(raw.behaviorProfile);

    const normalizedForceProfile = {
      ...forceProfile,
      basePower: this.#firstFiniteNumber(
        forceProfile.basePower,
        raw.basePower,
        1.0,
      ),
    };

    const levelBasePower = this.#firstFiniteNumber(
      overrides.levelBasePower,
      raw.levelBasePower,
      forceProfile.levelBasePower,
      NaN,
    );
    if (Number.isFinite(levelBasePower)) {
      normalizedForceProfile.levelBasePower = Math.max(0, levelBasePower);
    }

    const normalizedStaminaProfile = {
      ...staminaProfile,
      baseStamina: this.#firstFiniteNumber(
        staminaProfile.baseStamina,
        raw.baseStamina,
        NaN,
      ),
    };
    this.#copyFiniteAlias(
      normalizedStaminaProfile,
      "staminaWeightMultiplier",
      staminaProfile.staminaWeightMultiplier,
      raw.staminaWeightMultiplier,
    );
    this.#copyFiniteAlias(
      normalizedStaminaProfile,
      "staminaBossMultiplier",
      staminaProfile.staminaBossMultiplier,
      raw.staminaBossMultiplier,
    );
    this.#copyFiniteAlias(
      normalizedStaminaProfile,
      "staminaRatioFromEndurance",
      staminaProfile.staminaRatioFromEndurance,
      raw.staminaRatioFromEndurance,
    );
    this.#copyFiniteAlias(
      normalizedStaminaProfile,
      "minStaminaActivityMultiplier",
      staminaProfile.minStaminaActivityMultiplier,
      raw.minStaminaActivityMultiplier,
    );
    this.#copyFiniteAlias(
      normalizedStaminaProfile,
      "exhaustedSpeedRatio",
      staminaProfile.exhaustedSpeedRatio,
      raw.exhaustedSpeedRatio,
    );

    const normalizedMovementProfile = {
      ...movementProfile,
      baseSpeed: this.#firstFiniteNumber(
        movementProfile.baseSpeed,
        raw.baseSpeed,
        1.0,
      ),
      agility: this.#firstFiniteNumber(
        movementProfile.agility,
        raw.agility,
        1.0,
      ),
      bounceCooldownMs: this.#firstFiniteNumber(
        movementProfile.bounceCooldownMs,
        raw.bounceCooldownMs,
        NaN,
      ),
      dirChangeMinMs: this.#firstFiniteNumber(
        movementProfile.dirChangeMinMs,
        raw.dirChangeMinMs,
        NaN,
      ),
      dirChangeMaxMs: this.#firstFiniteNumber(
        movementProfile.dirChangeMaxMs,
        raw.dirChangeMaxMs,
        NaN,
      ),
      lastDashTrigger:
        movementProfile.lastDashTrigger ||
        behaviorProfile.lastDashTrigger ||
        raw.lastDashTrigger,
    };
    this.#copyNormalizedRange(
      normalizedMovementProfile,
      "radialRange",
      movementProfile.radialRange,
    );
    this.#copyNormalizedRange(
      normalizedMovementProfile,
      "lateralRange",
      movementProfile.lateralRange,
    );

    const behaviors = this.#resolveBehaviors(raw, behaviorProfile);
    const normalizedBehaviorProfile = {
      ...behaviorProfile,
      behaviors,
    };

    const result = {
      ...raw,
      forceProfile: normalizedForceProfile,
      staminaProfile: normalizedStaminaProfile,
      movementProfile: normalizedMovementProfile,
      behaviorProfile: normalizedBehaviorProfile,

      // Runtime convenience aliases used by existing systems/debug only.
      basePower: normalizedForceProfile.basePower,
      levelBasePower: normalizedForceProfile.levelBasePower,
      baseStamina: normalizedStaminaProfile.baseStamina,
      staminaWeightMultiplier: normalizedStaminaProfile.staminaWeightMultiplier,
      staminaBossMultiplier: normalizedStaminaProfile.staminaBossMultiplier,
      staminaRatioFromEndurance:
        normalizedStaminaProfile.staminaRatioFromEndurance,
      minStaminaActivityMultiplier:
        normalizedStaminaProfile.minStaminaActivityMultiplier,
      exhaustedSpeedRatio: normalizedStaminaProfile.exhaustedSpeedRatio,
      baseSpeed: normalizedMovementProfile.baseSpeed,
      agility: normalizedMovementProfile.agility,
      bounceCooldownMs: normalizedMovementProfile.bounceCooldownMs,
      dirChangeMinMs: normalizedMovementProfile.dirChangeMinMs,
      dirChangeMaxMs: normalizedMovementProfile.dirChangeMaxMs,
      lastDashTrigger: normalizedMovementProfile.lastDashTrigger,
      behaviors,
    };

    delete result.minPowerRatio;
    delete result.maxSpeedMetersPerSec;
    delete result.baseSpeedMetersPerSec;
    delete result.speedForceMultiplier;
    delete result.waterResistanceMultiplier;
    delete result.resistanceProfile;
    delete result.retrieveProfile;
    delete result.pullResistance;

    if (!Number.isFinite(Number(result.levelBasePower))) {
      delete result.levelBasePower;
    }
    if (!Number.isFinite(Number(result.baseStamina))) {
      delete result.baseStamina;
    }
    return result;
  }

  #resolveBehaviors(raw, behaviorProfile) {
    if (raw.behaviors && typeof raw.behaviors === "object") {
      return this.#normalizeBehaviors(raw.behaviors);
    }
    if (
      behaviorProfile.behaviors &&
      typeof behaviorProfile.behaviors === "object"
    ) {
      return this.#normalizeBehaviors(behaviorProfile.behaviors);
    }

    const directBehaviorProfileKeys = ["idle", "rest", "swim", "dash", "lastDash"];
    const hasDirectStates = directBehaviorProfileKeys.some(
      (key) => behaviorProfile[key] && typeof behaviorProfile[key] === "object",
    );
    return hasDirectStates ? this.#normalizeBehaviors(behaviorProfile) : {};
  }

  #normalizeBehaviors(behaviors) {
    const normalized = {};
    for (const [name, behavior] of Object.entries(behaviors || {})) {
      if (!behavior || typeof behavior !== "object") continue;
      const forceMultiplier = this.#firstFiniteNumber(
        behavior.forceMultiplier,
        1,
      );
      const speedMultiplier = this.#firstFiniteNumber(
        behavior.speedMultiplier,
        Math.abs(Number(behavior.moveX) || 0),
        0,
      );
      normalized[name] = {
        ...behavior,
        forceMultiplier,
        speedMultiplier,
      };
      if (behavior.direction && typeof behavior.direction === "object") {
        normalized[name].direction = {
          ...behavior.direction,
        };
        this.#copyNormalizedRange(
          normalized[name].direction,
          "radialRange",
          behavior.direction.radialRange,
        );
        this.#copyNormalizedRange(
          normalized[name].direction,
          "lateralRange",
          behavior.direction.lateralRange,
        );
        const directionAgility = this.#firstFiniteNumber(
          behavior.direction.agility,
          NaN,
        );
        if (Number.isFinite(directionAgility)) {
          normalized[name].direction.agility = directionAgility;
        } else {
          delete normalized[name].direction.agility;
        }
      }
      delete normalized[name].powerRatio;
      delete normalized[name].speedRatio;
      delete normalized[name].pullMult;
    }
    return normalized;
  }

  #copyNormalizedRange(target, key, value) {
    if (!Array.isArray(value) || value.length < 2) {
      delete target[key];
      return;
    }
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      delete target[key];
      return;
    }
    target[key] =
      first <= second ? [first, second] : [second, first];
  }

  #copyFiniteAlias(target, key, ...values) {
    const value = this.#firstFiniteNumber(...values, NaN);
    if (Number.isFinite(value)) target[key] = value;
  }

  #object(value) {
    return value && typeof value === "object" ? value : {};
  }

  #firstFiniteNumber(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return NaN;
  }
}
