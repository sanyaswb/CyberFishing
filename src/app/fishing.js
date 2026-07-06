class FishingController {
  #inventory;
  #equipment;
  #devFlags;
  #equipmentRules;
  #baitRules;
  #debugEvents;

  constructor({ inventory, equipment, devFlags, equipmentRules, baitRules, debugEvents = null }) {
    this.#inventory = inventory;
    this.#equipment = equipment;
    this.#devFlags = devFlags;
    this.#equipmentRules = equipmentRules;
    this.#baitRules = baitRules;
    this.#debugEvents = debugEvents;
  }

  consumeFirstBaitForFight(eq) {
    if (this.#devFlags.isEnabled("infiniteResources")) return false;
    return this.#equipment.consumeFirstBait(eq);
  }

  consumeExpiredFeederChum(eq) {
    return this.#consumeFeederChumLoad(eq);
  }

  consumeWetFeederChum(eq, elapsedMs = Infinity) {
    if (this.#isWithinSafeRecastWindow(eq?.feederChum, elapsedMs)) {
      return false;
    }
    return this.#consumeFeederChumLoad(eq);
  }

  #consumeFeederChumLoad(eq) {
    if (!this.#equipmentRules.isFeeder(eq) || !eq?.feederChum) return false;
    if (this.#devFlags.isEnabled("infiniteResources")) return false;
    return this.#equipment.consumeFeederChum(eq, true);
  }

  #isWithinSafeRecastWindow(chum, elapsedMs) {
    if (!chum || !Number.isFinite(elapsedMs)) return false;
    const safeWindowMs =
      chum.safeRecastWindowMs ??
      chum.feederSafeRecastWindowMs ??
      chum.recastGraceMs ??
      0;
    return safeWindowMs > 0 && elapsedMs <= safeWindowMs;
  }

  consumeHandChum(chum) {
    if (this.#devFlags.isEnabled("infiniteResources")) return false;
    if (!chum?.instanceId) return false;
    return this.#inventory.consumeItem(chum.instanceId, 1);
  }

  consumeDeliveryChum(slotIndex) {
    if (this.#devFlags.isEnabled("infiniteResources")) return false;
    return this.#equipment.consumeDeliveryChum(slotIndex);
  }

  collectAvailableBaits(eq, eatenBaits, outIds, outTypes) {
    outIds.length = 0;
    outTypes.length = 0;

    const hooks = eq?.hooks || [];
    const baits = eq?.baits || [];
    const eaten = eatenBaits || [];
    for (let i = 0; i < baits.length; i++) {
      const hook = hooks[i];
      const bait = baits[i];
      if (!hook || !bait) continue;

      let isEaten = false;
      for (let j = 0; j < eaten.length; j++) {
        if (eaten[j].instanceId === bait.instanceId) {
          isEaten = true;
          break;
        }
      }

      if (!isEaten) {
        outIds.push(bait.id);
        outTypes.push(bait.type);
      }
    }
  }

  hasActiveLureType(types) {
    return this.#baitRules.hasActiveLureType(types);
  }

  applyFailureEquipmentLoss(reason, eq, failure = {}) {
    if (this.#devFlags.isEnabled("noEquipmentLoss")) {
      console.log(
        "%c[GOD MODE] 🛡️ Снасті та наживку врятовано від втрати!",
        "color: #00ff00;",
      );
      return;
    }

    if (
      reason === "rod" ||
      reason === "line" ||
      reason === "leader" ||
      reason === "reel" ||
      reason === "hook" ||
      reason === "net_escape"
    ) {
      this.#equipment.consumeAllBaits(eq);
    }

    if (reason === "leader") {
      this.#equipment.consumeAllHooks(eq);
    }

    if (reason === "rod" || reason === "line" || reason === "reel") {
      this.#equipment.consumeAllHooks(eq);
      this.#equipment.consumeFloat(eq);
      this.#equipment.consumeSinker(eq);
      this.#consumeFeederChumLoad(eq);
    }

    if (reason === "rod" && eq?.rod) {
      this.#equipment.consumeRod(eq);
    }

    if (reason === "leader" && eq?.leader) {
      this.#equipment.consumeLeader(eq);
    }

    if (reason === "line" && eq?.line) {
      const lineLossMeters = Math.max(0, Number(failure?.lineLossMeters) || 0);
      if (!this.#equipment.breakEquippedLine(lineLossMeters)) {
        this.#equipment.consumeLine(eq);
      }
    }
  }

  tryConsumeBaitDuringBite(eq, stepInfo, rng, physicsConfig) {
    if (!stepInfo?.isAction) return false;

    let consumedBaitId = null;
    const hooks = eq?.hooks || [];
    const baits = eq?.baits || [];
    for (let i = 0; i < baits.length; i++) {
      if (hooks[i] && baits[i] && baits[i].type === "bait") {
        consumedBaitId = baits[i].instanceId;
        break;
      }
    }

    if (!consumedBaitId) return false;

    const lossChance = stepInfo.isGuaranteed
      ? (physicsConfig.baitLossChance?.guaranteed ?? 0.5)
      : (physicsConfig.baitLossChance?.normal ?? 0.15);

    if (!rng.chance(lossChance)) return false;

    if (this.#devFlags.isEnabled("noEquipmentLoss")) {
      console.log(
        "%c[GOD MODE] 🛡️ Риба намагалась вкрасти наживку, але Бог не дозволив!",
        "color: #00ff00;",
      );
    } else {
      this.#equipment.consumeFirstBait(eq);
    }

    return true;
  }
}

class CastService {
  #config;
  #rng;
  #clock;
  #equipmentRules;
  #baitRules;
  #getRodVirtualPos;
  #getDynamicBounds;
  #debugEvents;

  constructor({
    config,
    rng,
    clock,
    equipmentRules,
    baitRules,
    getRodVirtualPos,
    getDynamicBounds,
    debugEvents = null,
  }) {
    this.#config = config;
    this.#rng = rng;
    this.#clock = clock;
    this.#equipmentRules = equipmentRules;
    this.#baitRules = baitRules;
    this.#getRodVirtualPos = getRodVirtualPos;
    this.#getDynamicBounds = getDynamicBounds;
    this.#debugEvents = debugEvents;
  }

  cast(vx, vy, cellDepth, context) {
    const eq = context.equipment;
    if (!eq?.rod) return { success: false, reason: "missing_rod" };
    const needsReel = this.#equipmentRules.requiresReel(eq);
    if (needsReel && !eq.reel)
      return { success: false, reason: "missing_reel" };

    const rodPos =
      context.rodVirtualPos || this.#getRodVirtualPos(this.#getDynamicBounds());
    const dist = Math.hypot(vx - rodPos.x, vy - rodPos.y);
    const maxDist = this.#equipmentRules.getMaxCastDistance(eq, 2000);
    const castDistanceRatio = Math.min(1, dist / maxDist);
    const castStartTime = this.#clock.now;

    let currentHookDepth = context.currentHookDepth;
    if (this.#equipmentRules.isFeeder(eq)) currentHookDepth = cellDepth;

    let physicsType = "float";
    let physicsConfig = {};
    if (this.#equipmentRules.isSpinning(eq) && eq.baits?.[0]) {
      const baitStats = eq.baits[0].engineStats || eq.baits[0];
      physicsType = this.#baitRules.getPhysicsType(eq.baits[0], "spinner");
      physicsConfig = { ...baitStats };
    } else if (eq.float) {
      physicsType = "float";
      physicsConfig = { ...eq.float.engineStats, ...eq.float };
    } else if (eq.sinker) {
      physicsType = this.#equipmentRules.isFeeder(eq) ? "feeder" : "float";
      physicsConfig = { ...eq.sinker.engineStats, ...eq.sinker };
    }

    const floatEntity = BaitFactory.create(
      physicsType,
      vx,
      vy,
      physicsConfig,
      eq,
      this.#rng,
      this.#debugEvents,
    );

    if (typeof floatEntity.cast === "function") {
      const sinkerCfg = eq.sinker
        ? { ...eq.sinker.engineStats, ...eq.sinker }
        : null;
      floatEntity.cast(
        vx,
        vy,
        currentHookDepth,
        currentHookDepth > cellDepth,
        sinkerCfg,
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
}

class FightSessionFactory {
  constructor({ config, rng, castDistanceCalculator = null, devFlags = null }) {
    this.config = config;
    this.rng = rng;
    this.devFlags = devFlags;
    this.physicsConfig =
      config?.fightPhysicsConfig ||
      (typeof FightPhysicsConfigAdapter !== "undefined"
        ? new FightPhysicsConfigAdapter(config)
        : null);
    this.castDistanceCalculator =
      castDistanceCalculator || new CastDistanceCalculator(config || {});
  }

  create(fishData, equipment) {
    const lineSystemConfig = this.#getLineSystemConfig();
    const rod = new Rod(
      equipment.rod?.level || 1,
      equipment.rod?.basePower || 1.0,
      equipment.rod?.compensation || 0,
      equipment.rod?.type || "float",
      this.castDistanceCalculator.getMaxCastDistancePx(equipment, 100),
      equipment.rod?.hasReel !== false,
      {
        lengthMeters: equipment.rod?.lengthMeters,
        castPowerCoefficient: equipment.rod?.castPowerCoefficient,
        maxLoadKg: equipment.rod?.maxLoadKg,
        holdTensionRatio: equipment.rod?.holdTensionRatio,
        durability: equipment.rod?.durability,
        durabilityMaxLoadLossPerPercent:
          equipment.rod?.durabilityMaxLoadLossPerPercent,
      },
    );
    const reel = equipment.reel
      ? new Reel(
          equipment.reel.level || 1,
          equipment.reel.basePower || 1.0,
          {
            maxLoadKg: equipment.reel.maxLoadKg,
            lineCapacityMeters: equipment.reel.lineCapacityMeters,
            retrieveSpeedMetersPerSec: equipment.reel.retrieveSpeedMetersPerSec,
            bearingCount: equipment.reel.bearingCount,
            bearingRetrieveSpeedBonusMetersPerSec:
              this.physicsConfig?.getReelConfig?.()
                ?.bearingRetrieveSpeedBonusMetersPerSec,
            dragMinKg: equipment.reel.dragMinKg,
            dragMaxKg: equipment.reel.dragMaxKg,
            dragChangeSpeedPerSec: equipment.reel.dragChangeSpeedPerSec,
            hasDrag: equipment.reel.hasDrag,
            durability: equipment.reel.durability,
            durabilityMaxLoadLossPerPercent:
              equipment.reel.durabilityMaxLoadLossPerPercent,
          },
        )
      : new Reel(0, 0, { lineCapacityMeters: 0 });
    const activeHook = equipment.hooks?.[0] || {};
    const hook = new Hook(
      activeHook.level || 1,
      activeHook.weight || 1,
      activeHook.quality || 1.0,
      {
        maxLoadKg: activeHook.maxLoadKg,
        durability: activeHook.durability,
        durabilityMaxLoadLossPerPercent:
          activeHook.durabilityMaxLoadLossPerPercent,
      },
    );
    const fish = new Fish(
      fishData.level,
      fishData.weight,
      fishData.physics,
      this.rng,
    );
    const lineSystem = new LineSystem({
      rod,
      reel,
      config: lineSystemConfig,
      lineStats: equipment.line,
      castDistanceCalculator: this.castDistanceCalculator,
    });
    const dragSystem = new DragSystem(
      this.physicsConfig?.getReelDragConfig?.() || {},
      reel,
    );
    const fishForceSystem = new FishForceSystem({
      fish,
      config: this.config,
    });
    const pullInputMapper = new PullInputMapper();
    const rodPullSystem = new RodPullSystem(
      {
        ...(this.physicsConfig?.getRodPullConfig?.() || {}),
        rodHold: this.physicsConfig?.getRodHoldConfig?.() || {},
      },
    );
    const rodControlSystem = new RodLateralControlSystem();
    const reelSystem = new ReelSystem(
      this.physicsConfig?.getReelConfig?.() || {},
    );
    const tensionSystem = new TensionSystem();
    const tensionMeter = new TackleStressSystem({
      rod,
      reel,
      lineSystem,
      hook,
      leader: equipment.leader,
      config: this.physicsConfig?.getTensionConfig?.() || this.config.tension,
      rng: this.rng,
      devFlags: this.devFlags,
    });
    const fightPhysicsSystem = new FightPhysicsSystem(this.config);
    const fishCondition = new FishCondition(
      fishData.level,
      fishData.weight,
      this.config.stamina.fish,
      fishData.physics,
      {
        maxLevel: fishData.maxLevel,
        levelAverageWeightKg: fishData.levelAverageWeightKg,
      },
    );
    const staminaController = new StaminaController(
      fishCondition,
      fish,
      this.config.stamina.mechanics,
    );
    return {
      rod,
      reel,
      hook,
      fish,
      lineSystem,
      dragSystem,
      fishForceSystem,
      pullInputMapper,
      rodPullSystem,
      rodControlSystem,
      reelSystem,
      tensionSystem,
      fightPhysicsSystem,
      tensionMeter,
      fishCondition,
      staminaController,
    };
  }

  createEquipment(equipment) {
    const lineSystemConfig = this.#getLineSystemConfig();
    const rod = new Rod(
      equipment.rod?.level || 1,
      equipment.rod?.basePower || 1.0,
      equipment.rod?.compensation || 0,
      equipment.rod?.type || "float",
      this.castDistanceCalculator.getMaxCastDistancePx(equipment, 100),
      equipment.rod?.hasReel !== false,
      {
        lengthMeters: equipment.rod?.lengthMeters,
        castPowerCoefficient: equipment.rod?.castPowerCoefficient,
        maxLoadKg: equipment.rod?.maxLoadKg,
        holdTensionRatio: equipment.rod?.holdTensionRatio,
        durability: equipment.rod?.durability,
        durabilityMaxLoadLossPerPercent:
          equipment.rod?.durabilityMaxLoadLossPerPercent,
      },
    );
    const reel = equipment.reel
      ? new Reel(
          equipment.reel.level || 1,
          equipment.reel.basePower || 1.0,
          {
            maxLoadKg: equipment.reel.maxLoadKg,
            lineCapacityMeters: equipment.reel.lineCapacityMeters,
            retrieveSpeedMetersPerSec: equipment.reel.retrieveSpeedMetersPerSec,
            bearingCount: equipment.reel.bearingCount,
            bearingRetrieveSpeedBonusMetersPerSec:
              this.physicsConfig?.getReelConfig?.()
                ?.bearingRetrieveSpeedBonusMetersPerSec,
            dragMinKg: equipment.reel.dragMinKg,
            dragMaxKg: equipment.reel.dragMaxKg,
            dragChangeSpeedPerSec: equipment.reel.dragChangeSpeedPerSec,
            hasDrag: equipment.reel.hasDrag,
            durability: equipment.reel.durability,
            durabilityMaxLoadLossPerPercent:
              equipment.reel.durabilityMaxLoadLossPerPercent,
          },
        )
      : new Reel(0, 0, { lineCapacityMeters: 0 });
    const activeHook = equipment.hooks?.[0] || {};
    const hook = new Hook(
      activeHook.level || 1,
      activeHook.weight || 1,
      activeHook.quality || 1.0,
      {
        maxLoadKg: activeHook.maxLoadKg,
        durability: activeHook.durability,
        durabilityMaxLoadLossPerPercent:
          activeHook.durabilityMaxLoadLossPerPercent,
      },
    );
    const lineSystem = new LineSystem({
      rod,
      reel,
      config: lineSystemConfig,
      lineStats: equipment.line,
      castDistanceCalculator: this.castDistanceCalculator,
    });
    return { rod, reel, hook, lineSystem };
  }

  #getLineSystemConfig() {
    return this.physicsConfig?.getLineSystemConfig?.() || {};
  }
}

class FishingForceService {
  #config;
  #fishForceApplied = new Vector2(0, 0);
  #playerForce = new Vector2(0, 0);
  #playerForceApplied = new Vector2(0, 0);
  #pullDirection = new Vector2(0, 0);
  #upDirection = { x: 0, y: 1 };
  #forces = { pX: 0, pY: 0, fX: 0, fY: 0 };

  constructor(config) {
    this.#config = config;
  }

  applyForces(dt, context) {
    const {
      floatEntity,
      bounds,
      input,
      env,
      getRodVirtualPos,
      getBaseRodVirtualPos,
      rodControlCastAnchor,
      checkWater,
      rod,
      reel,
      fishForceSystem,
      lineSystem,
      dragSystem,
      pullInputMapper,
      rodPullSystem,
      rodControlSystem,
      reelSystem,
      tensionSystem,
      stressSystem,
      fightPhysicsSystem,
      fishCondition,
      buffs,
    } = context;
    return fightPhysicsSystem.step({
      dtMs: dt,
      floatEntity,
      bounds,
      input,
      env,
      checkWater,
      rodTipPosition:
        getBaseRodVirtualPos?.(bounds) || getRodVirtualPos(bounds),
      actualRodTipPosition: getRodVirtualPos(bounds),
      rodControlCastAnchor,
      rod,
      reel,
      fishForceSystem,
      lineSystem,
      dragSystem,
      pullInputMapper,
      rodPullSystem,
      rodControlSystem,
      reelSystem,
      tensionSystem,
      stressSystem,
      fishCondition,
      buffs,
    });
  }
}

class CatchResolutionService {
  #landingPolicyResolver;

  constructor({ landingPolicyResolver = null } = {}) {
    this.#landingPolicyResolver = landingPolicyResolver || new LandingPolicyResolver();
  }

  reset() {}

  resolveAutoCatch({
    fishData,
    lineDistanceMeters,
    shoreLandingDistanceMeters,
    maxTackleLoadKg,
    config,
    rod = null,
    reel = null,
    landingFrame = null,
    fightDebug = null,
  }) {
    const physicsConfig =
      config?.fightPhysicsConfig ||
      (typeof FightPhysicsConfigAdapter !== "undefined"
        ? new FightPhysicsConfigAdapter(config)
        : null);
    const cfg = physicsConfig?.getCatchZoneConfig?.() || {};
    const landingPolicy = this.#landingPolicyResolver.resolve({ rod, reel });
    const landingDistanceMeters = landingPolicy.getLandingDistanceMeters({
      rod,
      reel,
      config,
      lineDistanceMeters,
      fishData,
      maxTackleLoadKg,
    });
    const rawShoreDistanceMeters = Number(
      landingFrame?.shoreLandingDistanceMeters ??
        shoreLandingDistanceMeters ??
        lineDistanceMeters,
    );
    const shoreDistanceMeters = Number.isFinite(rawShoreDistanceMeters)
      ? Math.max(0, rawShoreDistanceMeters)
      : Infinity;
    if (shoreDistanceMeters > landingDistanceMeters) return {};

    const readiness = this.#resolveLandingReadiness({
      physicsConfig,
      landingFrame,
    });
    const landingReady = readiness.ready;
    const success = this.#canLandByWeight({
      fishWeightKg: fishData?.weight,
      maxTackleLoadKg,
      config: cfg,
    }) && landingReady;
    const transition = success
      ? { name: "victory", data: { fish: fishData } }
      : null;
    if (transition) {
      this.#logAutoCatchVictory({
        fishData,
        shoreDistanceMeters,
        landingDistanceMeters,
        landingPolicy,
        maxTackleLoadKg,
        catchConfig: cfg,
        landingReady,
        readiness,
        landingFrame,
        fightDebug,
      });
    }
    return {
      inLandingZone: true,
      landingReady,
      landingReadyReason: readiness.reason,
      landingReadiness: readiness,
      success,
      shoreLandingDistanceMeters: shoreDistanceMeters,
      landingDistanceMeters,
      landingPolicy: landingPolicy.constructor?.name || "LandingPolicy",
      transition,
    };
  }

  getLandingRollProgress(_config) {
    return 1;
  }

  resolveNetAttempt(net, fishWeight, rng, fishData) {
    const chance = net.calculateCatchChance(fishWeight);
    const roll = rng.range(0, 100);
    const success = chance > 0 && roll < chance;
    return {
      chance,
      roll,
      success,
      transition: {
        name: success ? "victory" : "failed",
        data: { reason: success ? null : "net_escape", fish: fishData },
      },
    };
  }

  #canLandByWeight({ fishWeightKg, maxTackleLoadKg, config }) {
    const fishWeight = Math.max(0, Number(fishWeightKg) || 0);
    const maxLoad = Math.max(0, Number(maxTackleLoadKg) || 0);
    if (maxLoad <= 0) return false;

    const maxRatio = Math.max(0, Number(config.maxLoadWeightRatio) || 1.0);
    return fishWeight <= maxLoad * maxRatio + 0.0001;
  }

  #resolveLandingReadiness({ physicsConfig, landingFrame }) {
    if (landingFrame?.readiness) {
      return landingFrame.readiness;
    }

    const liftConfig = physicsConfig?.getLandingLiftConfig?.() || {};
    if (liftConfig.enabled === false) {
      return {
        ready: true,
        reason: "landing_lift_disabled",
      };
    }

    return {
      ready: false,
      reason: "landing_frame_missing",
      liftRequiredKg: 0,
      liftHoldKg: 0,
      supportedTensionKg: 0,
      rawTensionKg: 0,
      visibleTensionKg: 0,
      dragSlipping: false,
    };
  }

  #logAutoCatchVictory({
    fishData,
    shoreDistanceMeters,
    landingDistanceMeters,
    landingPolicy,
    maxTackleLoadKg,
    catchConfig,
    landingReady,
    readiness,
    landingFrame,
    fightDebug,
  }) {
    if (typeof console === "undefined") return;
    if (typeof window === "undefined" || !window?.document) return;
    if (window.DEBUG_MODULES?.catchResolution !== true) return;

    const fishWeightKg = Math.max(0, Number(fishData?.weight) || 0);
    const maxRatio = Math.max(
      0,
      Number(catchConfig?.maxLoadWeightRatio) || 1,
    );
    const maxAllowedWeightKg =
      Math.max(0, Number(maxTackleLoadKg) || 0) * maxRatio;
    const reason =
      landingReady
        ? "landing_lift_ready"
        : readiness?.reason || "landing_lift_disabled_or_legacy";
    const lift = landingFrame?.lift || {};
    const tension = landingFrame?.tension || {};
    const values = {
      reason,
      fishId: fishData?.id || fishData?.name || "unknown",
      fishWeightKg,
      maxTackleLoadKg: Number(maxTackleLoadKg) || 0,
      maxAllowedWeightKg,
      maxLoadWeightRatio: maxRatio,
      lineDistanceMeters:
        Number(landingFrame?.lineDistanceMeters ?? fightDebug?.lineDistanceMeters) || 0,
      shoreLandingDistanceMeters: shoreDistanceMeters,
      landingDistanceMeters,
      landingPolicy: landingPolicy?.constructor?.name || "LandingPolicy",
      landingReady: !!landingReady,
      landingReadyReason: readiness?.reason || "not_checked",
      landingLiftActive: !!(lift.active ?? fightDebug?.landingLiftActive),
      landingLiftInZone: !!(lift.inLandingZone ?? fightDebug?.landingLiftInZone),
      landingLiftHoldKg:
        Number(lift.liftHoldKg ?? fightDebug?.landingLiftHoldKg) || 0,
      landingLiftMaxKg:
        Number(lift.liftMaxKg ?? fightDebug?.landingLiftMaxKg) || 0,
      landingLiftWaterTensionKg:
        Number(lift.waterFightTensionKg ?? fightDebug?.landingLiftWaterTensionKg) || 0,
      landingLiftFishTensionKg:
        Number(lift.fishTensionKg ?? fightDebug?.landingLiftFishTensionKg) || 0,
      landingLiftProgressRatio:
        Number(lift.progressRatio ?? fightDebug?.landingLiftProgressRatio) || 0,
      landingLiftTackleLoadProgressRatio:
        Number(
          lift.tackleLoadProgressRatio ??
            fightDebug?.landingLiftTackleLoadProgressRatio,
        ) || 0,
      landingLiftSlowdownRatio:
        Number(lift.slowdownRatio ?? fightDebug?.landingLiftSlowdownRatio) || 0,
      landingLiftSpeedRatio:
        Number(lift.speedRatio ?? fightDebug?.landingLiftSpeedRatio) || 0,
      landingLiftGainKgPerSecond:
        Number(lift.gainKgPerSecond ?? fightDebug?.landingLiftGainKgPerSecond) || 0,
      tensionKg: Number(fightDebug?.tensionKg) || 0,
      targetTensionKg: Number(fightDebug?.targetTensionKg) || 0,
      supportedTensionKg:
        Number(readiness?.supportedTensionKg ?? tension.supportedTensionKg) || 0,
      totalTensionKg:
        Number(tension.totalTensionKg ?? fightDebug?.totalTensionKg) || 0,
      rawTensionKg:
        Number(tension.rawTensionKg ?? fightDebug?.rawTensionKg) || 0,
      rawTotalTensionKg:
        Number(tension.rawTotalTensionKg ?? fightDebug?.rawTotalTensionKg) || 0,
      visibleTensionKg:
        Number(tension.visibleTensionKg ?? fightDebug?.visibleTensionKg) || 0,
      fishTensionKg:
        Number(lift.fishTensionKg ?? fightDebug?.fishTensionKg) || 0,
      playerHoldTensionKg: Number(fightDebug?.playerHoldTensionKg) || 0,
      rodHoldKg: Number(fightDebug?.activeRodPullForceKg) || 0,
      rodHoldMaxKg: Number(fightDebug?.rodHoldMaxKg) || 0,
      effectiveRodHoldKg: Number(fightDebug?.effectiveRodHoldKg) || 0,
      holdTensionRatio: Number(fightDebug?.holdTensionRatio) || 0,
      rodStrokeRatio: Number(fightDebug?.rodStrokeRatio) || 0,
      rodPullBlockedReason: fightDebug?.rodPullBlockedReason || "none",
      rodPullDragSlipping: !!fightDebug?.rodPullDragSlipping,
      dragLimitKg: Number(fightDebug?.dragLimitKg) || 0,
      dragLocked: !!fightDebug?.dragLocked,
      reelSlip: !!fightDebug?.reelSlip,
      rodStressRatio: Number(fightDebug?.rodStressRatio) || 0,
      lineStressRatio: Number(fightDebug?.lineStressRatio) || 0,
      hookStressRatio: Number(fightDebug?.hookStressRatio) || 0,
      lineCanRelease: !!fightDebug?.lineCanRelease,
      hardLineLimit: !!fightDebug?.hardLineLimit,
    };

    console.groupCollapsed?.("[CatchResolution] victory: " + reason);
    if (typeof console.table === "function") {
      console.table(values);
    } else {
      console.log(values);
    }
    console.groupEnd?.();
  }
}

class FightService {
  #config;
  #physicsConfig;
  #rng;
  #devFlags;
  #upDirection = { x: 0, y: 1 };
  #forces = { pX: 0, pY: 0, fX: 0, fY: 0 };
  #forceService;
  #catchResolver;
  #fishingSystem = null;
  #fish = null;
  #fishForceSystem = null;
  #lineSystem = null;
  #dragSystem = null;
  #pullInputMapper = null;
  #rodPullSystem = null;
  #rodControlSystem = null;
  #reelSystem = null;
  #tensionSystem = null;
  #fightPhysicsSystem = null;
  #tensionMeter = null;
  #fishCondition = null;
  #staminaController = null;
  #rod = null;
  #reel = null;
  #hook = null;

  #fightSessionFactory;

  constructor({
    config,
    rng,
    devFlags = null,
    fightSessionFactory = null,
    forceService = null,
    catchResolver = null,
  }) {
    this.#config = config;
    this.#physicsConfig =
      config?.fightPhysicsConfig ||
      (typeof FightPhysicsConfigAdapter !== "undefined"
        ? new FightPhysicsConfigAdapter(config)
        : null);
    this.#rng = rng;
    this.#devFlags = devFlags;
    this.#fightSessionFactory =
      fightSessionFactory || new FightSessionFactory({ config, rng, devFlags });
    this.#forceService = forceService || new FishingForceService(config);
    this.#catchResolver = catchResolver || new CatchResolutionService();
  }

  startFight(fishData, equipment) {
    const session = this.#fightSessionFactory.create(fishData, equipment);
    this.#rod = session.rod;
    this.#reel = session.reel;
    this.#hook = session.hook;
    this.#fish = session.fish;
    this.#fishForceSystem = session.fishForceSystem;
    this.#lineSystem = session.lineSystem;
    this.#dragSystem = session.dragSystem;
    this.#pullInputMapper = session.pullInputMapper;
    this.#rodPullSystem = session.rodPullSystem;
    this.#rodControlSystem = session.rodControlSystem;
    this.#reelSystem = session.reelSystem;
    this.#tensionSystem = session.tensionSystem;
    this.#fightPhysicsSystem = session.fightPhysicsSystem;
    this.#fightPhysicsSystem?.resetPlayerPullMotion?.();
    this.#tensionMeter = session.tensionMeter;
    this.#fishingSystem = this.#createDebugFishingAdapter();
    this.#fishCondition = session.fishCondition;
    this.#staminaController = session.staminaController;
    this.#catchResolver.reset?.();
  }

  syncEquipment(equipment) {
    if (!this.#tensionMeter || !this.#staminaController)
      return;
    const next = this.#fightSessionFactory.createEquipment(equipment);
    this.#rod = next.rod;
    this.#reel = next.reel;
    this.#hook = next.hook;
    this.#lineSystem = next.lineSystem;
    this.#dragSystem?.updateEquipment(this.#reel);
    this.#pullInputMapper?.reset?.();
    this.#rodPullSystem?.reset?.();
    this.#rodControlSystem?.reset?.();
    this.#fightPhysicsSystem?.resetPlayerPullMotion?.();
    this.#tensionMeter.updateEquipment({
      rod: this.#rod,
      reel: this.#reel,
      lineSystem: this.#lineSystem,
      hook: this.#hook,
      leader: equipment.leader,
    });
    this.#fishingSystem = this.#createDebugFishingAdapter();
  }

  syncFishRuntime(fishData) {
    if (!this.#fish || !fishData) return;
    this.#fish.updateRuntimeStats?.({
      level: fishData.level,
      weight: fishData.weight,
      physics: fishData.physics,
    });
    this.#fishingSystem = this.#createDebugFishingAdapter();
  }

  /** @returns {FightUpdateResult} */
  updateFight(dt, context) {
    if (this.#tensionMeter.isBroken()) {
      return {
        transition: {
          name: "failed",
          data: {
            reason: this.#tensionMeter.getBreakReason(),
            failure: this.#tensionMeter.getBreakInfo?.(),
          },
        },
      };
    }
    this.#syncGodModeStamina();
    const {
      floatEntity,
      bounds,
      input,
      net,
      fishData,
    } = context;
    const forceData = this.#forceService.applyForces(dt, {
      ...context,
      rod: this.#rod,
      reel: this.#reel,
      fishForceSystem: this.#fishForceSystem,
      lineSystem: this.#lineSystem,
      dragSystem: this.#dragSystem,
      pullInputMapper: this.#pullInputMapper,
      rodPullSystem: this.#rodPullSystem,
      rodControlSystem: this.#rodControlSystem,
      reelSystem: this.#reelSystem,
      tensionSystem: this.#tensionSystem,
      stressSystem: this.#tensionMeter,
      fightPhysicsSystem: this.#fightPhysicsSystem,
      fishCondition: this.#fishCondition,
      buffs: null,
    });
    this.#forces = forceData.forces;
    const fightDebug = this.#tensionMeter.getDebugData?.() || {};
    const staminaFrame = forceData.fightFrame?.stamina || {};
    if (this.#isFishStaminaLocked()) {
      this.#syncGodModeStamina();
    } else {
      this.#staminaController.evaluate({
        staminaFrame,
        dt,
      });
    }
    const resolution = this.#catchResolver.resolveAutoCatch({
      fishData,
      lineDistanceMeters: forceData.fightFrame?.landing?.lineDistanceMeters,
      shoreLandingDistanceMeters:
        forceData.fightFrame?.landing?.shoreLandingDistanceMeters,
      maxTackleLoadKg: this.#tensionMeter.getEffectiveMaxTackleLoadKg?.(),
      dtMs: dt,
      rng: this.#rng,
      config: this.#config,
      rod: this.#rod,
      reel: this.#reel,
      landingFrame: forceData.fightFrame?.landing,
      fightDebug,
    });
    if (resolution.transition) return { transition: resolution.transition };
    return {};
  }

  #syncGodModeStamina() {
    if (!this.#isFishStaminaLocked()) return;
    this.#staminaController?.restoreFullStamina?.();
  }

  #isFishStaminaLocked() {
    if (this.#devFlags?.isEnabled?.("noFishStaminaLoss")) return true;
    const godMode = this.#config?.debug?.godMode;
    return godMode?.enabled === true && godMode.noFishStaminaLoss === true;
  }

  handlePlayerInput(input, equipment) {
    // DragSystem now reads pointerStart / pointerCurrent every frame in
    // FightPhysicsSystem.step(), using the same drag-to-fill model as cast power.
    // Do not consume swipeDeltaY here, otherwise it becomes a one-shot 10% step again.
    return {
      consumedSwipe: false,
    };
  }

  handleNetAttempt(net, rng, fishData) {
    return this.#catchResolver.resolveNetAttempt(
      net,
      this.#fish?.getWeight?.() || 0,
      rng,
      fishData,
    );
  }

  #createDebugFishingAdapter() {
    return {
      calculatePlayerForce: () => ({
        x: 0,
        y: this.#tensionMeter?.getEffectiveMaxTackleLoadKg?.() || 0,
      }),
      getCurrentState: () =>
        this.#tensionMeter?.getDebugData?.().fishState || "idle",
      getFishBasePower: () =>
        this.#tensionMeter?.getDebugData?.().fishBasePower || 0,
      getFishInitialPower: () =>
        this.#tensionMeter?.getDebugData?.().fishInitialPower || 0,
      getPullMultiplier: () =>
        this.#tensionMeter?.getDebugData?.().pullMult || 0,
      getMoveMultiplier: () =>
        this.#tensionMeter?.getDebugData?.().moveMult || 0,
      getActiveDebuffName: () => this.#fish?.activeDebuffName || "Немає",
      getMasteryMultiplier: () => this.#fish?.getMasteryMultiplier?.() || 1.0,
    };
  }

  /**
   * Pure data context — no Game/facade dependency.
   * @param {{ floatEntity: object, boundaries: object, rodPos: Vector2, screenOffset: number, equipment: object }} ctx
   */
  getDebugData({ floatEntity, boundaries, rodPos, screenOffset, equipment }) {
    const fs = this.#fishingSystem;
    const sc = this.#staminaController;
    const floatPos = floatEntity.getPosition();
    const bounds = boundaries;

    const maxP = this.#fishingSystem.calculatePlayerForce(
      this.#upDirection,
      floatPos.x,
      floatPos.y,
      rodPos,
      screenOffset,
      this.#getDebugPhysicsConfig(),
      bounds,
    );
    const xRange = this.#physicsConfig?.getDistanceXMultiplier?.() || [1.0, 1.0];
    const boundsHeight = Math.max(1, bounds.bottom - bounds.top);
    const distRatio = Math.max(
      0,
      Math.min(1.0, (floatPos.y - bounds.top) / boundsHeight),
    );
    const depthScaleX = xRange[0] + distRatio * (xRange[1] - xRange[0]);
    const steerP =
      (this.#tensionMeter?.getEffectiveMaxTackleLoadKg?.() || 0) *
      (
        this.#physicsConfig?.getPlayerSteeringMultiplier?.() ??
        1.5
      ) *
      depthScaleX;
    return {
      playerForceY: Math.abs(this.#forces.pY || 0),
      playerForceX: Math.abs(this.#forces.pX || 0),
      fishForceY: Math.abs(this.#forces.fY || 0),
      fishForceX: Math.abs(this.#forces.fX || 0),
      playerMaxPowerY: Math.abs(maxP.y || 0),
      playerMaxPowerX: steerP,
      fishState: fs?.getCurrentState?.() || "idle",
      fishBasePower: fs?.getFishBasePower?.() || 0,
      fishInitialPower: fs?.getFishInitialPower?.() || 0,
      tension: this.#tensionMeter?.getTension?.() || 0,
      lineBreakProgress: this.#tensionMeter?.getLineBreakProgress?.() || 0,
      ...(this.#tensionMeter?.getDebugData?.() || {}),
      fishConditionPhase: this.#fishCondition?.phase || "n/a",
      fishConditionMaxStamina: this.#fishCondition?.maxStamina || 0,
      fishConditionMaxEndurance: this.#fishCondition?.maxEndurance || 0,
      fishConditionMaxPoints: this.#fishCondition?.maxPoints || 0,
      currentStamina: this.#fishCondition?.currentStamina || 0,
      currentExhaustion: this.#fishCondition?.currentExhaustion || 0,
      pullMult: fs?.getPullMultiplier?.() || 0,
      moveMult: fs?.getMoveMultiplier?.() || 0,
      activeDebuffName: fs?.getActiveDebuffName?.() || "Немає",
      masteryCurrentMult: fs?.getMasteryMultiplier?.() || 1.0,
      masteryTimerMs: sc?.getMasteryTimer?.() || 0,
      isMasteryActive: sc?.isMasteryActive?.() || false,
      exhaustionDurationMs: sc?.getExhaustionDurationMs?.() || 1000,
    };
  }

  getHoldUiState() {
    return null;
  }

  get tensionMeter() {
    return this.#tensionMeter;
  }

  #getDebugPhysicsConfig() {
    return this.#physicsConfig?.getLineSystemConfig?.() || {};
  }

  get fishCondition() {
    return this.#fishCondition;
  }

  endFight() {
    this.#fightPhysicsSystem?.resetPlayerPullMotion?.();
  }
}
