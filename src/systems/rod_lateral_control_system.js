class RodLateralControlSystem {
  #targetRodXOnStart = 0;
  #initialOffsetX = 0;
  #wasActive = false;
  #result = this.#createResult();

  update({
    dtSec,
    inputState,
    fishPosition,
    rodTipPosition,
    rodControlTargetPosition,
    rodLimitKg,
    maxTackleLoadKg,
    currentTensionKg,
    fishTensionKg,
    fishVelocityX,
    fishWeightKg,
    config,
  } = {}) {
    const cfg = config || {};
    if (cfg.enabled === false) {
      this.reset();
      this.#result = this.#createResult({ blockedReason: "disabled" });
      return this.#result;
    }

    const active = !!inputState?.rodControlActive;
    const inputDirectionX = active
      ? Math.sign(this.#safeNumber(inputState?.rodControlDirectionX, 0))
      : 0;
    const inputRatio = active
      ? this.#clamp01(inputState?.rodControlInputRatio)
      : 0;
    const hasFish = this.#hasPoint(fishPosition);
    const fishX = this.#safeNumber(fishPosition?.x, 0);
    const fishY = this.#safeNumber(fishPosition?.y, 0);
    const targetRodX = this.#resolveTargetRodX({
      rodControlTargetPosition,
      rodTipPosition,
    });
    const rodY = this.#safeNumber(
      rodTipPosition?.y ?? rodControlTargetPosition?.y,
      0,
    );
    const alignmentCfg = cfg.alignment || {};
    const minInitialOffsetPx = Math.max(
      0,
      this.#safeNumber(alignmentCfg.minInitialOffsetPx, 12),
    );
    const alignedThresholdPx = Math.max(
      0,
      this.#safeNumber(alignmentCfg.alignedThresholdPx, 8),
    );

    if (!active) {
      this.reset();
      const currentOffsetX = fishX - targetRodX;
      this.#result = this.#createResult({
        active: false,
        inputDirectionX: 0,
        inputRatio: 0,
        targetRodX,
        currentOffsetX,
        towardRodDirectionX: this.#towardRodDirection(currentOffsetX),
        blockedReason: "no_input",
      });
      return this.#result;
    }

    if (!hasFish) {
      this.#result = this.#createResult({
        active: true,
        inputDirectionX,
        inputRatio,
        targetRodX,
        blockedReason: "no_fish",
      });
      return this.#result;
    }

    if (!this.#wasActive) {
      this.#targetRodXOnStart = targetRodX;
      this.#initialOffsetX = fishX - this.#targetRodXOnStart;
      this.#wasActive = true;
    }

    const currentOffsetX = fishX - this.#targetRodXOnStart;
    const initialAbs = Math.abs(this.#initialOffsetX);
    const currentAbs = Math.abs(currentOffsetX);
    const towardRodDirectionX = this.#towardRodDirection(currentOffsetX);
    const lineAngleDeg = this.#calculateLineAngleDeg({
      offsetX: currentOffsetX,
      fishY,
      rodY,
    });
    const angleRatio = this.#resolveAngleRatio({
      lineAngleDeg,
      alignmentCfg,
    });
    const directionFactor = this.#resolveDirectionFactor({
      inputDirectionX,
      towardRodDirectionX,
      alignmentCfg,
    });
    const geometricTransferRatio = this.#clamp01(
      inputRatio * angleRatio * directionFactor,
    );
    const forceFrame = this.#resolveForceFrame({
      geometricTransferRatio,
      rodLimitKg,
      maxTackleLoadKg,
      currentTensionKg,
      fishTensionKg,
      fishWeightKg,
      config: cfg,
    });
    const deliveredForceRatio = this.#clamp01(
      geometricTransferRatio * forceFrame.loadReserveRatio,
    );
    const alignmentProgress = this.#calculateProgress({
      initialAbs,
      currentAbs,
      alignedThresholdPx,
    });
    const aligned =
      currentAbs <= alignedThresholdPx || towardRodDirectionX === 0;
    const hasEnoughInitialOffset = initialAbs >= minInitialOffsetPx;
    const desiredMovePx = this.#resolveMovePx({
      dtSec,
      deliveredForceRatio,
      currentAbs,
      alignedThresholdPx,
      config: cfg,
    });
    const tensionMultiplier = this.#resolveTensionMultiplier({
      controlDirectionX: towardRodDirectionX,
      fishVelocityX,
      config: cfg,
    });
    const forceKg =
      !aligned && hasEnoughInitialOffset
        ? forceFrame.forceKg
        : 0;
    const canApply =
      deliveredForceRatio > 0 &&
      forceKg > 0 &&
      desiredMovePx > 0 &&
      hasEnoughInitialOffset &&
      !aligned;
    const blockedReason = this.#resolveBlockedReason({
      active,
      hasFish,
      inputDirectionX,
      inputRatio,
      hasEnoughInitialOffset,
      aligned,
      directionFactor,
      angleRatio,
      loadReserveKg: forceFrame.loadReserveKg,
      forceKg,
      deliveredForceRatio,
    });
    const playerTensionKg = canApply ? forceKg * tensionMultiplier : 0;
    const pixelsPerMeter = Math.max(1, this.#safeNumber(cfg.pixelsPerMeter, 50));

    this.#result = {
      active,
      canApply,
      directionX: towardRodDirectionX,
      inputDirectionX,
      towardRodDirectionX,
      inputRatio,
      angleRatio,
      directionFactor,
      geometricTransferRatio,
      loadReserveKg: forceFrame.loadReserveKg,
      loadReserveRatio: forceFrame.loadReserveRatio,
      forceLimitKg: forceFrame.forceLimitKg,
      currentTensionKg: forceFrame.currentTensionKg,
      deliveredForceRatio: canApply ? deliveredForceRatio : 0,
      forceKg: canApply ? forceKg : 0,
      playerTensionKg,
      tensionMultiplier,
      desiredMovePx: canApply ? desiredMovePx : 0,
      desiredMoveMeters: canApply ? desiredMovePx / pixelsPerMeter : 0,
      appliedMoveMeters: 0,
      appliedMovePx: 0,
      targetRodX: this.#targetRodXOnStart,
      initialOffsetX: this.#initialOffsetX,
      currentOffsetX,
      alignmentProgress,
      aligned,
      alignedThresholdPx,
      lineAngleDeg,
      blockedReason,
      visualRatio: inputRatio * angleRatio,
    };
    return this.#result;
  }

  recordAppliedMovement({
    movedMeters = 0,
    movedPx = 0,
    currentFishX = null,
  } = {}) {
    const nextOffset = Number.isFinite(Number(currentFishX))
      ? Number(currentFishX) - this.#targetRodXOnStart
      : this.#result.currentOffsetX;
    const nextProgress = this.#calculateProgress({
      initialAbs: Math.abs(this.#initialOffsetX),
      currentAbs: Math.abs(nextOffset),
      alignedThresholdPx: this.#result.alignedThresholdPx,
    });
    this.#result.appliedMoveMeters = Math.max(0, Number(movedMeters) || 0);
    this.#result.appliedMovePx = Math.max(0, Number(movedPx) || 0);
    this.#result.currentOffsetX = nextOffset;
    this.#result.alignmentProgress = nextProgress;
    this.#result.aligned =
      Math.abs(nextOffset) <=
      Math.max(0, Number(this.#result.alignedThresholdPx) || 0);
    if (this.#result.aligned) {
      this.#result.canApply = false;
      this.#result.deliveredForceRatio = 0;
      this.#result.forceKg = 0;
      this.#result.playerTensionKg = 0;
      this.#result.desiredMoveMeters = 0;
      this.#result.desiredMovePx = 0;
      this.#result.blockedReason = "aligned";
    }
    return this.#result;
  }

  getState() {
    return this.#result;
  }

  reset() {
    this.#targetRodXOnStart = 0;
    this.#initialOffsetX = 0;
    this.#wasActive = false;
    this.#result = this.#createResult();
  }

  #resolveTargetRodX({ rodControlTargetPosition, rodTipPosition }) {
    if (Number.isFinite(Number(rodControlTargetPosition?.x))) {
      return Number(rodControlTargetPosition.x);
    }
    return this.#safeNumber(rodTipPosition?.x, 0);
  }

  #resolveAngleRatio({ lineAngleDeg, alignmentCfg }) {
    const maxEffectiveAngleDeg = this.#safeNumber(
      alignmentCfg.maxEffectiveAngleDeg,
      45,
    );
    if (maxEffectiveAngleDeg <= 0) return 0;
    return this.#clamp01(lineAngleDeg / maxEffectiveAngleDeg);
  }

  #resolveDirectionFactor({
    inputDirectionX,
    towardRodDirectionX,
    alignmentCfg,
  }) {
    if (inputDirectionX === 0 || towardRodDirectionX === 0) return 0;
    if (inputDirectionX === towardRodDirectionX) return 1;
    if (alignmentCfg.allowAwayDirection === true) {
      return this.#clamp01(alignmentCfg.awayDirectionMultiplier);
    }
    return 0;
  }

  #resolveForceFrame({
    geometricTransferRatio,
    rodLimitKg,
    maxTackleLoadKg,
    currentTensionKg,
    fishTensionKg,
    fishWeightKg,
    config,
  }) {
    const forceCfg = config.force || {};
    const maxForceKg = Math.max(
      0,
      this.#safeNumber(forceCfg.maxForceKg, 0.22),
    );
    const tackleLimitKg = Math.max(
      0,
      this.#safeNumber(
        rodLimitKg,
        this.#safeNumber(maxTackleLoadKg, maxForceKg),
      ),
    );
    const resolvedCurrentTensionKg = Math.max(
      0,
      this.#safeNumber(
        currentTensionKg,
        this.#safeNumber(fishTensionKg, 0),
      ),
    );
    const loadReserveKg = Math.max(
      0,
      tackleLimitKg - resolvedCurrentTensionKg,
    );
    const forceLimitKg = Math.min(maxForceKg, loadReserveKg);
    const loadReserveRatio =
      maxForceKg > 0 ? this.#clamp01(forceLimitKg / maxForceKg) : 0;
    const weightResistance = this.#weightResistance({ fishWeightKg, forceCfg });
    return {
      currentTensionKg: resolvedCurrentTensionKg,
      loadReserveKg,
      forceLimitKg,
      loadReserveRatio,
      forceKg:
        forceLimitKg * this.#clamp01(geometricTransferRatio) / weightResistance,
    };
  }

  #resolveMovePx({
    dtSec,
    deliveredForceRatio,
    currentAbs,
    alignedThresholdPx,
    config,
  }) {
    const forceCfg = config.force || {};
    const speedPxPerSecond = Math.max(
      0,
      this.#safeNumber(forceCfg.sideMovePxPerSecond, 50),
    );
    const desired =
      speedPxPerSecond *
      Math.max(0, this.#safeNumber(dtSec, 0)) *
      this.#clamp01(deliveredForceRatio);
    const maxBeforeAlignment = Math.max(
      0,
      Math.max(0, this.#safeNumber(currentAbs, 0)) -
        Math.max(0, this.#safeNumber(alignedThresholdPx, 0)),
    );
    return Math.min(desired, maxBeforeAlignment);
  }

  #resolveTensionMultiplier({ controlDirectionX, fishVelocityX, config }) {
    const tension = config.tension || {};
    const fishDirection = Math.sign(this.#safeNumber(fishVelocityX, 0));
    if (fishDirection === 0 || controlDirectionX === 0) {
      return Math.max(0, this.#safeNumber(tension.sideMultiplier, 1));
    }
    if (fishDirection === controlDirectionX) {
      return Math.max(
        0,
        this.#safeNumber(tension.sameDirectionMultiplier, 0),
      );
    }
    return Math.max(
      0,
      this.#safeNumber(tension.oppositeDirectionMultiplier, 2.5),
    );
  }

  #resolveBlockedReason({
    active,
    hasFish,
    inputDirectionX,
    inputRatio,
    hasEnoughInitialOffset,
    aligned,
    directionFactor,
    angleRatio,
    loadReserveKg,
    forceKg,
    deliveredForceRatio,
  }) {
    if (!active) return "no_input";
    if (!hasFish) return "no_fish";
    if (inputDirectionX === 0) return "no_input";
    if (inputRatio <= 0) return "dead_zone";
    if (aligned) return "aligned";
    if (!hasEnoughInitialOffset) return "initial_offset_too_small";
    if (directionFactor <= 0) return "wrong_direction";
    if (angleRatio <= 0) return "angle_too_small";
    if (loadReserveKg <= 0) return "no_load_reserve";
    if (forceKg <= 0 || deliveredForceRatio <= 0) return "no_force";
    return "none";
  }

  #calculateProgress({ initialAbs, currentAbs, alignedThresholdPx }) {
    const initial = Math.max(0, this.#safeNumber(initialAbs, 0));
    if (initial <= 0) return 0;
    const threshold = Math.max(0, this.#safeNumber(alignedThresholdPx, 0));
    if (Math.max(0, this.#safeNumber(currentAbs, 0)) <= threshold) return 1;
    return this.#clamp01(
      1 - Math.max(0, this.#safeNumber(currentAbs, 0)) / initial,
    );
  }

  #calculateLineAngleDeg({ offsetX, fishY, rodY }) {
    const dx = Math.abs(this.#safeNumber(offsetX, 0));
    const dy = Math.abs(this.#safeNumber(fishY, 0) - this.#safeNumber(rodY, 0));
    if (dx <= 0 && dy <= 0) return 0;
    return (Math.atan2(dx, dy) * 180) / Math.PI;
  }

  #towardRodDirection(offsetX) {
    return -Math.sign(this.#safeNumber(offsetX, 0));
  }

  #weightResistance({ fishWeightKg, forceCfg }) {
    return Math.max(
      0.25,
      1 +
        Math.max(0, this.#safeNumber(fishWeightKg, 0)) *
          Math.max(
            0,
            this.#safeNumber(forceCfg.fishWeightResistanceMultiplier, 0),
          ),
    );
  }

  #hasPoint(point) {
    return (
      point &&
      Number.isFinite(Number(point.x)) &&
      Number.isFinite(Number(point.y))
    );
  }

  #safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  #createResult(overrides = {}) {
    return {
      active: false,
      canApply: false,
      directionX: 0,
      inputDirectionX: 0,
      towardRodDirectionX: 0,
      inputRatio: 0,
      angleRatio: 0,
      directionFactor: 0,
      geometricTransferRatio: 0,
      loadReserveKg: 0,
      loadReserveRatio: 0,
      forceLimitKg: 0,
      currentTensionKg: 0,
      deliveredForceRatio: 0,
      forceKg: 0,
      playerTensionKg: 0,
      tensionMultiplier: 0,
      desiredMoveMeters: 0,
      desiredMovePx: 0,
      appliedMoveMeters: 0,
      appliedMovePx: 0,
      targetRodX: 0,
      initialOffsetX: 0,
      currentOffsetX: 0,
      alignmentProgress: 0,
      aligned: false,
      alignedThresholdPx: 0,
      lineAngleDeg: 0,
      blockedReason: "no_input",
      visualRatio: 0,
      ...overrides,
    };
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, this.#safeNumber(value, 0)));
  }
}
