const FISH_FIGHT_EVENT = Object.freeze({
  CATCH_ZONE_ENTERED: "catch_zone_entered",
});

class FishPhysicsProfile {
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
      delete normalized[name].powerRatio;
      delete normalized[name].speedRatio;
      delete normalized[name].pullMult;
    }
    return normalized;
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

class Fish {
  #level;
  #weight;
  #fishConfig;
  #powerDebuff;
  #behavior;
  #masteryPowerMult = 1.0;
  #lastDebuffName = null;

  #originalBehaviors = null;
  #hasActiveDebuff = false;
  #rng;

  constructor(level, weight, fishConfig, rng = null) {
    this.#level = level;
    this.#weight = weight;
    this.#fishConfig = FishPhysicsProfile.toRuntimeConfig(fishConfig);
    this.#rng = rng || { next: () => Math.random() };
    this.#powerDebuff = 0;
    this.#behavior = new FishBehavior(this.#fishConfig, this.#rng);
  }

  #int(min, max) {
    return typeof this.#rng.int === "function"
      ? this.#rng.int(min, max)
      : Math.floor(min + this.#rng.next() * (max - min + 1));
  }

  getWeight() {
    return this.#weight;
  }

  updateRuntimeStats({ level, weight, physics } = {}) {
    if (Number.isFinite(Number(level))) {
      this.#level = Math.max(1, Math.round(Number(level)));
    }
    if (Number.isFinite(Number(weight))) {
      this.#weight = Math.max(0, Number(weight));
    }
    if (physics && typeof physics === "object") {
      this.#fishConfig = FishPhysicsProfile.toRuntimeConfig(physics);
      this.#behavior = new FishBehavior(this.#fishConfig, this.#rng);
    }
  }

  getPhysicsConfig() {
    return this.#fishConfig || {};
  }

  getLevelMultiplier() {
    // Numeric level is NOT multiplied into fish force anymore.
    // The level only selects a configured per-level basePower coefficient.
    const levelBasePower = this.#fishConfig?.forceProfile?.levelBasePower;
    if (Number.isFinite(Number(levelBasePower))) {
      return Math.max(0, Number(levelBasePower));
    }

    return 1;
  }

  getInitialPower() {
    const basePowerValue = this.#fishConfig?.forceProfile?.basePower;
    const basePower = Number.isFinite(Number(basePowerValue))
      ? Number(basePowerValue)
      : 1.0;
    return this.#weight * this.getLevelMultiplier() * Math.max(0, basePower);
  }

  getStaticPowerKg() {
    const basePower = this.#fishConfig?.forceProfile?.basePower ?? 1.0;
    return this.#weight * this.getLevelMultiplier() * basePower;
  }

  getCurrentStaticPowerKg() {
    const base = this.getStaticPowerKg();
    const initial = Math.max(0.001, this.getInitialPower());
    const currentRatio = this.getPower() / initial;
    return base * Math.max(0, currentRatio);
  }

  getMaxSpeedPxPerSec(pixelsPerMeter = 50) {
    const baseSpeed = Number(this.#fishConfig?.movementProfile?.baseSpeed);
    return Math.max(0, Number.isFinite(baseSpeed) ? baseSpeed : 1) * pixelsPerMeter;
  }

  getBaseSpeedPxPerSec(pixelsPerMeter = 50) {
    return this.getMaxSpeedPxPerSec(pixelsPerMeter);
  }

  getPower() {
    const initial = this.getInitialPower();
    const current = Math.max(0, initial - this.#powerDebuff);
    return current * this.#masteryPowerMult;
  }

  get activeDebuffName() {
    return this.#hasActiveDebuff
      ? this.#lastDebuffName || "Невідомий"
      : "Немає";
  }

  getMasteryMultiplier() {
    return this.#masteryPowerMult;
  }

  setMasteryMultiplier(currentMultiplier) {
    this.#masteryPowerMult = Number(currentMultiplier);
  }

  clearMasteryDebuff() {
    if (this.#masteryPowerMult !== 1.0) {
      this.#masteryPowerMult = 1.0;
      console.log(
        `[MASTERY] Риба вирвалась з центру! Плавне підкорення скинуто.`,
      );
    }
  }

  get hasActiveDebuff() {
    return this.#hasActiveDebuff;
  }

  applyPowerDebuff(amount, minBasePowerRatio = 0) {
    this.#powerDebuff = this.#clampPowerDebuff(
      this.#powerDebuff + amount,
      minBasePowerRatio,
    );
  }

  setPowerDebuffByExhaustionRatio(
    exhaustionRatio,
    maxPowerDropPerSec,
    maxDurationSec,
    minBasePowerRatio = 0.2,
  ) {
    const ratio = Math.max(0, Math.min(1, Number(exhaustionRatio) || 0));
    const maxPossibleDebuff = maxPowerDropPerSec * maxDurationSec;

    this.#powerDebuff = this.#clampPowerDebuff(
      maxPossibleDebuff * (1.0 - ratio),
      minBasePowerRatio,
    );
  }

  #clampPowerDebuff(value, minBasePowerRatio) {
    const initial = this.getInitialPower();
    const minRatio = Math.max(
      0,
      Math.min(1, Number(minBasePowerRatio) || 0),
    );
    const maxAllowedDebuff = initial * (1.0 - minRatio);
    return Math.max(0, Math.min(maxAllowedDebuff, Number(value) || 0));
  }

  getBehavior(dt) {
    this.#behavior.update(dt);
    return this.#behavior.getStateData();
  }

  evaluateLastDashTrigger(context = {}) {
    return this.#behavior.evaluateLastDashTrigger(context);
  }

  handleFightEvent(event = {}) {
    this.#behavior.handleFightEvent(event);
  }

  getLastDashDebugData() {
    return this.#behavior.getLastDashDebugData();
  }

  reactToWall(wallSide) {
    if (this.#behavior && typeof this.#behavior.reactToWall === "function") {
      this.#behavior.reactToWall(wallSide);
    }
  }

  #getBehaviorMap() {
    return this.#fishConfig?.behaviorProfile?.behaviors || this.#fishConfig?.behaviors || null;
  }

  applyRandomDebuff(debuffsCfg) {
    const behaviors = this.#getBehaviorMap();
    if (!behaviors) return;

    if (!this.#originalBehaviors) {
      this.#originalBehaviors = JSON.parse(JSON.stringify(behaviors));
    }

    this.clearDebuff();
    this.#hasActiveDebuff = true;

    const types = [
      "swimPull",
      "dashMaxTime",
      "idleMaxTime",
      "dashPull",
      "restWeight",
      "restMaxTime",
    ];
    const debuffType = types[this.#int(0, types.length - 1)];
    this.#lastDebuffName = debuffType;
    console.log(`[DEBUFF] Фаза 2 виснажена! Дебаф: ${debuffType}`);

    switch (debuffType) {
      case "swimPull":
        if (behaviors.swim) {
          behaviors.swim.forceMultiplier *= debuffsCfg.swimPullMult;
        }
        break;
      case "dashMaxTime":
        if (behaviors.dash)
          behaviors.dash.maxTime *= debuffsCfg.dashMaxTimeMult;
        break;
      case "idleMaxTime":
        if (behaviors.idle)
          behaviors.idle.maxTime *= debuffsCfg.idleMaxTimeMult;
        break;
      case "dashPull":
        if (behaviors.dash) {
          behaviors.dash.forceMultiplier *= debuffsCfg.dashPullMult;
        }
        break;
      case "restWeight":
        if (behaviors.rest) {
          behaviors.rest.weight += debuffsCfg.restWeightAdd;
          if (behaviors.swim)
            behaviors.swim.weight = Math.max(
              1,
              behaviors.swim.weight - debuffsCfg.restWeightAdd,
            );
        }
        break;
      case "restMaxTime":
        if (behaviors.rest)
          behaviors.rest.maxTime *= debuffsCfg.restMaxTimeMult;
        break;
    }
  }

  clearDebuff() {
    if (!this.#originalBehaviors || !this.#hasActiveDebuff) return;
    const behaviors = this.#getBehaviorMap();
    for (const key in this.#originalBehaviors) {
      if (behaviors[key])
        Object.assign(behaviors[key], this.#originalBehaviors[key]);
    }
    this.#hasActiveDebuff = false;
    console.log(`[DEBUFF] Стаміна 100%. Дебафи знято.`);
  }

}

class FishBehavior {
  #config;
  #currentStateName;
  #stateTimer;
  #dirTimer;
  #currentPull;
  #targetPull;
  #currentMove;
  #targetMove;
  #currentDirX;
  #targetDirX;
  #isLocked;
  #lastDashCheckTimer;
  #holdSpecialStateUntilLeave;
  #lastDashBlockedByCatchZone;
  #lastDashDebug;
  #rng;

  constructor(fishConfig, rng = null) {
    const behaviorMap = fishConfig?.behaviorProfile?.behaviors || fishConfig?.behaviors || {};
    this.#config = {
      ...fishConfig,
      behaviors: behaviorMap,
    };
    this.#rng = rng || { next: () => Math.random() };
    this.#currentStateName = "swim";
    this.#stateTimer = 0;
    this.#dirTimer = 0;
    this.#currentPull = 1.0;
    this.#targetPull = 1.0;
    this.#currentMove = 0.0;
    this.#targetMove = 0.0;
    this.#currentDirX = 0;
    this.#targetDirX = 0;
    this.#isLocked = false;
    this.#lastDashCheckTimer = 0;
    this.#holdSpecialStateUntilLeave = null;
    this.#lastDashBlockedByCatchZone = false;
    this.#lastDashDebug = {};
    this.#pickNextState();
  }

  #range(min, max) {
    return typeof this.#rng.range === "function"
      ? this.#rng.range(min, max)
      : min + this.#rng.next() * (max - min);
  }

  #pickNextState() {
    if (this.#isLocked) return;

    const states = this.#config.behaviors;
    if (!states) return;

    const validKeys = [];
    const lastDashStateName =
      this.#config.lastDashTrigger?.targetState || "lastDash";
    for (const key of Object.keys(states)) {
      if (this.#lastDashBlockedByCatchZone && key === lastDashStateName) {
        continue;
      }
      if (states[key].weight > 0) validKeys.push(key);
    }

    if (validKeys.length === 0) return;

    let totalWeight = 0;
    for (let k of validKeys) {
      totalWeight += states[k].weight;
    }

    let r = this.#range(0, totalWeight);
    let selectedKey = validKeys[0];

    for (let k of validKeys) {
      if (r < states[k].weight) {
        selectedKey = k;
        break;
      }
      r -= states[k].weight;
    }

    this.#currentStateName = selectedKey;
    const state = states[this.#currentStateName];
    this.#targetPull = Math.max(0, Number(state.forceMultiplier ?? 1) || 0);
    this.#targetMove = this.#clampNonNegative(state.speedMultiplier ?? 0);
    this.#stateTimer = this.#range(state.minTime, state.maxTime);
  }

  forceState(stateName, isLocked = false) {
    const lastDashStateName =
      this.#config.lastDashTrigger?.targetState || "lastDash";
    if (
      this.#lastDashBlockedByCatchZone &&
      stateName === lastDashStateName
    ) {
      return;
    }
    const state = this.#config.behaviors[stateName];
    if (!state) {
      console.error(`[BEHAVIOR ERROR] Стан ${stateName} не знайдено!`);
      return;
    }

    this.#currentStateName = stateName;
    this.#targetPull = Math.max(0, Number(state.forceMultiplier ?? 1) || 0);
    this.#targetMove = this.#clampNonNegative(state.speedMultiplier ?? 0);
    this.#isLocked = isLocked;
    this.#stateTimer = this.#range(state.minTime, state.maxTime);
    this.#dirTimer = 0;
  }

  handleFightEvent(event = {}) {
    if (event.type !== FISH_FIGHT_EVENT.CATCH_ZONE_ENTERED) return;
    this.#lastDashBlockedByCatchZone = true;
    this.#lastDashCheckTimer = 0;
  }

  evaluateLastDashTrigger(context = {}) {
    const trigger = this.#config.lastDashTrigger || {};
    const stateName = trigger.targetState || "lastDash";
    const state = this.#config.behaviors?.[stateName];
    const stateEnabled = state?.enabled !== false;
    const triggerEnabled = trigger.enabled === true;
    const hasState = !!state;
    const dtMs = Math.max(0, Number(context.dtMs) || 0);
    const landingDistanceMeters = Math.max(
      0,
      Number(context.landingDistanceMeters) || 0,
    );
    const lineDistanceMeters = this.#positiveOrInfinity(
      context.lineDistanceMeters,
    );
    const horizontalDistanceMeters = this.#positiveOrInfinity(
      context.horizontalDistanceMeters ?? context.verticalDistanceMeters,
    );
    const triggerDistanceMeters = this.#resolveLastDashTriggerDistance(
      trigger,
      landingDistanceMeters,
    );
    const zoneShape = this.#resolveLastDashZoneShape(trigger);
    const zoneDistanceMeters = zoneShape === "circle"
      ? lineDistanceMeters
      : horizontalDistanceMeters;
    if (this.#lastDashBlockedByCatchZone) {
      this.#lastDashDebug = {
        enabled: triggerEnabled && hasState && stateEnabled,
        stateName,
        inZone: false,
        active: this.#currentStateName === stateName,
        blockedByCatchZone: true,
        lineDistanceMeters,
        horizontalDistanceMeters,
        zoneDistanceMeters,
        zoneShape,
        triggerDistanceMeters,
      };
      return this.#lastDashDebug;
    }
    const inZone =
      hasState &&
      triggerEnabled &&
      stateEnabled &&
      triggerDistanceMeters > 0 &&
      zoneDistanceMeters <= triggerDistanceMeters;

    if (!inZone) {
      if (this.#holdSpecialStateUntilLeave === stateName) {
        this.#holdSpecialStateUntilLeave = null;
        this.#isLocked = false;
        this.#stateTimer = 0;
      }
      this.#lastDashDebug = {
        enabled: triggerEnabled && hasState && stateEnabled,
        stateName,
        inZone: false,
        lineDistanceMeters,
        horizontalDistanceMeters,
        zoneDistanceMeters,
        zoneShape,
        triggerDistanceMeters,
        active: this.#currentStateName === stateName,
      };
      return this.#lastDashDebug;
    }

    const stayUntilLeaveZone =
      trigger.stayUntilLeaveZone === true ||
      trigger.holdUntilLeaveZone === true ||
      trigger.escapeUntilLeaveZone === true;

    if (this.#currentStateName === stateName) {
      if (stayUntilLeaveZone) {
        this.#holdSpecialStateUntilLeave = stateName;
        this.#isLocked = true;
        this.#stateTimer = Math.max(this.#stateTimer, dtMs + 1);
      }
      this.#lastDashDebug = {
        enabled: true,
        stateName,
        inZone: true,
        active: true,
        holdingUntilLeave: this.#holdSpecialStateUntilLeave === stateName,
        lineDistanceMeters,
        horizontalDistanceMeters,
        zoneDistanceMeters,
        zoneShape,
        triggerDistanceMeters,
      };
      return this.#lastDashDebug;
    }

    this.#lastDashCheckTimer -= dtMs;
    if (this.#lastDashCheckTimer > 0) {
      this.#lastDashDebug = {
        enabled: true,
        stateName,
        inZone: true,
        active: false,
        waitingMs: this.#lastDashCheckTimer,
        lineDistanceMeters,
        horizontalDistanceMeters,
        zoneDistanceMeters,
        zoneShape,
        triggerDistanceMeters,
      };
      return this.#lastDashDebug;
    }

    const intervalMs = Math.max(1, Number(trigger.checkIntervalMs) || 1000);
    this.#lastDashCheckTimer = intervalMs;
    const chance = this.#resolveChance(trigger.chance);
    const roll = this.#random();
    const triggered = roll < chance;
    if (triggered) {
      this.forceState(stateName, stayUntilLeaveZone || trigger.isLocked === true);
      if (stayUntilLeaveZone) {
        this.#holdSpecialStateUntilLeave = stateName;
        this.#stateTimer = Math.max(this.#stateTimer, dtMs + 1);
      }
    }

    this.#lastDashDebug = {
      enabled: true,
      stateName,
      inZone: true,
      active: triggered,
      triggered,
      chance,
      roll,
      holdingUntilLeave: this.#holdSpecialStateUntilLeave === stateName,
      lineDistanceMeters,
      horizontalDistanceMeters,
      zoneDistanceMeters,
      zoneShape,
      triggerDistanceMeters,
    };
    return this.#lastDashDebug;
  }

  reactToWall(wallSide) {
    this.#targetDirX = wallSide === -1 ? 1 : -1;
    this.#currentDirX = this.#targetDirX;
    const stateConfig = this.#config.behaviors[this.#currentStateName];
    this.#dirTimer =
      stateConfig.bounceCooldownMs ?? this.#config.bounceCooldownMs ?? 2000;

    if (!this.#isLocked) {
      this.#stateTimer = 0;
    }
  }

  update(dt) {
    this.#stateTimer -= dt;
    if (this.#stateTimer <= 0) {
      if (this.#holdSpecialStateUntilLeave === this.#currentStateName) {
        this.#stateTimer = Math.max(1, dt);
      } else if (this.#isLocked) {
        this.#isLocked = false;
      }
      this.#pickNextState();
    }

    const stateConfig = this.#config.behaviors[this.#currentStateName];

    this.#dirTimer -= dt;
    if (this.#dirTimer <= 0) {
      this.#targetDirX = this.#range(-1, 1);
      const minMs =
        stateConfig.dirChangeMinMs ?? this.#config.dirChangeMinMs ?? 500;
      const maxMs =
        stateConfig.dirChangeMaxMs ?? this.#config.dirChangeMaxMs ?? 2000;
      this.#dirTimer = this.#range(minMs, maxMs);
    }

    const agility = stateConfig.agility ?? this.#config.agility ?? 1.0;
    const t = Math.min(1, (dt / 1000) * 3.0 * agility);

    this.#currentPull += (this.#targetPull - this.#currentPull) * t;
    this.#currentMove += (this.#targetMove - this.#currentMove) * t;
    this.#currentDirX += (this.#targetDirX - this.#currentDirX) * t;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  #clampNonNegative(value) {
    return Math.max(0, Number(value) || 0);
  }

  #resolveLastDashTriggerDistance(trigger, landingDistanceMeters) {
    const absolute = Number(trigger.distanceMeters ?? trigger.triggerDistanceMeters);
    if (Number.isFinite(absolute)) return Math.max(0, absolute);

    const multiplier = Math.max(
      0,
      Number(
        trigger.catchZoneMultiplier ??
          trigger.triggerZoneMultiplier ??
          trigger.landingDistanceMultiplier,
      ) || 1.1,
    );
    const extra = Math.max(
      0,
      Number(trigger.extraDistanceMeters ?? trigger.triggerExtraDistanceMeters) || 0,
    );
    return Math.max(0, landingDistanceMeters * multiplier + extra);
  }

  #resolveLastDashZoneShape(trigger) {
    const value = String(
      trigger.zoneShape ??
        trigger.shape ??
        trigger.zoneMode ??
        "horizontal",
    ).toLowerCase();
    return value === "circle" || value === "radial" ? "circle" : "horizontal";
  }

  #positiveOrInfinity(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return Infinity;
    return Math.max(0, number);
  }

  #resolveChance(value) {
    const numeric = Math.max(0, Number(value) || 0);
    return numeric > 1 ? Math.min(1, numeric / 100) : Math.min(1, numeric);
  }

  #random() {
    return typeof this.#rng.next === "function" ? this.#rng.next() : Math.random();
  }

  getLastDashDebugData() {
    return this.#lastDashDebug || {};
  }

  getStateData() {
    const stateConfig = this.#config.behaviors[this.#currentStateName];
    const speedRatio = this.#clampNonNegative(Math.abs(this.#currentMove));
    return {
      name: this.#currentStateName,
      pullMult: this.#currentPull,
      forceMultiplier: this.#currentPull,
      speedMultiplier: speedRatio,
      moveX: speedRatio * this.#currentDirX,
      agility: stateConfig.agility ?? this.#config.agility ?? 1.0,
    };
  }
}

class FishCondition {
  #maxStamina;
  #maxEndurance;
  #currentStamina;
  #currentExhaustion;
  #phase;

  constructor(level, weight, staminaFishConfig, fishPhysics = null, options = {}) {
    this.#maxEndurance = new FishEndurancePointsCalculator().calculate({
      level,
      weightKg: weight,
      staminaFishConfig,
      fishPhysics,
      maxLevel: options.maxLevel,
      levelAverageWeightKg: options.levelAverageWeightKg,
    });
    this.#maxStamina = new FishStaminaPointsCalculator().calculate({
      endurancePoints: this.#maxEndurance,
      staminaFishConfig,
      fishPhysics,
    });
    this.#currentStamina = this.#maxStamina;
    this.#currentExhaustion = this.#maxEndurance;
    this.#phase = "stamina";
  }

  get phase() {
    return this.#phase;
  }
  get maxPoints() {
    return this.#maxStamina;
  }
  get maxStamina() {
    return this.#maxStamina;
  }
  get maxEndurance() {
    return this.#maxEndurance;
  }
  get currentStamina() {
    return this.#currentStamina;
  }
  get currentExhaustion() {
    return this.#currentExhaustion;
  }

  restoreFull() {
    this.#currentStamina = this.#maxStamina;
    this.#currentExhaustion = this.#maxEndurance;
    this.#phase = "stamina";
  }

  breakExhaustion() {
    if (this.#phase === "exhaustion") {
      this.#phase = "stamina";
    }
  }

  applyStaminaDamage(amount) {
    if (this.#phase !== "stamina") return;
    this.#currentStamina = Math.max(0, this.#currentStamina - amount);
    if (this.#currentStamina === 0) {
      this.#phase = "exhaustion";
    }
  }

  applyStaminaRegen(amount) {
    if (this.#phase !== "stamina") return;
    this.#currentStamina = Math.min(
      this.#maxStamina,
      this.#currentStamina + amount,
    );
  }

  applyExhaustionDamage(amount) {
    if (this.#phase !== "exhaustion") return;
    this.#currentExhaustion = Math.max(0, this.#currentExhaustion - amount);
  }

  applyPunishment(capPercent) {
    const cap = this.#maxEndurance * capPercent;
    if (this.#currentExhaustion < cap) {
      this.#currentExhaustion = cap;
      console.log(
        `[STAMINA] Риба відновилася! Виснаження повернулося до ${capPercent * 100}%`,
      );
    }
  }
}

class FishEndurancePointsCalculator {
  calculate({
    level,
    weightKg,
    staminaFishConfig = {},
    fishPhysics = null,
    maxLevel = null,
    levelAverageWeightKg = null,
  } = {}) {
    const physics = FishPhysicsProfile.toRuntimeConfig(fishPhysics || {});
    const staminaProfile = physics.staminaProfile || {};
    const baseStamina = this.#resolveBaseStamina(staminaProfile, staminaFishConfig);
    const levelMultiplier = this.#positiveLevel(level);
    const weightGrams = this.#positiveNumber(weightKg) * 1000;
    const bossMultiplier = this.#resolveBossMultiplier(
      staminaProfile,
      staminaFishConfig,
    );

    let points = baseStamina + weightGrams * levelMultiplier;
    if (this.#isBossFish({ level, weightKg, maxLevel, levelAverageWeightKg })) {
      points *= bossMultiplier;
    }

    return Math.max(0, points);
  }

  #resolveBaseStamina(staminaProfile, staminaFishConfig) {
    const profileBase = Number(staminaProfile?.baseStamina);
    if (Number.isFinite(profileBase)) return Math.max(0, profileBase);

    const configBase = Number(staminaFishConfig?.baseStamina);
    if (Number.isFinite(configBase)) return Math.max(0, configBase);

    const legacyFlatBonus = Number(staminaFishConfig?.flatBonus);
    return Number.isFinite(legacyFlatBonus) ? Math.max(0, legacyFlatBonus) : 500;
  }

  #resolveBossMultiplier(staminaProfile, staminaFishConfig) {
    const profileMultiplier = Number(staminaProfile?.staminaBossMultiplier);
    if (Number.isFinite(profileMultiplier)) return Math.max(0, profileMultiplier);

    const configMultiplier = Number(staminaFishConfig?.staminaBossMultiplier);
    return Number.isFinite(configMultiplier) ? Math.max(0, configMultiplier) : 1;
  }

  #isBossFish({ level, weightKg, maxLevel, levelAverageWeightKg }) {
    const currentLevel = this.#positiveLevel(level);
    const lastLevel = Number(maxLevel);
    const weight = Number(weightKg);
    const averageWeight = Number(levelAverageWeightKg);

    return (
      Number.isFinite(lastLevel) &&
      currentLevel === Math.max(1, Math.round(lastLevel)) &&
      Number.isFinite(weight) &&
      Number.isFinite(averageWeight) &&
      weight < averageWeight
    );
  }

  #positiveLevel(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1;
  }

  #positiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
}

class FishStaminaPointsCalculator {
  calculate({ endurancePoints, staminaFishConfig = {}, fishPhysics = null } = {}) {
    const physics = FishPhysicsProfile.toRuntimeConfig(fishPhysics || {});
    const staminaProfile = physics.staminaProfile || {};
    const ratio = this.#resolveRatio(staminaProfile, staminaFishConfig);
    return Math.max(0, this.#positiveNumber(endurancePoints) * ratio);
  }

  #resolveRatio(staminaProfile, staminaFishConfig) {
    const profileRatio = Number(staminaProfile?.staminaRatioFromEndurance);
    if (Number.isFinite(profileRatio)) return Math.max(0, profileRatio);

    const configRatio = Number(staminaFishConfig?.staminaRatioFromEndurance);
    return Number.isFinite(configRatio) ? Math.max(0, configRatio) : 0.1;
  }

  #positiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
}
