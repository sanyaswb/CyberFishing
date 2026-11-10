import { clampUnit, nonNegativeFiniteOr } from "../../../engine/math/number_normalization.js";

/**
 * Resolves reel drag only against outward radial fish movement.
 *
 * Responsibility boundary:
 * - receives an already resolved world-space velocity and line direction;
 * - preserves tangent and inward velocity;
 * - does not mutate entities or calculate line payout.
 */
export class DragForceCalculator {
  calculate({
    fishOppositionKg,
    effectiveRodHoldKg = 0,
    awayDir = null,
    dragRatio = 0,
    dragLimitKg = 0,
    lineHasReserve = true,
    lineTaut = true,
    dragLocked = false,
    dragSupported = true,
    targetVelocity = null,
    targetXSpeedPxPerSec = 0,
    targetYSpeedPxPerSec = 0,
    yAwayRatio = null,
    waterMotionResistance = 1000,
    waterSpeedMultiplier = 64,
    fishBaseSpeed = 1,
    fishStateSpeedMultiplier = 1,
    pixelsPerMeter = 50,
  } = {}) {
    const targetX = Number(
      targetVelocity?.x ?? targetXSpeedPxPerSec,
    ) || 0;
    const targetY = Number(
      targetVelocity?.y ?? targetYSpeedPxPerSec,
    ) || 0;
    const hasExplicitAwayDirection =
      Math.hypot(Number(awayDir?.x) || 0, Number(awayDir?.y) || 0) >
      0.000001;
    const direction = this.#resolveAwayDirection({
      awayDir,
      targetY,
      yAwayRatio,
    });
    const targetSpeed = Math.hypot(targetX, targetY);
    const radialSpeed =
      targetX * direction.x + targetY * direction.y;
    const outwardRadialSpeed = Math.max(0, radialSpeed);
    const projectedOutwardRatio =
      targetSpeed > 0.000001
        ? clampUnit(outwardRadialSpeed / targetSpeed)
        : 0;
    const outwardRatio =
      !hasExplicitAwayDirection && yAwayRatio !== null
        ? clampUnit(yAwayRatio)
        : projectedOutwardRatio;
    const radialVelocityX = direction.x * radialSpeed;
    const radialVelocityY = direction.y * radialSpeed;
    const tangentVelocityX = targetX - radialVelocityX;
    const tangentVelocityY = targetY - radialVelocityY;
    const tangentSpeed = Math.hypot(
      tangentVelocityX,
      tangentVelocityY,
    );

    const fishWonForceKg = Math.max(
      0,
      nonNegativeFiniteOr(fishOppositionKg) -
        nonNegativeFiniteOr(effectiveRodHoldKg),
    );
    const fishWonRadialForceKg = fishWonForceKg * outwardRatio;
    const resolvedDragRatio = clampUnit(dragRatio);
    const resolvedDragLimitKg = nonNegativeFiniteOr(dragLimitKg);
    const dragEngaged = !!lineTaut && outwardRadialSpeed > 0.000001;
    const canSlipTautLine =
      !!lineHasReserve &&
      !dragLocked &&
      !!dragSupported;
    const dragHasThreshold =
      resolvedDragRatio > 0.000001 &&
      resolvedDragLimitKg > 0.000001;
    const dragCanBeExceeded =
      dragEngaged && canSlipTautLine && dragHasThreshold;
    const shouldSlipDrag =
      dragCanBeExceeded &&
      fishWonRadialForceKg > resolvedDragLimitKg + 0.000001;

    const dragBlockedForceKg = !dragEngaged
      ? 0
      : canSlipTautLine
        ? dragHasThreshold
          ? Math.min(fishWonRadialForceKg, resolvedDragLimitKg)
          : 0
        : fishWonRadialForceKg;
    const tautRadialEscapeForceKg = canSlipTautLine
      ? dragHasThreshold
        ? Math.max(0, fishWonRadialForceKg - resolvedDragLimitKg)
        : fishWonRadialForceKg
      : 0;
    const radialEscapeForceKg = dragEngaged
      ? tautRadialEscapeForceKg
      : fishWonRadialForceKg;
    const resolvedOutwardSpeed = this.speedFromForceKg({
      forceKg: radialEscapeForceKg,
      waterMotionResistance,
      waterSpeedMultiplier,
      fishBaseSpeed,
      fishStateSpeedMultiplier,
      pixelsPerMeter,
    });
    const tautResolvedOutwardSpeed = this.speedFromForceKg({
      forceKg: tautRadialEscapeForceKg,
      waterMotionResistance,
      waterSpeedMultiplier,
      fishBaseSpeed,
      fishStateSpeedMultiplier,
      pixelsPerMeter,
    });
    const tautRadialSpeed =
      radialSpeed > 0 ? tautResolvedOutwardSpeed : radialSpeed;
    const tautFinalX =
      tangentVelocityX + direction.x * tautRadialSpeed;
    const tautFinalY =
      tangentVelocityY + direction.y * tautRadialSpeed;
    const finalX = dragEngaged ? tautFinalX : targetX;
    const finalY = dragEngaged ? tautFinalY : targetY;
    const finalRadialSpeed =
      finalX * direction.x + finalY * direction.y;

    return Object.freeze({
      fishWonForceKg,
      fishWonRadialForceKg,
      radialEscapeForceKg,
      radialSpeedPxPerSec: radialSpeed,
      outwardRadialSpeedPxPerSec: outwardRadialSpeed,
      finalRadialSpeedPxPerSec: finalRadialSpeed,
      tangentSpeedPxPerSec: tangentSpeed,
      outwardRatio,
      radialAwayRatio: outwardRatio,
      awayDirX: direction.x,
      awayDirY: direction.y,
      dragRatio: resolvedDragRatio,
      dragLimitKg: resolvedDragLimitKg,
      dragBlockedForceKg,
      targetXSpeedPxPerSec: targetX,
      targetYSpeedPxPerSec: targetY,
      finalXSpeedPxPerSec: finalX,
      finalYSpeedPxPerSec: finalY,
      tautFinalXSpeedPxPerSec: tautFinalX,
      tautFinalYSpeedPxPerSec: tautFinalY,
      lineHasReserve: !!lineHasReserve,
      lineTaut: !!lineTaut,
      dragEngaged,
      dragLocked: !!dragLocked,
      dragSupported: !!dragSupported,
      dragCanBeExceeded,
      shouldSlipDrag,
      hasAwayYMovement: outwardRadialSpeed > 0.000001,

      // Temporary aliases for existing tension/debug consumers.
      fishWonYForceKg: fishWonRadialForceKg,
      yAwayRatio: outwardRatio,
      excessYForceKg: radialEscapeForceKg,
      yEscapeForceKg: radialEscapeForceKg,
      dragSlowedYSpeedPxPerSec: 0,
      excessYSpeedPxPerSec: resolvedOutwardSpeed,
    });
  }

  speedFromForceKg({
    forceKg,
    waterMotionResistance = 1000,
    waterSpeedMultiplier = 64,
    fishBaseSpeed = 1,
    fishStateSpeedMultiplier = 1,
    pixelsPerMeter = 50,
  } = {}) {
    const resistance = Math.max(
      0.000001,
      nonNegativeFiniteOr(waterMotionResistance, 1000),
    );
    return (
      Math.sqrt(nonNegativeFiniteOr(forceKg) / resistance) *
      nonNegativeFiniteOr(waterSpeedMultiplier, 64) *
      nonNegativeFiniteOr(fishBaseSpeed, 1) *
      nonNegativeFiniteOr(fishStateSpeedMultiplier, 1) *
      Math.max(1, nonNegativeFiniteOr(pixelsPerMeter, 50))
    );
  }

  #resolveAwayDirection({ awayDir, targetY, yAwayRatio }) {
    const x = Number(awayDir?.x) || 0;
    const y = Number(awayDir?.y) || 0;
    const length = Math.hypot(x, y);
    if (length > 0.000001) {
      return { x: x / length, y: y / length };
    }

    // Compatibility for old callers that supplied only Y escape data.
    const legacyAway = clampUnit(yAwayRatio);
    if (legacyAway > 0) {
      return { x: 0, y: Math.sign(targetY) || -1 };
    }
    return { x: 0, y: -(Math.sign(targetY) || 1) };
  }
}
