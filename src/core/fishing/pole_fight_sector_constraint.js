class PoleFightSectorConstraint {
  #geometry;
  #frame = this.#createFrame();

  constructor({ geometry = null } = {}) {
    this.#geometry = geometry || (
      typeof PoleFightSectorGeometry !== "undefined"
        ? new PoleFightSectorGeometry()
        : null
    );
  }

  resolveMovement({
    fromPosition,
    proposedPosition,
    velocity = null,
    origin,
    config = {},
    limitRadiusPx = 0,
    pixelsPerMeter = 50,
    geometryFrame = null,
  } = {}) {
    const from = this.#point(fromPosition);
    const proposed = this.#point(proposedPosition);
    const geometry = geometryFrame || this.#geometry?.resolve?.({
      origin,
      config,
      limitRadiusPx,
      pixelsPerMeter,
      position: proposed,
    });
    const hasGeometry = !!geometry?.hasGeometry && from.valid && proposed.valid;

    this.#writeFrame({
      enabled: geometry?.enabled === true,
      active: geometry?.active === true && hasGeometry,
      clamped: false,
      outside: false,
      recoveryMovement: false,
      side: "none",
      angleDeg: Number(geometry?.fishAngleDeg) || 0,
      clampedAngleDeg: Number(geometry?.fishAngleDeg) || 0,
      proposedAngleDeg: Number(geometry?.fishAngleDeg) || 0,
      maxAngleFromCenterDeg:
        Number(geometry?.maxAngleFromCenterDeg) || 60,
      radiusPx: Number(geometry?.fishRadiusPx) || 0,
      limitRadiusPx: Math.max(0, Number(geometry?.limitRadiusPx) || 0),
      originX: Number(geometry?.originX) || 0,
      originY: Number(geometry?.originY) || 0,
      radialOriginX:
        Number(geometry?.radialOriginX ?? geometry?.originX) || 0,
      radialOriginY:
        Number(geometry?.radialOriginY ?? geometry?.originY) || 0,
      sectorApexX:
        Number(geometry?.sectorApexX ?? geometry?.originX) || 0,
      sectorApexY:
        Number(geometry?.sectorApexY ?? geometry?.originY) || 0,
      apexOffsetPx: Math.max(0, Number(geometry?.apexOffsetPx) || 0),
      shoreOpeningWidthMeters: Math.max(
        0,
        Number(geometry?.shoreOpeningWidthMeters) || 0,
      ),
      forwardX: Number(geometry?.forwardX) || 0,
      forwardY: Number(geometry?.forwardY) || -1,
      leftBoundaryDirectionX:
        Number(geometry?.leftBoundaryDirectionX) || 0,
      leftBoundaryDirectionY:
        Number(geometry?.leftBoundaryDirectionY) || 0,
      rightBoundaryDirectionX:
        Number(geometry?.rightBoundaryDirectionX) || 0,
      rightBoundaryDirectionY:
        Number(geometry?.rightBoundaryDirectionY) || 0,
      leftBoundaryRadiusIntersectionX:
        Number(geometry?.leftBoundaryRadiusIntersectionX) || 0,
      leftBoundaryRadiusIntersectionY:
        Number(geometry?.leftBoundaryRadiusIntersectionY) || 0,
      rightBoundaryRadiusIntersectionX:
        Number(geometry?.rightBoundaryRadiusIntersectionX) || 0,
      rightBoundaryRadiusIntersectionY:
        Number(geometry?.rightBoundaryRadiusIntersectionY) || 0,
      positionX: proposed.x,
      positionY: proposed.y,
      velocityAdjusted: false,
      velocityX: Number(velocity?.x) || 0,
      velocityY: Number(velocity?.y) || 0,
      boundaryType: "none",
      allowedMoveRatio: 1,
    });

    if (!this.#frame.active || !this.#geometry) return this.#frame;

    const fromInside = this.#geometry.contains(from, geometry);
    const proposedInside = this.#geometry.contains(proposed, geometry);
    let allowed = proposed;
    let recoveryMovement = false;
    let allowedMoveRatio = 1;

    if (!proposedInside) {
      if (!fromInside) {
        const fromViolation = this.#geometry.violation(from, geometry);
        const proposedViolation = this.#geometry.violation(proposed, geometry);
        const doesNotWorsenAngle =
          proposedViolation.angleExcessDeg <=
          fromViolation.angleExcessDeg + 0.0000001;
        const doesNotWorsenRadius =
          proposedViolation.radiusExcessPx <=
          fromViolation.radiusExcessPx + 0.0000001;
        recoveryMovement =
          doesNotWorsenAngle &&
          doesNotWorsenRadius &&
          proposedViolation.score < fromViolation.score - 0.0000001;
        allowed = recoveryMovement ? proposed : from;
        allowedMoveRatio = recoveryMovement ? 1 : 0;
      } else {
        const boundary = this.#findBoundaryPoint({
          from,
          proposed,
          geometry,
        });
        allowed = boundary.point;
        allowedMoveRatio = boundary.ratio;
      }
    }

    const radialOrigin = {
      x: Number(geometry.radialOriginX ?? geometry.originX) || 0,
      y: Number(geometry.radialOriginY ?? geometry.originY) || 0,
    };
    const sectorApex = {
      x: Number(geometry.sectorApexX ?? geometry.originX) || 0,
      y: Number(geometry.sectorApexY ?? geometry.originY) || 0,
    };
    const angleDeg = this.#geometry.angleDeg(allowed, sectorApex);
    const proposedAngleDeg = this.#geometry.angleDeg(proposed, sectorApex);
    const allowedRadiusPx = this.#geometry.radiusPx(allowed, radialOrigin);
    const proposedRadiusPx = this.#geometry.radiusPx(proposed, radialOrigin);
    const clamped =
      Math.abs(allowed.x - proposed.x) > 0.000001 ||
      Math.abs(allowed.y - proposed.y) > 0.000001;
    const boundaryType = clamped
      ? this.#resolveBoundaryType({
          proposedAngleDeg,
          proposedRadiusPx,
          geometry,
        })
      : "none";
    const velocityFrame = clamped
      ? this.#resolveAllowedVelocity({
          velocity,
          allowed,
          proposed,
        })
      : {
          adjusted: false,
          x: Number(velocity?.x) || 0,
          y: Number(velocity?.y) || 0,
        };

    return this.#writeFrame({
      ...this.#frame,
      clamped,
      outside: !proposedInside,
      recoveryMovement,
      side: proposedAngleDeg < -0.000001
        ? "left"
        : proposedAngleDeg > 0.000001
          ? "right"
          : "center",
      angleDeg,
      clampedAngleDeg: angleDeg,
      proposedAngleDeg,
      radiusPx: allowedRadiusPx,
      positionX: allowed.x,
      positionY: allowed.y,
      velocityAdjusted: velocityFrame.adjusted,
      velocityX: velocityFrame.x,
      velocityY: velocityFrame.y,
      boundaryType,
      allowedMoveRatio,
    });
  }

  inspect({
    position,
    origin,
    config = {},
    limitRadiusPx = 0,
    pixelsPerMeter = 50,
    geometryFrame = null,
  } = {}) {
    return this.resolveMovement({
      fromPosition: position,
      proposedPosition: position,
      origin,
      config,
      limitRadiusPx,
      pixelsPerMeter,
      geometryFrame,
    });
  }

  reset() {
    this.#frame = this.#createFrame();
  }

  #findBoundaryPoint({ from, proposed, geometry }) {
    let low = 0;
    let high = 1;
    let allowedX = from.x;
    let allowedY = from.y;

    for (let index = 0; index < 30; index += 1) {
      const ratio = (low + high) * 0.5;
      const x = from.x + (proposed.x - from.x) * ratio;
      const y = from.y + (proposed.y - from.y) * ratio;
      if (this.#geometry.contains({ x, y }, geometry)) {
        low = ratio;
        allowedX = x;
        allowedY = y;
      } else {
        high = ratio;
      }
    }

    return {
      point: { x: allowedX, y: allowedY, valid: true },
      ratio: low,
    };
  }

  #resolveBoundaryType({
    proposedAngleDeg,
    proposedRadiusPx,
    geometry,
  }) {
    const angleOutside =
      Math.abs(proposedAngleDeg) >
      (Number(geometry.maxAngleFromCenterDeg) || 0) + 0.000001;
    const radiusOutside =
      proposedRadiusPx >
      Math.max(0, Number(geometry.limitRadiusPx) || 0) + 0.000001;
    if (angleOutside && radiusOutside) return "angle_and_radius";
    if (angleOutside) return "angle";
    if (radiusOutside) return "radius";
    return "none";
  }

  #resolveAllowedVelocity({ velocity, allowed, proposed }) {
    const velocityX = Number(velocity?.x) || 0;
    const velocityY = Number(velocity?.y) || 0;
    const blockedX = proposed.x - allowed.x;
    const blockedY = proposed.y - allowed.y;
    const blockedLength = Math.hypot(blockedX, blockedY);
    if (blockedLength <= 0.000001) {
      return { adjusted: false, x: velocityX, y: velocityY };
    }
    const normalX = blockedX / blockedLength;
    const normalY = blockedY / blockedLength;
    const outwardVelocity = velocityX * normalX + velocityY * normalY;
    if (outwardVelocity <= 0) {
      return { adjusted: false, x: velocityX, y: velocityY };
    }
    return {
      adjusted: true,
      x: velocityX - normalX * outwardVelocity,
      y: velocityY - normalY * outwardVelocity,
    };
  }

  #point(value) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      valid: Number.isFinite(x) && Number.isFinite(y),
    };
  }

  #createFrame() {
    return {
      enabled: false,
      active: false,
      clamped: false,
      outside: false,
      recoveryMovement: false,
      side: "none",
      angleDeg: 0,
      clampedAngleDeg: 0,
      proposedAngleDeg: 0,
      maxAngleFromCenterDeg: 60,
      radiusPx: 0,
      limitRadiusPx: 0,
      originX: 0,
      originY: 0,
      radialOriginX: 0,
      radialOriginY: 0,
      sectorApexX: 0,
      sectorApexY: 0,
      apexOffsetPx: 0,
      shoreOpeningWidthMeters: 0,
      forwardX: 0,
      forwardY: -1,
      leftBoundaryDirectionX: 0,
      leftBoundaryDirectionY: 0,
      rightBoundaryDirectionX: 0,
      rightBoundaryDirectionY: 0,
      leftBoundaryRadiusIntersectionX: 0,
      leftBoundaryRadiusIntersectionY: 0,
      rightBoundaryRadiusIntersectionX: 0,
      rightBoundaryRadiusIntersectionY: 0,
      positionX: 0,
      positionY: 0,
      velocityAdjusted: false,
      velocityX: 0,
      velocityY: 0,
      boundaryType: "none",
      allowedMoveRatio: 1,
    };
  }

  #writeFrame(values) {
    Object.assign(this.#frame, values);
    return this.#frame;
  }
}
