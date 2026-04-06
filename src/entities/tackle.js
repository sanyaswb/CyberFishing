class Equipment {
  #level;
  #basePower;

  constructor(level, basePower) {
    this.#level = level;
    this.#basePower = basePower;
  }

  getPower() {
    return this.#level * this.#basePower;
  }
}

class Rod extends Equipment {
  #compensation;
  #type;
  #maxDistance;
  #hasReel;

  constructor(
    level,
    power,
    compensation = 0,
    type = "float_match",
    maxDistance = Infinity,
    hasReel = true,
  ) {
    super(level, power);
    this.#compensation = compensation;
    this.#type = type;
    this.#maxDistance = maxDistance;
    this.#hasReel = hasReel;
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
}

class Reel extends Equipment {
  #holdConfig;

  constructor(level, power, holdConfig = null) {
    super(level, power); // Стара логіка відпрацьовує як і раніше!
    this.#holdConfig = holdConfig;
  }

  // Метод для перевірки, чи взагалі доступна механіка утримання
  hasHoldMechanic() {
    return this.#holdConfig && this.#holdConfig.activeLevel > 0;
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

  constructor(config) {
    this.#config = config || { active: false };
  }

  get isActive() {
    return this.#config.active;
  }

  // Переводимо стару логіку "length * 10" у віртуальну дистанцію.
  // Наприклад, length 15 = 150 віртуальних пікселів від берега.
  get virtualReach() {
    return (this.#config.length || 0) * 10;
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

    const maxWeight = this.#config.maxWeight || 0;
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
  _biteMoveTimer = 0;
  _stepId = 0;
  _isOverDepth = false;

  _windAngleOffset = 0;
  _targetWindAngle = 0;
  _windTimer = 0;
  _windFluctuationTimer = 0;
  _sinkerConfig = null;
  _sinkingStartAngle = 90;

  constructor(x, y, config, maxDepth) {
    this._position = new Vector2(x, y);
    this._velocity = new Vector2(0, 0);
    this._currentBiteMoveVelocity = new Vector2(0, 0);
    this._config = config;
    this._maxDepth = maxDepth || config.maxDepth || 8.0;
    this._currentHookDepth = 0.1;
    this._targetHookDepth = 0.1;

    // ВАЖЛИВО: Розділяємо фізичне гальмування і опір наживки
    this._velocityDamping = config.friction || 0.85;
    this._lureResistance = config.waterFriction || 0;

    this._baseColor = config.type === "day" ? "#ffffff" : "#00ff80";
    this._currentColor = this._baseColor;
  }

  getPosition() {
    return this._position;
  }

  getCurrentHookDepth() {
    return this._currentHookDepth;
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
    const isSpinningLure = ["spinner", "wobbler", "jig"].includes(
      this._config.type,
    );

    if (!this._isHooked) {
      if (!this._isBiting || isSpinningLure) {
        this._processMechanics(dt, input, reelPower, pullDirection);
      }
    }

    this._applyPhysics(boundsRect, checkWater, dt, environment);

    if (this._isBiting) {
      this.updateBite(dt, checkWater);
    }
  }

  _processMechanics(dt, input, reelPower, pullDirection) {}

  _applyPhysics(boundsRect, checkWater, dt, environment) {
    let driftDx = 0;
    let driftDy = 0;

    if (!this._isHooked && environment) {
      if (environment.current) {
        const activeCfg = this._sinkerConfig || this._config;
        const compRange = activeCfg.currentCompensation || [0.1, 0.99];
        const qual = Math.max(1, Math.min(10, activeCfg.quality || 1));
        const comp = this._lerp(compRange[0], compRange[1], (qual - 1) / 9);

        const driftSpeed = environment.current.speedPxPerSec * (1 - comp);
        driftDx = environment.current.direction.x * driftSpeed * (dt / 1000);
        driftDy = environment.current.direction.y * driftSpeed * (dt / 1000);
      }

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
          if (Math.random() < environment.wind.gustChancePerSec * (dt / 1000)) {
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
      this._velocity.multiplyScalar(this._velocityDamping);
      return;
    }

    let nextX = this._position.x + this._velocity.x + driftDx;
    let nextY = this._position.y + this._velocity.y + driftDy;

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

    this._velocity.multiplyScalar(this._velocityDamping);
  }

  getVisualState() {
    let finalAngle = this._currentAngle;
    if (!this._isHooked && !this._isBiting) {
      finalAngle += this._windAngleOffset;
    }
    return {
      color: this._currentColor,
      angle: finalAngle,
      scaleY: this._currentScaleY * this._sinkerHeightScale,
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
    const hasMoreActions = this._sequenceQueue.some(
      (s) => s.angle !== 0 || s.scaleY !== 1.0 || s.startMove,
    );
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
    this._biteMoveTimer = 0;
  }

  startBite(isPulling = false, fishBiteSequence = null) {
    this._isBiting = true;
    this._isHooked = false;

    const baseSeq = fishBiteSequence || CONFIG.float.biteSequence;
    const seqCfg = { ...baseSeq };

    const isSpinningLure = ["spinner", "wobbler", "jig"].includes(
      this._config.type,
    );

    if (isSpinningLure && !isPulling) {
      seqCfg.chanceGuaranteed = CONFIG.physics?.idleSpinningBiteChance ?? 0.005;
    }

    this._currentSequenceCount = 1;
    this._targetSequenceCount = Math.floor(
      this._getRandom(seqCfg.maxSequences),
    );
    this._rollBiteSequence(seqCfg);
  }

  stopBite() {
    this._isBiting = false;
    this._sequenceQueue = [];
    this._currentAngle = this._isOverDepth ? this._sinkingStartAngle : 0;
    this._currentScaleY = 1.0;
    this._currentColor = this._baseColor;
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
        this._rollBiteSequence(
          this._config.biteSequence || CONFIG.float.biteSequence,
        );
      }
    }
  }

  _rollBiteSequence(seqCfg) {
    const isRed = Math.random() <= seqCfg.chanceGuaranteed;
    const color = isRed ? "#ff0000" : "#ffff00";
    const range = isRed ? seqCfg.guaranteedIters : seqCfg.normalIters;
    const iters = Math.floor(this._getRandom(range));

    if (this._currentSequenceCount > 1) {
      this._sequenceQueue.push({
        duration: this._getRandom(seqCfg.sequenceIntervalMs),
        angle: 0,
        scaleY: 1.0,
        startMove: false,
        color: this._baseColor,
        isGuaranteed: false,
      });
    }
    for (let i = 0; i < iters; i++) {
      const steps = this._generateRandomAnim(isRed, seqCfg);
      steps.forEach((s) => {
        s.color = color;
        s.isGuaranteed = isRed;
        this._sequenceQueue.push(s);
      });
      this._sequenceQueue.push({
        duration: this._getRandom(seqCfg.intervalMs),
        angle: 0,
        scaleY: 1.0,
        startMove: false,
        color: color,
        isGuaranteed: isRed,
      });
    }
    this._nextAnimStep();
  }

  _generateRandomAnim(isRed, seqCfg) {
    const animsCfg = seqCfg.animations || { slide: {} };
    const types = Object.keys(animsCfg);
    const chosen =
      types.length > 0
        ? types[Math.floor(Math.random() * types.length)]
        : "slide";
    const cfg = animsCfg[chosen] || {};
    const mods = seqCfg.guaranteedModifiers || {};

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

    if (chosen === "slide" || Math.random() <= (seqCfg.movementChance || 0)) {
      startMove = true;
      moveTime = this._getRandom(seqCfg.movementDurationMs || [100, 200]);
      let speed = this._getRandom(seqCfg.movementSpeedPx || [10, 20]);

      if (isRed && mods.movementSpeedMult) {
        speed *= this._getRandom(mods.movementSpeedMult);
        moveTime *= this._getRandom(mods.movementDurationMult || [1, 1]);
      }

      const dirAngle = Math.random() * Math.PI * 2;
      moveVelX = Math.cos(dirAngle) * speed;
      moveVelY = Math.sin(dirAngle) * speed;
      duration = Math.max(100, moveTime - holdDuration);
    }

    if (targetAngle !== 0) {
      if (startMove && moveVelX !== 0) {
        targetAngle = Math.abs(targetAngle) * (moveVelX > 0 ? -1 : 1);
      } else {
        if (Math.random() < 0.5) targetAngle = -targetAngle;
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
    return arr[0] + Math.random() * (arr[1] - arr[0]);
  }
}

class SpinnerEntity extends WaterEntity {
  _processMechanics(dt, input, reelPower, pullDirection) {
    const dtSec = dt / 1000;
    if (input.isPulling && pullDirection) {
      const multiplier = CONFIG.physics?.lureRetrieveMultiplier ?? 150;
      const targetSpeedPxPerSec =
        Math.max(0, reelPower - this._lureResistance) * multiplier;

      // Ідеальна формула: компенсуємо частоту кадрів та інерцію
      const force = targetSpeedPxPerSec * dtSec * (1 - this._velocityDamping);

      this.applyForce(
        new Vector2(pullDirection.x * force, pullDirection.y * force),
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

class WobblerEntity extends WaterEntity {
  _processMechanics(dt, input, reelPower, pullDirection) {
    const dtSec = dt / 1000;

    if (input.isPulling && pullDirection) {
      const multiplier = CONFIG.physics?.lureRetrieveMultiplier ?? 150;
      const targetSpeedPxPerSec =
        Math.max(0, reelPower - this._lureResistance) * multiplier;
      const force = targetSpeedPxPerSec * dtSec * (1 - this._velocityDamping);

      this.applyForce(
        new Vector2(pullDirection.x * force, pullDirection.y * force),
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
      const multiplier = CONFIG.physics?.lureRetrieveMultiplier ?? 150;
      const targetSpeedPxPerSec =
        Math.max(0, reelPower - this._lureResistance) * multiplier;

      const force = targetSpeedPxPerSec * dtSec * (1 - this._velocityDamping);

      this.applyForce(
        new Vector2(pullDirection.x * force, pullDirection.y * force),
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

class FloatEntity extends WaterEntity {
  _sinkingTimer = 0;
  _isSinking = false;
  _sinkingTotalTime = 0;
  _sinkingDelayTimer = 0;

  // КРИТИЧНО ВАЖЛИВО: Цей метод має залишитися тут!
  cast(x, y, targetDepth, isOverDepth, sinkerConfig, distanceRatio) {
    this._position.set(x, y);
    this._velocity.set(0, 0);
    this._isHooked = false;
    this._isBiting = false;
    this.stopBite();

    this._targetHookDepth = targetDepth;
    this._currentHookDepth = 0.1;
    this._isOverDepth = isOverDepth;
    this._sinkerConfig = sinkerConfig;

    const weightCfg = sinkerConfig.weights[sinkerConfig.weight];
    this._sinkerHeightScale = weightCfg.heightScale;

    const pRange = this._config.perspectiveScaleRange || [1.3, 0.7];
    this._perspectiveScale =
      pRange[0] + distanceRatio * (pRange[1] - pRange[0]);

    this._isSinking = true;
    this._sinkingDelayTimer = this._config.sinkingDelayMs || 500;

    const maxDepth = sinkerConfig.maxDepth || 8.0;
    const depthRatio = Math.max(0.1, Math.min(1.0, targetDepth / maxDepth));
    const baseSinkingTime =
      (this._config.sinkingDurationMs || 4000) * depthRatio;

    this._sinkingTotalTime = baseSinkingTime / weightCfg.speedMult;
    this._sinkingTimer = this._sinkingTotalTime;

    this._sinkingStartAngle = Math.random() < 0.5 ? 90 : -90;
    this._currentAngle = this._sinkingStartAngle;
    this._currentScaleY = 1.0;
  }

  // Твоя нова, ідеально чиста логіка
  _processMechanics(dt, input, reelPower, pullDirection) {
    if (!this._isSinking) return;

    if (this._sinkingDelayTimer > 0) {
      this._sinkingDelayTimer -= dt;
      return;
    }

    const isFishHolding =
      this._isBiting && this._currentColor !== this._baseColor;

    if (!isFishHolding) {
      this._sinkingTimer -= dt;
      let progress =
        1.0 - Math.max(0, this._sinkingTimer / this._sinkingTotalTime);

      this._currentHookDepth = this._lerp(0.1, this._targetHookDepth, progress);

      if (!this._isBiting) {
        if (this._isOverDepth) {
          this._currentAngle = this._sinkingStartAngle;
        } else {
          this._currentAngle = this._lerp(this._sinkingStartAngle, 0, progress);
        }
      }

      if (this._sinkingTimer <= 0) {
        this._isSinking = false;
        this._currentHookDepth = this._targetHookDepth;
        if (!this._isBiting && !this._isOverDepth) {
          this._currentAngle = 0;
        }
      }
    }
  }
}

class BaitFactory {
  static create(type, x, y, config, equipment) {
    switch (type) {
      case "spinner":
        return new SpinnerEntity(x, y, config, config.maxDepth);
      case "wobbler":
        return new WobblerEntity(x, y, config, config.maxDepth);
      case "jig":
        return new JigEntity(
          x,
          y,
          config,
          equipment?.sinker?.maxDepth || config.maxDepth,
        );
      case "float":
      default:
        return new FloatEntity(x, y, config, config.maxDepth);
    }
  }
}
