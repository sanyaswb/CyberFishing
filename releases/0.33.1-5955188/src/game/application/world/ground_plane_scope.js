import { Vector2 } from "../../../engine/math/vector2.js";

// Runs a water entity update on the ground plane of the location's water metric (base pixels: ground metres x
// pixelsPerMeter along and away from the shore). enter() converts the entity's own position and velocity in place
// and hands out plane bounds, a plane water lookup and plane points; exit() converts the entity back to the map.
// In between, every pixel distance, speed and pixelsPerMeter conversion of the update means ground metres, wherever
// the entity is on the painted water. A uniform metric maps the plane 1:1, so nothing is converted and the original
// bounds, lookup and points are handed out.
export class GroundPlaneScope {
  #metric = null;
  #entity = null;
  #checkWater = null;
  #virtualScratch = new Vector2(0, 0);
  #points = [new Vector2(0, 0), new Vector2(0, 0), new Vector2(0, 0)];
  #bounds = { left: 0, right: 0, top: 0, bottom: 0 };
  #frame = { bounds: null, checkWater: null };
  #planeCheckWater = (baseX, baseY) => {
    this.#metric.fromBasePlane(baseX, baseY, this.#virtualScratch);
    return this.#checkWater(this.#virtualScratch.x, this.#virtualScratch.y);
  };

  enter({ metric, entity, bounds, checkWater }) {
    const frame = this.#frame;
    if (metric.isUniform) {
      this.#metric = null;
      frame.bounds = bounds;
      frame.checkWater = checkWater;
      return frame;
    }
    this.#metric = metric;
    this.#entity = entity;
    this.#checkWater = checkWater;
    const position = entity.getPosition();
    const velocity = entity.getVelocity();
    metric.velocityToBasePlane(position.x, position.y, velocity.x, velocity.y, velocity);
    metric.toBasePlane(position.x, position.y, position);
    frame.bounds = bounds ? this.#writePlaneBounds(bounds) : bounds;
    frame.checkWater = checkWater ? this.#planeCheckWater : checkWater;
    return frame;
  }

  // A map point on the plane for this scope (slot 0..2 keeps up to three points apart).
  point(slot, point) {
    if (this.#metric === null || !point) return point;
    return this.#metric.toBasePlane(point.x, point.y, this.#points[slot]);
  }

  exit() {
    const metric = this.#metric;
    if (metric === null) return;
    const position = this.#entity.getPosition();
    const velocity = this.#entity.getVelocity();
    metric.fromBasePlane(position.x, position.y, position);
    metric.velocityFromBasePlane(position.x, position.y, velocity.x, velocity.y, velocity);
    this.#metric = null;
    this.#entity = null;
    this.#checkWater = null;
  }

  // The plane rectangle around the map's water rectangle: far water is wider on the ground, so the side edges come
  // from the far corners. The water lookup still decides which plane points are water.
  #writePlaneBounds(bounds) {
    const metric = this.#metric;
    const scratch = this.#virtualScratch;
    const planeBounds = this.#bounds;
    metric.toBasePlane(bounds.left, bounds.top, scratch);
    const farLeft = scratch.x;
    planeBounds.top = scratch.y;
    metric.toBasePlane(bounds.right, bounds.top, scratch);
    const farRight = scratch.x;
    metric.toBasePlane(bounds.left, bounds.bottom, scratch);
    planeBounds.left = Math.min(farLeft, scratch.x);
    planeBounds.bottom = scratch.y;
    metric.toBasePlane(bounds.right, bounds.bottom, scratch);
    planeBounds.right = Math.max(farRight, scratch.x);
    return planeBounds;
  }
}
