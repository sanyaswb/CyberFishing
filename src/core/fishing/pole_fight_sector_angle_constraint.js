class PoleFightSectorAngleConstraint {
  #constraint;

  constructor({ constraint = null, geometry = null } = {}) {
    this.#constraint = constraint || (
      typeof PoleFightSectorConstraint !== "undefined"
        ? new PoleFightSectorConstraint({ geometry })
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
    if (!this.#constraint?.resolveMovement) {
      return {
        active: false,
        clamped: false,
        positionX: Number(proposedPosition?.x) || 0,
        positionY: Number(proposedPosition?.y) || 0,
        enforceRadius: false,
      };
    }

    return this.#constraint.resolveMovement({
      fromPosition,
      proposedPosition,
      velocity,
      origin,
      config,
      limitRadiusPx,
      pixelsPerMeter,
      geometryFrame,
      enforceRadius: false,
    });
  }

  reset() {
    this.#constraint?.reset?.();
  }
}
