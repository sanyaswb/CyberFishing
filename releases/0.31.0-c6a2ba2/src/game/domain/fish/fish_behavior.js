import { DEFAULT_FISH_LATERAL_RANGE, DEFAULT_FISH_RADIAL_RANGE, FishDirectionIntentSampler } from "../fishing/fish_direction_intent_sampler.js";
import { FISH_FIGHT_EVENT } from "./fish_fight_event.js";
import { clampUnit, nonNegative } from "../../../engine/math/number_normalization.js";

export class FishBehavior {
  #config;
  #movementProfile;
  #directionIntentSampler;
  #currentStateName;
  #stateTimer;
  #dirTimer;
  #currentPull;
  #targetPull;
  #currentMove;
  #targetMove;
  #currentRadialIntent;
  #targetRadialIntent;
  #currentLateralIntent;
  #targetLateralIntent;
  #isLocked;
  #lastDashCheckTimer;
  #holdSpecialStateUntilLeave;
  #lastDashBlockedByCatchZone;
  #lastDashDebug;
  #runtimeMovementModifier;
  #lastMovementDebuffDebug;
  #rng;
  #logger;

  constructor(fishConfig, rng = null, logger = null) {
    const behaviorMap = fishConfig?.behaviorProfile?.behaviors || fishConfig?.behaviors || {};
    this.#config = {
      ...fishConfig,
      behaviors: behaviorMap,
    };
    this.#movementProfile =
      fishConfig?.movementProfile &&
      typeof fishConfig.movementProfile === "object"
        ? fishConfig.movementProfile
        : fishConfig || {};
    this.#rng = rng || { next: () => Math.random() };
    this.#logger = logger;
    this.#directionIntentSampler =
      new FishDirectionIntentSampler(this.#rng);
    this.#currentStateName = "swim";
    this.#stateTimer = 0;
    this.#dirTimer = 0;
    this.#currentPull = 1.0;
    this.#targetPull = 1.0;
    this.#currentMove = 0.0;
    this.#targetMove = 0.0;
    this.#currentRadialIntent = 1;
    this.#targetRadialIntent = 1;
    this.#currentLateralIntent = 0;
    this.#targetLateralIntent = 0;
    this.#isLocked = false;
    this.#lastDashCheckTimer = 0;
    this.#holdSpecialStateUntilLeave = null;
    this.#lastDashBlockedByCatchZone = false;
    this.#lastDashDebug = {};
    this.#runtimeMovementModifier = null;
    this.#lastMovementDebuffDebug = null;
    this.#pickNextState();
  }

  #range(min, max) {
    return typeof this.#rng.range === "function"
      ? this.#rng.range(min, max)
      : min + this.#rng.next() * (max - min);
  }

  #pickNextState(runtimeMovementModifier = this.#runtimeMovementModifier) {
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
      if (this.#effectiveBehaviorWeight(key, states[key], runtimeMovementModifier) > 0) {
        validKeys.push(key);
      }
    }

    if (validKeys.length === 0) return;

    let totalWeight = 0;
    for (let k of validKeys) {
      totalWeight += this.#effectiveBehaviorWeight(
        k,
        states[k],
        runtimeMovementModifier,
      );
    }

    let r = this.#range(0, totalWeight);
    let selectedKey = validKeys[0];

    for (let k of validKeys) {
      const weight = this.#effectiveBehaviorWeight(
        k,
        states[k],
        runtimeMovementModifier,
      );
      if (r < weight) {
        selectedKey = k;
        break;
      }
      r -= weight;
    }

    this.#currentStateName = selectedKey;
    const state = states[this.#currentStateName];
    this.#targetPull = Math.max(0, Number(state.forceMultiplier ?? 1) || 0);
    this.#targetMove = nonNegative(state.speedMultiplier ?? 0);
    this.#pickDirectionTarget(state, runtimeMovementModifier);
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
      this.#logger?.error?.(`[BEHAVIOR ERROR] Стан ${stateName} не знайдено!`);
      return;
    }

    this.#currentStateName = stateName;
    this.#targetPull = Math.max(0, Number(state.forceMultiplier ?? 1) || 0);
    this.#targetMove = nonNegative(state.speedMultiplier ?? 0);
    this.#pickDirectionTarget(state, this.#runtimeMovementModifier);
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
    const shoreLandingDistanceMeters = this.#positiveOrInfinity(
      context.shoreLandingDistanceMeters,
    );
    const horizontalDistanceMeters = this.#positiveOrInfinity(
      context.horizontalDistanceMeters ??
        context.shoreLandingDistanceMeters ??
        context.verticalDistanceMeters,
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
        shoreLandingDistanceMeters,
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
        shoreLandingDistanceMeters,
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
        shoreLandingDistanceMeters,
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
        shoreLandingDistanceMeters,
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
      shoreLandingDistanceMeters,
      horizontalDistanceMeters,
      zoneDistanceMeters,
      zoneShape,
      triggerDistanceMeters,
    };
    return this.#lastDashDebug;
  }

  reactToWall(wallSide) {
    this.#targetLateralIntent = wallSide === -1 ? 1 : -1;
    this.#currentLateralIntent = this.#targetLateralIntent;
    const stateConfig = this.#config.behaviors[this.#currentStateName];
    this.#dirTimer =
      stateConfig.bounceCooldownMs ?? this.#config.bounceCooldownMs ?? 2000;

    if (!this.#isLocked) {
      this.#stateTimer = 0;
    }
  }

  update(dt, runtimeMovementModifier = null) {
    this.#runtimeMovementModifier = runtimeMovementModifier;
    this.#stateTimer -= dt;
    if (this.#stateTimer <= 0) {
      if (this.#holdSpecialStateUntilLeave === this.#currentStateName) {
        this.#stateTimer = Math.max(1, dt);
      } else if (this.#isLocked) {
        this.#isLocked = false;
      }
      this.#pickNextState(runtimeMovementModifier);
    }

    const stateConfig = this.#config.behaviors[this.#currentStateName];

    this.#dirTimer -= dt;
    if (this.#dirTimer <= 0) {
      this.#pickDirectionTarget(stateConfig, runtimeMovementModifier);
      const minMs =
        stateConfig.dirChangeMinMs ?? this.#config.dirChangeMinMs ?? 500;
      const maxMs =
        stateConfig.dirChangeMaxMs ?? this.#config.dirChangeMaxMs ?? 2000;
      this.#dirTimer = this.#range(minMs, maxMs);
    }

    const agility =
      stateConfig.direction?.agility ??
      stateConfig.agility ??
      this.#config.agility ??
      1.0;
    const t = Math.min(1, (dt / 1000) * 3.0 * agility);

    this.#currentPull += (this.#targetPull - this.#currentPull) * t;
    this.#currentMove += (this.#targetMove - this.#currentMove) * t;
    this.#currentRadialIntent +=
      (this.#targetRadialIntent - this.#currentRadialIntent) * t;
    this.#currentLateralIntent +=
      (this.#targetLateralIntent - this.#currentLateralIntent) * t;
  }

  #pickDirectionTarget(stateConfig = {}, runtimeMovementModifier = null) {
    const stateDirection =
      stateConfig.direction &&
      typeof stateConfig.direction === "object"
        ? stateConfig.direction
        : {};
    const radialRangeFrame = this.#resolveRadialRangeFrame(
      stateDirection,
      runtimeMovementModifier,
    );
    const intent = this.#directionIntentSampler.sample({
      radialRange: radialRangeFrame.effectiveRange,
      lateralRange:
        stateDirection.lateralRange ??
        this.#movementProfile.lateralRange ??
        DEFAULT_FISH_LATERAL_RANGE,
    });
    this.#targetRadialIntent = intent.radial;
    this.#targetLateralIntent = intent.lateral;
    this.#lastMovementDebuffDebug = Object.freeze({
      selectedBehavior: this.#currentStateName,
      baseRadialRange: Object.freeze([...radialRangeFrame.baseRange]),
      effectiveRadialRange: Object.freeze([...radialRangeFrame.effectiveRange]),
      sampledRadialIntent: intent.radial,
      sampledLateralIntent: intent.lateral,
    });
  }

  #resolveRadialRangeFrame(stateDirection, runtimeMovementModifier) {
    const baseRange = this.#normalizeRange(
      stateDirection.radialRange ??
        this.#movementProfile.radialRange ??
        DEFAULT_FISH_RADIAL_RANGE,
      DEFAULT_FISH_RADIAL_RANGE,
    );
    if (
      runtimeMovementModifier?.active === true &&
      runtimeMovementModifier?.directionEnabled === true &&
      Array.isArray(runtimeMovementModifier.exhaustedRadialRange)
    ) {
      return {
        baseRange,
        effectiveRange: this.#lerpRange(
          baseRange,
          runtimeMovementModifier.exhaustedRadialRange,
          runtimeMovementModifier.debuffPower,
        ),
      };
    }
    const override = runtimeMovementModifier?.radialRangeOverride;
    if (Array.isArray(override) && override.length >= 2) {
      return {
        baseRange,
        effectiveRange: this.#normalizeRange(override, baseRange),
      };
    }
    return { baseRange, effectiveRange: baseRange };
  }

  #lerpRange(baseRange, targetRange, ratio) {
    const base = this.#normalizeRange(baseRange, DEFAULT_FISH_RADIAL_RANGE);
    const target = this.#normalizeRange(targetRange, base);
    const t = clampUnit(ratio);
    return [
      base[0] + (target[0] - base[0]) * t,
      base[1] + (target[1] - base[1]) * t,
    ];
  }

  #normalizeRange(value, fallback) {
    const range = Array.isArray(value) && value.length >= 2 ? value : fallback;
    const first = Number(range?.[0]);
    const second = Number(range?.[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return fallback;
    }
    return first <= second ? [first, second] : [second, first];
  }

  #effectiveBehaviorWeight(
    behaviorName,
    state,
    runtimeMovementModifier,
  ) {
    const baseWeight = Math.max(0, Number(state?.weight) || 0);
    const multiplier = Number(
      runtimeMovementModifier?.behaviorWeightMultipliers?.[behaviorName],
    );
    if (!Number.isFinite(multiplier)) return baseWeight;
    return baseWeight * Math.max(0, multiplier);
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

  getLastDashDiagnostics() {
    return this.#lastDashDebug || {};
  }

  getStateData() {
    const stateConfig = this.#config.behaviors[this.#currentStateName];
    const speedRatio = nonNegative(Math.abs(this.#currentMove));
    const targetForceMultiplier = nonNegative(
      stateConfig.forceMultiplier ?? this.#targetPull ?? this.#currentPull,
    );
    return {
      name: this.#currentStateName,
      pullMult: this.#currentPull,
      forceMultiplier: this.#currentPull,
      runtimeForceMultiplier: this.#currentPull,
      targetForceMultiplier,
      speedMultiplier: speedRatio,
      movementIntent: {
        radial: this.#currentRadialIntent,
        lateral: this.#currentLateralIntent,
      },
      movementDebuffDebug: this.#lastMovementDebuffDebug,
      moveX: speedRatio * this.#currentLateralIntent,
      agility:
        stateConfig.direction?.agility ??
        stateConfig.agility ??
        this.#config.agility ??
        1.0,
    };
  }
}
