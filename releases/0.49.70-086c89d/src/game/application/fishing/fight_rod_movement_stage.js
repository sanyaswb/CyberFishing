import { RodControlMovementProjector } from "../../domain/fishing/rod_control_movement_projector.js";
import { RodStrokeDistanceTracker } from "../../domain/fishing/rod_stroke_distance_tracker.js";
import { hasLineReserve, isLineTaut } from "../../domain/fishing/line_state_queries.js";

// Fight pipeline stages resolve_rod_pull_and_retrieve, resolve_rod_control_x and update_rod_stroke_distance: the
// player's rod pull and lateral rod control for one step, smoothed by the shared pull motion smoother and applied
// as movement within water, bounds and the pole fight sector.
export class FightRodMovementStage {
  #rodStrokeDistanceTracker = new RodStrokeDistanceTracker();
  #rodControlMovementProjector = new RodControlMovementProjector();
  #waterProbePoint = { x: 0, y: 0 };
  #config;
  #physicsConfig;
  #playerPullMotionSmoother;
  #recoverableLineCalculator;
  #lineConstraint;
  #poleSector;

  constructor({ config, physicsConfig, playerPullMotionSmoother, recoverableLineCalculator, lineConstraint, poleSector }) {
    this.#config = config;
    this.#physicsConfig = physicsConfig;
    this.#playerPullMotionSmoother = playerPullMotionSmoother;
    this.#recoverableLineCalculator = recoverableLineCalculator;
    this.#lineConstraint = lineConstraint;
    this.#poleSector = poleSector;
  }

  updateRodPull({
    dtSec,
    pullInput,
    floatEntity,
    rodTipPosition,
    rod,
    lineSystem,
    rodPullSystem,
    fishRetrieveSystem,
    forceData,
    lineStateBeforeFishMotion,
    fishCondition,
    dragContext,
    physics,
    bounds,
    checkWater,
    holdReelRecover,
    isRecoverMode,
    reel,
    rodLimitKg,
    playerForceBudget,
    playerPressureGain,
    playerTensionBuildRate,
    playerPressureFatigue,
  }) {
    const lineStateBeforePull = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    const prePullStrokeDistanceFrame = this.#calculateRodStrokeDistanceFrame({
      previousDistanceMeters:
        lineStateBeforeFishMotion?.distanceMeters ??
        lineStateBeforePull.distanceMeters,
      currentDistanceMeters: lineStateBeforePull.distanceMeters,
      reasonPrefix: "pre_player",
    });
    const initialRecoverableLineMeters = this.#recoverableLineCalculator.calculateRecoverableLineMeters({
      releasedMeters: lineStateBeforePull.releasedMeters,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });
    const rodPullResult = rodPullSystem.update({
      dtSec,
      inputState: pullInput,
      rod,
      distanceLostBeforePullMeters:
        prePullStrokeDistanceFrame.lostMeters,
      fishForceKg: forceData.totalFishForceKg,
      fishTensionKg: forceData.fishTensionKg,
      rodLimitKg,
      playerForceBudget,
      playerPressureGain,
      playerTensionBuildRate,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      maxTackleLoadKg: dragContext.maxTackleLoadKg,
      dragLocked: dragContext.dragLocked,
      hardLineLimit: lineStateBeforePull.isFullyExtended,
      lineHasReserve: hasLineReserve(lineStateBeforePull),
      lineLengthMeters: lineStateBeforePull.totalLengthMeters,
      hasReel: lineStateBeforePull.hasReel,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
      playerPressureFatigue,
    });
    const remainingStrokeMeters = Math.max(
      0,
      (Number(rodPullResult.maxDistanceMeters) || 0) -
        (Number(rodPullResult.rodStrokeWonMeters) || 0),
    );
    const rodStrokeMovementBlocked = this.#isRodStrokeMovementBlocked(
      rodPullResult,
      remainingStrokeMeters,
    );
    const holdReelRecoverActive = !!holdReelRecover?.active;
    const fishRetrieveFrame = fishRetrieveSystem.calculate({
      dtSec,
      rodPullResult,
      forceData,
      fishCondition,
      lineDistanceMeters: lineStateBeforePull.distanceMeters,
      landingDistanceMeters: forceData.landingDistanceMeters,
      movementBlocked:
        (rodStrokeMovementBlocked && !holdReelRecoverActive),
      dragRatio: dragContext.clampedDrag,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      dragLocked: dragContext.dragLocked,
      dragSupported: dragContext.dragSupported,
      lineHasReserve: hasLineReserve(lineStateBeforePull),
      lineTaut: isLineTaut(lineStateBeforePull),
    });
    const rodStrokeMoveCapacityMeters =
      rodPullResult.active && !rodStrokeMovementBlocked
        ? this.#calculateAllowedPullMoveMeters({
            requestedMoveMeters: fishRetrieveFrame.desiredMoveMeters,
            remainingStrokeMeters,
            fishPosition: floatEntity.getPosition(),
            rodTipPosition,
          })
        : 0;
    const holdReelRecoverMoveMeters = this.#calculateHoldReelRecoverMoveMeters({
      dtSec,
      fishRetrieveResult: fishRetrieveFrame,
      holdReelRecover,
      holdReelRecoverActive,
    });
    const requestedRodMoveMeters = Math.min(
      fishRetrieveFrame.desiredMoveMeters,
      rodStrokeMoveCapacityMeters,
    );
    const desiredRodMoveMeters = requestedRodMoveMeters;
    const smoothedRodMoveMeters = this.#smoothPlayerPullAxis({
      axis: "y",
      desiredMoveMeters: desiredRodMoveMeters,
      dtSec,
    });
    const rodPullMovement = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: smoothedRodMoveMeters,
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() ||
        50,
      bounds,
      checkWater,
      limitRadiusPx: this.#poleSector.resolvePoleFightSectorLimitRadiusPx({
        lineState: lineStateBeforePull,
      }),
    });
    const rodPullMoveMeters = rodPullMovement.meters;
    this.#playerPullMotionSmoother.reconcileAxis({
      axis: "y",
      appliedMove: rodPullMoveMeters,
      deltaTime: dtSec,
      blocked:
        rodPullMovement.hardBlocked ||
        rodPullMovement.directionalBlocked ||
        rodPullMoveMeters + 0.000001 < smoothedRodMoveMeters,
    });
    const reelHoldDesiredMoveMeters = Math.min(
      Math.max(0, fishRetrieveFrame.desiredMoveMeters - rodPullMoveMeters),
      holdReelRecoverMoveMeters,
    );
    const reelHoldMovement = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: reelHoldDesiredMoveMeters,
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() ||
        50,
      bounds,
      checkWater,
      limitRadiusPx: this.#poleSector.resolvePoleFightSectorLimitRadiusPx({
        lineState: lineStateBeforePull,
      }),
    });
    const reelHoldMoveMeters = reelHoldMovement.meters;
    const totalAppliedMoveMeters = rodPullMoveMeters + reelHoldMoveMeters;
    const movementBlocked =
      fishRetrieveFrame.desiredMoveMeters > totalAppliedMoveMeters + 0.001 ||
      (
        rodStrokeMovementBlocked &&
        !holdReelRecoverActive
      );
    const hardTensionBlocked =
      !!lineStateBeforePull.isFullyExtended ||
      rodPullMovement.hardBlocked ||
      reelHoldMovement.hardBlocked;
    const fishRetrieveResult = fishRetrieveFrame
      .withAppliedMovement({
        appliedMoveMeters: totalAppliedMoveMeters,
        movementBlocked,
        hardTensionBlocked,
      });
    const lineStateAfterPull = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );

    return {
      lineStateBeforePull,
      lineStateAfterPull,
      initialRecoverableLineMeters,
      rodPullResult,
      fishRetrieveResult,
      prePullStrokeDistanceFrame,
      rodPullMoveMeters,
      reelHoldMoveMeters,
      rodPullMovementBlockReason: rodPullMovement.blockedReason,
      reelHoldMovementBlockReason: reelHoldMovement.blockedReason,
      hardTensionBlocked,
      holdReelRecoverMoveMeters: holdReelRecoverActive
        ? reelHoldMoveMeters
        : 0,
      previousReelHoldEngaged: !!holdReelRecover?.engaged,
      previousReelHoldActive: holdReelRecoverActive,
      hardLineLimitBeforeRelease: !!lineStateAfterPull.isFullyExtended,
    };
  }

  recordRodStrokeDistance({
    rodPullSystem,
    previousLineState,
    currentLineState,
  } = {}) {
    const frame = this.#calculateRodStrokeDistanceFrame({
      previousDistanceMeters: previousLineState?.distanceMeters,
      currentDistanceMeters: currentLineState?.distanceMeters,
      reasonPrefix: "player_frame",
    });
    rodPullSystem.recordDistanceMovement({
      gainedMeters: frame.gainedMeters,
      lostMeters: frame.lostMeters,
      previousDistanceMeters: frame.previousDistanceMeters,
      currentDistanceMeters: frame.currentDistanceMeters,
      deltaMeters: frame.deltaMeters,
      reason: frame.reason,
    });
    return frame;
  }

  #calculateRodStrokeDistanceFrame({
    previousDistanceMeters,
    currentDistanceMeters,
    reasonPrefix = "line_distance",
  } = {}) {
    if (!this.#rodStrokeDistanceTracker?.calculate) {
      return {
        previousDistanceMeters: Math.max(0, Number(previousDistanceMeters) || 0),
        currentDistanceMeters: Math.max(0, Number(currentDistanceMeters) || 0),
        deltaMeters: 0,
        gainedMeters: 0,
        lostMeters: 0,
        reason: "distance_tracker_missing",
      };
    }
    return this.#rodStrokeDistanceTracker.calculate({
      previousDistanceMeters,
      currentDistanceMeters,
      reasonPrefix,
    });
  }

  #calculateHoldReelRecoverMoveMeters({
    dtSec,
    fishRetrieveResult,
    holdReelRecover,
    holdReelRecoverActive,
  }) {
    if (!holdReelRecoverActive) return 0;
    const targetFishSpeed = Math.max(
      0,
      Number(fishRetrieveResult?.targetFishPullSpeedMetersPerSecond) || 0,
    );
    const recoverSpeed = Math.max(
      0,
      Number(holdReelRecover?.recoverSpeedMetersPerSecond) || 0,
    );
    const speed = targetFishSpeed > 0.001
      ? Math.min(targetFishSpeed, recoverSpeed)
      : recoverSpeed;
    return Math.max(0, speed * Math.max(0, Number(dtSec) || 0));
  }

  #isRodStrokeMovementBlocked(rodPullResult, remainingStrokeMeters = null) {
    if (!rodPullResult?.active) return false;
    const reason = rodPullResult.blockedReason;
    if (
      reason === "stroke_capacity_unavailable" ||
      reason === "pump_credit_too_high"
    ) {
      return true;
    }
    if (reason === "max_distance_reached") {
      if (remainingStrokeMeters !== null) {
        return Math.max(0, Number(remainingStrokeMeters) || 0) <= 0.001;
      }
      return true;
    }
    if (remainingStrokeMeters === null) return false;
    return Math.max(0, Number(remainingStrokeMeters) || 0) <= 0.001;
  }

  updateRodControl({
    dtSec,
    input,
    floatEntity,
    rodTipPosition,
    rodControlTargetAnchor,
    actualRodTipPosition,
    lineSystem,
    rodControlSystem,
    forceData,
    dragContext,
    stressSystem,
    bounds,
    checkWater,
    maxTackleLoadKg,
    rodLimitKg,
    lineState,
    fishRetrieveResult,
    playerForceBudget,
    rodControlIntent,
    playerPressureGain,
    playerTensionBuildRate,
    playerPressureFatigue,
  }) {
    if (!rodControlSystem?.update) {
      return {
        rodControlResult: this.#emptyRodControlResult("missing_system"),
        rodControlMoveMeters: 0,
        rodControlMovePx: 0,
        rodControlMovementBlockReason: "missing_system",
        lineStateAfterControl: lineSystem.updateDistance(
          floatEntity.getPosition(),
          rodTipPosition,
        ),
      };
    }

    const config = this.#physicsConfig.getRodControlConfig() || {};
    const fishPosition = floatEntity.getPosition();
    const currentLineState = lineState || lineSystem.updateDistance(
      fishPosition,
      rodTipPosition,
    );
    const lineConstraintState = this.#lineConstraint.resolveLineConstraintState({
      lineState: currentLineState,
      dragContext,
      fishRetrieveResult,
      payoutResult: currentLineState?.lastReleaseResult,
      config,
    });
    const lineHasReserve = lineConstraintState.lineHasReserve;
    const hardLineLimit = lineConstraintState.hardLineLimit;
    const currentFrameTensionKg = Number(
      fishRetrieveResult?.totalTensionKg,
    );
    const currentTensionKg = Math.max(
      0,
      Number.isFinite(currentFrameTensionKg)
        ? currentFrameTensionKg
        : Number(stressSystem.getTensionKg()) ||
          Number(forceData?.fishTensionKg) ||
          0,
    );
    const rodControlResult = rodControlSystem.update({
      dtSec,
      inputState: input,
      fishPosition,
      rodTipPosition,
      baseRodTipPosition: rodControlTargetAnchor || rodTipPosition,
      actualRodTipPosition,
      rodLimitKg,
      maxTackleLoadKg,
      currentTensionKg,
      fishTensionKg: forceData?.fishTensionKg,
      fishVelocity: forceData?.targetVelocity,
      playerForceBudget,
      dragLimitKg: dragContext?.effectiveDragLimitKg,
      dragLocked: dragContext?.dragLocked !== false,
      lineHasReserve,
      hardLineLimit,
      lineConstraintState,
      intentFrame: rodControlIntent,
      playerPressureGain,
      playerTensionBuildRate,
      playerPressureFatigue,
      config,
    });
    const desiredSignedMoveMeters =
      (Number(rodControlResult.directionX) || 0) *
      Math.max(0, Number(rodControlResult.desiredMoveMeters) || 0);
    let rawSmoothedSignedMoveMeters = 0;
    if (rodControlResult.canApply) {
      rawSmoothedSignedMoveMeters = this.#smoothPlayerPullAxis({
        axis: "x",
        desiredMoveMeters: desiredSignedMoveMeters,
        dtSec,
      });
    } else {
      this.#playerPullMotionSmoother.resetAxis("x");
    }
    const smoothedSignedMoveMeters = this.#limitRodControlMoveTowardTarget({
      signedMoveMeters: rawSmoothedSignedMoveMeters,
      fishPosition,
      rodControlResult,
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() ||
        50,
    });
    if (
      Math.abs(rawSmoothedSignedMoveMeters) > 0.000001 &&
      Math.abs(smoothedSignedMoveMeters) <= 0.000001
    ) {
      this.#playerPullMotionSmoother.resetAxis("x");
    }
    const allowedMoveMeters = Math.abs(smoothedSignedMoveMeters);
    const movement = this.#applyRodControlMovement({
      floatEntity,
      rodTipPosition,
      directionX: Math.sign(smoothedSignedMoveMeters),
      deltaMeters: Math.abs(smoothedSignedMoveMeters),
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() ||
        50,
      bounds,
      checkWater,
      lineConstraintState,
      limitRadiusPx: this.#poleSector.resolvePoleFightSectorLimitRadiusPx({
        lineConstraintState,
      }),
      projectLockedMovementToArc:
        config.lineConstraint?.projectLockedMovementToArc !== false,
    });
    const requestedAppliedMeters = Math.abs(smoothedSignedMoveMeters);
    const controlMovementBlocked =
      movement.hardBlocked ||
      movement.directionalBlocked ||
      movement.meters + 0.000001 < requestedAppliedMeters;
    this.#playerPullMotionSmoother.reconcileAxis({
      axis: "x",
      appliedMove: movement.signedMeters,
      deltaTime: dtSec,
      blocked: controlMovementBlocked,
    });
    rodControlSystem.recordAppliedMovement({
      movedMeters: movement.meters,
      movedPx: movement.px,
    });
    const updatedResult = rodControlSystem.getState() || rodControlResult;
    Object.assign(updatedResult, {
      phase: updatedResult.canApply
        ? "applying_force"
        : updatedResult.active
          ? "blocked"
          : "inactive",
      allowedMoveMeters,
      movementMode: movement.mode,
      lineLengthLocked: lineConstraintState.lineLengthLocked,
      radialConstraintActive: lineConstraintState.radialConstraintActive,
    });
    const lineStateAfterControl = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    return {
      rodControlResult: updatedResult,
      rodControlMoveMeters: movement.meters,
      rodControlMovePx: movement.px,
      rodControlMovementBlockReason: movement.blockedReason,
      lineConstraintState,
      lineStateAfterControl,
    };
  }

  #emptyRodControlResult(blockedReason = "no_input") {
    return {
      active: false,
      canApply: false,
      directionX: 0,
      inputDirectionX: 0,
      inputRatio: 0,
      requestedForceRatio: 0,
      rawForceKg: 0,
      forceKg: 0,
      loadReserveKg: 0,
      loadReserveRatio: 0,
      tensionCeilingMultiplier: 1,
      tensionCeilingKg: 0,
      forceLimitKg: 0,
      effectiveForceLimitKg: 0,
      currentTensionKg: 0,
      dragLimited: false,
      dragReserveKg: 0,
      canSlipDrag: false,
      deliveredForceRatio: 0,
      playerPressureEfficiency: 1,
      playerPressureFatigueEnabled: false,
      playerTensionKg: 0,
      tensionMultiplier: 0,
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
      maxEffectiveAngleDeg: 0,
      angleRatio: 0,
      directionFactor: 0,
      aligned: false,
      blockedReason,
      phase: "inactive",
      allowedMoveMeters: 0,
    };
  }

  #calculateAllowedPullMoveMeters({
    requestedMoveMeters,
    remainingStrokeMeters,
    fishPosition,
    rodTipPosition,
  }) {
    const requested = Math.max(0, Number(requestedMoveMeters) || 0);
    const remainingStroke = Math.max(0, Number(remainingStrokeMeters) || 0);
    if (requested <= 0 || remainingStroke <= 0) return 0;

    const dx = (Number(rodTipPosition?.x) || 0) - (Number(fishPosition?.x) || 0);
    const dy = (Number(rodTipPosition?.y) || 0) - (Number(fishPosition?.y) || 0);
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) return 0;

    const yRatio = Math.abs(dy) / distance;
    if (yRatio <= 0.000001) return requested;
    return Math.min(requested, remainingStroke / yRatio);
  }

  #smoothPlayerPullAxis({ axis, desiredMoveMeters, dtSec }) {
    const config =
      this.#physicsConfig.getPlayerPullMotionConfig() ||
      this.#getRuntimePhysicsConfig()?.fight?.playerPullMotion ||
      {};
    return this.#playerPullMotionSmoother.updateAxis({
      axis,
      desiredMove: Number(desiredMoveMeters) || 0,
      deltaTime: dtSec,
      config,
    }).move;
  }

  #limitRodControlMoveTowardTarget({
    signedMoveMeters,
    fishPosition,
    rodControlResult,
    pixelsPerMeter,
  }) {
    const move = Number(signedMoveMeters) || 0;
    if (move === 0) return 0;
    if (rodControlResult?.active !== true) return move;
    const rawTargetX = rodControlResult?.targetRodX;
    if (rawTargetX === null || rawTargetX === undefined) return move;
    const targetX = Number(rawTargetX);
    if (!Number.isFinite(targetX)) return move;
    const fishX = Number(fishPosition?.x);
    if (!Number.isFinite(fishX)) return move;

    const direction = Math.sign(move);
    const distancePx = Math.abs(targetX - fishX);
    const thresholdPx = 0.001;
    if (distancePx <= thresholdPx) return 0;

    const towardTarget = Math.sign(targetX - fishX);
    if (towardTarget !== 0 && direction !== towardTarget) return 0;

    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const maxMoveMeters = distancePx / scale;
    return direction * Math.min(Math.abs(move), maxMoveMeters);
  }

  #applyRodPullMovement({
    floatEntity,
    rodTipPosition,
    deltaMeters,
    pixelsPerMeter,
    bounds,
    checkWater,
    limitRadiusPx = 0,
  }) {
    const meters = Math.max(0, Number(deltaMeters) || 0);
    if (meters <= 0) return this.#movementResult();

    const position = floatEntity.getPosition();
    const dx = rodTipPosition.x - position.x;
    const dy = rodTipPosition.y - position.y;
    const distancePx = Math.hypot(dx, dy);
    if (distancePx <= 0.001) {
      return this.#movementResult({ blockedReason: "target_reached" });
    }

    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const movePx = Math.min(distancePx, meters * scale);
    const rawNext = {
      x: position.x + (dx / distancePx) * movePx,
      y: position.y + (dy / distancePx) * movePx,
    };
    const next = this.#clampToBounds(
      rawNext,
      bounds,
    );
    let hardBlocked =
      Math.abs(next.x - rawNext.x) > 0.001 ||
      Math.abs(next.y - rawNext.y) > 0.001;
    let blockedReason = hardBlocked ? "bounds_blocked" : "none";

    if (typeof checkWater === "function" && !checkWater(next.x, next.y)) {
      const waterEdgePoint = this.#findLastWaterPoint({
        from: position,
        to: next,
        checkWater,
      });
      hardBlocked = true;
      blockedReason = "water_blocked";
      if (!waterEdgePoint) {
        return this.#movementResult({ blockedReason, hardBlocked });
      }
      next.x = waterEdgePoint.x;
      next.y = waterEdgePoint.y;
    }

    const sectorFrame = this.#poleSector.applyPoleFightSectorMovement({
      fromPosition: position,
      proposedPosition: next,
      origin: rodTipPosition,
      limitRadiusPx,
    });
    const directionalBlocked = sectorFrame.clamped === true;
    if (directionalBlocked && blockedReason === "none") {
      blockedReason = "pole_fight_sector";
    }

    const appliedPx = Math.hypot(next.x - position.x, next.y - position.y);
    position.x = next.x;
    position.y = next.y;
    return this.#movementResult({
      meters: appliedPx / scale,
      blockedReason,
      hardBlocked,
      directionalBlocked,
    });
  }

  #applyRodControlMovement({
    floatEntity,
    rodTipPosition,
    directionX,
    deltaMeters,
    pixelsPerMeter,
    bounds,
    checkWater,
    lineConstraintState,
    limitRadiusPx = 0,
    projectLockedMovementToArc,
  }) {
    const direction = Math.sign(Number(directionX) || 0);
    const meters = Math.max(0, Number(deltaMeters) || 0);
    if (direction === 0 || meters <= 0) {
      return this.#movementResult();
    }

    const position = floatEntity.getPosition();
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const requestedMovePx = meters * scale;
    const rawNext = this.#rodControlMovementProjector.resolveNextPoint({
      position,
      rodTipPosition,
      directionX: direction,
      deltaMeters: meters,
      pixelsPerMeter: scale,
      lineConstraintState,
      projectLockedMovementToArc,
    });
    const movementStart = {
      x: Number(rawNext.normalizedStartX) || position.x,
      y: Number(rawNext.normalizedStartY) || position.y,
    };
    const next = this.#clampToBounds(rawNext, bounds);
    let hardBlocked =
      Math.abs(next.x - rawNext.x) > 0.001 ||
      Math.abs(next.y - rawNext.y) > 0.001;
    let blockedReason = hardBlocked ? "bounds_blocked" : "none";
    let postProjectionClamped = hardBlocked;

    if (typeof checkWater === "function" && !checkWater(next.x, next.y)) {
      const waterEdgePoint = this.#findLastWaterPoint({
        from: movementStart,
        to: next,
        checkWater,
      });
      hardBlocked = true;
      postProjectionClamped = true;
      blockedReason = "water_blocked";
      if (!waterEdgePoint) {
        position.x = movementStart.x;
        position.y = movementStart.y;
        return this.#movementResult({
          blockedReason,
          hardBlocked,
          constraintCorrectionPx: rawNext.constraintCorrectionPx,
        });
      }
      next.x = waterEdgePoint.x;
      next.y = waterEdgePoint.y;
    }

    const sectorFrame = this.#poleSector.applyPoleFightSectorMovement({
      fromPosition: movementStart,
      proposedPosition: next,
      origin: rodTipPosition,
      limitRadiusPx,
    });
    const directionalBlocked = sectorFrame.clamped === true;
    if (directionalBlocked) {
      postProjectionClamped = true;
      if (blockedReason === "none") blockedReason = "pole_fight_sector";
    }

    const endpointMovePx = Math.hypot(
      next.x - movementStart.x,
      next.y - movementStart.y,
    );
    const projectedPathPx = Math.min(
      requestedMovePx,
      Math.max(0, Number(rawNext.appliedPathPx) || 0),
    );
    const appliedControlPx = postProjectionClamped
      ? Math.min(projectedPathPx, endpointMovePx)
      : projectedPathPx;
    const movementInvariantViolated =
      appliedControlPx > requestedMovePx + 0.001;

    position.x = next.x;
    position.y = next.y;
    return this.#movementResult({
      meters: movementInvariantViolated ? meters : appliedControlPx / scale,
      px: movementInvariantViolated ? requestedMovePx : appliedControlPx,
      signedMeters: direction * (
        movementInvariantViolated ? meters : appliedControlPx / scale
      ),
      requestedPx: requestedMovePx,
      blockedReason: movementInvariantViolated
        ? "movement_invariant_violation"
        : blockedReason,
      hardBlocked: hardBlocked || movementInvariantViolated,
      directionalBlocked,
      constraintCorrectionPx: rawNext.constraintCorrectionPx,
      mode: rawNext.mode,
    });
  }

  #movementResult({
    meters = 0,
    px = 0,
    signedMeters = 0,
    requestedPx = 0,
    constraintCorrectionPx = 0,
    blockedReason = "none",
    hardBlocked = false,
    directionalBlocked = false,
    mode = "none",
  } = {}) {
    return {
      meters: Math.max(0, Number(meters) || 0),
      px: Math.max(0, Number(px) || 0),
      signedMeters: Number(signedMeters) || 0,
      requestedPx: Math.max(0, Number(requestedPx) || 0),
      constraintCorrectionPx: Math.max(
        0,
        Number(constraintCorrectionPx) || 0,
      ),
      blockedReason,
      hardBlocked: !!hardBlocked,
      directionalBlocked: !!directionalBlocked,
      mode,
    };
  }

  #findLastWaterPoint({ from, to, checkWater }) {
    if (!checkWater(from.x, from.y)) return null;

    let low = 0;
    let high = 1;
    let found = false;
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    for (let i = 0; i < 8; i++) {
      const t = (low + high) * 0.5;
      const x = from.x + dx * t;
      const y = from.y + dy * t;

      if (checkWater(x, y)) {
        low = t;
        found = true;
      } else {
        high = t;
      }
    }

    if (!found || low <= 0.0001) return null;

    this.#waterProbePoint.x = from.x + dx * low;
    this.#waterProbePoint.y = from.y + dy * low;
    return this.#waterProbePoint;
  }

  #clampToBounds(point, bounds) {
    if (!bounds) return point;
    const minX = Number.isFinite(Number(bounds.left)) ? Number(bounds.left) : -Infinity;
    const maxX = Number.isFinite(Number(bounds.right)) ? Number(bounds.right) : Infinity;
    const minY = Number.isFinite(Number(bounds.top)) ? Number(bounds.top) : -Infinity;
    const maxY = Number.isFinite(Number(bounds.bottom)) ? Number(bounds.bottom) : Infinity;
    return {
      x: Math.max(minX, Math.min(maxX, point.x)),
      y: Math.max(minY, Math.min(maxY, point.y)),
    };
  }

  #getRuntimePhysicsConfig() {
    return this.#config.physics || {};
  }
}
