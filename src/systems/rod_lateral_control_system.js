class RodLateralControlSystem {
  #result = this.#createResult();
  #tensionModeResolver;
  #centerStartDirectionX = 0;
  #controlStartedCentered = false;
  #wasControlActive = false;

  constructor({ tensionModeResolver = null } = {}) {
    this.#tensionModeResolver =
      tensionModeResolver || new RodControlTensionModeResolver();
  }

  update({
    dtSec,
    inputState,
    fishPosition,
    rodTipPosition,
    baseRodTipPosition,
    actualRodTipPosition,
    rodLimitKg,
    maxTackleLoadKg,
    currentTensionKg,
    fishTensionKg,
    fishVelocity,
    fishVelocityX,
    fishWeightKg,
    playerForceBudget,
    dragLimitKg,
    dragLocked = true,
    lineHasReserve = false,
    hardLineLimit = false,
    lineConstraintState = null,
    intentFrame = null,
    config,
  } = {}) {
    const cfg = config || {};
    if (cfg.enabled === false) {
      this.#resetControlSession();
      this.#result = this.#createResult({ blockedReason: "disabled" });
      return this.#result;
    }

    const intent = intentFrame || this.resolveIntent({
      inputState,
      fishPosition,
      rodTipPosition,
      baseRodTipPosition,
      actualRodTipPosition,
      config: cfg,
    });
    const active = intent.active;
    const inputDirectionX = intent.inputDirectionX;
    const inputRatio = intent.inputRatio;
    const hasFish = intent.hasFish;
    const targetFrame = intent.targetFrame;
    const requestedForceRatio = this.#clamp01(
      inputRatio * targetFrame.angleRatio * targetFrame.directionFactor,
    );
    const tensionModeFrame = this.#resolveTensionModeFrame({
      fishVelocity,
      fishVelocityX,
      controlDirectionX: targetFrame.directionX,
      config: cfg,
    });
    const tensionMultiplier = this.#resolveTensionMultiplier({
      mode: tensionModeFrame.mode,
      config: cfg,
    });
    const forceFrame = this.#resolveForceFrame({
      requestedForceRatio,
      rodLimitKg,
      maxTackleLoadKg,
      currentTensionKg,
      fishTensionKg,
      fishWeightKg,
      playerForceBudget,
      tensionMultiplier,
      dragLimitKg,
      dragLocked,
      lineHasReserve,
      hardLineLimit,
      lineConstraintState,
      config: cfg,
    });
    const deliveredForceRatio = this.#clamp01(
      requestedForceRatio * forceFrame.loadReserveRatio,
    );
    const forceKg = forceFrame.forceKg;
    const moveFrame = this.#resolveMoveFrame({
      dtSec,
      forceKg,
      maxBeforeAlignmentMeters: targetFrame.maxBeforeAlignmentMeters,
      config: cfg,
    });
    const canApply =
      active &&
      hasFish &&
      targetFrame.directionX !== 0 &&
      inputRatio > 0 &&
      targetFrame.directionFactor > 0 &&
      targetFrame.angleRatio > 0 &&
      (!targetFrame.aligned || targetFrame.centerStartActive) &&
      forceFrame.effectiveForceLimitKg > 0 &&
      forceKg > 0 &&
      moveFrame.desiredMoveMeters > 0;

    this.#result = this.#createResult({
      active,
      canApply,
      directionX: targetFrame.directionX,
      inputDirectionX,
      inputRatio,
      requestedForceRatio,
      loadReserveKg: forceFrame.loadReserveKg,
      loadReserveRatio: forceFrame.loadReserveRatio,
      tensionCeilingMultiplier: forceFrame.tensionCeilingMultiplier,
      tensionCeilingKg: forceFrame.tensionCeilingKg,
      playerForceBudgetEnabled: forceFrame.playerForceBudgetEnabled,
      playerForceControlBudgetKg: forceFrame.playerForceControlBudgetKg,
      playerForceControlShare: forceFrame.playerForceControlShare,
      forceLimitKg: forceFrame.forceLimitKg,
      effectiveForceLimitKg: forceFrame.effectiveForceLimitKg,
      currentTensionKg: forceFrame.currentTensionKg,
      dragLimited: forceFrame.dragLimited,
      dragReserveKg: forceFrame.dragReserveKg,
      canSlipDrag: forceFrame.canSlipDrag,
      lineLengthLocked: !!lineConstraintState?.lineLengthLocked,
      radialConstraintActive: !!lineConstraintState?.radialConstraintActive,
      deliveredForceRatio: canApply ? deliveredForceRatio : 0,
      forceKg: canApply ? forceKg : 0,
      playerTensionKg: canApply ? forceKg * tensionMultiplier : 0,
      tensionMultiplier,
      tensionMode: tensionModeFrame.mode,
      fishControlAxisAlignment: tensionModeFrame.alignment,
      fishControlAxisVelocityPxPerSecond:
        tensionModeFrame.projectionSpeedPxPerSec,
      fishAutonomousSpeedPxPerSecond:
        tensionModeFrame.fishSpeedPxPerSec,
      controlAxisX: tensionModeFrame.controlAxisX,
      controlAxisY: tensionModeFrame.controlAxisY,
      desiredMoveMeters: canApply ? moveFrame.desiredMoveMeters : 0,
      desiredMovePx: canApply ? moveFrame.desiredMovePx : 0,
      maxPullSpeedMetersPerSecond:
        moveFrame.maxPullSpeedMetersPerSecond,
      visualControlRatio: canApply ? deliveredForceRatio : 0,
      targetRodX: active ? targetFrame.targetRodX : null,
      targetRodY: active ? targetFrame.targetRodY : null,
      targetMode: targetFrame.targetMode,
      fishOffsetX: targetFrame.fishOffsetX,
      lineAngleDeg: targetFrame.lineAngleDeg,
      angleRatio: targetFrame.angleRatio,
      directionFactor: targetFrame.directionFactor,
      aligned: targetFrame.aligned,
      centered: targetFrame.centered,
      centerStartActive: targetFrame.centerStartActive,
      controlStartedCentered: targetFrame.controlStartedCentered,
      maxBeforeAlignmentMeters: targetFrame.maxBeforeAlignmentMeters,
      blockedReason: intent.canRequestForce
        ? this.#forceBlockedReason({
            loadReserveKg: forceFrame.loadReserveKg,
            effectiveForceLimitKg: forceFrame.effectiveForceLimitKg,
            dragLimited: forceFrame.dragLimited,
            forceKg,
          })
        : intent.blockedReason,
    });
    return this.#result;
  }

  resolveIntent({
    inputState,
    fishPosition,
    rodTipPosition,
    baseRodTipPosition,
    actualRodTipPosition,
    config,
  } = {}) {
    const cfg = config || {};
    const active = cfg.enabled !== false && !!inputState?.rodControlActive;
    if (!active) this.#resetControlSession();
    const controlSessionStarted = active && !this.#wasControlActive;
    const inputDirectionX = active
      ? Math.sign(this.#number(inputState?.rodControlDirectionX))
      : 0;
    const inputRatio = active
      ? this.#clamp01(inputState?.rodControlInputRatio)
      : 0;
    const hasFish = this.#hasPoint(fishPosition);
    const targetFrame = Object.freeze(this.#resolveTargetFrame({
      inputDirectionX,
      fishPosition,
      rodTipPosition,
      baseRodTipPosition,
      actualRodTipPosition,
      controlSessionStarted,
      config: cfg,
    }));
    if (active) this.#wasControlActive = true;
    const blockedReason = this.#intentBlockedReason({
      active,
      hasFish,
      inputDirectionX,
      inputRatio,
      targetFrame,
    });
    return Object.freeze({
      active,
      inputDirectionX,
      inputRatio,
      hasFish,
      targetFrame,
      canRequestForce: blockedReason === "none",
      blockedReason,
    });
  }

  recordAppliedMovement({ movedMeters = 0, movedPx = 0 } = {}) {
    const desiredMoveMeters = Math.max(
      0,
      this.#number(this.#result.desiredMoveMeters),
    );
    const appliedMoveMeters = Math.max(0, this.#number(movedMeters));
    this.#result.appliedMoveMeters = appliedMoveMeters;
    this.#result.appliedMovePx = Math.max(0, this.#number(movedPx));
    this.#result.actualMovementRatio = desiredMoveMeters > 0
      ? this.#clamp01(appliedMoveMeters / desiredMoveMeters)
      : 0;
    return this.#result;
  }

  getState() {
    return this.#result;
  }

  reset() {
    this.#result = this.#createResult();
    this.#resetControlSession();
  }

  #resetControlSession() {
    this.#centerStartDirectionX = 0;
    this.#controlStartedCentered = false;
    this.#wasControlActive = false;
  }

  #resolveTargetFrame({
    inputDirectionX,
    fishPosition,
    rodTipPosition,
    baseRodTipPosition,
    actualRodTipPosition,
    controlSessionStarted = false,
    config,
  }) {
    const alignment = config.alignment || {};
    const enabled = alignment.enabled !== false;
    const pixelsPerMeter = Math.max(
      1,
      this.#number(config.pixelsPerMeter, 50),
    );

    if (!enabled) {
      return {
        enabled: false,
        directionX: Math.sign(inputDirectionX) || 0,
        directionFactor: Math.sign(inputDirectionX) === 0 ? 0 : 1,
        angleRatio: Math.sign(inputDirectionX) === 0 ? 0 : 1,
        lineAngleDeg: 0,
        targetRodX: null,
        targetRodY: null,
        targetMode: "input_direction",
        fishOffsetX: 0,
        aligned: false,
        centered: false,
        centerStartActive: false,
        controlStartedCentered: false,
        maxBeforeAlignmentMeters: Number.POSITIVE_INFINITY,
      };
    }

    const targetPoint = baseRodTipPosition || rodTipPosition ||
      actualRodTipPosition;
    const targetMode = targetPoint?.mode || "base_rod";
    if (!this.#hasPoint(fishPosition) || !this.#hasPoint(targetPoint)) {
      return {
        enabled: true,
        directionX: 0,
        directionFactor: 0,
        angleRatio: 0,
        lineAngleDeg: 0,
        targetRodX: this.#number(targetPoint?.x, 0),
        targetRodY: this.#number(targetPoint?.y, 0),
        targetMode,
        fishOffsetX: 0,
        aligned: false,
        centered: false,
        centerStartActive: false,
        controlStartedCentered: false,
        maxBeforeAlignmentMeters: 0,
      };
    }

    const targetRodX = this.#number(targetPoint.x);
    const targetRodY = this.#number(targetPoint.y);
    const fishX = this.#number(fishPosition.x);
    const fishY = this.#number(fishPosition.y);
    const fishOffsetX = fishX - targetRodX;
    const absOffsetX = Math.abs(fishOffsetX);
    const alignedThresholdPx = Math.max(
      0,
      this.#number(alignment.alignedThresholdPx, 8),
    );
    const centerStartThresholdPx = Math.max(
      0,
      this.#number(alignment.centerStartThresholdPx, 0.5),
    );
    const aligned = absOffsetX <= alignedThresholdPx;
    const centered = absOffsetX <= centerStartThresholdPx;
    const inputDir = Math.sign(inputDirectionX) || 0;

    if (controlSessionStarted) {
      this.#controlStartedCentered = centered;
      this.#centerStartDirectionX = 0;
    }

    if (
      this.#controlStartedCentered &&
      centered &&
      inputDir !== 0 &&
      this.#centerStartDirectionX === 0
    ) {
      this.#centerStartDirectionX = inputDir;
    }
    const centerStartActive =
      this.#controlStartedCentered && this.#centerStartDirectionX !== 0;
    const towardRodDirectionX = centerStartActive
      ? this.#centerStartDirectionX
      : aligned
        ? 0
        : -Math.sign(fishOffsetX);
    const maxEffectiveAngleDeg = Math.max(
      0.000001,
      this.#number(alignment.maxEffectiveAngleDeg, 45),
    );
    const dy = Math.abs(targetRodY - fishY);
    const lineAngleDeg = Math.atan2(absOffsetX, Math.max(1, dy)) * 180 / Math.PI;
    const angleRatio = centerStartActive
      ? 1
      : aligned
        ? 0
      : this.#clamp01(lineAngleDeg / maxEffectiveAngleDeg);
    let directionFactor = 0;
    if (inputDir !== 0) {
      if (inputDir === towardRodDirectionX) {
        directionFactor = 1;
      }
    }

    return {
      enabled: true,
      directionX: towardRodDirectionX,
      directionFactor,
      angleRatio,
      lineAngleDeg,
      targetRodX: centerStartActive ? null : targetRodX,
      targetRodY: centerStartActive ? null : targetRodY,
      targetMode: centerStartActive ? "center_start" : targetMode,
      fishOffsetX,
      aligned,
      centered,
      centerStartActive,
      controlStartedCentered: this.#controlStartedCentered,
      maxBeforeAlignmentMeters: Math.max(
        0,
        centerStartActive
          ? Number.POSITIVE_INFINITY
          : (absOffsetX - alignedThresholdPx) / pixelsPerMeter,
      ),
    };
  }

  #resolveForceFrame({
    requestedForceRatio,
    rodLimitKg,
    maxTackleLoadKg,
    currentTensionKg,
    fishTensionKg,
    fishWeightKg,
    playerForceBudget,
    tensionMultiplier,
    dragLimitKg,
    dragLocked,
    lineHasReserve,
    hardLineLimit,
    lineConstraintState,
    config,
  }) {
    const forceCfg = config.force || {};
    const maxForceKg = Math.max(
      0,
      this.#number(forceCfg.maxForceKg, 0.22),
    );
    const tackleLimitKg = Math.max(
      0,
      this.#number(
        rodLimitKg,
        this.#number(maxTackleLoadKg, maxForceKg),
      ),
    );
    const budget = playerForceBudget || {};
    const hasExternalBudget = Number.isFinite(
      Number(budget.controlBudgetKg),
    );
    const tensionCeilingMultiplier = hasExternalBudget
      ? Math.max(0, this.#number(budget.combinedCeilingMultiplier, 1))
      : Math.max(0, this.#number(config.tensionCeilingMultiplier, 1));
    const tensionCeilingKg = hasExternalBudget
      ? Math.max(0, this.#number(budget.combinedTensionCeilingKg, 0))
      : tackleLimitKg * tensionCeilingMultiplier;
    const resolvedCurrentTensionKg = Math.max(
      0,
      this.#number(currentTensionKg, this.#number(fishTensionKg)),
    );
    const loadReserveKg = hasExternalBudget
      ? Math.max(0, this.#number(budget.controlBudgetKg, 0))
      : Math.max(0, tensionCeilingKg - resolvedCurrentTensionKg);
    const forceLimitKg = Math.min(maxForceKg, loadReserveKg);
    const canSlipDrag = lineConstraintState
      ? lineConstraintState.dragCanPayout === true
      : !dragLocked && !!lineHasReserve && !hardLineLimit;
    const resolvedDragLimitKg = Math.max(
      0,
      this.#number(dragLimitKg),
    );
    const dragReserveKg = canSlipDrag
      ? Math.max(0, resolvedDragLimitKg - resolvedCurrentTensionKg)
      : loadReserveKg;
    const effectiveTensionReserveKg = canSlipDrag
      ? Math.min(loadReserveKg, dragReserveKg)
      : loadReserveKg;
    const tensionScale = Math.max(
      1,
      this.#number(tensionMultiplier, 1),
    );
    const effectiveForceLimitKg = Math.min(
      maxForceKg,
      effectiveTensionReserveKg / tensionScale,
    );
    const loadReserveRatio = maxForceKg > 0
      ? this.#clamp01(effectiveForceLimitKg / maxForceKg)
      : 0;
    const weightResistance = Math.max(
      0.25,
      1 +
        Math.max(0, this.#number(fishWeightKg)) *
          Math.max(
            0,
            this.#number(forceCfg.fishWeightResistanceMultiplier),
          ),
    );
    return {
      currentTensionKg: resolvedCurrentTensionKg,
      tensionCeilingMultiplier,
      tensionCeilingKg,
      playerForceBudgetEnabled: hasExternalBudget,
      playerForceControlBudgetKg: hasExternalBudget
        ? Math.max(0, this.#number(budget.controlBudgetKg, 0))
        : 0,
      playerForceControlShare: hasExternalBudget
        ? this.#clamp01(budget.controlShare)
        : 0,
      loadReserveKg,
      loadReserveRatio,
      forceLimitKg,
      effectiveForceLimitKg,
      dragLimited: canSlipDrag && effectiveForceLimitKg < forceLimitKg,
      dragReserveKg,
      canSlipDrag,
      forceKg:
        effectiveForceLimitKg *
        this.#clamp01(requestedForceRatio) /
        weightResistance,
    };
  }

  #resolveMoveFrame({ dtSec, forceKg, maxBeforeAlignmentMeters, config }) {
    const forceCfg = config.force || {};
    const waterCfg = config.water || {};
    const pixelsPerMeter = Math.max(
      1,
      this.#number(config.pixelsPerMeter, 50),
    );
    const resistance = Math.max(
      0.000001,
      this.#number(waterCfg.motionResistance, 1000),
    );
    const maxPullSpeedMetersPerSecond =
      Math.sqrt(Math.max(0, this.#number(forceKg)) / resistance) *
      Math.max(0, this.#number(waterCfg.speedMultiplier, 64)) *
      Math.max(
        0,
        this.#number(forceCfg.sidePullSpeedMultiplier, 1),
      );
    const rawDesiredMoveMeters =
      maxPullSpeedMetersPerSecond *
      Math.max(0, this.#number(dtSec));
    const alignmentLimit = Number.isFinite(Number(maxBeforeAlignmentMeters))
      ? Math.max(0, Number(maxBeforeAlignmentMeters) || 0)
      : rawDesiredMoveMeters;
    const desiredMoveMeters = Math.min(rawDesiredMoveMeters, alignmentLimit);
    return {
      desiredMoveMeters,
      desiredMovePx: desiredMoveMeters * pixelsPerMeter,
      maxPullSpeedMetersPerSecond,
    };
  }

  #resolveTensionMultiplier({ mode, config }) {
    const tension = config.tension || {};
    if (mode === "same_direction") {
      return Math.max(
        0,
        this.#number(tension.sameDirectionMultiplier, 0),
      );
    }
    if (mode === "opposite_direction") {
      return Math.max(
        0,
        this.#number(tension.oppositeDirectionMultiplier, 2.5),
      );
    }
    return Math.max(0, this.#number(tension.sideMultiplier, 1));
  }

  #resolveTensionModeFrame({
    fishVelocity,
    fishVelocityX,
    controlDirectionX,
    config,
  }) {
    if (
      fishVelocity &&
      Number.isFinite(Number(fishVelocity.x)) &&
      Number.isFinite(Number(fishVelocity.y))
    ) {
      return this.#tensionModeResolver.resolve({
        fishVelocity,
        controlAxis: {
          x: controlDirectionX,
          y: 0,
        },
        config: config.tension?.mode,
      });
    }
    return this.#legacyResolveModeFromFishVelocityX({
      fishVelocityX,
      directionX: controlDirectionX,
    });
  }

  #legacyResolveModeFromFishVelocityX({
    fishVelocityX,
    directionX,
  }) {
    const fishDirection = Math.sign(this.#number(fishVelocityX));
    const controlDirection = Math.sign(this.#number(directionX));
    const mode = fishDirection === 0 || controlDirection === 0
      ? "side"
      : fishDirection === controlDirection
        ? "same_direction"
        : "opposite_direction";
    const speed = Math.abs(this.#number(fishVelocityX));
    return Object.freeze({
      mode,
      alignment:
        mode === "same_direction"
          ? 1
          : mode === "opposite_direction"
            ? -1
            : 0,
      projectionSpeedPxPerSec:
        this.#number(fishVelocityX) * controlDirection,
      fishSpeedPxPerSec: speed,
      controlAxisX: controlDirection,
      controlAxisY: 0,
    });
  }

  #intentBlockedReason({
    active,
    hasFish,
    inputDirectionX,
    inputRatio,
    targetFrame,
  }) {
    if (!active) return "no_input";
    if (!hasFish) return "no_fish";
    if (inputDirectionX === 0 || inputRatio <= 0) return "dead_zone";
    if (targetFrame.aligned && !targetFrame.centerStartActive) return "aligned";
    if (targetFrame.directionFactor <= 0) return "wrong_direction";
    if (targetFrame.angleRatio <= 0) return "angle_too_small";
    return "none";
  }

  #forceBlockedReason({
    loadReserveKg,
    effectiveForceLimitKg,
    dragLimited,
    forceKg,
  }) {
    if (loadReserveKg <= 0) return "no_load_reserve";
    if (dragLimited && effectiveForceLimitKg <= 0) return "drag_limit_reached";
    if (forceKg <= 0) return "no_force";
    return "none";
  }

  #hasPoint(point) {
    return (
      point &&
      Number.isFinite(Number(point.x)) &&
      Number.isFinite(Number(point.y))
    );
  }

  #createResult(overrides = {}) {
    return {
      active: false,
      canApply: false,
      directionX: 0,
      inputDirectionX: 0,
      inputRatio: 0,
      requestedForceRatio: 0,
      loadReserveKg: 0,
      loadReserveRatio: 0,
      tensionCeilingMultiplier: 1,
      tensionCeilingKg: 0,
      playerForceBudgetEnabled: false,
      playerForceControlBudgetKg: 0,
      playerForceControlShare: 0,
      forceLimitKg: 0,
      effectiveForceLimitKg: 0,
      currentTensionKg: 0,
      dragLimited: false,
      dragReserveKg: 0,
      canSlipDrag: false,
      lineLengthLocked: false,
      radialConstraintActive: false,
      movementMode: "none",
      deliveredForceRatio: 0,
      forceKg: 0,
      playerTensionKg: 0,
      tensionMultiplier: 0,
      tensionMode: "side",
      fishControlAxisAlignment: 0,
      fishControlAxisVelocityPxPerSecond: 0,
      fishAutonomousSpeedPxPerSecond: 0,
      controlAxisX: 0,
      controlAxisY: 0,
      desiredMoveMeters: 0,
      desiredMovePx: 0,
      appliedMoveMeters: 0,
      appliedMovePx: 0,
      actualMovementRatio: 0,
      maxPullSpeedMetersPerSecond: 0,
      visualControlRatio: 0,
      targetRodX: null,
      targetRodY: null,
      targetMode: "input_direction",
      fishOffsetX: 0,
      lineAngleDeg: 0,
      angleRatio: 0,
      directionFactor: 0,
      aligned: false,
      centered: false,
      centerStartActive: false,
      controlStartedCentered: false,
      maxBeforeAlignmentMeters: 0,
      blockedReason: "no_input",
      ...overrides,
    };
  }

  #number(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, this.#number(value)));
  }
}
