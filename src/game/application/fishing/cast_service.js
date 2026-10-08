import { BaitFactory } from "../../domain/tackle/bait_factory.js";

export class CastService {
  #config;
  #rng;
  #clock;
  #equipmentRules;
  #baitRules;
  #getRodVirtualPos;
  #getDynamicBounds;
  #debugEvents;
  #castReadinessEvaluator;
  #devFlags;
  #runtimeConfig;

  constructor({
    config,
    rng,
    clock,
    equipmentRules,
    baitRules,
    getRodVirtualPos,
    getDynamicBounds,
    debugEvents = null,
    castReadinessEvaluator = null,
    devFlags = null,
    runtimeConfig = null,
  }) {
    this.#config = config;
    this.#rng = rng;
    this.#clock = clock;
    this.#equipmentRules = equipmentRules;
    this.#baitRules = baitRules;
    this.#getRodVirtualPos = getRodVirtualPos;
    this.#getDynamicBounds = getDynamicBounds;
    this.#debugEvents = debugEvents;
    this.#devFlags = devFlags;
    this.#runtimeConfig = runtimeConfig;
    this.#castReadinessEvaluator =
      typeof castReadinessEvaluator === "function"
        ? castReadinessEvaluator
        : null;
  }

  cast(vx, vy, cellDepth, context) {
    const eq = context.equipment;
    const readiness = this.#evaluateCastReadiness(eq);
    if (!readiness.canCast) {
      return {
        success: false,
        reason: this.#resolveReadinessFailureReason(readiness),
        readiness,
      };
    }

    const rodPos =
      context.rodVirtualPos || this.#getRodVirtualPos(this.#getDynamicBounds());
    const dist = Math.hypot(vx - rodPos.x, vy - rodPos.y);
    const maxDist = this.#equipmentRules.getMaxCastDistance(
      eq,
      2000,
      context.currentHookDepth,
    );
    const castDistanceRatio = Math.min(1, dist / maxDist);
    const castStartTime = this.#clock.now;

    let currentHookDepth = context.currentHookDepth;
    if (this.#equipmentRules.isFeeder(eq)) currentHookDepth = cellDepth;

    let physicsType = "float";
    let physicsConfig = {};
    if (this.#equipmentRules.isSpinning(eq) && eq.baits?.[0]) {
      const baitStats = eq.baits[0].effectiveStats || {};
      physicsType = this.#baitRules.getPhysicsType(eq.baits[0], "spinner");
      physicsConfig = { ...baitStats, type: eq.baits[0].variant };
    } else if (this.#equipmentRules.isFeeder(eq) && eq.feederRig) {
      physicsType = "feeder";
      physicsConfig = { ...eq.feederRig.effectiveStats, type: "feeder" };
    } else if (eq.float) {
      physicsType = "float";
      physicsConfig = {
        ...eq.float.effectiveStats,
        type: eq.float.variant || "day",
      };
    }

    const floatEntity = BaitFactory.create(
      physicsType,
      vx,
      vy,
      physicsConfig,
      eq,
      this.#rng,
      this.#debugEvents,
      this.#devFlags,
      this.#runtimeConfig,
    );

    if (typeof floatEntity.cast === "function") {
      floatEntity.cast(
        vx,
        vy,
        currentHookDepth,
        currentHookDepth > cellDepth,
        physicsConfig,
        castDistanceRatio,
      );
    } else {
      floatEntity.setPosition(vx, vy);
      if (typeof floatEntity.setHookDepth === "function")
        floatEntity.setHookDepth(0.1);
      if (typeof floatEntity.stopBite === "function") floatEntity.stopBite();
    }

    return {
      success: true,
      floatEntity,
      castDistanceRatio,
      castStartTime,
      currentHookDepth,
      nextState: "waiting",
    };
  }

  #evaluateCastReadiness(equipment) {
    const evaluated = this.#castReadinessEvaluator?.(equipment);
    if (typeof evaluated?.canCast === "boolean") return evaluated;

    if (!equipment?.rod) {
      return {
        canCast: false,
        shouldOpenInventory: true,
        warningCode: "rod-required",
        warning: "Спочатку спорядіть вудилище.",
      };
    }
    if (this.#equipmentRules.requiresReel(equipment) && !equipment.reel) {
      return {
        canCast: false,
        shouldOpenInventory: true,
        warningCode: "reel-required",
        warning: "Для цієї вудки потрібна котушка.",
      };
    }
    if (!this.#equipmentRules.hasEquippedLine(equipment)) {
      return {
        canCast: false,
        shouldOpenInventory: true,
        warningCode: "line-required",
        warning: "Для закидання потрібна ліска.",
      };
    }
    return {
      canCast: true,
      shouldOpenInventory: false,
      warningCode: null,
      warning: null,
    };
  }

  #resolveReadinessFailureReason(readiness) {
    const warningCode = String(readiness?.warningCode || "");
    if (warningCode === "rod-required") return "missing_rod";
    if (warningCode === "reel-required") return "missing_reel";
    return "missing_line";
  }
}
