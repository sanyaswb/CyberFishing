class RodControlMovementProjector {
  resolveNextPoint({
    position,
    rodTipPosition,
    directionX,
    deltaMeters,
    pixelsPerMeter,
    lineConstraintState,
    projectLockedMovementToArc = true,
  } = {}) {
    const current = this.#point(position);
    const rodTip = this.#point(rodTipPosition);
    const direction = Math.sign(Number(directionX) || 0);
    const meters = Math.max(0, Number(deltaMeters) || 0);
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);

    if (direction === 0 || meters <= 0) {
      return { ...current, mode: "none" };
    }

    if (
      !lineConstraintState?.radialConstraintActive ||
      projectLockedMovementToArc === false
    ) {
      return {
        x: current.x + direction * meters * scale,
        y: current.y,
        mode: "free_x",
      };
    }

    const radiusPx =
      Math.max(
        0,
        Number(lineConstraintState.lockedLengthMeters) || 0,
      ) * scale;
    const dx = current.x - rodTip.x;
    const dy = current.y - rodTip.y;
    const distancePx = Math.hypot(dx, dy);
    if (radiusPx <= 0.001 || distancePx <= 0.001) {
      return { ...current, mode: "locked_no_radius" };
    }

    const angle = Math.atan2(dy, dx);
    const positiveTangentX = -dy / distancePx;
    const rotationSign =
      Math.sign(positiveTangentX) === direction ? 1 : -1;
    const deltaAngle = meters * scale / radiusPx;
    const nextAngle = angle + rotationSign * deltaAngle;

    return {
      x: rodTip.x + Math.cos(nextAngle) * radiusPx,
      y: rodTip.y + Math.sin(nextAngle) * radiusPx,
      mode: "locked_arc",
    };
  }

  #point(value) {
    return {
      x: Number(value?.x) || 0,
      y: Number(value?.y) || 0,
    };
  }
}
