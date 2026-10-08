import { EnvironmentalCompensationModifier } from "../items/quality/environmental_compensation_modifier.js";
import { Vector2 } from "../../../engine/math/vector2.js";

export class WaterEntity {
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
  _weightedTackleHeightScale = 1.0;

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
  _weightedTackleConfig = null;
  _sinkingStartAngle = 90;
  _isPlayerPullingThisFrame = false;

  _activeBiteSequence = null;
  _rng;
  _debugEvents;
  _environmentalCompensationModifier;
  _devFlags;
  _runtimeConfig;

  constructor(
    x,
    y,
    config,
    maxDepth,
    rng = null,
    debugEvents = null,
    environmentalCompensationModifier = null,
    devFlags = null,
    runtimeConfig = null,
  ) {
    this._position = new Vector2(x, y);
    this._velocity = new Vector2(0, 0);
    this._currentBiteMoveVelocity = new Vector2(0, 0);
    this._forceScratch = new Vector2(0, 0);
    this._config = config;
    this._rng = rng || { next: () => Math.random() };
    this._debugEvents = debugEvents || null;
    this._devFlags = devFlags || null;
    this._runtimeConfig = runtimeConfig || null;
    this._environmentalCompensationModifier =
      environmentalCompensationModifier ||
      new EnvironmentalCompensationModifier();
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
    const passiveRetrieve = this._passiveRetrieveConfig();
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
        retrieveParams?.power ??
          passiveRetrieve.passiveRetrievePowerRatio ??
          passiveRetrieve.power ??
          1.0,
        retrieveParams?.multiplier ?? passiveRetrieve.multiplier ?? 35,
        retrieveParams?.waterFriction ??
          passiveRetrieve.waterFriction ??
          0.35,
      );
    }

    const dtSec = this._getClampedDtSec(dt);
    this._currentHookDepth = Math.max(
      0,
      this._currentHookDepth -
        (passiveRetrieve.depthRiseSpeed ?? 0.15) * dtSec,
    );
  }

  getPosition() {
    return this._position;
  }

  getVelocity() {
    return this._velocity;
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

  applyHookedFightMovement({
    boundsRect,
    dt,
    environment,
    checkWater,
    input = {},
    pullDirection = null,
    targetVelocity = null,
  } = {}) {
    this._isPlayerPullingThisFrame = !!(input.isPulling && pullDirection);

    const dtSec = this._getClampedDtSec(dt);
    const targetVelocityX = Number(targetVelocity?.x) || 0;
    const targetVelocityY = Number(targetVelocity?.y) || 0;
    const drift = this._calculateEnvironmentDrift(dtSec, environment);

    // Hooked fight movement is authoritative: the simplified fight model already
    // applies water resistance, drag escape multiplier and state speed modifiers.
    // Do not run the generic WaterEntity damping on this movement frame.
    this._velocity.set(targetVelocityX, targetVelocityY);

    this._resetPassiveWindMotion(dt);

    const prevX = this._position.x;
    const prevY = this._position.y;
    let nextX = this._position.x + targetVelocityX * dtSec + drift.x;
    let nextY = this._position.y + targetVelocityY * dtSec + drift.y;

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

    const bounds = boundsRect || {
      left: -Infinity,
      right: Infinity,
      top: -Infinity,
      bottom: Infinity,
    };

    this._position.set(
      Math.max(bounds.left, Math.min(bounds.right, nextX)),
      Math.max(bounds.top, Math.min(bounds.bottom, nextY)),
    );

    const movedX = this._position.x - prevX;
    const movedY = this._position.y - prevY;
    this._updateMotionTilt(dt, movedX, movedY);
    this._afterPhysicsUpdate(checkWater);

    if (this._isBiting && typeof this.updateBite === "function") {
      this.updateBite(dt, checkWater);
    }

    return {
      movedX,
      movedY,
      actualSpeedPxPerSec: dtSec > 0 ? Math.hypot(movedX, movedY) / dtSec : 0,
      targetSpeedPxPerSec: Math.hypot(targetVelocityX, targetVelocityY),
      driftX: drift.x,
      driftY: drift.y,
      dampingApplied: false,
    };
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

  // The composition passes the live runtime config object; its adapter is read on every call, so
  // DEV adapter overrides stay live.
  _fightPhysicsConfig() {
    return this._runtimeConfig?.fightPhysicsConfig || null;
  }

  _passiveRetrieveConfig() {
    return this._fightPhysicsConfig()?.getPassiveRetrieveConfig?.() || {};
  }

  _floatMotionConfig() {
    const physicsConfig = this._fightPhysicsConfig();
    return (
      physicsConfig?.getFloatMotionConfig?.() ||
      (physicsConfig?.getDistanceConfig?.() || {}).floatMotion ||
      {}
    );
  }

  _lureRetrieveConfig() {
    return this._fightPhysicsConfig()?.getLureRetrieveConfig?.() || {};
  }

  _getClampedDtSec(dt) {
    const maxDtMs = this._fightPhysicsConfig()?.getMaxDtMs?.() ?? 50;
    return Math.min(Math.max(0, Number(dt) || 0), maxDtMs) / 1000;
  }

  _getVelocityDamping(dtSec) {
    const dampingPerSecond =
      this._config.velocityDampingPerSecond ??
      -Math.log(Math.max(0.001, Math.min(0.999, this._velocityDamping))) * 60;
    return Math.exp(-Math.max(0, dampingPerSecond) * dtSec);
  }

  _calculateEnvironmentDrift(dtSec, environment) {
    if (!environment?.current) return { x: 0, y: 0 };

    const activeCfg = this._weightedTackleConfig || this._config;
    const compRange = activeCfg.currentCompensation || [0.1, 0.99];
    const comp = this._environmentalCompensationModifier.getCoefficient(
      activeCfg.quality,
      compRange,
    );
    const driftSpeed = environment.current.speedPxPerSec * (1 - comp);

    return {
      x: environment.current.direction.x * driftSpeed * dtSec,
      y: environment.current.direction.y * driftSpeed * dtSec,
    };
  }

  _resetPassiveWindMotion(dt) {
    this._targetWindAngle = 0;
    this._windTimer = 0;
    this._windFluctuationTimer = 0;
    this._windAngleOffset = this._lerp(
      this._windAngleOffset,
      this._targetWindAngle,
      dt * 0.005,
    );
  }

  _applyPhysics(boundsRect, checkWater, dt, environment) {
    const dtSec = this._getClampedDtSec(dt);
    const drift = this._calculateEnvironmentDrift(dtSec, environment);
    const driftDx = drift.x;
    const driftDy = drift.y;

    if (!this._isHooked && environment) {
      const isActivelyPulling =
        this._isBiting &&
        (Math.abs(this._currentAngle) > 0.5 ||
          Math.abs(this._currentScaleY - 1.0) > 0.02);

      if (environment.wind && !isActivelyPulling) {
        const dir = environment.wind.direction;
        const windCompRange = this._config.windCompensation || [0.1, 0.99];
        const windComp = this._environmentalCompensationModifier.getCoefficient(
          this._config.quality,
          windCompRange,
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

    const cfg = this._floatMotionConfig();
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
        this._currentScaleY *
        this._weightedTackleHeightScale *
        this._pullImpulseScaleY,
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

  // DEV bite-sequence override through the injected DevFlagsProvider (none without DEV).
  _applyGodModeBiteSequence(seqCfg) {
    const mode = this._devFlags?.godModeValue?.("biteSequenceMode");
    if (mode !== "guaranteed" && mode !== "normal") return seqCfg;

    seqCfg.chanceGuaranteed = mode === "guaranteed" ? 1.0 : 0.0;
    seqCfg.chanceNormal = mode === "guaranteed" ? 0.0 : 1.0;
    return seqCfg;
  }

  startBite(isPulling = false, fishBiteSequence = null) {
    this._isBiting = true;
    this._isHooked = false;

    // 1. БЕРЕМО КОНФІГ ВІД РИБИ
    const baseSeq = fishBiteSequence || this._runtimeConfig.float.biteSequence;
    const seqCfg = this._applyGodModeBiteSequence({ ...baseSeq });

    const isSpinningLure = ["spinner", "wobbler", "jig"].includes(
      this._config.type,
    );

    if (isSpinningLure && !isPulling) {
      seqCfg.chanceGuaranteed =
        this._lureRetrieveConfig().idleSpinningBiteChance ?? 0.005;
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
        result: "success",
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
