class PoleFightSectorGeometry {
  #frame = this.#createFrame();

  resolve({
    origin,
    config = {},
    limitRadiusPx = 0,
    pixelsPerMeter = 50,
    position = null,
  } = {}) {
    const center = this.#point(origin);
    const fish = this.#point(position);
    const enabled = config.enabled !== false;
    const maxAngleFromCenterDeg = this.#clamp(
      Math.abs(Number(config.maxAngleFromCenterDeg) || 60),
      0,
      89.9,
    );
    const radiusPx = Math.max(0, Number(limitRadiusPx) || 0);
    const shoreOpeningWidthMeters = Math.max(
      0,
      this.#finiteNumber(config.shoreOpeningWidthMeters, 1),
    );
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const maxAngleRad = maxAngleFromCenterDeg * Math.PI / 180;
    const apexOffsetPx = maxAngleRad > 0.000001
      ? shoreOpeningWidthMeters * scale * 0.5 / Math.tan(maxAngleRad)
      : 0;
    const sectorApex = {
      x: center.x,
      y: center.y + apexOffsetPx,
    };
    const boundaryIntersections = this.#boundaryIntersections({
      radialOrigin: center,
      sectorApex,
      radiusPx,
      maxAngleRad,
    });
    const hasGeometry =
      center.valid &&
      radiusPx > 0.000001 &&
      maxAngleFromCenterDeg > 0;
    const fishRadiusPx = fish.valid && center.valid
      ? Math.hypot(fish.x - center.x, fish.y - center.y)
      : 0;
    const fishAngleDeg = fish.valid && center.valid
      ? this.angleDeg(fish, sectorApex)
      : 0;

    return this.#writeFrame({
      enabled,
      active: enabled && hasGeometry,
      hasGeometry,
      originX: center.x,
      originY: center.y,
      radialOriginX: center.x,
      radialOriginY: center.y,
      sectorApexX: sectorApex.x,
      sectorApexY: sectorApex.y,
      apexOffsetPx,
      shoreOpeningWidthMeters,
      forwardX: 0,
      forwardY: -1,
      maxAngleFromCenterDeg,
      maxAngleRad,
      limitRadiusPx: radiusPx,
      leftBoundaryDirectionX: -Math.sin(maxAngleRad),
      leftBoundaryDirectionY: -Math.cos(maxAngleRad),
      rightBoundaryDirectionX: Math.sin(maxAngleRad),
      rightBoundaryDirectionY: -Math.cos(maxAngleRad),
      leftBoundaryRadiusIntersectionX: boundaryIntersections.left.x,
      leftBoundaryRadiusIntersectionY: boundaryIntersections.left.y,
      rightBoundaryRadiusIntersectionX: boundaryIntersections.right.x,
      rightBoundaryRadiusIntersectionY: boundaryIntersections.right.y,
      fishRadiusPx,
      fishAngleDeg,
      fishInsideAngle:
        hasGeometry && Math.abs(fishAngleDeg) <= maxAngleFromCenterDeg + 0.000001,
      fishInsideRadius:
        hasGeometry && fishRadiusPx <= radiusPx + 0.000001,
    });
  }

  contains(point, geometry, epsilonPx = 0.000001) {
    if (!geometry?.active) return true;
    const candidate = this.#point(point);
    if (!candidate.valid) return false;
    const center = {
      x: Number(geometry.radialOriginX ?? geometry.originX) || 0,
      y: Number(geometry.radialOriginY ?? geometry.originY) || 0,
    };
    const apex = {
      x: Number(geometry.sectorApexX ?? geometry.originX) || 0,
      y: Number(geometry.sectorApexY ?? geometry.originY) || 0,
    };
    const angleInside =
      Math.abs(this.angleDeg(candidate, apex)) <=
      (Number(geometry.maxAngleFromCenterDeg) || 0) + 0.000001;
    const radiusInside =
      Math.hypot(candidate.x - center.x, candidate.y - center.y) <=
      Math.max(0, Number(geometry.limitRadiusPx) || 0) +
        Math.max(0, Number(epsilonPx) || 0);
    return angleInside && radiusInside;
  }

  angleDeg(point, origin) {
    return Math.atan2(
      Number(point?.x) - Number(origin?.x),
      -(Number(point?.y) - Number(origin?.y)),
    ) * 180 / Math.PI;
  }

  radiusPx(point, origin) {
    return Math.hypot(
      Number(point?.x) - Number(origin?.x),
      Number(point?.y) - Number(origin?.y),
    );
  }

  violation(point, geometry) {
    if (!geometry?.active) {
      return {
        score: 0,
        angleExcessDeg: 0,
        radiusExcessPx: 0,
      };
    }
    const radialOrigin = {
      x: Number(geometry.radialOriginX ?? geometry.originX) || 0,
      y: Number(geometry.radialOriginY ?? geometry.originY) || 0,
    };
    const sectorApex = {
      x: Number(geometry.sectorApexX ?? geometry.originX) || 0,
      y: Number(geometry.sectorApexY ?? geometry.originY) || 0,
    };
    const angleExcessDeg = Math.max(
      0,
      Math.abs(this.angleDeg(point, sectorApex)) -
        (Number(geometry.maxAngleFromCenterDeg) || 0),
    );
    const radiusExcessPx = Math.max(
      0,
      this.radiusPx(point, radialOrigin) -
        Math.max(0.000001, Number(geometry.limitRadiusPx) || 0.000001),
    );
    const normalizedAngle = angleExcessDeg /
      Math.max(0.000001, Number(geometry.maxAngleFromCenterDeg) || 1);
    const normalizedRadius = radiusExcessPx /
      Math.max(0.000001, Number(geometry.limitRadiusPx) || 1);
    return {
      score: normalizedAngle + normalizedRadius,
      angleExcessDeg,
      radiusExcessPx,
    };
  }

  pointAt(geometry, angleDeg, radiusPx, target = {}) {
    const angleRad = Number(angleDeg) * Math.PI / 180;
    const radius = Math.max(0, Number(radiusPx) || 0);
    target.x = (Number(geometry?.originX) || 0) + Math.sin(angleRad) * radius;
    target.y = (Number(geometry?.originY) || 0) - Math.cos(angleRad) * radius;
    return target;
  }

  #createFrame() {
    return {
      enabled: false,
      active: false,
      hasGeometry: false,
      originX: 0,
      originY: 0,
      forwardX: 0,
      forwardY: -1,
      maxAngleFromCenterDeg: 60,
      maxAngleRad: Math.PI / 3,
      limitRadiusPx: 0,
      radialOriginX: 0,
      radialOriginY: 0,
      sectorApexX: 0,
      sectorApexY: 0,
      apexOffsetPx: 0,
      shoreOpeningWidthMeters: 1,
      leftBoundaryDirectionX: -Math.sin(Math.PI / 3),
      leftBoundaryDirectionY: -Math.cos(Math.PI / 3),
      rightBoundaryDirectionX: Math.sin(Math.PI / 3),
      rightBoundaryDirectionY: -Math.cos(Math.PI / 3),
      leftBoundaryRadiusIntersectionX: 0,
      leftBoundaryRadiusIntersectionY: 0,
      rightBoundaryRadiusIntersectionX: 0,
      rightBoundaryRadiusIntersectionY: 0,
      fishRadiusPx: 0,
      fishAngleDeg: 0,
      fishInsideAngle: false,
      fishInsideRadius: false,
    };
  }

  #writeFrame(values) {
    Object.assign(this.#frame, values);
    return this.#frame;
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

  #boundaryIntersections({
    radialOrigin,
    sectorApex,
    radiusPx,
    maxAngleRad,
  }) {
    const resolveSide = (side) => {
      const directionX = Math.sin(maxAngleRad) * side;
      const directionY = -Math.cos(maxAngleRad);
      const offsetX = sectorApex.x - radialOrigin.x;
      const offsetY = sectorApex.y - radialOrigin.y;
      const projection =
        offsetX * directionX + offsetY * directionY;
      const discriminant =
        projection * projection -
        (offsetX * offsetX + offsetY * offsetY - radiusPx * radiusPx);
      if (discriminant < 0) {
        return {
          x: radialOrigin.x + radiusPx * side,
          y: radialOrigin.y,
        };
      }
      const distance = -projection + Math.sqrt(discriminant);
      return {
        x: sectorApex.x + directionX * distance,
        y: sectorApex.y + directionY * distance,
      };
    };

    return {
      left: resolveSide(-1),
      right: resolveSide(1),
    };
  }

  #finiteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  #clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }
}
