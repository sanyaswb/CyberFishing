class FishBoundarySteeringPolicy {
  #tangentSide = 0;
  #frame = this.#createFrame();

  resolveVelocity({
    position,
    rodTipPosition,
    freeVelocity,
    constrainedVelocity,
    radialConstraintActive = false,
    sectorConfig = {},
    dtSec = 0,
  } = {}) {
    const free = this.#velocity(freeVelocity);
    const constrained = this.#velocity(constrainedVelocity);
    const point = this.#point(position);
    const origin = this.#point(rodTipPosition);
    const radial = {
      x: point.x - origin.x,
      y: point.y - origin.y,
    };
    const radialLength = Math.hypot(radial.x, radial.y);
    const constrainedSpeed = Math.hypot(constrained.x, constrained.y);
    const freeSpeed = Math.hypot(free.x, free.y);
    const topEscapeConfig = this.#resolveTopEscapeConfig(sectorConfig);

    this.#writeFrame({
      active: false,
      reason: "none",
      tangentSide: this.#tangentSide,
      velocityX: constrained.x,
      velocityY: constrained.y,
      freeSpeedPxPerSec: freeSpeed,
      constrainedSpeedPxPerSec: constrainedSpeed,
      topEscapeActive: false,
      topEscapeAngleDeg: 0,
      minTopTangentSpeedPxPerSec: 0,
    });

    if (
      !radialConstraintActive ||
      radialLength <= 0.001 ||
      freeSpeed <= 0.001
    ) {
      return this.#frame;
    }

    radial.x /= radialLength;
    radial.y /= radialLength;
    const outwardSpeed = free.x * radial.x + free.y * radial.y;
    if (outwardSpeed <= 0.001) return this.#frame;

    const positiveTangent = { x: -radial.y, y: radial.x };
    const projectedTangentSpeed =
      free.x * positiveTangent.x + free.y * positiveTangent.y;
    const constrainedTangentSpeed =
      constrained.x * positiveTangent.x + constrained.y * positiveTangent.y;
    const topEscapeFrame = this.#resolveTopEscapeFrame({
      point,
      origin,
      freeSpeed,
      outwardSpeed,
      constrainedSpeed,
      constrainedTangentSpeed,
      config: topEscapeConfig,
    });
    const deadlockActive = constrainedSpeed <= 0.001;
    if (!deadlockActive && !topEscapeFrame.active) return this.#frame;

    if (Math.abs(constrainedTangentSpeed) > 0.001) {
      this.#tangentSide = Math.sign(constrainedTangentSpeed);
    } else if (Math.abs(projectedTangentSpeed) > 0.001) {
      this.#tangentSide = Math.sign(projectedTangentSpeed);
    }
    if (this.#tangentSide === 0) {
      this.#tangentSide = point.x >= origin.x ? -1 : 1;
    }

    const targetTangentSpeed = deadlockActive
      ? freeSpeed
      : Math.max(
          Math.abs(constrainedTangentSpeed),
          topEscapeFrame.minTangentSpeedPxPerSec,
        );
    this.#tangentSide = this.#chooseSectorSafeSide({
      point,
      origin,
      tangent: positiveTangent,
      preferredSide: this.#tangentSide,
      speedPxPerSec: targetTangentSpeed,
      dtSec,
      sectorConfig,
    });

    return this.#writeFrame({
      active: true,
      reason: deadlockActive
        ? "outward_deadlock_tangent"
        : "top_boundary_lateral_escape",
      tangentSide: this.#tangentSide,
      velocityX: positiveTangent.x * targetTangentSpeed * this.#tangentSide,
      velocityY: positiveTangent.y * targetTangentSpeed * this.#tangentSide,
      freeSpeedPxPerSec: freeSpeed,
      constrainedSpeedPxPerSec: constrainedSpeed,
      topEscapeActive: topEscapeFrame.active,
      topEscapeAngleDeg: topEscapeFrame.angleDeg,
      minTopTangentSpeedPxPerSec:
        topEscapeFrame.minTangentSpeedPxPerSec,
    });
  }

  reset() {
    this.#tangentSide = 0;
    this.#frame = this.#createFrame();
  }

  #resolveTopEscapeFrame({
    point,
    origin,
    freeSpeed,
    outwardSpeed,
    constrainedSpeed,
    constrainedTangentSpeed,
    config,
  }) {
    const angleDeg = Math.abs(this.#angleDeg(point, origin));
    const minTangentSpeedPxPerSec = Math.max(
      Math.max(0, Number(config.minTangentSpeedPxPerSec) || 0),
      freeSpeed * Math.max(0, Number(config.minTangentSpeedRatio) || 0),
    );
    const outwardRatio = freeSpeed > 0 ? outwardSpeed / freeSpeed : 0;
    const active =
      config.enabled !== false &&
      angleDeg <= config.angleDeg &&
      outwardRatio >= config.outwardSpeedRatio &&
      constrainedSpeed > 0.001 &&
      Math.abs(constrainedTangentSpeed) < minTangentSpeedPxPerSec;

    return {
      active,
      angleDeg,
      minTangentSpeedPxPerSec,
    };
  }

  #resolveTopEscapeConfig(sectorConfig = {}) {
    const source = sectorConfig.boundarySteering?.topEscape || {};
    return {
      enabled: source.enabled !== false,
      angleDeg: Math.max(
        0,
        Math.min(
          89.9,
          Math.abs(Number(source.angleDeg ?? source.topAngleDeg) || 18),
        ),
      ),
      minTangentSpeedRatio: Math.max(
        0,
        Math.min(1, Number(source.minTangentSpeedRatio) || 0.65),
      ),
      minTangentSpeedPxPerSec: Math.max(
        0,
        Number(source.minTangentSpeedPxPerSec) || 20,
      ),
      outwardSpeedRatio: Math.max(
        0,
        Math.min(1, Number(source.outwardSpeedRatio) || 0.35),
      ),
    };
  }

  #chooseSectorSafeSide({
    point,
    origin,
    tangent,
    preferredSide,
    speedPxPerSec,
    dtSec,
    sectorConfig,
  }) {
    if (sectorConfig?.enabled === false) return preferredSide;
    const maxAngleDeg = Math.max(
      0,
      Math.min(89.9, Math.abs(Number(sectorConfig?.maxAngleFromCenterDeg) || 60)),
    );
    const step = Math.max(0.001, Number(dtSec) || 0.016) * speedPxPerSec;
    const score = (side) => {
      const candidate = {
        x: point.x + tangent.x * step * side,
        y: point.y + tangent.y * step * side,
      };
      return Math.abs(this.#angleDeg(candidate, origin));
    };
    const preferredScore = score(preferredSide);
    const oppositeScore = score(-preferredSide);
    const currentScore = Math.abs(this.#angleDeg(point, origin));

    if (currentScore >= maxAngleDeg - 0.001 && oppositeScore < preferredScore) {
      return -preferredSide;
    }
    return preferredSide;
  }

  #angleDeg(point, center) {
    return Math.atan2(point.x - center.x, -(point.y - center.y)) * 180 / Math.PI;
  }

  #point(value) {
    return {
      x: Number(value?.x) || 0,
      y: Number(value?.y) || 0,
    };
  }

  #velocity(value) {
    return {
      x: Number(value?.x ?? value?.velocityX) || 0,
      y: Number(value?.y ?? value?.velocityY) || 0,
    };
  }

  #createFrame() {
    return {
      active: false,
      reason: "none",
      tangentSide: 0,
      velocityX: 0,
      velocityY: 0,
      freeSpeedPxPerSec: 0,
      constrainedSpeedPxPerSec: 0,
      topEscapeActive: false,
      topEscapeAngleDeg: 0,
      minTopTangentSpeedPxPerSec: 0,
    };
  }

  #writeFrame(values) {
    Object.assign(this.#frame, values);
    return this.#frame;
  }
}
