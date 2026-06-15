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
    const original = this.#point(position);
    const rodTip = this.#point(rodTipPosition);
    const direction = Math.sign(Number(directionX) || 0);
    const meters = Math.max(0, Number(deltaMeters) || 0);
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const requestedMovePx = meters * scale;

    if (direction === 0 || requestedMovePx <= 0) {
      return this.#result(original, {
        mode: "none",
        requestedMovePx,
      });
    }

    if (
      !lineConstraintState?.radialConstraintActive ||
      projectLockedMovementToArc === false
    ) {
      return this.#result({
        x: original.x + direction * requestedMovePx,
        y: original.y,
      }, {
        mode: "free_x",
        requestedMovePx,
        appliedPathPx: requestedMovePx,
        normalizedStart: original,
      });
    }

    const radiusPx = Math.max(
      0,
      Number(lineConstraintState.lockedLengthMeters) || 0,
    ) * scale;
    if (radiusPx <= 0.001) {
      return this.#result(original, {
        mode: "locked_no_radius",
        requestedMovePx,
      });
    }

    const normalized = this.#normalizeStartToRadius({
      point: original,
      center: rodTip,
      radiusPx,
    });
    const start = normalized.point;
    const freeCandidate = {
      x: start.x + direction * requestedMovePx,
      y: start.y,
    };

    if (this.#distance(freeCandidate, rodTip) <= radiusPx + 0.001) {
      return this.#result(freeCandidate, {
        mode: "locked_free_x",
        requestedMovePx,
        appliedPathPx: requestedMovePx,
        normalizedStart: start,
        correction: normalized,
      });
    }

    const boundary = this.#findSegmentCircleBoundary({
      from: start,
      to: freeCandidate,
      center: rodTip,
      radiusPx,
    });
    if (!boundary) {
      return this.#result(start, {
        mode: "locked_blocked",
        requestedMovePx,
        normalizedStart: start,
        correction: normalized,
      });
    }

    const freeMovePx = Math.min(
      requestedMovePx,
      this.#distance(start, boundary),
    );
    const remainingArcPx = Math.max(0, requestedMovePx - freeMovePx);
    if (remainingArcPx <= 0.001) {
      return this.#result(boundary, {
        mode: "locked_boundary",
        requestedMovePx,
        appliedPathPx: freeMovePx,
        normalizedStart: start,
        correction: normalized,
      });
    }

    const boundaryDx = boundary.x - rodTip.x;
    const boundaryDy = boundary.y - rodTip.y;
    const boundaryDistancePx = Math.hypot(boundaryDx, boundaryDy);
    if (boundaryDistancePx <= 0.001) {
      return this.#result(boundary, {
        mode: "locked_boundary",
        requestedMovePx,
        appliedPathPx: freeMovePx,
        normalizedStart: start,
        correction: normalized,
      });
    }

    const angle = Math.atan2(boundaryDy, boundaryDx);
    const positiveRotationTangentX = -boundaryDy / boundaryDistancePx;
    const rotationSign = this.#resolveRotationSign({
      tangentX: positiveRotationTangentX,
      direction,
      boundaryDx,
    });
    const deltaAngle = remainingArcPx / radiusPx;
    const nextAngle = angle + rotationSign * deltaAngle;
    const next = {
      x: rodTip.x + Math.cos(nextAngle) * radiusPx,
      y: rodTip.y + Math.sin(nextAngle) * radiusPx,
    };

    return this.#result(next, {
      mode: "locked_arc",
      requestedMovePx,
      appliedPathPx: freeMovePx + remainingArcPx,
      normalizedStart: start,
      correction: normalized,
    });
  }

  #normalizeStartToRadius({ point, center, radiusPx }) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distancePx = Math.hypot(dx, dy);
    if (distancePx <= radiusPx + 0.001) {
      return {
        point: { ...point },
        corrected: false,
        correctionX: 0,
        correctionY: 0,
        correctionPx: 0,
      };
    }

    const ratio = radiusPx / Math.max(distancePx, 0.000001);
    const normalizedPoint = {
      x: center.x + dx * ratio,
      y: center.y + dy * ratio,
    };
    return {
      point: normalizedPoint,
      corrected: true,
      correctionX: normalizedPoint.x - point.x,
      correctionY: normalizedPoint.y - point.y,
      correctionPx: distancePx - radiusPx,
    };
  }

  #findSegmentCircleBoundary({ from, to, center, radiusPx }) {
    const segmentX = to.x - from.x;
    const segmentY = to.y - from.y;
    const relativeX = from.x - center.x;
    const relativeY = from.y - center.y;
    const a = segmentX * segmentX + segmentY * segmentY;
    if (a <= 0.000001) return null;

    const b = 2 * (relativeX * segmentX + relativeY * segmentY);
    const c = relativeX * relativeX + relativeY * relativeY - radiusPx * radiusPx;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const sqrt = Math.sqrt(discriminant);
    const roots = [
      (-b - sqrt) / (2 * a),
      (-b + sqrt) / (2 * a),
    ].filter((value) => value >= -0.000001 && value <= 1.000001);
    if (!roots.length) return null;

    const t = Math.max(0, Math.min(1, Math.min(...roots)));
    return {
      x: from.x + segmentX * t,
      y: from.y + segmentY * t,
    };
  }

  #resolveRotationSign({ tangentX, direction, boundaryDx }) {
    const tangentDirection = Math.sign(tangentX);
    if (tangentDirection !== 0) {
      return tangentDirection === direction ? 1 : -1;
    }
    return Math.sign(boundaryDx) === direction ? 1 : -1;
  }

  #result(point, {
    mode,
    requestedMovePx = 0,
    appliedPathPx = 0,
    normalizedStart = null,
    correction = null,
  } = {}) {
    const start = normalizedStart || point;
    return {
      x: point.x,
      y: point.y,
      mode: mode || "none",
      requestedMovePx: Math.max(0, Number(requestedMovePx) || 0),
      appliedPathPx: Math.max(0, Number(appliedPathPx) || 0),
      normalizedStartX: Number(start.x) || 0,
      normalizedStartY: Number(start.y) || 0,
      constraintCorrectionApplied: correction?.corrected === true,
      constraintCorrectionX: Number(correction?.correctionX) || 0,
      constraintCorrectionY: Number(correction?.correctionY) || 0,
      constraintCorrectionPx: Math.max(
        0,
        Number(correction?.correctionPx) || 0,
      ),
    };
  }

  #distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  #point(value) {
    return {
      x: Number(value?.x) || 0,
      y: Number(value?.y) || 0,
    };
  }
}
