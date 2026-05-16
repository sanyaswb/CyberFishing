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

  applyFailureEquipmentLoss(reason, eq) {
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
      reason === "reel" ||
      reason === "hook" ||
      reason === "net_escape"
    ) {
      this.#equipment.consumeAllBaits(eq);
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

    if (reason === "reel" && eq?.reel) {
      this.#equipment.consumeReel(eq);
    }

    if (reason === "line" && eq?.line) {
      this.#equipment.consumeLine(eq);
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
  constructor({ config, rng, castDistanceCalculator = null }) {
    this.config = config;
    this.rng = rng;
    this.castDistanceCalculator =
      castDistanceCalculator || new CastDistanceCalculator(config || {});
  }

  create(fishData, equipment) {
    const rod = new Rod(
      equipment.rod?.level || 1,
      equipment.rod?.basePower || 1.0,
      equipment.rod?.compensation || 0,
      equipment.rod?.type || "float",
      this.castDistanceCalculator.getMaxCastDistancePx(equipment, 100),
      equipment.rod?.hasReel !== false,
      {
        lengthMeters: equipment.rod?.lengthMeters,
        maxLoadKg: equipment.rod?.maxLoadKg,
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
            dragMinKg: equipment.reel.dragMinKg,
            dragMaxKg: equipment.reel.dragMaxKg,
            dragChangeSpeedPerSec: equipment.reel.dragChangeSpeedPerSec,
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
    );
    const fish = new Fish(
      fishData.level,
      fishData.weight,
      fishData.resistance,
      fishData.physics,
      this.rng,
    );
    const lineSystem = new LineSystem({
      rod,
      reel,
      config: this.config.physics,
      lineStats: equipment.line,
      castDistanceCalculator: this.castDistanceCalculator,
    });
    const dragSystem = new DragSystem(this.config.physics?.drag, reel);
    const fishForceSystem = new FishForceSystem({
      fish,
      config: this.config,
    });
    const pullInputMapper = new PullInputMapper();
    const rodPullSystem = new RodPullSystem(this.config.physics?.rodPull);
    const reelSystem = new ReelSystem(this.config.physics?.reel);
    const tensionSystem = new TensionSystem();
    const tensionMeter = new TackleStressSystem({
      rod,
      reel,
      lineSystem,
      config: this.config.tension,
      rng: this.rng,
    });
    const fightPhysicsSystem = new FightPhysicsSystem(this.config);
    const fishCondition = new FishCondition(
      fishData.level,
      fishData.weight,
      this.config.stamina.fish,
      fishData.physics,
    );
    const staminaController = new StaminaController(
      fishCondition,
      fish,
      tensionMeter.getEffectiveMaxTackleLoadKg(),
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
      reelSystem,
      tensionSystem,
      fightPhysicsSystem,
      tensionMeter,
      fishCondition,
      staminaController,
    };
  }

  createEquipment(equipment) {
    const rod = new Rod(
      equipment.rod?.level || 1,
      equipment.rod?.basePower || 1.0,
      equipment.rod?.compensation || 0,
      equipment.rod?.type || "float",
      this.castDistanceCalculator.getMaxCastDistancePx(equipment, 100),
      equipment.rod?.hasReel !== false,
      {
        lengthMeters: equipment.rod?.lengthMeters,
        maxLoadKg: equipment.rod?.maxLoadKg,
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
            dragMinKg: equipment.reel.dragMinKg,
            dragMaxKg: equipment.reel.dragMaxKg,
            dragChangeSpeedPerSec: equipment.reel.dragChangeSpeedPerSec,
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
    );
    const lineSystem = new LineSystem({
      rod,
      reel,
      config: this.config.physics,
      lineStats: equipment.line,
      castDistanceCalculator: this.castDistanceCalculator,
    });
    return { rod, reel, hook, lineSystem };
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
      checkWater,
      rod,
      reel,
      fishForceSystem,
      lineSystem,
      dragSystem,
      pullInputMapper,
      rodPullSystem,
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
      rodTipPosition: getRodVirtualPos(bounds),
      rod,
      reel,
      fishForceSystem,
      lineSystem,
      dragSystem,
      pullInputMapper,
      rodPullSystem,
      reelSystem,
      tensionSystem,
      stressSystem,
      fishCondition,
      buffs,
    });
  }
}

class CatchResolutionService {
  #landingRollTimerMs = 0;

  reset() {
    this.#landingRollTimerMs = 0;
  }

  resolveAutoCatch({
    fishData,
    lineDistanceMeters,
    maxTackleLoadKg,
    dtMs,
    rng,
    config,
  }) {
    const cfg = config?.physics?.catchZone || {};
    const landingDistanceMeters = Math.max(
      0,
      Number(cfg.landingDistanceMeters) || 1,
    );
    const distanceMeters = Math.max(0, Number(lineDistanceMeters) || Infinity);
    if (distanceMeters > landingDistanceMeters) {
      this.#landingRollTimerMs = 0;
      return {};
    }

    this.#landingRollTimerMs += Math.max(0, Number(dtMs) || 0);
    const intervalMs = Math.max(1, Number(cfg.rollIntervalMs) || 1000);
    if (this.#landingRollTimerMs < intervalMs) return { inLandingZone: true };
    this.#landingRollTimerMs = 0;

    const chance = this.#calculateLandingChance({
      fishWeightKg: fishData?.weight,
      maxTackleLoadKg,
      config: cfg,
    });
    const roll = rng?.range?.(0, 100) ?? Math.random() * 100;
    const success = chance > 0 && roll < chance * 100;
    return {
      inLandingZone: true,
      chance,
      roll,
      success,
      transition: success
        ? { name: "victory", data: { fish: fishData } }
        : null,
    };
  }

  getLandingRollProgress(config) {
    const intervalMs = Math.max(
      1,
      Number(config?.physics?.catchZone?.rollIntervalMs) || 1000,
    );
    return Math.min(1, this.#landingRollTimerMs / intervalMs);
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

  #calculateLandingChance({ fishWeightKg, maxTackleLoadKg, config }) {
    const fishWeight = Math.max(0, Number(fishWeightKg) || 0);
    const maxLoad = Math.max(0, Number(maxTackleLoadKg) || 0);
    if (maxLoad <= 0) return 0;

    const ratio = fishWeight / maxLoad;
    const guaranteedRatio = Math.max(
      0,
      Number(config.guaranteedWeightRatio) || 0.2,
    );
    const maxRatio = Math.max(
      guaranteedRatio,
      Number(config.maxLoadWeightRatio) || 1.0,
    );
    const chanceAtGuaranteed = Math.max(
      0,
      Math.min(1, Number(config.chanceAtGuaranteedRatio) || 1.0),
    );
    const chanceAtMax = Math.max(
      0,
      Math.min(1, Number(config.chanceAtMaxLoadRatio) || 0.01),
    );

    if (ratio > maxRatio) {
      return Math.max(0, Math.min(1, Number(config.overweightChance) || 0));
    }
    if (ratio <= guaranteedRatio) return chanceAtGuaranteed;

    const t =
      (ratio - guaranteedRatio) / Math.max(0.001, maxRatio - guaranteedRatio);
    return chanceAtGuaranteed + (chanceAtMax - chanceAtGuaranteed) * t;
  }
}

class FightService {
  #config;
  #rng;
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
  #reelSystem = null;
  #tensionSystem = null;
  #fightPhysicsSystem = null;
  #tensionMeter = null;
  #fishCondition = null;
  #staminaController = null;
  #rod = null;
  #reel = null;

  #fightSessionFactory;

  constructor({
    config,
    rng,
    fightSessionFactory = null,
    forceService = null,
    catchResolver = null,
  }) {
    this.#config = config;
    this.#rng = rng;
    this.#fightSessionFactory =
      fightSessionFactory || new FightSessionFactory({ config, rng });
    this.#forceService = forceService || new FishingForceService(config);
    this.#catchResolver = catchResolver || new CatchResolutionService();
  }

  startFight(fishData, equipment) {
    const session = this.#fightSessionFactory.create(fishData, equipment);
    this.#rod = session.rod;
    this.#reel = session.reel;
    this.#fish = session.fish;
    this.#fishForceSystem = session.fishForceSystem;
    this.#lineSystem = session.lineSystem;
    this.#dragSystem = session.dragSystem;
    this.#pullInputMapper = session.pullInputMapper;
    this.#rodPullSystem = session.rodPullSystem;
    this.#reelSystem = session.reelSystem;
    this.#tensionSystem = session.tensionSystem;
    this.#fightPhysicsSystem = session.fightPhysicsSystem;
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
    this.#lineSystem = next.lineSystem;
    this.#dragSystem?.updateEquipment(this.#reel);
    this.#pullInputMapper?.reset?.();
    this.#rodPullSystem?.reset?.();
    this.#tensionMeter.updateEquipment({
      rod: this.#rod,
      reel: this.#reel,
      lineSystem: this.#lineSystem,
    });
    this.#fishingSystem = this.#createDebugFishingAdapter();
    this.#staminaController.updatePlayerPower(
      this.#tensionMeter.getEffectiveMaxTackleLoadKg(),
    );
  }

  /** @returns {FightUpdateResult} */
  updateFight(dt, context) {
    if (this.#tensionMeter.isBroken()) {
      return {
        transition: {
          name: "failed",
          data: { reason: this.#tensionMeter.getBreakReason() },
        },
      };
    }
    const {
      floatEntity,
      bounds,
      input,
      net,
      fishData,
      projectorScale,
      catchLineOffsetPx,
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
      reelSystem: this.#reelSystem,
      tensionSystem: this.#tensionSystem,
      stressSystem: this.#tensionMeter,
      fightPhysicsSystem: this.#fightPhysicsSystem,
      fishCondition: this.#fishCondition,
      buffs: null,
    });
    this.#forces = forceData.forces;
    const isRetrieveOnly =
      this.#reel?.hasReel?.() &&
      input.retrieve &&
      !input.isPulling &&
      !input.pointerDown;
    const fightDebug = this.#tensionMeter.getDebugData?.() || {};
    this.#staminaController.evaluate({
      tension: this.#tensionMeter.getTension(),
      playerPowerIsPulling: input.isPulling && !isRetrieveOnly,
      dt,
      angleStressRatio: fightDebug.angleStressRatio || 0,
      staminaPressureRatio: fightDebug.staminaPressureRatio || 0,
      isLineFullyExtended: !!fightDebug.isLineFullyExtended,
    });
    const resolution = this.#catchResolver.resolveAutoCatch({
      fishData,
      lineDistanceMeters: fightDebug.lineDistanceMeters,
      maxTackleLoadKg: this.#tensionMeter.getEffectiveMaxTackleLoadKg?.(),
      dtMs: dt,
      rng: this.#rng,
      config: this.#config,
    });
    if (resolution.transition) return { transition: resolution.transition };
    return {};
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
      this.#config.physics,
      bounds,
    );
    const xRange = this.#config.physics?.distanceXMultiplier || [1.0, 1.0];
    const boundsHeight = Math.max(1, bounds.bottom - bounds.top);
    const distRatio = Math.max(
      0,
      Math.min(1.0, (floatPos.y - bounds.top) / boundsHeight),
    );
    const depthScaleX = xRange[0] + distRatio * (xRange[1] - xRange[0]);
    const steerP =
      (this.#tensionMeter?.getEffectiveMaxTackleLoadKg?.() || 0) *
      (this.#config.physics.playerSteeringMultiplier ?? 1.5) *
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

  get fishCondition() {
    return this.#fishCondition;
  }

  endFight() {}
}
