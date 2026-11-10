import { FISH_FIGHT_EVENT } from "../../domain/fish/fish_fight_event.js";
import { LandingPolicyResolver } from "../../domain/fishing/landing_policy_resolver.js";
import { LineConstrainedFishMotionResolver } from "../../domain/fishing/line_constrained_fish_motion_resolver.js";
import { LineRadialMovementSplitter } from "../../domain/fishing/line_radial_movement_splitter.js";
import { RodStrokeTracker } from "../../domain/fishing/rod_stroke_tracker.js";
import { Vector2 } from "../../../engine/math/vector2.js";
import { hasLineReserve, isLineTaut } from "../../domain/fishing/line_state_queries.js";

// Fight pipeline stage update_fish_motion: the fish's line-constrained motion for one step, with the catch zone
// and shore landing, reel-recovery slowdown and the pole fight sector angle limit. Owns the motion scratch
// objects (reused every step) and the catch-zone flag of one fight session.
export class FightFishMotionStage {
  #velocityScratch = new Vector2(0, 0);
  #radialTargetVelocity = new Vector2(0, 0);
  #rodStrokeTracker = new RodStrokeTracker();
  #landingPolicyResolver = new LandingPolicyResolver();
  #lineConstrainedFishMotionResolver =
    new LineConstrainedFishMotionResolver();
  #lineConstrainedFishMotionPreviewResolver =
    new LineConstrainedFishMotionResolver();
  #lineRadialMovementSplitter = new LineRadialMovementSplitter();
  #modelFishVelocityScratch = { x: 0, y: 0 };
  #previewLineConstraintStateScratch = {};
  #fishWasInCatchZone = false;
  #config;
  #physicsConfig;
  #recoveryFishSlowdownPolicy;
  #lineConstraint;
  #poleSector;

  constructor({ config, physicsConfig, recoveryFishSlowdownPolicy, lineConstraint, poleSector }) {
    this.#config = config;
    this.#physicsConfig = physicsConfig;
    this.#recoveryFishSlowdownPolicy = recoveryFishSlowdownPolicy;
    this.#lineConstraint = lineConstraint;
    this.#poleSector = poleSector;
  }

  updateFishMotion({
    dtMs,
    dtSec,
    floatEntity,
    bounds,
    input,
    env,
    checkWater,
    rodTipPosition,
    rod,
    reel,
    fishForceSystem,
    lineSystem,
    dragSystem,
    rodPullSystem,
    fishCondition,
    playerMaxLoadKg,
    lineRecoveryFishSlowdown,
  }) {
    const fishPosition = floatEntity.getPosition();
    const previousFishX = Number(fishPosition.x) || 0;
    const previousFishY = Number(fishPosition.y) || 0;
    const fishVelocity = floatEntity.getVelocity() || this.#velocityScratch.set(0, 0);
    const lineState = lineSystem.updateDistance(fishPosition, rodTipPosition);
    const previousRodPullState = rodPullSystem.getState() || {};
    const activeRodHoldKg = input?.isPulling
      ? Number(
          previousRodPullState.effectiveForceKg ??
            previousRodPullState.forceKg,
        ) || 0
      : 0;
    const landingPolicy = this.#landingPolicyResolver.resolve({ rod, reel });
    const landingDistanceMeters = landingPolicy.getLandingDistanceMeters({
      rod,
      reel,
      config: this.#config,
      lineDistanceMeters: lineState.distanceMeters,
    });
    const shoreLandingDistanceMeters = this.#calculateShoreLandingDistanceMeters({
      fishPosition,
      bounds,
    });
    const inCatchZone =
      landingDistanceMeters > 0 &&
      shoreLandingDistanceMeters <= landingDistanceMeters + 0.001;
    if (inCatchZone && !this.#fishWasInCatchZone) {
      fishForceSystem.handleFightEvent({
        type: FISH_FIGHT_EVENT.CATCH_ZONE_ENTERED,
        lineDistanceMeters: lineState.distanceMeters,
        shoreLandingDistanceMeters,
        landingDistanceMeters,
      });
    }
    this.#fishWasInCatchZone = inCatchZone;
    fishForceSystem.evaluateLastDashTrigger({
      dtMs,
      lineDistanceMeters: lineState.distanceMeters,
      shoreLandingDistanceMeters,
      horizontalDistanceMeters: shoreLandingDistanceMeters,
      landingDistanceMeters,
    });

    const forceData = fishForceSystem.calculate({
      dtMs,
      fishPosition,
      fishVelocity,
      rodTipPosition,
      fishCondition,
      dragRatio: dragSystem.value,
      input,
      rod,
      reel,
      playerMaxLoadKg,
      activeRodHoldKg,
      lineHasReserve: hasLineReserve(lineState),
      lineTaut: isLineTaut(lineState),
      env,
      fishSpeedMultiplier:
        this.#recoveryFishSlowdownPolicy.getMotionMultiplier(
          lineRecoveryFishSlowdown,
        ) ?? 1,
    });
    forceData.landingDistanceMeters = landingDistanceMeters;
    forceData.shoreLandingDistanceMeters = shoreLandingDistanceMeters;
    forceData.lineRecoveryFishSlowdownActive =
      !!lineRecoveryFishSlowdown?.active;
    forceData.lineRecoveryFishSlowdownMultiplier =
      this.#recoveryFishSlowdownPolicy.getMotionMultiplier(
        lineRecoveryFishSlowdown,
      ) ?? 1;
    forceData.lineRecoveryFishSlowdownSource =
      lineRecoveryFishSlowdown?.source || "none";
    const fishMotionDragContext = this.#resolveFishMotionDragContext({
      reel,
      dragSystem,
    });
    const fishMotionLineConstraintState = this.#lineConstraint.resolveLineConstraintState({
      lineState,
      dragContext: fishMotionDragContext,
      fishRetrieveResult: forceData,
    });
    const modelFishVelocity = this.#modelFishVelocityScratch;
    modelFishVelocity.x = forceData.modelFishEscapeVelocityX;
    modelFishVelocity.y = forceData.modelFishEscapeVelocityY;
    const previewLineConstraintState =
      this.#previewLineConstraintStateScratch;
    Object.assign(previewLineConstraintState, fishMotionLineConstraintState);
    previewLineConstraintState.radialConstraintActive =
      !!fishMotionLineConstraintState.lineLengthLocked;
    const activeProjectionFrame =
      this.#lineConstrainedFishMotionResolver.resolve({
        position: fishPosition,
        rodTipPosition,
        rawVelocity: modelFishVelocity,
        lineConstraintState: fishMotionLineConstraintState,
        dtSec,
      });
    const constrainedProjectionFrame =
      fishMotionLineConstraintState.radialConstraintActive
        ? activeProjectionFrame
        : this.#lineConstrainedFishMotionPreviewResolver.resolve({
            position: fishPosition,
            rodTipPosition,
            rawVelocity: modelFishVelocity,
            lineConstraintState: previewLineConstraintState,
            dtSec,
          });
    const radialMovementFrame =
      this.#lineRadialMovementSplitter.resolveVelocity({
        position: fishPosition,
        rodTipPosition,
        freeVelocity: modelFishVelocity,
        constrainedVelocity: constrainedProjectionFrame,
        releasedMeters: lineState.releasedMeters,
        pixelsPerMeter:
          this.#physicsConfig.getPixelsPerMeter() ||
          50,
        dtSec,
      });
    const projectionFrame =
      radialMovementFrame.crossedReleasedRadius ||
      fishMotionLineConstraintState.radialConstraintActive
        ? constrainedProjectionFrame
        : activeProjectionFrame;
    const frameTargetVelocity = this.#radialTargetVelocity.set(
      radialMovementFrame.velocityX,
      radialMovementFrame.velocityY,
    );

    let movementFrame = null;
    if (typeof floatEntity.applyHookedFightMovement === "function") {
      movementFrame = floatEntity.applyHookedFightMovement({
        boundsRect: bounds,
        dt: dtMs,
        environment: env,
        checkWater,
        input,
        pullDirection: forceData.player.pullDir,
        targetVelocity: frameTargetVelocity,
      });
    } else {
      const fallbackVelocity = floatEntity.getVelocity() || fishVelocity;
      fallbackVelocity.x = frameTargetVelocity.x;
      fallbackVelocity.y = frameTargetVelocity.y;
      floatEntity.update(
        bounds,
        dtMs,
        env,
        checkWater,
        input,
        0,
        forceData.player.pullDir,
      );
      movementFrame = {
        actualSpeedPxPerSec: Math.hypot(fallbackVelocity.x, fallbackVelocity.y),
        targetSpeedPxPerSec: Math.hypot(
          frameTargetVelocity.x,
          frameTargetVelocity.y,
        ),
        dampingApplied: true,
        fallbackDampedUpdate: true,
      };
    }

    const constrainedFishPosition = floatEntity.getPosition();
    const sectorMovementFrame = this.#poleSector.applyPoleFightSectorAngleMovement({
      fromPosition: {
        x: previousFishX,
        y: previousFishY,
      },
      proposedPosition: constrainedFishPosition,
      velocity: floatEntity.getVelocity() || fishVelocity,
      origin: rodTipPosition,
      limitRadiusPx: this.#poleSector.resolvePoleFightSectorLimitRadiusPx({
        lineState,
      }),
      adjustVelocity: true,
    });
    let prePlayerLineConstraint = null;
    const lineStateAfterFishMovement = lineSystem.updateDistance(
      constrainedFishPosition,
      rodTipPosition,
    );
    const postFishMotionLineConstraintState = this.#lineConstraint.resolveLineConstraintState({
      lineState: lineStateAfterFishMovement,
      dragContext: fishMotionDragContext,
      fishRetrieveResult: forceData,
    });
    if (postFishMotionLineConstraintState.radialConstraintActive) {
      prePlayerLineConstraint = lineSystem.constrainPosition(
        constrainedFishPosition,
        floatEntity.getVelocity() || fishVelocity,
        rodTipPosition,
      );
    }
    const constrainedMovedX = constrainedFishPosition.x - previousFishX;
    const constrainedMovedY = constrainedFishPosition.y - previousFishY;
    movementFrame.movedX = constrainedMovedX;
    movementFrame.movedY = constrainedMovedY;
    movementFrame.actualSpeedPxPerSec = dtSec > 0
      ? Math.hypot(constrainedMovedX, constrainedMovedY) / dtSec
      : 0;
    movementFrame.poleFightSectorClamped =
      sectorMovementFrame.clamped === true;
    movementFrame.poleFightSectorActive =
      sectorMovementFrame.active === true;
    movementFrame.poleFightSectorSide =
      sectorMovementFrame.side || "none";
    movementFrame.poleFightSectorAngleDeg =
      sectorMovementFrame.proposedAngleDeg ??
      sectorMovementFrame.angleDeg ??
      0;
    movementFrame.poleFightSectorBoundaryType =
      sectorMovementFrame.boundaryType || "none";
    movementFrame.poleFightSectorAllowedMoveRatio =
      sectorMovementFrame.allowedMoveRatio ?? 1;
    movementFrame.poleFightSectorEnforceRadius =
      sectorMovementFrame.enforceRadius !== false;
    movementFrame.prePlayerLineConstraintApplied =
      prePlayerLineConstraint?.constrained === true ||
      prePlayerLineConstraint?.hardLimit === true;
    movementFrame.fishMoveRawVelocityX = modelFishVelocity.x;
    movementFrame.fishMoveRawVelocityY = modelFishVelocity.y;
    movementFrame.fishMoveAllowedVelocityX = frameTargetVelocity.x;
    movementFrame.fishMoveAllowedVelocityY = frameTargetVelocity.y;
    movementFrame.fishMoveRadialX = projectionFrame.radialX ?? 0;
    movementFrame.fishMoveRadialY = projectionFrame.radialY ?? 0;
    movementFrame.fishMoveRadialSpeedPxPerSec =
      projectionFrame.radialSpeedPxPerSec ?? 0;
    movementFrame.fishMoveBlockedRadialSpeedPxPerSec =
      projectionFrame.blockedRadialSpeedPxPerSec ?? 0;
    movementFrame.fishMoveAllowedTangentSpeedPxPerSec =
      projectionFrame.allowedTangentSpeedPxPerSec ?? 0;
    movementFrame.fishMoveConstraintActive =
      !!fishMotionLineConstraintState.radialConstraintActive ||
      !!radialMovementFrame.crossedReleasedRadius;
    movementFrame.fishMoveConstraintReason =
      fishMotionLineConstraintState.reason || "none";
    movementFrame.fishMoveProjectionReason =
      radialMovementFrame.crossedReleasedRadius &&
      projectionFrame.projectionReason === "free"
        ? "released_radius_crossed"
        : projectionFrame.projectionReason || projectionFrame.reason || "free";
    movementFrame.fishActualBlockedReason =
      this.#resolveFishActualBlockedReason({
        allowedVelocityX: frameTargetVelocity.x,
        allowedVelocityY: frameTargetVelocity.y,
        actualSpeedPxPerSec: movementFrame.actualSpeedPxPerSec,
        sectorMovementFrame,
        lineConstraintResult: prePlayerLineConstraint,
      });
    movementFrame.lineConstraintReason =
      fishMotionLineConstraintState.reason || "none";
    movementFrame.radialConstraintActive =
      !!fishMotionLineConstraintState.radialConstraintActive;
    movementFrame.lineLengthLocked =
      !!fishMotionLineConstraintState.lineLengthLocked;
    movementFrame.dragCanPayout =
      !!fishMotionLineConstraintState.dragCanPayout;
    movementFrame.dragPayoutBlocked =
      !!fishMotionLineConstraintState.dragPayoutBlocked;

    movementFrame.freeReleasedLineMeters =
      Number(lineState.freeReleasedLineMeters) ||
      Math.max(
        0,
        (Number(lineState.releasedMeters) || 0) -
        (Number(lineState.distanceMeters) || 0),
      );
    movementFrame.freeRadialTimeSec =
      radialMovementFrame.freeTimeSec;
    movementFrame.constrainedRadialTimeSec =
      radialMovementFrame.constrainedTimeSec;
    movementFrame.crossedReleasedRadius =
      radialMovementFrame.crossedReleasedRadius;
    forceData.fightMovementFrame = movementFrame;
    const currentFishY = Number(floatEntity.getPosition()?.y) || previousFishY;
    const towardPlayerYSign = this.#rodStrokeTracker.resolveTowardPlayerYSign({
      fishY: previousFishY,
      rodTipY: rodTipPosition?.y,
    });
    forceData.fightYMovementFrame = {
      ...this.#rodStrokeTracker.calculate({
        previousFishY,
        currentFishY,
        pixelsPerMeter:
          this.#physicsConfig.getPixelsPerMeter() ||
          50,
        towardPlayerYSign,
      }),
      previousFishY,
      currentFishY,
      towardPlayerYSign,
    };
    const velocity = floatEntity.getVelocity() || fishVelocity;
    return {
      forceData,
      velocity,
      movementFrame,
      lineStateBeforeFishMotion: lineState,
      lineConstraintStateBeforeFishMotion: fishMotionLineConstraintState,
    };
  }

  #calculateShoreLandingDistanceMeters({
    fishPosition,
    bounds,
  } = {}) {
    const pixelsPerMeter =
      this.#physicsConfig.getPixelsPerMeter() ||
      50;
    const shoreY = Number(bounds?.bottom) || 0;
    const fishY = Number(fishPosition?.y) || 0;
    const distancePx = Math.max(0, shoreY - fishY);
    return distancePx / Math.max(1, pixelsPerMeter);
  }

  #resolveFishMotionDragContext({ reel, dragSystem } = {}) {
    const hasReel = !!reel.hasReel();
    const dragSupported = hasReel && reel.hasDrag() !== false;
    const clampedDrag = Math.max(
      0,
      Math.min(1, Number(dragSystem?.value) || 0),
    );
    const dragLocked =
      !dragSupported ||
      clampedDrag >= 0.999;
    return {
      clampedDrag,
      dragLocked,
      dragOpen:
        dragSupported &&
        !dragLocked &&
        clampedDrag <= 0.000001,
      hasReel,
      dragSupported,
    };
  }

  #resolveFishActualBlockedReason({
    allowedVelocityX = 0,
    allowedVelocityY = 0,
    actualSpeedPxPerSec = 0,
    sectorMovementFrame = null,
    lineConstraintResult = null,
  } = {}) {
    const allowedSpeed = Math.hypot(
      Number(allowedVelocityX) || 0,
      Number(allowedVelocityY) || 0,
    );
    if (allowedSpeed <= 0.001 || Number(actualSpeedPxPerSec) > 0.001) {
      return "none";
    }
    if (sectorMovementFrame?.clamped === true) {
      const boundaryType = sectorMovementFrame.boundaryType || "unknown";
      const radiusDuplicate =
        boundaryType.includes("radius") &&
        sectorMovementFrame.enforceRadius !== false;
      return radiusDuplicate
        ? "sector_radius_duplicate"
        : `sector_${boundaryType}`;
    }
    if (
      lineConstraintResult?.constrained === true ||
      lineConstraintResult?.hardLimit === true
    ) {
      return "line_radius";
    }
    return "unknown_post_constraint";
  }
}
