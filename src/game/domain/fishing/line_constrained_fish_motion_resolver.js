export class LineConstrainedFishMotionResolver {
  #frame = this.#createFrame();

  resolve({
    position,
    rodTipPosition,
    rawVelocity,
    lineConstraintState,
    dtSec,
  } = {}) {
    const constraintActive = !!lineConstraintState?.radialConstraintActive;
    const rawX = Number(rawVelocity?.x ?? rawVelocity?.velocityX) || 0;
    const rawY = Number(rawVelocity?.y ?? rawVelocity?.velocityY) || 0;
    const dx =
      (Number(position?.x) || 0) - (Number(rodTipPosition?.x) || 0);
    const dy =
      (Number(position?.y) || 0) - (Number(rodTipPosition?.y) || 0);
    const distance = Math.hypot(dx, dy);

    if (!constraintActive) {
      return this.#writeFrame({
        velocityX: rawX,
        velocityY: rawY,
        active: false,
        constraintActive: false,
        reason: "free",
        projectionReason: "free",
        radialX: 0,
        radialY: 0,
        radialSpeedPxPerSec: 0,
        blockedRadialSpeedPxPerSec: 0,
        allowedTangentSpeedPxPerSec: Math.hypot(rawX, rawY),
        rawVelocityX: rawX,
        rawVelocityY: rawY,
        dtSec: this.#nonNegative(dtSec),
      });
    }

    if (distance <= 0.001) {
      return this.#writeFrame({
        velocityX: rawX,
        velocityY: rawY,
        active: false,
        constraintActive: true,
        reason: "zero_radius",
        projectionReason: "zero_radius",
        radialX: 0,
        radialY: -1,
        radialSpeedPxPerSec: 0,
        blockedRadialSpeedPxPerSec: 0,
        allowedTangentSpeedPxPerSec: Math.hypot(rawX, rawY),
        rawVelocityX: rawX,
        rawVelocityY: rawY,
        dtSec: this.#nonNegative(dtSec),
      });
    }

    const radialX = dx / distance;
    const radialY = dy / distance;
    const radialSpeed = rawX * radialX + rawY * radialY;
    if (radialSpeed <= 0) {
      return this.#writeFrame({
        velocityX: rawX,
        velocityY: rawY,
        active: false,
        constraintActive: true,
        reason: "allowed_inward_or_tangent",
        projectionReason: "allowed_inward_or_tangent",
        radialX,
        radialY,
        radialSpeedPxPerSec: radialSpeed,
        blockedRadialSpeedPxPerSec: 0,
        allowedTangentSpeedPxPerSec: Math.hypot(rawX, rawY),
        rawVelocityX: rawX,
        rawVelocityY: rawY,
        dtSec: this.#nonNegative(dtSec),
      });
    }

    const blockedX = radialX * radialSpeed;
    const blockedY = radialY * radialSpeed;
    const allowedX = rawX - blockedX;
    const allowedY = rawY - blockedY;
    return this.#writeFrame({
      velocityX: allowedX,
      velocityY: allowedY,
      active: true,
      constraintActive: true,
      reason: "radial_outward_projected",
      projectionReason: "radial_outward_projected",
      radialX,
      radialY,
      radialSpeedPxPerSec: radialSpeed,
      blockedRadialSpeedPxPerSec: radialSpeed,
      allowedTangentSpeedPxPerSec: Math.hypot(allowedX, allowedY),
      rawVelocityX: rawX,
      rawVelocityY: rawY,
      dtSec: this.#nonNegative(dtSec),
    });
  }

  #nonNegative(value) {
    return Math.max(0, Number(value) || 0);
  }

  #createFrame() {
    return {
      velocityX: 0,
      velocityY: 0,
      active: false,
      constraintActive: false,
      reason: "free",
      projectionReason: "free",
      radialX: 0,
      radialY: 0,
      radialSpeedPxPerSec: 0,
      blockedRadialSpeedPxPerSec: 0,
      allowedTangentSpeedPxPerSec: 0,
      rawVelocityX: 0,
      rawVelocityY: 0,
      dtSec: 0,
    };
  }

  #writeFrame(values) {
    Object.assign(this.#frame, values);
    return this.#frame;
  }
}
