class Equipment {
  #level;
  #basePower;

  constructor(level, basePower) {
    this.#level = level;
    this.#basePower = basePower;
  }

  getPower() {
    // --- СТАРИЙ ВАРІАНТ (Множення) ---
    // return this.#level * this.#basePower;

    // --- НОВИЙ ВАРІАНТ (Додавання) ---
    return this.#level + this.#basePower;
  }
}

class Rod extends Equipment {
  #compensation;
  #type;
  #maxDistance;
  #hasReel;
  #lengthMeters;
  #castPowerCoefficient;
  #maxLoadKg;
  #durability;
  #durabilityMaxLoadLossPerPercent;

  constructor(
    level,
    power,
    compensation = 0,
    type = "float_match",
    maxDistance = Infinity,
    hasReel = true,
    options = {},
  ) {
    super(level, power);
    this.#compensation = compensation;
    this.#type = type;
    this.#maxDistance = maxDistance;
    this.#hasReel = hasReel;
    this.#lengthMeters = Rod.#numberOrDefault(options.lengthMeters, 2.0);
    this.#castPowerCoefficient = Rod.#nullableNumber(
      options.castPowerCoefficient,
    );
    this.#maxLoadKg = Rod.#numberOrDefault(options.maxLoadKg, 8.0);
    this.#durability = Rod.#numberOrDefault(options.durability, 100);
    this.#durabilityMaxLoadLossPerPercent =
      Rod.#numberOrDefault(options.durabilityMaxLoadLossPerPercent, 0.001);
  }

  getCompensation() {
    return this.#compensation;
  }

  getType() {
    return this.#type;
  }

  getMaxDistance() {
    return this.#maxDistance;
  }

  hasReel() {
    return this.#hasReel;
  }

  getLengthMeters() {
    return this.#lengthMeters;
  }

  getCastPowerCoefficient() {
    return this.#castPowerCoefficient;
  }

  getMaxLoadKg() {
    return this.#maxLoadKg;
  }

  getDurabilityMaxLoadLossPerPercent() {
    return this.#durabilityMaxLoadLossPerPercent;
  }

  getEffectiveMaxLoadKg() {
    const loss =
      (100 - Math.max(0, Math.min(100, this.#durability))) *
      this.#durabilityMaxLoadLossPerPercent;
    return this.#maxLoadKg * Math.max(0.1, 1 - loss);
  }

  static #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  static #nullableNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}

class Reel extends Equipment {
  #holdConfig;
  #maxLoadKg;
  #lineCapacityMeters;
  #retrieveSpeedMetersPerSec;
  #dragMinKg;
  #dragMaxKg;
  #dragChangeSpeedPerSec;
  #hasDrag;
  #durability;
  #durabilityMaxLoadLossPerPercent;

  constructor(level, power, options = {}) {
    super(level, power); // Стара логіка відпрацьовує як і раніше!
    this.#holdConfig = null;
    this.#maxLoadKg = Reel.#numberOrDefault(options.maxLoadKg, 10);
    this.#lineCapacityMeters = Reel.#numberOrDefault(
      options.lineCapacityMeters,
      50,
    );
    this.#retrieveSpeedMetersPerSec =
      Reel.#numberOrDefault(options.retrieveSpeedMetersPerSec, 0.8);
    this.#dragMinKg = Reel.#numberOrDefault(options.dragMinKg, 0);
    this.#dragMaxKg = Reel.#numberOrDefault(
      options.dragMaxKg,
      this.#maxLoadKg,
    );
    this.#dragChangeSpeedPerSec =
      Reel.#numberOrDefault(options.dragChangeSpeedPerSec, 1.5);
    this.#hasDrag = options.hasDrag !== false;
    if (!this.#hasDrag) {
      this.#dragMinKg = 0;
      this.#dragMaxKg = 0;
      this.#dragChangeSpeedPerSec = 0;
    }
    this.#durability = Reel.#numberOrDefault(options.durability, 100);
    this.#durabilityMaxLoadLossPerPercent =
      Reel.#numberOrDefault(options.durabilityMaxLoadLossPerPercent, 0.001);
  }

  // Метод для перевірки, чи взагалі доступна механіка утримання
  hasHoldMechanic() {
    return false;
  }

  // Зручний геттер, який збирає всі потрібні дані для поточного рівня утримання
  getHoldStats() {
    if (!this.hasHoldMechanic()) return null;

    const lvl = this.#holdConfig.activeLevel;
    const stats = this.#holdConfig.levels[lvl];

    if (!stats) return null;

    return {
      level: lvl,
      swipeThreshold: this.#holdConfig.swipeThresholdPx,
      manualCooldownMs: this.#holdConfig.manualCooldownMs,
      maxCharges: stats.charges,
      restoreTimeMs: stats.restoreTimeMs,
      holdPower: stats.holdPower,
      tensionMultiplier:
        stats.tensionMultiplier !== undefined ? stats.tensionMultiplier : 1.0,
      totalHoldForce: this.getPower() + stats.holdPower,
    };
  }

  hasReel() {
    return this.getPower() > 0 || this.#lineCapacityMeters > 0;
  }

  getMaxLoadKg() {
    return this.#maxLoadKg;
  }

  getEffectiveMaxLoadKg() {
    const loss =
      (100 - Math.max(0, Math.min(100, this.#durability))) *
      this.#durabilityMaxLoadLossPerPercent;
    return this.#maxLoadKg * Math.max(0.1, 1 - loss);
  }

  getLineCapacityMeters() {
    return this.#lineCapacityMeters;
  }

  getRetrieveSpeedMetersPerSec() {
    return this.#retrieveSpeedMetersPerSec;
  }

  getDragChangeSpeedPerSec() {
    return this.#dragChangeSpeedPerSec;
  }

  hasDrag() {
    return this.#hasDrag;
  }

  getDragRangeKg() {
    return { min: this.#dragMinKg, max: this.#dragMaxKg };
  }

  static #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}

class Hook {
  #level;
  #weight;
  #quality;

  constructor(level, weight, quality) {
    this.#level = level;
    this.#weight = weight;
    this.#quality = quality;
  }

  getPower() {
    return (this.#level * this.#weight + this.#quality) * 0.01;
  }
}

class Net {
  #config;
  #converter;

  constructor(config, physicsConfig = null) {
    this.#converter = this.#createConverter(physicsConfig);
    this.updateConfig(config);
  }

  updateConfig(config) {
    this.#config = config || { active: false };
  }

  get isActive() {
    return this.#config.active;
  }

  // Переводимо стару логіку "length * 10" у віртуальну дистанцію.
  // Наприклад, length 15 = 150 віртуальних пікселів від берега.
  // Current model: length is meters; virtual reach is pixels via DistanceUnitConverter.
  getReachMeters() {
    const reachMeters = Number(
      this.#config.lengthMeters ??
        this.#config.reachMeters ??
        this.#config.length,
    );
    return Number.isFinite(reachMeters) ? Math.max(0, reachMeters) : 0;
  }

  getReachPixels() {
    return this.#converter.metersToPixels(this.getReachMeters());
  }

  get virtualReach() {
    return this.getReachPixels();
  }

  getMaxWeight() {
    return Math.max(0, Number(this.#config.maxWeight) || 0);
  }

  // Отримуємо віртуальну Y-координату, де починається зона підсаки
  getTriggerVirtualY(virtualBottomY) {
    // Якщо підсаки немає, базова зона вилову (наприклад, 50 віртуальних пікселів біля самого берега)
    const baseReach = 50;
    const reach = this.isActive ? this.virtualReach : baseReach;
    return virtualBottomY - reach;
  }

  // Перевірка, чи знаходиться поплавець/риба у зоні дії підсаки
  isFloatInZone(floatVirtualY, virtualBottomY) {
    if (!this.isActive) return false;
    const triggerY = this.getTriggerVirtualY(virtualBottomY);
    return floatVirtualY >= triggerY && floatVirtualY < virtualBottomY;
  }

  // Розрахунок шансу успішного вилову риби
  calculateCatchChance(fishWeight) {
    if (!this.isActive) return 100; // Якщо механіка підсаки вимкнена

    const maxWeight = this.getMaxWeight();
    if (maxWeight <= 0) return 0;
    if (fishWeight <= maxWeight) return 100;

    // Якщо риба важча за ліміт підсаки:
    const diffPercent = ((fishWeight - maxWeight) / maxWeight) * 100;
    let baseChance = 50;

    if (this.#config.chances) {
      for (const t of this.#config.chances) {
        if (diffPercent >= t.min && diffPercent <= t.max) {
          baseChance = t.chance;
          break;
        }
      }
    }

    const qualBonus = Math.round(((this.#config.quality || 1.0) - 1.0) * 10);
    return Math.min(100, Math.max(0, baseChance + qualBonus));
  }

  #createConverter(physicsConfig) {
    const resolvedPhysics =
      physicsConfig ||
      (typeof CONFIG !== "undefined" ? CONFIG.physics : null) ||
      {};

    if (typeof DistanceUnitConverter !== "undefined") {
      return new DistanceUnitConverter(resolvedPhysics);
    }

    const pixelsPerMeter = Math.max(
      1,
      Number(resolvedPhysics.pixelsPerMeter) || 50,
    );
    return {
      metersToPixels: (meters) => {
        const value = Number(meters);
        return Number.isFinite(value) ? value * pixelsPerMeter : 0;
      },
    };
  }
}

class WaterEntity {
  _position;
  _velocity;
  _config;
  _maxDepth;
  _currentHookDepth;
  _targetHookDepth;

  _velocityDamping; // Для тертя фізичного рушія
  _lureResistance; // Для опору самої приманки

  _isBiting = false;
  _isGuaranteed = false;
  _isHooked = false;

  _currentColor;
  _baseColor;
  _currentAngle = 0;
  _currentScaleY = 1.0;
  _perspectiveScale = 1.0;
  _sinkerHeightScale = 1.0;

  _sequenceQueue = [];
  _animTimer = 0;
  _animDuration = 0;
  _currentSequenceCount = 0;
  _targetSequenceCount = 0;
  _startAnimState = null;
  _targetAnimState = null;
  _currentBiteMoveVelocity;
  _forceScratch;
  _biteMoveTimer = 0;
  _stepId = 0;
  _isOverDepth = false;

  _windAngleOffset = 0;
  _targetWindAngle = 0;
  _windTimer = 0;
  _windFluctuationTimer = 0;
  _motionTiltEnabled = false;
  _motionTiltAngle = 0;
  _pullImpulseAngle = 0;
  _pullImpulseScaleY = 1;
  _pullImpulseSign = 0;
  _sinkerConfig = null;
  _sinkingStartAngle = 90;
  _isPlayerPullingThisFrame = false;

  _activeBiteSequence = null;
  _rng;
  _debugEvents;

  constructor(x, y, config, maxDepth, rng = null, debugEvents = null) {
    this._position = new Vector2(x, y);
    this._velocity = new Vector2(0, 0);
    this._currentBiteMoveVelocity = new Vector2(0, 0);
    this._forceScratch = new Vector2(0, 0);
    this._config = config;
    this._rng = rng || { next: () => Math.random() };
    this._debugEvents = debugEvents || null;
    this._maxDepth = maxDepth || config.maxDepth || 8.0;
    this._currentHookDepth = 0.1;
    this._targetHookDepth = 0.1;

    // ВАЖЛИВО: Розділяємо фізичне гальмування і опір наживки
    this._velocityDamping = config.friction || 0.85;
    this._lureResistance = config.waterFriction || 0;

    this._baseColor = config.type === "day" ? "#ffffff" : "#00ff80";
    this._currentColor = this._baseColor;
  }

  _random() {
    return this._rng.next();
  }

  _chance(probability) {
    return this._rollChance(probability).success;
  }

  _rollChance(probability) {
    const normalized = Math.max(0, Math.min(1, Number(probability) || 0));
    const roll = this._random();
    return {
      probability: normalized,
      roll,
      success: roll < normalized,
    };
  }

  _formatPercent(value) {
    return `${(Math.max(0, Math.min(1, Number(value) || 0)) * 100).toFixed(2)}%`;
  }

  _emitDebugEvent(type, detail) {
    if (!this._debugEvents || typeof this._debugEvents.emit !== "function") return;
    this._debugEvents.emit(type, detail);
  }

  _applyRetrieveForce(dt, pullDirection, power, multiplier, waterFriction = 0) {
    if (!pullDirection) return;
    const dtSec = this._getClampedDtSec(dt);
    const targetSpeedPxPerSec =
      Math.max(0, power - waterFriction) * multiplier;
    const damping = this._getVelocityDamping(dtSec);
    const force = targetSpeedPxPerSec * (1 - damping);

    this.applyForce(
      this._forceScratch.set(
        pullDirection.x * force,
        pullDirection.y * force,
      ),
    );
  }

  _applyRetrieveSpeed(dt, pullDirection, targetSpeedPxPerSec, waterFrictionMultiplier = 0) {
    if (!pullDirection) return;
    const dtSec = this._getClampedDtSec(dt);
    const targetSpeed =
      Math.max(0, Number(targetSpeedPxPerSec) || 0) *
      Math.max(0, 1 - (Number(waterFrictionMultiplier) || 0));
    const damping = this._getVelocityDamping(dtSec);
    const force = targetSpeed * (1 - damping);

    this.applyForce(
      this._forceScratch.set(
        pullDirection.x * force,
        pullDirection.y * force,
      ),
    );
  }

  _applyPassiveRetrieve(dt, pullDirection, retrieveParams = null) {
    const physics = CONFIG.physics || {};
    if (Number.isFinite(Number(retrieveParams?.targetSpeedPxPerSec))) {
      this._applyRetrieveSpeed(
        dt,
        pullDirection,
        retrieveParams.targetSpeedPxPerSec,
        retrieveParams.waterFrictionMultiplier,
      );
    } else {
      this._applyRetrieveForce(
        dt,
        pullDirection,
        retrieveParams?.power ?? physics.passiveRetrievePower ?? 1.0,
        retrieveParams?.multiplier ?? physics.passiveRetrieveMultiplier ?? 35,
        retrieveParams?.waterFriction ??
          physics.passiveRetrieveWaterFriction ??
          0.35,
      );
    }

    const dtSec = this._getClampedDtSec(dt);
    this._currentHookDepth = Math.max(
      0,
      this._currentHookDepth -
        (physics.passiveRetrieveDepthRiseSpeed ?? 0.15) * dtSec,
    );
  }

  getPosition() {
    return this._position;
  }

  getVelocity() {
    return this._velocity;
  }

  setVelocity(x, y) {
    this._velocity.set(x, y);
  }

  getCurrentHookDepth() {
    return this._currentHookDepth;
  }

  getEffectiveHookDepth(bottomDepth) {
    return Math.min(this._currentHookDepth, Math.max(0, bottomDepth || 0));
  }

  getEffectiveLineLength(bottomDepth) {
    return this.getEffectiveHookDepth(bottomDepth);
  }

  isBottomLocked() {
    return false;
  }

  applyForce(force) {
    this._velocity.add(force);
  }

  setPosition(x, y) {
    this._position.set(x, y);
  }

  setHookDepth(depth) {
    this._currentHookDepth = depth;
  }

  update(
    boundsRect,
    dt,
    environment,
    checkWater,
    input = {},
    reelPower = 0,
    pullDirection = null,
  ) {
    this._isPlayerPullingThisFrame = !!(input.isPulling && pullDirection);

    const isSpinningLure = ["spinner", "wobbler", "jig"].includes(
      this._config.type,
    );

    let bottomDepth = this._maxDepth;
    if (checkWater) {
      const cell = checkWater(this._position.x, this._position.y);
      if (cell) bottomDepth = cell.depth;
    }

    if (!this._isHooked) {
      if (!this._isBiting || isSpinningLure) {
        this._processMechanics(
          dt,
          input,
          reelPower,
          pullDirection,
          bottomDepth,
        );
      }
    }

    this._applyPhysics(boundsRect, checkWater, dt, environment);

    if (this._isBiting) {
      this.updateBite(dt, checkWater);
    }

    this._afterPhysicsUpdate(checkWater);
  }

  _processMechanics(dt, input, reelPower, pullDirection) {}

  _afterPhysicsUpdate(checkWater) {}

  _getClampedDtSec(dt) {
    const physics = typeof CONFIG !== "undefined" ? CONFIG.physics || {} : {};
    const maxDtMs = physics.maxDtMs ?? 50;
    return Math.min(Math.max(0, Number(dt) || 0), maxDtMs) / 1000;
  }

  _getVelocityDamping(dtSec) {
    const dampingPerSecond =
      this._config.velocityDampingPerSecond ??
      CONFIG.physics?.fightMotion?.velocityDampingPerSecond ??
      -Math.log(Math.max(0.001, Math.min(0.999, this._velocityDamping))) * 60;
    return Math.exp(-Math.max(0, dampingPerSecond) * dtSec);
  }

  _applyPhysics(boundsRect, checkWater, dt, environment) {
    const dtSec = this._getClampedDtSec(dt);
    let driftDx = 0;
    let driftDy = 0;

    if (environment?.current) {
      const activeCfg = this._sinkerConfig || this._config;
      const compRange = activeCfg.currentCompensation || [0.1, 0.99];
      const qual = Math.max(1, Math.min(10, activeCfg.quality || 1));
      const comp = this._lerp(compRange[0], compRange[1], (qual - 1) / 9);

      const driftSpeed = environment.current.speedPxPerSec * (1 - comp);
      driftDx = environment.current.direction.x * driftSpeed * dtSec;
      driftDy = environment.current.direction.y * driftSpeed * dtSec;
    }

    if (!this._isHooked && environment) {
      const isActivelyPulling =
        this._isBiting &&
        (Math.abs(this._currentAngle) > 0.5 ||
          Math.abs(this._currentScaleY - 1.0) > 0.02);

      if (environment.wind && !isActivelyPulling) {
        const dir = environment.wind.direction;
        const windCompRange = this._config.windCompensation || [0.1, 0.99];
        const qual = Math.max(1, Math.min(10, this._config.quality || 1));
        const windComp = this._lerp(
          windCompRange[0],
          windCompRange[1],
          (qual - 1) / 9,
        );

        this._windFluctuationTimer -= dt;

        if (this._windTimer > 0) {
          this._windTimer -= dt;
          if (this._windFluctuationTimer <= 0) {
            const gustAngle =
              this._getRandom(environment.wind.gustAngleRange) * dir;
            this._targetWindAngle = gustAngle * (1 - windComp);
            this._windFluctuationTimer = this._getRandom(
              environment.wind.gustFluctuationMs,
            );
          }
        } else {
          if (this._windFluctuationTimer <= 0) {
            const breezeAngle =
              this._getRandom(environment.wind.breezeAngleRange) * dir;
            this._targetWindAngle = breezeAngle * (1 - windComp);
            this._windFluctuationTimer =
              this._getRandom(environment.wind.gustFluctuationMs) * 3;
          }
          if (this._chance(environment.wind.gustChancePerSec * dtSec)) {
            this._windTimer = this._getRandom(environment.wind.gustDurationMs);
            this._windFluctuationTimer = 0;
          }
        }
      } else {
        this._targetWindAngle = 0;
        this._windTimer = 0;
        this._windFluctuationTimer = 0;
      }
    } else {
      this._targetWindAngle = 0;
      this._windTimer = 0;
      this._windFluctuationTimer = 0;
    }

    this._windAngleOffset = this._lerp(
      this._windAngleOffset,
      this._targetWindAngle,
      dt * 0.005,
    );

    const isSpinningLure = ["spinner", "wobbler", "jig"].includes(
      this._config.type,
    );

    if (this._isBiting && !isSpinningLure) {
      this._velocity.multiplyScalar(this._getVelocityDamping(dtSec));
      this._updateMotionTilt(dt, 0, 0);
      return;
    }

    const prevX = this._position.x;
    const prevY = this._position.y;
    let nextX = this._position.x + this._velocity.x * dtSec + driftDx;
    let nextY = this._position.y + this._velocity.y * dtSec + driftDy;

    if (checkWater) {
      if (!checkWater(nextX, this._position.y)) {
        this._velocity.x = 0;
        nextX = this._position.x;
      }
      if (!checkWater(this._position.x, nextY)) {
        this._velocity.y = 0;
        nextY = this._position.y;
      }
    }

    this._position.set(
      Math.max(boundsRect.left, Math.min(boundsRect.right, nextX)),
      Math.max(boundsRect.top, Math.min(boundsRect.bottom, nextY)),
    );

    this._updateMotionTilt(
      dt,
      this._position.x - prevX,
      this._position.y - prevY,
    );

    this._velocity.multiplyScalar(this._getVelocityDamping(dtSec));
  }

  _updateMotionTilt(dt, moveX, moveY) {
    if (!this._motionTiltEnabled) return;

    const cfg = CONFIG.physics?.floatMotion || {};
    if (cfg.enabled === false) {
      this._motionTiltAngle = 0;
      return;
    }

    const dtSec = Math.max(0.001, dt / 1000);
    const speed = Math.hypot(moveX, moveY) / dtSec;
    const minSpeed = cfg.minSpeedPxPerSec ?? 2;
    let targetAngle = 0;

    if (speed >= minSpeed) {
      const lateralInfluence = cfg.lateralInfluence ?? 1.0;
      const verticalInfluence = cfg.verticalInfluence ?? 0.35;
      const verticalTiltSign = cfg.verticalTiltSign ?? 1;
      const tiltAxis =
        moveX * lateralInfluence + moveY * verticalInfluence * verticalTiltSign;

      if (Math.abs(tiltAxis) > 0.001) {
        const maxAngle = cfg.maxAngleDeg ?? 24;
        const speedForMax = Math.max(1, cfg.speedForMaxTiltPxPerSec ?? 120);
        const speedRatio = Math.min(1, speed / speedForMax);
        const pullMultiplier = this._isPlayerPullingThisFrame
          ? (cfg.pullTiltMultiplier ?? 1.2)
          : 1.0;

        targetAngle =
          -Math.sign(tiltAxis) *
          Math.min(maxAngle, maxAngle * speedRatio * pullMultiplier);
      }
    }

    const isGrowing = Math.abs(targetAngle) > Math.abs(this._motionTiltAngle);
    const smoothing = isGrowing
      ? (cfg.responseSpeed ?? 12)
      : (cfg.settleSpeed ?? 7);
    const alpha = 1 - Math.exp(-Math.max(0, smoothing) * dtSec);
    this._motionTiltAngle += (targetAngle - this._motionTiltAngle) * alpha;
  }

  getVisualState() {
    let finalAngle = this._currentAngle;
    if (!this._isHooked && !this._isBiting) {
      finalAngle += this._windAngleOffset;
      finalAngle += this._motionTiltAngle;
      finalAngle += this._pullImpulseAngle;
    }
    return {
      color: this._currentColor,
      angle: finalAngle,
      scaleY:
        this._currentScaleY * this._sinkerHeightScale * this._pullImpulseScaleY,
      perspectiveScale: this._perspectiveScale,
    };
  }

  isGuaranteedBite() {
    return this._isGuaranteed;
  }

  isHooked() {
    return this._isHooked;
  }

  isBiting() {
    return this._isBiting;
  }

  getBiteStepInfo() {
    if (!this._isBiting) return null;
    let hasMoreActions = false;
    for (let i = 0; i < this._sequenceQueue.length; i++) {
      const step = this._sequenceQueue[i];
      if (step.angle !== 0 || step.scaleY !== 1.0 || step.startMove) {
        hasMoreActions = true;
        break;
      }
    }
    const isLastIter = this._currentSequenceCount >= this._targetSequenceCount;
    const isLastAction = isLastIter && !hasMoreActions;
    const isAction =
      this._targetAnimState?.angle !== 0 ||
      this._targetAnimState?.scaleY !== 1.0 ||
      this._biteMoveTimer > 0;
    return {
      id: this._stepId,
      isGuaranteed: this._isGuaranteed,
      duration: this._animDuration,
      isAction: isAction,
      isLastAction: isLastAction,
    };
  }

  hook() {
    this._isHooked = true;
    this._isBiting = false;
    this._velocity.set(0, 0);
    this._currentBiteMoveVelocity.set(0, 0);
    this._pullImpulseAngle = 0;
    this._pullImpulseScaleY = 1;
    this._biteMoveTimer = 0;
  }

  _applyGodModeBiteSequence(seqCfg) {
    if (typeof GodMode === "undefined") return seqCfg;
    const mode = GodMode.biteSequenceMode;
    if (mode !== "guaranteed" && mode !== "normal") return seqCfg;

    seqCfg.chanceGuaranteed = mode === "guaranteed" ? 1.0 : 0.0;
    seqCfg.chanceNormal = mode === "guaranteed" ? 0.0 : 1.0;
    return seqCfg;
  }

  startBite(isPulling = false, fishBiteSequence = null) {
    this._isBiting = true;
    this._isHooked = false;

    // 1. БЕРЕМО КОНФІГ ВІД РИБИ
    const baseSeq = fishBiteSequence || CONFIG.float.biteSequence;
    const seqCfg = this._applyGodModeBiteSequence({ ...baseSeq });

    const isSpinningLure = ["spinner", "wobbler", "jig"].includes(
      this._config.type,
    );

    if (isSpinningLure && !isPulling) {
      seqCfg.chanceGuaranteed = CONFIG.physics?.idleSpinningBiteChance ?? 0.005;
    }

    this._applyGodModeBiteSequence(seqCfg);

    // 2. ЗАПАМ'ЯТОВУЄМО КОНФІГ ДЛЯ НАСТУПНИХ ІТЕРАЦІЙ
    this._activeBiteSequence = seqCfg;

    this._currentSequenceCount = 1;
    this._targetSequenceCount = Math.floor(
      this._getRandom(seqCfg.maxSequences),
    );

    this._emitDebugEvent("debug-bite-sequence", {
      mode: "BITING",
      event: "START",
      isPulling,
      isSpinningLure,
      sequence: {
        chanceGuaranteed: seqCfg.chanceGuaranteed,
        chanceGuaranteedPercent: this._formatPercent(seqCfg.chanceGuaranteed),
        chanceNormal: seqCfg.chanceNormal,
        chanceNormalPercent: this._formatPercent(seqCfg.chanceNormal),
        maxSequences: seqCfg.maxSequences,
        targetSequenceCount: this._targetSequenceCount,
        guaranteedIters: seqCfg.guaranteedIters,
        normalIters: seqCfg.normalIters,
        intervalMs: seqCfg.intervalMs,
        sequenceIntervalMs: seqCfg.sequenceIntervalMs,
      },
    });

    // Більше не передаємо seqCfg сюди, метод візьме його з this._activeBiteSequence
    this._rollBiteSequence();
  }

  stopBite() {
    this._isBiting = false;
    this._sequenceQueue = [];
    this._currentAngle = this._isOverDepth ? this._sinkingStartAngle : 0;
    this._currentScaleY = 1.0;
    this._currentColor = this._baseColor;
    this._pullImpulseAngle = 0;
    this._pullImpulseScaleY = 1;
    this._biteMoveTimer = 0;
  }

  updateBite(dt, checkWater) {
    if (!this._isBiting) return;

    if (this._isOverDepth) {
      this._currentAngle = this._sinkingStartAngle;
      this._currentScaleY = 1.0;
      this._biteMoveTimer = 0;
      this._animTimer -= dt;
      if (this._animTimer <= 0) this._handleSequenceEnd();
      return;
    }

    if (this._biteMoveTimer > 0) {
      this._biteMoveTimer -= dt;
      let nextX =
        this._position.x + this._currentBiteMoveVelocity.x * (dt / 1000);
      let nextY =
        this._position.y + this._currentBiteMoveVelocity.y * (dt / 1000);
      if (checkWater) {
        if (!checkWater(nextX, this._position.y)) {
          this._currentBiteMoveVelocity.x *= -1;
          nextX = this._position.x;
        }
        if (!checkWater(this._position.x, nextY)) {
          this._currentBiteMoveVelocity.y *= -1;
          nextY = this._position.y;
        }
      }
      this._position.set(nextX, nextY);
    }

    this._animTimer -= dt;
    if (this._animTimer <= 0) {
      this._handleSequenceEnd();
    } else if (this._startAnimState && this._targetAnimState) {
      const progress = 1.0 - this._animTimer / this._animDuration;
      const ease = this._easeInOutQuad(Math.max(0, Math.min(1, progress)));
      this._currentAngle = this._lerp(
        this._startAnimState.angle,
        this._targetAnimState.angle,
        ease,
      );
      this._currentScaleY = this._lerp(
        this._startAnimState.scaleY,
        this._targetAnimState.scaleY,
        ease,
      );
    }
  }

  _handleSequenceEnd() {
    if (this._sequenceQueue.length > 0) {
      this._nextAnimStep();
    } else {
      if (this._currentSequenceCount >= this._targetSequenceCount) {
        this.stopBite();
      } else {
        this._currentSequenceCount++;
        // 3. ВИПРАВЛЕНО: більше не читаємо з this._config, просто викликаємо метод
        this._rollBiteSequence();
      }
    }
  }

  _rollBiteSequence() {
    // 4. ЧИТАЄМО ЗБЕРЕЖЕНИЙ КОНФІГ
    const seqCfg = this._activeBiteSequence;

    const rollResult = this._rollChance(seqCfg.chanceGuaranteed);
    const isRed = rollResult.success;
    const color = isRed ? "#ff0000" : "#ffff00";
    const range = isRed ? seqCfg.guaranteedIters : seqCfg.normalIters;
    const iters = Math.floor(this._getRandom(range));
    const sequenceType = isRed ? "guaranteed" : "normal";
    const debugIterations = [];
    let sequenceIntervalMs = 0;

    if (this._currentSequenceCount > 1) {
      sequenceIntervalMs = this._getRandom(seqCfg.sequenceIntervalMs);
      this._sequenceQueue.push({
        duration: sequenceIntervalMs,
        angle: 0,
        scaleY: 1.0,
        startMove: false,
        color: this._baseColor,
        isGuaranteed: false,
      });
    }

    for (let i = 0; i < iters; i++) {
      const steps = this._generateRandomAnim(isRed, seqCfg); // Передаємо seqCfg сюди
      for (let j = 0; j < steps.length; j++) {
        const s = steps[j];
        s.color = color;
        s.isGuaranteed = isRed;
        this._sequenceQueue.push(s);
      }
      const intervalMs = this._getRandom(seqCfg.intervalMs);
      this._sequenceQueue.push({
        duration: intervalMs,
        angle: 0,
        scaleY: 1.0,
        startMove: false,
        color: color,
        isGuaranteed: isRed,
      });
      debugIterations.push({
        index: i + 1,
        result: "успішно",
        stepCount: steps.length,
        fallbackMs: intervalMs,
      });
    }

    this._emitDebugEvent("debug-bite-sequence", {
      mode: "BITING",
      event: "SEQUENCE_ROLL",
      sequenceIndex: this._currentSequenceCount,
      sequenceCount: this._targetSequenceCount,
      chanceGuaranteed: seqCfg.chanceGuaranteed,
      chanceGuaranteedPercent: this._formatPercent(seqCfg.chanceGuaranteed),
      chanceNormal: seqCfg.chanceNormal,
      chanceNormalPercent: this._formatPercent(seqCfg.chanceNormal),
      roll: rollResult.roll,
      rollPercent: this._formatPercent(rollResult.roll),
      selectedType: sequenceType,
      generatedIterations: iters,
      sequenceIntervalMs,
      iterations: debugIterations,
    });

    this._nextAnimStep();
  }

  _generateRandomAnim(isRed, seqCfg) {
    const animsCfg = seqCfg.animations || {};
    const mods = seqCfg.guaranteedModifiers || {};

    const availableTypes = Object.keys(animsCfg);
    const chosen =
      availableTypes.length > 0
        ? availableTypes[Math.floor(this._random() * availableTypes.length)]
        : "slide";

    const cfg = animsCfg[chosen] || {};

    let targetAngle = 0;
    let targetScaleY = 1.0;
    let holdDuration = 0;
    let duration = this._getRandom(seqCfg.animDurationMs || [100, 200]);

    if (chosen === "bob") {
      let range = cfg.heightPercent ? [...cfg.heightPercent] : [10, 20];
      if (isRed && mods.bobAmpAdd) {
        range[0] -= mods.bobAmpAdd;
        range[1] += mods.bobAmpAdd;
      }
      targetScaleY = Math.max(0, 1.0 + this._getRandom(range) / 100);
    } else if (chosen === "sink") {
      let range =
        isRed && mods.sinkHeightPercent
          ? mods.sinkHeightPercent
          : cfg.heightPercent || [10, 20];
      targetScaleY = Math.max(0, 1.0 + this._getRandom(range) / 100);
      if (isRed && mods.holdDurationMs)
        holdDuration = this._getRandom(mods.holdDurationMs);
    } else if (chosen === "rise") {
      let range =
        isRed && mods.riseHeightPercent
          ? mods.riseHeightPercent
          : cfg.heightPercent || [10, 20];
      targetScaleY = Math.max(0, 1.0 + this._getRandom(range) / 100);
      if (isRed && mods.holdDurationMs)
        holdDuration = this._getRandom(mods.holdDurationMs);
    } else if (chosen === "tilt") {
      if (isRed && mods.tiltAngle) {
        targetAngle = this._getRandom(mods.tiltAngle);
        holdDuration = this._getRandom(mods.holdDurationMs || [0, 0]);
      } else {
        targetAngle = this._getRandom(cfg.angle || [10, 20]);
      }
    }

    let moveVelX = 0;
    let moveVelY = 0;
    let moveTime = 0;
    let startMove = false;

    if (chosen === "slide" || this._chance(seqCfg.movementChance || 0)) {
      startMove = true;
      moveTime = this._getRandom(seqCfg.movementDurationMs || [100, 200]);
      let speed = this._getRandom(seqCfg.movementSpeedPx || [10, 20]);

      if (isRed && mods.movementSpeedMult) {
        speed *= this._getRandom(mods.movementSpeedMult);
        moveTime *= this._getRandom(mods.movementDurationMult || [1, 1]);
      }

      const dirAngle = this._random() * Math.PI * 2;
      moveVelX = Math.cos(dirAngle) * speed;
      moveVelY = Math.sin(dirAngle) * speed;

      if (chosen === "slide") {
        duration = Math.max(100, moveTime - holdDuration);
      }
    }

    if (targetAngle !== 0) {
      if (startMove && moveVelX !== 0) {
        targetAngle = Math.abs(targetAngle) * (moveVelX > 0 ? -1 : 1);
      } else {
        if (this._chance(0.5)) targetAngle = -targetAngle;
      }
    }

    const steps = [];
    steps.push({
      duration,
      angle: targetAngle,
      scaleY: targetScaleY,
      startMove,
      moveVelX,
      moveVelY,
      moveTime,
    });

    if (holdDuration > 0) {
      steps.push({
        duration: holdDuration,
        angle: targetAngle,
        scaleY: targetScaleY,
        startMove: false,
      });
    }

    return steps;
  }

  _nextAnimStep() {
    const anim = this._sequenceQueue.shift();
    const wasGuaranteed = this._isGuaranteed;
    this._animDuration = anim.duration;
    this._animTimer = anim.duration;
    this._currentColor = anim.color || this._baseColor;
    this._isGuaranteed = anim.isGuaranteed || false;
    if (wasGuaranteed && !this._isGuaranteed) {
      this._biteMoveTimer = 0;
      this._currentBiteMoveVelocity.set(0, 0);
    }
    this._startAnimState = {
      angle: this._currentAngle,
      scaleY: this._currentScaleY,
    };
    this._targetAnimState = { angle: anim.angle, scaleY: anim.scaleY };
    if (anim.startMove) {
      this._currentBiteMoveVelocity.set(anim.moveVelX, anim.moveVelY);
      this._biteMoveTimer = anim.moveTime;
    }
    this._stepId++;
  }

  _easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  _lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }
  _getRandom(arr) {
    return arr[0] + this._random() * (arr[1] - arr[0]);
  }
}

class SpinnerEntity extends WaterEntity {
  _processMechanics(dt, input, reelPower, pullDirection, bottomDepth) {
    const dtSec = dt / 1000;

    if (input.isPulling && pullDirection) {
      this._applyRetrieveForce(
        dt,
        pullDirection,
        reelPower,
        CONFIG.physics?.lureRetrieveMultiplier ?? 150,
        this._lureResistance,
      );

      this._currentHookDepth = Math.max(
        0,
        this._currentHookDepth - this._config.riseSpeed * dtSec,
      );
    } else {
      this._currentHookDepth = Math.min(
        bottomDepth,
        this._currentHookDepth + this._config.sinkSpeed * dtSec,
      );
    }
  }
}

class WobblerEntity extends WaterEntity {
  _processMechanics(dt, input, reelPower, pullDirection) {
    const dtSec = dt / 1000;

    if (input.isPulling && pullDirection) {
      this._applyRetrieveForce(
        dt,
        pullDirection,
        reelPower,
        CONFIG.physics?.lureRetrieveMultiplier ?? 150,
        this._lureResistance,
      );

      const topDepth = this._config.targetMinDepth ?? 0;
      const bottomDepth = this._config.targetMaxDepth ?? this._maxDepth;

      if (this._config.mode === 1 || this._config.mode === 2) {
        this._adjustDepth(topDepth, dtSec);
      } else if (this._config.mode === 3) {
        this._adjustDepth(bottomDepth, dtSec);
      }
    } else {
      const topDepth = this._config.targetMinDepth ?? 0;
      const bottomDepth = this._config.targetMaxDepth ?? this._maxDepth;

      if (this._config.mode === 1 || this._config.mode === 2) {
        this._adjustDepth(bottomDepth, dtSec);
      } else if (this._config.mode === 3) {
        this._adjustDepth(topDepth, dtSec);
      }
    }
  }

  _adjustDepth(target, dtSec) {
    if (this._currentHookDepth < target) {
      this._currentHookDepth = Math.min(
        target,
        this._currentHookDepth + this._config.sinkSpeed * dtSec,
      );
    } else if (this._currentHookDepth > target) {
      this._currentHookDepth = Math.max(
        target,
        this._currentHookDepth - this._config.riseSpeed * dtSec,
      );
    }
  }
}

class JigEntity extends WaterEntity {
  _processMechanics(dt, input, reelPower, pullDirection) {
    const dtSec = dt / 1000;
    if (input.isPulling && pullDirection) {
      this._applyRetrieveForce(
        dt,
        pullDirection,
        reelPower,
        CONFIG.physics?.lureRetrieveMultiplier ?? 150,
        this._lureResistance,
      );
      this._currentHookDepth = Math.max(
        0,
        this._currentHookDepth - this._config.riseSpeed * dtSec,
      );
    } else {
      this._currentHookDepth = Math.min(
        this._maxDepth,
        this._currentHookDepth + this._config.sinkSpeed * dtSec,
      );
    }
  }
}

class FeederEntity extends WaterEntity {
  _sinkingTimer = 0;
  _isSinking = false;
  _sinkingTotalTime = 0;
  _sinkingStartAngle = 90;

  cast(x, y, targetDepth, isOverDepth, sinkerConfig, distanceRatio) {
    this._position.set(x, y);
    this._velocity.set(0, 0);
    this._isHooked = false;
    this._isBiting = false;
    this.stopBite();

    this._targetHookDepth = targetDepth;
    this._currentHookDepth = 0.1;
    this._sinkerConfig = sinkerConfig;

    const engine = sinkerConfig?.engineStats || sinkerConfig || {};
    const weightCfg =
      engine.weights && engine.weight ? engine.weights[engine.weight] : engine;
    const speedMult = weightCfg.speedMult || engine.speedMult || 1.5;
    this._sinkerHeightScale = weightCfg.heightScale || engine.heightScale || 1.0;
    this._isSinking = true;
    this._sinkingTotalTime = (targetDepth / speedMult) * 1000;
    this._sinkingTimer = this._sinkingTotalTime;

    this._sinkingStartAngle = this._chance(0.5) ? 90 : -90;
    this._currentAngle = this._sinkingStartAngle;
    this._currentScaleY = 1.0;
  }

  _processMechanics(dt, input, reelPower, pullDirection) {
    if (input.isPulling && pullDirection) {
      this._applyPassiveRetrieve(dt, pullDirection, input.idleRetrieveParams);
      return;
    }

    if (!this._isSinking) return;

    this._sinkingTimer -= dt;
    let progress =
      1.0 - Math.max(0, this._sinkingTimer / this._sinkingTotalTime);

    this._currentHookDepth = this._lerp(0.1, this._targetHookDepth, progress);
    this._currentAngle = this._lerp(this._sinkingStartAngle, 0, progress);

    if (this._sinkingTimer <= 0) {
      this._isSinking = false;
      this._currentHookDepth = this._targetHookDepth;
      this._currentAngle = 0;
    }
  }

  isBottomLocked() {
    return !this._isSinking;
  }

  getEffectiveHookDepth(bottomDepth) {
    const depth = Math.max(0, bottomDepth || 0);
    return this.isBottomLocked()
      ? depth
      : Math.min(this._currentHookDepth, depth);
  }

  getEffectiveLineLength(bottomDepth) {
    return this.getEffectiveHookDepth(bottomDepth);
  }

  _afterPhysicsUpdate(checkWater) {
    if (this._isSinking || !checkWater) return;
    const cell = checkWater(this._position.x, this._position.y);
    if (!cell) return;
    this._syncToBottomDepth(cell.depth);
  }

  _syncToBottomDepth(bottomDepth) {
    const depth = Math.max(0, bottomDepth || 0);
    this._targetHookDepth = depth;
    this._currentHookDepth = depth;
  }

  getChumBonus(elapsedMs, chumConfig) {
    if (!chumConfig) return { bonus: 1.0, targets: [] };

    const rampUpTime = Math.max(0, chumConfig.rampUpTimeMs || 0);
    const peakDuration = Math.max(0, chumConfig.peakDurationMs || 0);
    const totalTime = Math.max(
      1,
      chumConfig.totalBonusTimeMs || rampUpTime + peakDuration || 300000,
    );
    const peakStartTime = Math.min(rampUpTime, totalTime);
    const peakEndTime = Math.min(peakStartTime + peakDuration, totalTime);
    const maxBonus = Math.max(1.0, chumConfig.maxBonus ?? 1.0);
    const targets = chumConfig.targetFishes || [];

    if (elapsedMs >= totalTime) {
      return { bonus: 1.0, targets: [], isExpired: true };
    }

    if (peakStartTime > 0 && elapsedMs < peakStartTime) {
      const progress = elapsedMs / peakStartTime;
      const bonus = 1.0 + (maxBonus - 1.0) * progress;
      return { bonus, targets };
    }

    if (elapsedMs < peakEndTime) {
      return { bonus: maxBonus, targets };
    }

    const decayDuration = Math.max(1, totalTime - peakEndTime);
    const decayProgress = (elapsedMs - peakEndTime) / decayDuration;
    const bonus = maxBonus - (maxBonus - 1.0) * decayProgress;
    return { bonus: Math.max(1.0, bonus), targets };
  }
}

class FloatEntity extends WaterEntity {
  _motionTiltEnabled = true;
  _isSinking = false;
  _sinkingTotalTime = 0;
  _sinkingVisualElapsed = 0;
  _sinkingDelayTimer = 0;

  cast(x, y, targetDepth, isOverDepth, sinkerConfig, distanceRatio) {
    this._position.set(x, y);
    this._velocity.set(0, 0);
    this._motionTiltAngle = 0;
    this._pullImpulseAngle = 0;
    this._pullImpulseScaleY = 1;
    this._pullImpulseSign = 0;
    this._sinkingVisualElapsed = 0;
    this._isHooked = false;
    this._isBiting = false;
    this.stopBite();

    const hasSinker = !!sinkerConfig;

    this._targetHookDepth = hasSinker
      ? targetDepth
      : (CONFIG.physics?.defaultDepthNoSinker ?? 0.1);
    this._currentHookDepth = 0.1;
    this._isOverDepth = hasSinker ? isOverDepth : false;
    this._sinkerConfig = sinkerConfig;

    const engine = sinkerConfig?.engineStats || sinkerConfig || {};
    const weightCfg =
      engine.weights && engine.weight ? engine.weights[engine.weight] : engine;

    const speedMult = weightCfg.speedMult || 1.0;
    this._sinkerHeightScale = weightCfg.heightScale || 1.0;

    const pRange = this._config.perspectiveScaleRange || [1.3, 0.7];
    this._perspectiveScale =
      pRange[0] + distanceRatio * (pRange[1] - pRange[0]);

    this._isSinking = true;
    this._sinkingDelayTimer = this._config.sinkingDelayMs || 500;

    const maxDepth = engine.maxDepth || 8.0;
    const depthRatio = Math.max(
      0.1,
      Math.min(1.0, this._targetHookDepth / maxDepth),
    );
    const baseSinkingTime =
      (this._config.sinkingDurationMs || 4000) * depthRatio;

    this._sinkingTotalTime = baseSinkingTime / speedMult;

    const startAngle = CONFIG.physics?.floatMotion?.sinkingStartAngleDeg ?? 90;
    this._sinkingStartAngle = this._chance(0.5) ? startAngle : -startAngle;
    this._currentAngle = this._sinkingStartAngle;
    this._currentScaleY = 1.0;
  }

  _processMechanics(dt, input, reelPower, pullDirection) {
    const isPulling = !!(input.isPulling && pullDirection);
    if (isPulling) {
      this._redirectSinkingAngleFromPull(pullDirection);
    }

    this._updatePullImpulseTilt(dt, pullDirection, isPulling);

    if (isPulling) {
      this._advanceSinkingVisual(dt);
      this._applyPassiveRetrieve(dt, pullDirection, input.idleRetrieveParams);
      this._syncSinkingAngleToDepth();
      return;
    }

    if (!this._isSinking) return;

    if (this._sinkingDelayTimer > 0) {
      this._sinkingDelayTimer -= dt;
      return;
    }

    const isFishHolding =
      this._isBiting && this._currentColor !== this._baseColor;

    if (!isFishHolding) {
      this._advanceSinkingVisual(dt);

      const depthSpan = Math.max(0, this._targetHookDepth - 0.1);
      const depthPerMs = depthSpan / Math.max(1, this._sinkingTotalTime);
      this._currentHookDepth = Math.min(
        this._targetHookDepth,
        this._currentHookDepth + depthPerMs * dt,
      );

      if (!this._isBiting) {
        this._syncSinkingAngleToDepth();
      }

      if (
        this._currentHookDepth >= this._targetHookDepth - 0.001 &&
        this._getSinkingDepthProgress() >= 1
      ) {
        this._isSinking = false;
        this._currentHookDepth = this._targetHookDepth;
        if (!this._isBiting && !this._isOverDepth) {
          this._currentAngle = 0;
        }
      }
    }
  }

  _redirectSinkingAngleFromPull(pullDirection) {
    if (!this._isSinking && !this._isOverDepth) return;
    const impulseSign = this._getPullImpulseSign(pullDirection);
    if (impulseSign !== 0) {
      this._sinkingStartAngle =
        impulseSign * Math.abs(this._sinkingStartAngle || 90);
      this._pullImpulseSign = impulseSign;
    }

    if (this._isOverDepth) {
      this._currentAngle = this._sinkingStartAngle;
      return;
    }

    this._syncSinkingAngleToDepth();
  }

  _syncSinkingAngleToDepth() {
    if (!this._isSinking) return;
    if (this._isOverDepth) {
      this._currentAngle = this._sinkingStartAngle;
      return;
    }
    const progress = this._getSinkingDepthProgress();
    this._currentAngle = this._sinkingStartAngle * (1 - progress);
  }

  _advanceSinkingVisual(dt) {
    if (!this._isSinking) return;
    this._sinkingVisualElapsed += Math.max(0, dt);
  }

  _getSinkingDepthProgress() {
    const startDepth = 0.1;
    const span = this._targetHookDepth - startDepth;
    const depthProgress =
      span <= 0
        ? 1
        : Math.max(
            0,
            Math.min(1, (this._currentHookDepth - startDepth) / span),
          );

    const minDuration =
      CONFIG.physics?.floatMotion?.minStandUpDurationMs ?? 400;
    if (minDuration <= 0) return depthProgress;

    const timeProgress = Math.max(
      0,
      Math.min(1, this._sinkingVisualElapsed / minDuration),
    );
    return Math.min(depthProgress, timeProgress);
  }

  _updatePullImpulseTilt(dt, pullDirection, isPulling) {
    const cfg = CONFIG.physics?.floatMotion || {};
    if (cfg.enabled === false) {
      this._pullImpulseAngle = 0;
      return;
    }

    const dtSec = Math.max(0.001, dt / 1000);
    let targetAngle = 0;
    let targetScaleY = 1;

    if (isPulling) {
      const impulseSign = this._getPullImpulseSign(pullDirection);
      if (impulseSign !== 0) {
        this._pullImpulseSign = impulseSign;
        targetAngle = impulseSign * (cfg.pullImpulseOvershootDeg ?? 14);
      }

      const pullDepth = Math.abs(pullDirection?.y || 0);
      const depthDeadZone = cfg.pullImpulseDepthDeadZone ?? 0.02;
      if (pullDepth > depthDeadZone) {
        const maxDrop = cfg.pullImpulseDepthScaleDrop ?? 0.45;
        targetScaleY = Math.max(0.2, 1 - pullDepth * maxDrop);
      }
    }

    const speed = isPulling
      ? (cfg.pullImpulseResponseSpeed ?? 32)
      : (cfg.pullImpulseDecaySpeed ?? 8);
    const alpha = 1 - Math.exp(-Math.max(0, speed) * dtSec);
    this._pullImpulseAngle += (targetAngle - this._pullImpulseAngle) * alpha;
    this._pullImpulseScaleY +=
      (targetScaleY - this._pullImpulseScaleY) * alpha;
  }

  _getPullImpulseSign(pullDirection) {
    const cfg = CONFIG.physics?.floatMotion || {};
    const pullX = pullDirection?.x || 0;
    const deadZone = cfg.pullImpulseLateralDeadZone ?? 0.02;
    return Math.abs(pullX) > deadZone ? -Math.sign(pullX) : 0;
  }
}

class BaitFactory {
  static create(type, x, y, config, equipment, rng = null, debugEvents = null) {
    switch (type) {
      case "spinner":
        return new SpinnerEntity(x, y, config, config.maxDepth, rng, debugEvents);
      case "wobbler":
        return new WobblerEntity(x, y, config, config.maxDepth, rng, debugEvents);
      case "jig":
        return new JigEntity(
          x,
          y,
          config,
          equipment?.sinker?.maxDepth || config.maxDepth,
          rng,
          debugEvents,
        );
      case "feeder":
        return new FeederEntity(x, y, config, config.maxDepth, rng, debugEvents);
      case "float":
      default:
        return new FloatEntity(x, y, config, config.maxDepth, rng, debugEvents);
    }
  }
}
