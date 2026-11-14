export class LineRadialMovementSplitter {
  #result = {
    velocityX: 0,
    velocityY: 0,
    freeTimeSec: 0,
    constrainedTimeSec: 0,
    crossedReleasedRadius: false,
  };

  resolveVelocity({
    position,
    rodTipPosition,
    freeVelocity,
    constrainedVelocity,
    releasedMeters,
    pixelsPerMeter,
    dtSec,
  } = {}) {
    const dt = Math.max(0, Number(dtSec) || 0);
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const radiusPx = Math.max(0, Number(releasedMeters) || 0) * scale;
    const current = this.#relativePoint(position, rodTipPosition);
    const free = this.#velocity(freeVelocity);
    const constrained = this.#velocity(constrainedVelocity);

    if (dt <= 0 || radiusPx <= 0) {
      return this.#frame(constrained, 0, dt, false);
    }

    const currentDistancePx = Math.hypot(current.x, current.y);
    if (currentDistancePx >= radiusPx - 0.001) {
      return this.#frame(constrained, 0, dt, false);
    }

    const crossingTimeSec = this.#findCrossingTime({
      current,
      velocity: free,
      radiusPx,
      dtSec: dt,
    });
    if (crossingTimeSec === null) {
      return this.#frame(free, dt, 0, false);
    }

    const constrainedTimeSec = Math.max(0, dt - crossingTimeSec);
    const averageVelocity = {
      x:
        (
          free.x * crossingTimeSec +
          constrained.x * constrainedTimeSec
        ) / dt,
      y:
        (
          free.y * crossingTimeSec +
          constrained.y * constrainedTimeSec
        ) / dt,
    };
    return this.#frame(
      averageVelocity,
      crossingTimeSec,
      constrainedTimeSec,
      true,
    );
  }

  #findCrossingTime({ current, velocity, radiusPx, dtSec }) {
    const a = velocity.x * velocity.x + velocity.y * velocity.y;
    if (a <= 0.000001) return null;

    const b = 2 * (current.x * velocity.x + current.y * velocity.y);
    const c =
      current.x * current.x +
      current.y * current.y -
      radiusPx * radiusPx;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const sqrt = Math.sqrt(discriminant);
    const denominator = 2 * a;
    const roots = [
      (-b - sqrt) / denominator,
      (-b + sqrt) / denominator,
    ];
    let crossingTimeSec = null;
    for (const root of roots) {
      if (root < 0 || root > dtSec) continue;
      if (crossingTimeSec === null || root < crossingTimeSec) {
        crossingTimeSec = root;
      }
    }
    return crossingTimeSec;
  }

  #relativePoint(position, rodTipPosition) {
    return {
      x:
        (Number(position?.x) || 0) -
        (Number(rodTipPosition?.x) || 0),
      y:
        (Number(position?.y) || 0) -
        (Number(rodTipPosition?.y) || 0),
    };
  }

  #velocity(value) {
    return {
      x: Number(value?.x ?? value?.velocityX) || 0,
      y: Number(value?.y ?? value?.velocityY) || 0,
    };
  }

  #frame(
    velocity,
    freeTimeSec,
    constrainedTimeSec,
    crossedReleasedRadius,
  ) {
    this.#result.velocityX = velocity.x;
    this.#result.velocityY = velocity.y;
    this.#result.freeTimeSec = freeTimeSec;
    this.#result.constrainedTimeSec = constrainedTimeSec;
    this.#result.crossedReleasedRadius = crossedReleasedRadius;
    return this.#result;
  }
}
