import { Vector2 } from "../../../engine/math/vector2.js";

// Presents one fight step with the hooked tackle, the water bounds, the water lookup and the rod positions on the
// ground plane of the water metric (base pixels: ground metres x pixelsPerMeter). Every fight stage then measures
// the line, distances and speeds in ground metres, wherever the fish is on the painted water.
//
// The tackle facade owns the plane position and velocity during the step (stages mutate them in place, as they did
// the tackle's own vectors); the tackle's virtual vectors are written back around its movement and in end().
// A uniform metric maps the plane 1:1, so begin() hands the step the original objects and nothing is converted.
export class FightGroundPlane {
  #metric = null;
  #tackle = null;
  #checkWater = null;
  #virtualBounds = null;
  #position = new Vector2(0, 0);
  #velocity = new Vector2(0, 0);
  #virtualScratch = new Vector2(0, 0);
  #targetVelocity = new Vector2(0, 0);
  #bounds = { left: 0, right: 0, top: 0, bottom: 0 };
  #rodTipPosition = new Vector2(0, 0);
  #actualRodTipPosition = new Vector2(0, 0);
  #rodControlCastAnchor = new Vector2(0, 0);
  #frame = {
    floatEntity: null,
    bounds: null,
    checkWater: null,
    rodTipPosition: null,
    actualRodTipPosition: null,
    rodControlCastAnchor: null,
  };
  #planeCheckWater = (baseX, baseY) => {
    this.#metric.fromBasePlane(baseX, baseY, this.#virtualScratch);
    return this.#checkWater(this.#virtualScratch.x, this.#virtualScratch.y);
  };
  #facade = {
    getPosition: () => this.#position,
    getVelocity: () => this.#velocity,
    applyHookedFightMovement: (options) => this.#applyHookedFightMovement(options),
  };

  begin({ metric, floatEntity, bounds, checkWater, rodTipPosition, actualRodTipPosition, rodControlCastAnchor }) {
    const frame = this.#frame;
    if (metric.isUniform) {
      this.#metric = null;
      frame.floatEntity = floatEntity;
      frame.bounds = bounds;
      frame.checkWater = checkWater;
      frame.rodTipPosition = rodTipPosition;
      frame.actualRodTipPosition = actualRodTipPosition;
      frame.rodControlCastAnchor = rodControlCastAnchor;
      return frame;
    }
    this.#metric = metric;
    this.#tackle = floatEntity;
    this.#checkWater = checkWater;
    this.#virtualBounds = bounds;
    this.#readTackle();
    this.#writePlaneBounds(bounds);
    frame.floatEntity = this.#facade;
    frame.bounds = this.#bounds;
    frame.checkWater = checkWater ? this.#planeCheckWater : checkWater;
    frame.rodTipPosition = this.#toPlane(rodTipPosition, this.#rodTipPosition);
    frame.actualRodTipPosition = this.#toPlane(actualRodTipPosition, this.#actualRodTipPosition);
    frame.rodControlCastAnchor = this.#toPlane(rodControlCastAnchor, this.#rodControlCastAnchor);
    return frame;
  }

  end() {
    if (this.#metric === null) return;
    this.#writeTackle();
    this.#metric = null;
    this.#tackle = null;
    this.#checkWater = null;
    this.#virtualBounds = null;
  }

  // The tackle moves on the painted water: it gets the virtual velocity that carries it over its own step exactly to
  // the plane point position + velocity x step, moves and clamps against the virtual bounds and water, and the plane
  // vectors are read back. Unless the water stopped it, the plane velocity stays the requested one.
  #applyHookedFightMovement({ dt, environment, input, pullDirection, targetVelocity }) {
    this.#writeTackle();
    const tackle = this.#tackle;
    const position = tackle.getPosition();
    const baseTargetX = Number(targetVelocity?.x) || 0;
    const baseTargetY = Number(targetVelocity?.y) || 0;
    const stepSeconds = tackle.getStepSeconds(dt);
    const virtualTarget = this.#targetVelocity;
    if (stepSeconds > 0) {
      this.#metric.fromBasePlane(
        this.#position.x + baseTargetX * stepSeconds,
        this.#position.y + baseTargetY * stepSeconds,
        virtualTarget,
      );
      virtualTarget.x = (virtualTarget.x - position.x) / stepSeconds;
      virtualTarget.y = (virtualTarget.y - position.y) / stepSeconds;
    } else {
      this.#metric.velocityFromBasePlane(position.x, position.y, baseTargetX, baseTargetY, virtualTarget);
    }
    const virtualTargetX = virtualTarget.x;
    const virtualTargetY = virtualTarget.y;
    const movementFrame = tackle.applyHookedFightMovement({
      boundsRect: this.#virtualBounds,
      dt,
      environment,
      checkWater: this.#checkWater,
      input,
      pullDirection,
      targetVelocity: virtualTarget,
    });
    this.#readTackle();
    const velocity = tackle.getVelocity();
    if (velocity.x === virtualTargetX) this.#velocity.x = baseTargetX;
    if (velocity.y === virtualTargetY) this.#velocity.y = baseTargetY;
    movementFrame.targetSpeedPxPerSec = Math.hypot(baseTargetX, baseTargetY);
    return movementFrame;
  }

  #readTackle() {
    const position = this.#tackle.getPosition();
    const velocity = this.#tackle.getVelocity();
    this.#metric.velocityToBasePlane(position.x, position.y, velocity.x, velocity.y, this.#velocity);
    this.#metric.toBasePlane(position.x, position.y, this.#position);
  }

  #writeTackle() {
    const position = this.#tackle.getPosition();
    const velocity = this.#tackle.getVelocity();
    this.#metric.fromBasePlane(this.#position.x, this.#position.y, position);
    this.#metric.velocityFromBasePlane(position.x, position.y, this.#velocity.x, this.#velocity.y, velocity);
  }

  // The plane rectangle around the virtual water rectangle: far water is wider on the ground, so the side edges come
  // from the far corners. The water lookup still decides which plane points are water.
  #writePlaneBounds(bounds) {
    const metric = this.#metric;
    const scratch = this.#virtualScratch;
    metric.toBasePlane(bounds.left, bounds.top, scratch);
    const farLeft = scratch.x;
    this.#bounds.top = scratch.y;
    metric.toBasePlane(bounds.right, bounds.top, scratch);
    const farRight = scratch.x;
    metric.toBasePlane(bounds.left, bounds.bottom, scratch);
    this.#bounds.left = Math.min(farLeft, scratch.x);
    this.#bounds.bottom = scratch.y;
    metric.toBasePlane(bounds.right, bounds.bottom, scratch);
    this.#bounds.right = Math.max(farRight, scratch.x);
  }

  #toPlane(point, target) {
    if (!point) return point;
    return this.#metric.toBasePlane(point.x, point.y, target);
  }
}
