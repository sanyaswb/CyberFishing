import { Vector2 } from "../../../engine/math/vector2.js";

// Runs a bait boat update on the ground plane of the location's water metric (spec 054, G-007), like GroundPlaneScope
// does for the tackle: enter() converts the boat's own spatial state in place (headings and velocity at its map
// position first, then its points) and hands out plane lookups and the plane size of a map cell at the boat; exit()
// converts everything back in the reverse order. In between, the boat's speeds, acceleration, braking and turning
// distances, arrival radii and current drift are ground metres x pixelsPerMeter wherever it is on the water, so far
// away it covers fewer map pixels per second. A uniform metric converts nothing and hands out the originals.
export class BaitBoatGroundPlaneScope {
  #metric = null;
  #boat = null;
  #checkPhysics = null;
  #checkSensor = null;
  #scratch = new Vector2(0, 0);
  #heading = new Vector2(0, 0);
  #frame = { checkPhysics: null, checkSensor: null, cellSize: 0 };
  #planePhysics = (baseX, baseY) => {
    this.#metric.fromBasePlane(baseX, baseY, this.#scratch);
    return this.#checkPhysics(this.#scratch.x, this.#scratch.y);
  };
  #planeSensor = (baseX, baseY) => {
    this.#metric.fromBasePlane(baseX, baseY, this.#scratch);
    return this.#checkSensor(this.#scratch.x, this.#scratch.y);
  };
  #toPlane = (x, y, out) => this.#metric.toBasePlane(x, y, out);
  #toMap = (x, y, out) => this.#metric.fromBasePlane(x, y, out);

  enter({ metric, boat, checkPhysics, checkSensor, cellSize }) {
    const frame = this.#frame;
    if (!metric || metric.isUniform) {
      this.#metric = null;
      frame.checkPhysics = checkPhysics;
      frame.checkSensor = checkSensor;
      frame.cellSize = cellSize;
      return frame;
    }
    this.#metric = metric;
    this.#boat = boat;
    this.#checkPhysics = checkPhysics;
    this.#checkSensor = checkSensor;
    const position = boat.pos;
    // Sensors look for collision cells, which are map cells: far away one spans more ground (spec 054 decision).
    frame.cellSize = (cellSize / metric.pixelsPerMeterY(position.y)) * metric.pixelsPerMeter;
    this.#convertDirections(boat, position, true);
    metric.toBasePlane(position.x, position.y, position);
    this.#convertPoints(boat, this.#toPlane);
    frame.checkPhysics = checkPhysics ? this.#planePhysics : checkPhysics;
    frame.checkSensor = checkSensor ? this.#planeSensor : checkSensor;
    return frame;
  }

  exit() {
    const metric = this.#metric;
    if (metric === null) return;
    const boat = this.#boat;
    const position = boat.pos;
    metric.fromBasePlane(position.x, position.y, position);
    this.#convertDirections(boat, position, false);
    this.#convertPoints(boat, this.#toMap);
    this.#metric = null;
    this.#boat = null;
    this.#checkPhysics = null;
    this.#checkSensor = null;
  }

  // Velocity and both headings at the boat's map position (the exact derivative of the plane mapping).
  #convertDirections(boat, position, toPlane) {
    this.#direction(boat.velocity.x, boat.velocity.y, position, toPlane, boat.velocity);
    const heading = this.#heading;
    this.#direction(Math.cos(boat.angle), Math.sin(boat.angle), position, toPlane, heading);
    boat.angle = Math.atan2(heading.y, heading.x);
    this.#direction(Math.cos(boat.avoidanceTargetAngle), Math.sin(boat.avoidanceTargetAngle), position, toPlane,
      heading);
    boat.avoidanceTargetAngle = Math.atan2(heading.y, heading.x);
  }

  #direction(vx, vy, position, toPlane, out) {
    if (toPlane) return this.#metric.velocityToBasePlane(position.x, position.y, vx, vy, out);
    return this.#metric.velocityFromBasePlane(position.x, position.y, vx, vy, out);
  }

  // The boat's other points: start (the shore it returns to), target, queued waypoints and its sensor rays. Rays are
  // converted both ways too, so rays the update did not rewrite (an idle boat) come back unchanged.
  #convertPoints(boat, map) {
    const scratch = this.#scratch;
    map(boat.startPos.x, boat.startPos.y, boat.startPos);
    if (boat.target) map(boat.target.x, boat.target.y, boat.target);
    for (let index = 0; index < boat.waypoints.length; index += 1) {
      const waypoint = boat.waypoints[index];
      map(waypoint.x, waypoint.y, scratch);
      waypoint.x = scratch.x;
      waypoint.y = scratch.y;
    }
    boat.mapSensorRays(map);
  }
}
