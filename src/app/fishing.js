class FishingController {
  #inventory;
  #equipment;
  #devFlags;
  #equipmentRules;
  #baitRules;

  constructor({ inventory, equipment, devFlags, equipmentRules, baitRules }) {
    this.#inventory = inventory;
    this.#equipment = equipment;
    this.#devFlags = devFlags;
    this.#equipmentRules = equipmentRules;
    this.#baitRules = baitRules;
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

    const baits = eq?.baits || [];
    const eaten = eatenBaits || [];
    for (let i = 0; i < baits.length; i++) {
      const bait = baits[i];
      if (!bait) continue;

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
      reason === "hook" ||
      reason === "net_escape"
    ) {
      this.#equipment.consumeAllBaits(eq);
    }

    if (reason === "rod" || reason === "line") {
      this.#equipment.consumeAllHooks(eq);
      this.#equipment.consumeFloat(eq);
      this.#equipment.consumeSinker(eq);
      this.#consumeFeederChumLoad(eq);
    }

    if (reason === "rod" && eq?.rod) {
      this.#equipment.consumeRod(eq);
    }
  }

  tryConsumeBaitDuringBite(eq, stepInfo, rng, physicsConfig) {
    if (!stepInfo?.isAction) return false;

    let consumedBaitId = null;
    const baits = eq?.baits || [];
    for (let i = 0; i < baits.length; i++) {
      if (baits[i] && baits[i].type === "bait") {
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

  constructor({
    config,
    rng,
    clock,
    equipmentRules,
    baitRules,
    getRodVirtualPos,
    getDynamicBounds,
  }) {
    this.#config = config;
    this.#rng = rng;
    this.#clock = clock;
    this.#equipmentRules = equipmentRules;
    this.#baitRules = baitRules;
    this.#getRodVirtualPos = getRodVirtualPos;
    this.#getDynamicBounds = getDynamicBounds;
  }

  cast(vx, vy, cellDepth, context) {
    const eq = context.equipment;
    if (!eq?.rod) return { success: false, reason: "missing_rod" };
    const needsReel = this.#equipmentRules.requiresReel(eq);
    if (needsReel && !eq.reel)
      return { success: false, reason: "missing_reel" };

    const rodPos = this.#getRodVirtualPos(this.#getDynamicBounds());
    const dist = Math.hypot(vx - rodPos.x, vy - rodPos.y);
    const maxDist = normalizeDistance(eq.rod?.maxDistance, 2000);
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
  constructor({ config, rng }) {
    this.config = config;
    this.rng = rng;
  }

  create(fishData, equipment) {
    const rod = new Rod(
      equipment.rod?.level || 1,
      equipment.rod?.basePower || 1.0,
      equipment.rod?.compensation || 0,
      equipment.rod?.type || "float",
      normalizeDistance(equipment.rod?.maxDistance, 100),
      equipment.rod?.hasReel !== false,
    );
    const reel = equipment.reel
      ? new Reel(
          equipment.reel.level || 1,
          equipment.reel.basePower || 1.0,
          equipment.reel.hold || null,
        )
      : new Reel(0, 0, null);
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
    const fishingSystem = new FishingSystem(rod, reel, fish, this.rng);
    const tensionMeter = new TensionMeter(
      equipment.rod?.level || 1,
      equipment.reel?.level || 0,
      hook,
      this.config.tension,
      this.rng,
    );
    const fishCondition = new FishCondition(
      fishData.level,
      fishData.weight,
      this.config.stamina.fish,
    );
    const staminaController = new StaminaController(
      fishCondition,
      fish,
      rod.getPower() + reel.getPower(),
      this.config.stamina.mechanics,
    );
    return {
      rod,
      reel,
      hook,
      fish,
      fishingSystem,
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
      normalizeDistance(equipment.rod?.maxDistance, 100),
      equipment.rod?.hasReel !== false,
    );
    const reel = equipment.reel
      ? new Reel(
          equipment.reel.level || 1,
          equipment.reel.basePower || 1.0,
          equipment.reel.hold || null,
        )
      : new Reel(0, 0, null);
    const activeHook = equipment.hooks?.[0] || {};
    const hook = new Hook(
      activeHook.level || 1,
      activeHook.weight || 1,
      activeHook.quality || 1.0,
    );
    return { rod, reel, hook };
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
      fishingSystem,
      floatEntity,
      bounds,
      input,
      env,
      getRodVirtualPos,
      getScreenOffsetRatio,
      checkWater,
    } = context;
    const floatPos = floatEntity.getPosition();
    const fishForceRaw = fishingSystem.calculateFishForce(
      dt,
      floatPos,
      bounds,
      this.#config.stamina.mechanics,
      checkWater,
    );
    let tFishY = fishForceRaw.y;
    const activeHold = fishingSystem.isHoldActive();
    if (activeHold && tFishY < 0) {
      tFishY = 0;
      fishForceRaw.y *= fishingSystem.getHoldTensionMultiplier?.() || 1.0;
    }
    floatEntity.applyForce(
      this.#fishForceApplied
        .set(fishForceRaw.x, tFishY)
        .multiplyScalar(this.#config.physics.fishForceMultiplier),
    );
    const rodPos = getRodVirtualPos(bounds);
    const screenOffset = getScreenOffsetRatio(floatPos);
    const pF = this.#playerForce.set(0, 0);
    if (input.isPulling) {
      pF.copy(
        fishingSystem.calculatePlayerForce(
          input.pullDirection,
          floatPos.x,
          floatPos.y,
          rodPos,
          screenOffset,
          this.#config.physics,
          bounds,
        ),
      );
      this.#playerForceApplied
        .copy(pF)
        .multiplyScalar(this.#config.physics.playerForceMultiplier);
      floatEntity.applyForce(this.#playerForceApplied);
    }
    this.#forces.pX = pF.x;
    this.#forces.pY = pF.y;
    this.#forces.fX = fishForceRaw.x;
    this.#forces.fY = fishForceRaw.y;
    const pMax = Math.abs(
      fishingSystem.calculatePlayerForce(
        this.#upDirection,
        floatPos.x,
        floatPos.y,
        rodPos,
        screenOffset,
        this.#config.physics,
        bounds,
      ).y * this.#config.physics.playerForceMultiplier,
    );
    const fMag =
      Math.max(Math.abs(fishForceRaw.x), Math.abs(fishForceRaw.y)) *
      this.#config.physics.fishForceMultiplier;
    let pullDirection = null;
    if (input.isPulling) {
      pullDirection = this.#pullDirection
        .set(rodPos.x - floatPos.x, rodPos.y - floatPos.y)
        .normalize();
    }
    floatEntity.update(
      bounds,
      dt,
      env,
      checkWater,
      input,
      fishingSystem.getReelPower(),
      pullDirection,
    );
    return { activeHold, pMax, fMag, forces: this.#forces };
  }
}

class CatchResolutionService {
  resolveAutoCatch({
    floatEntity,
    bounds,
    net,
    fishData,
    projectorScale,
    catchLineOffsetPx,
  }) {
    const updatedPos = floatEntity.getPosition();
    const autoY = bounds.bottom - catchLineOffsetPx / projectorScale;
    if (
      updatedPos.y >= net.getTriggerVirtualY(bounds.bottom) &&
      updatedPos.y < autoY
    ) {
      return { shouldTriggerLastDash: true };
    }
    if (updatedPos.y >= autoY) {
      return { transition: { name: "victory", data: { fish: fishData } } };
    }
    return {};
  }

  resolveNetAttempt(net, fishWeight, rng, fishData) {
    const chance = net.calculateCatchChance(fishWeight);
    const roll = rng.range(0, 100);
    const success = roll <= chance;
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
}

class FightService {
  #config;
  #rng;
  #upDirection = { x: 0, y: 1 };
  #forces = { pX: 0, pY: 0, fX: 0, fY: 0 };
  #forceService;
  #catchResolver;
  #fishingSystem = null;
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
    this.#fishingSystem = session.fishingSystem;
    this.#tensionMeter = session.tensionMeter;
    this.#fishCondition = session.fishCondition;
    this.#staminaController = session.staminaController;
  }

  syncEquipment(equipment) {
    if (!this.#fishingSystem || !this.#tensionMeter || !this.#staminaController)
      return;
    const next = this.#fightSessionFactory.createEquipment(equipment);
    this.#rod = next.rod;
    this.#reel = next.reel;
    this.#fishingSystem.updateEquipment(this.#rod, this.#reel);
    this.#tensionMeter.updateEquipment(
      equipment.rod?.level || 1,
      equipment.reel?.level || 0,
      next.hook,
      this.#config.tension,
    );
    this.#staminaController.updatePlayerPower(
      this.#rod.getPower() + this.#reel.getPower(),
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
      fishingSystem: this.#fishingSystem,
    });
    this.#forces = forceData.forces;
    this.#tensionMeter.update(
      input.isPulling,
      forceData.pMax,
      forceData.fMag,
      this.#fishingSystem.getReelPower(),
      forceData.fMag * 0.01,
      dt,
      this.#config.tension,
      this.#config.hookMechanics,
      forceData.activeHold,
    );
    const floatPos = floatEntity.getPosition();
    this.#staminaController.evaluate(
      this.#tensionMeter.getTension(),
      input.isPulling,
      dt,
      floatPos.x,
      bounds,
    );
    const resolution = this.#catchResolver.resolveAutoCatch({
      floatEntity,
      bounds,
      net,
      fishData,
      projectorScale,
      catchLineOffsetPx,
    });
    if (resolution.shouldTriggerLastDash) {
      this.#fishingSystem.tryTriggerFishLastDash?.(dt);
    }
    if (resolution.transition) return { transition: resolution.transition };
    return {};
  }

  handlePlayerInput(input, equipment) {
    const isHold = this.#fishingSystem.isHoldActive();
    const swipeThreshold = equipment.reel?.hold?.swipeThresholdPx || 100;
    if (this.#fishingSystem.getHoldUIState()?.hasHold) {
      if (input.toggleHold || input.swipeDeltaY > swipeThreshold) {
        isHold
          ? this.#fishingSystem.deactivateHold()
          : this.#fishingSystem.activateHold();
      }
    }
    if (input.pumpAction || input.swipeDeltaY < -swipeThreshold) {
      const red = this.#fishingSystem.tryUsePump(
        equipment.reel?.pumpLevel || 0,
        equipment.reel?.pumpPowerPerLevel || 10,
      );
      if (red > 0) this.#tensionMeter.applyPump(red);
      return { consumedSwipe: true };
    }
    return {
      consumedSwipe:
        !!input.swipeDeltaY &&
        (input.toggleHold || input.swipeDeltaY > swipeThreshold),
    };
  }

  handleNetAttempt(net, rng, fishData) {
    return this.#catchResolver.resolveNetAttempt(
      net,
      this.#fishingSystem.getFishWeight(),
      rng,
      fishData,
    );
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
      (this.#rod.getPower() + this.#reel.getPower()) *
      this.#config.physics.playerSteeringMultiplier *
      this.#config.physics.playerForceMultiplier *
      depthScaleX;
    return {
      playerForceY: Math.abs(this.#forces.pY || 0),
      playerForceX: Math.abs(this.#forces.pX || 0),
      fishForceY: Math.abs(this.#forces.fY || 0),
      fishForceX: Math.abs(this.#forces.fX || 0),
      playerMaxPowerY: Math.abs(
        maxP.y * this.#config.physics.playerForceMultiplier,
      ),
      playerMaxPowerX: steerP,
      fishState: fs?.getCurrentState?.() || "idle",
      fishBasePower: fs?.getFishBasePower?.() || 0,
      fishInitialPower: fs?.getFishInitialPower?.() || 0,
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
    return this.#fishingSystem?.getHoldUIState?.() || null;
  }

  get tensionMeter() {
    return this.#tensionMeter;
  }

  get fishCondition() {
    return this.#fishCondition;
  }

  endFight() {}
}
