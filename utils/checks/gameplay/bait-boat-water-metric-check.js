"use strict";

// Spec 054 (G-007): the bait boat moves on the location's water metric. A boat on a perspective water (metres per
// pixel grow toward the far edge) moves, in ground metres, exactly like the same boat on a flat lake; a uniform metric
// leaves it bitwise unchanged; drops and sensor rays come back on the map.
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const runtime = new SourceRuntime();
const { WaterMetric } = runtime.importModule("src/game/domain/locations/water_metric.js");
const { BaitBoat } = runtime.importModule("src/game/application/chum/bait_boat.js");
const { BaitBoatGroundPlaneScope } = runtime.importModule("src/game/application/chum/bait_boat_ground_plane_scope.js");
const { Vector2 } = runtime.importModule("src/engine/math/vector2.js");

const STATS = {
  hasSonar: true, showSensors: true, manualControl: false, sections: 3, upgradeLevel: 1,
  statsByLevel: { 1: { speedPxPerSec: 150 } },
  maneuver: { reverseTimeSec: 0.8, reverseThrustMult: 0.8, maneuverTimeSec: 1.5, maneuverThrustMult: 0.3,
    maneuverSpeedMult: 0.4 },
  sensorRangeFactor: 1.5, turnSpeedRad: 2.5, avoidancePersistenceMs: 300, avoidanceThrustMultiplier: 0.5,
  acceleration: 800, slowRadius: 150, brakeForce: 0.5, finishRadiusTarget: 5, finishRadiusReturning: 30,
};
const ENV = { current: { speedPxPerSec: 5, direction: { x: 1, y: 0.1 } } };
const water = () => ({ depth: 2 });
const noCollision = () => false;

// A 40 m water painted over 800 map pixels (shore at y 800), and a flat 40 m lake whose map is its own plane.
const perspective = WaterMetric.illustrated({ pixelsPerMeter: 50, shoreY: 800, topY: 0, centerX: 1000, maxMeters: 40,
  farScale: .3, lateralContraction: true });
const flat = new WaterMetric({ pixelsPerMeter: 50, shoreY: 800, topY: -1200, centerX: 1000 });
assert.equal(flat.isUniform, true);

function checkFlatLakeEquivalence(perspective) {
  const startMap = perspective.fromBasePlane(1000, 790, new Vector2());
  const targetMap = perspective.fromBasePlane(1300, 800 - 25 * 50, new Vector2(0, 0));
  const onPerspective = new BaitBoat(startMap.x, startMap.y, STATS);
  const startPlane = perspective.toBasePlane(startMap.x, startMap.y, new Vector2(0, 0));
  const onFlat = new BaitBoat(startPlane.x, startPlane.y, STATS);
  onPerspective.setTarget(targetMap.x, targetMap.y, "zone");
  onFlat.setTarget(1300, 800 - 25 * 50, "zone");
  // A second drop while deploying is queued as a waypoint (ChumController).
  const secondMap = perspective.fromBasePlane(800, 800 - 15 * 50, new Vector2(0, 0));
  onPerspective.setTarget(secondMap.x, secondMap.y, "second");
  onFlat.setTarget(800, 800 - 15 * 50, "second");
  assert.equal(onPerspective.waypoints.length, 1);
  const scopeA = new BaitBoatGroundPlaneScope();
  const scopeB = new BaitBoatGroundPlaneScope();
  const step = (boat, scope, metric) => {
    const plane = scope.enter({ metric, boat, checkPhysics: water, checkSensor: noCollision, cellSize: 40 });
    try {
      boat.update(16, plane.checkPhysics, plane.checkSensor, plane.cellSize, ENV);
    } finally {
      scope.exit();
    }
  };
  const plane = new Vector2(0, 0);
  let worst = 0;
  let farthest = 0;
  let sawReturn = false;
  const nearSpeeds = [];
  const farSpeeds = [];
  for (let frame = 0; frame < 4000 && !(onPerspective.isFinished && onFlat.isFinished); frame += 1) {
    const before = perspective.toBasePlane(onPerspective.pos.x, onPerspective.pos.y, new Vector2(0, 0));
    step(onPerspective, scopeA, perspective);
    step(onFlat, scopeB, flat);
    perspective.toBasePlane(onPerspective.pos.x, onPerspective.pos.y, plane);
    worst = Math.max(worst, Math.hypot(plane.x - onFlat.pos.x, plane.y - onFlat.pos.y) / 50);
    farthest = Math.max(farthest, perspective.metersFromShore(onPerspective.pos.y));
    if (onPerspective.state === "returning") sawReturn = true;
    for (const boat of [onPerspective, onFlat]) {
      if (boat.isBaitDropped && boat.zoneId) Object.assign(boat, { isBaitDropped: false, zoneId: null }); // as ChumService
    }
    const metresPerSecond = Math.hypot(plane.x - before.x, plane.y - before.y) / 50 / 0.016;
    const metres = perspective.metersFromShore(onPerspective.pos.y);
    if (onPerspective.state === "deploying" && metres > 2 && metres < 6) nearSpeeds.push(metresPerSecond);
    if (onPerspective.state === "deploying" && metres > 18 && metres < 22) farSpeeds.push(metresPerSecond);
  }
  assert(farthest > 24, `the boat reaches the far water (${farthest.toFixed(2)} m)`);
  assert(sawReturn && onPerspective.isFinished && onFlat.isFinished, "both deliver and come back");
  assert(worst < 1e-6, `in ground metres the perspective boat moves like the flat-lake boat (worst ${worst} m)`);
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert(nearSpeeds.length > 5 && farSpeeds.length > 5);
  assert(Math.abs(mean(farSpeeds) - mean(nearSpeeds)) < 0.05 * mean(nearSpeeds),
    `cruise speed in metres is the same near and far (${mean(nearSpeeds).toFixed(2)} vs ${mean(farSpeeds).toFixed(2)} m/s)`);
  return { near: mean(nearSpeeds), far: mean(farSpeeds) };
}

function checkUniformIdentity() {
  const scope = new BaitBoatGroundPlaneScope();
  const plain = new BaitBoat(1000, 790, STATS);
  const scoped = new BaitBoat(1000, 790, STATS);
  plain.setTarget(1200, 300, "zone");
  scoped.setTarget(1200, 300, "zone");
  const objects = [scoped.pos, scoped.velocity, scoped.target, scoped.startPos];
  for (let frame = 0; frame < 300; frame += 1) {
    plain.update(16, water, noCollision, 40, ENV);
    const frameOut = scope.enter({ metric: flat, boat: scoped, checkPhysics: water, checkSensor: noCollision, cellSize: 40 });
    assert(frameOut.checkPhysics === water && frameOut.checkSensor === noCollision && frameOut.cellSize === 40,
      "a uniform metric hands out the original lookups and cell size");
    scoped.update(16, frameOut.checkPhysics, frameOut.checkSensor, frameOut.cellSize, ENV);
    scope.exit();
  }
  for (const key of ["pos", "velocity", "target", "startPos"]) {
    assert(Object.is(scoped[key].x, plain[key].x) && Object.is(scoped[key].y, plain[key].y), `${key} bitwise unchanged`);
  }
  assert(Object.is(scoped.angle, plain.angle), "heading bitwise unchanged");
  assert.deepEqual(scoped.sensorRays, plain.sensorRays, "rays unchanged");
  assert.deepEqual([scoped.pos, scoped.velocity, scoped.target, scoped.startPos], objects, "same objects");
  assert.equal(scope.enter({ metric: null, boat: scoped, checkPhysics: water, checkSensor: noCollision, cellSize: 40 })
    .checkPhysics, water, "no metric: the originals");
  scope.exit();
}

function checkMapOutput() {
  const scope = new BaitBoatGroundPlaneScope();
  const boat = new BaitBoat(1000, 790, STATS);
  boat.setTarget(1100, 200, "zone");
  boat.waypoints.push({ x: 900, y: 250, zoneId: "next" });
  boat.avoidanceTargetAngle = -Math.PI / 3; // a held diagonal avoidance heading (open water writes none)
  const before = new Vector2(0, 0);
  const planeVelocity = new Vector2(0, 0);
  let planeAngles = [];
  for (let frame = 0; frame < 2000 && boat.pos.y > 300; frame += 1) { // into the far water, short of the target
    before.set(boat.pos.x, boat.pos.y);
    const plane = scope.enter({ metric: perspective, boat, checkPhysics: water, checkSensor: noCollision, cellSize: 40 });
    boat.update(16, plane.checkPhysics, plane.checkSensor, plane.cellSize, ENV);
    planeVelocity.set(boat.velocity.x, boat.velocity.y);
    planeAngles = [boat.angle, boat.avoidanceTargetAngle];
    scope.exit();
  }
  // The renderer rotates the sprite by the heading on the map: velocity and headings come back as map directions.
  const mapVelocity = perspective.velocityFromBasePlane(boat.pos.x, boat.pos.y, planeVelocity.x, planeVelocity.y,
    new Vector2(0, 0));
  near(boat.velocity.x, mapVelocity.x, 1e-9, "the velocity is a map velocity");
  near(boat.velocity.y, mapVelocity.y, 1e-9);
  assert(Math.abs(mapVelocity.y - planeVelocity.y) > 0.2 * Math.abs(planeVelocity.y), "far water: map and plane differ");
  for (const [index, key] of ["angle", "avoidanceTargetAngle"].entries()) {
    const heading = perspective.velocityFromBasePlane(boat.pos.x, boat.pos.y, Math.cos(planeAngles[index]),
      Math.sin(planeAngles[index]), new Vector2(0, 0));
    near(Math.sin(boat[key] - Math.atan2(heading.y, heading.x)), 0, 1e-9, `${key} is a map heading`);
  }
  // The boat syncs its rays before it moves, so they start where it was at the start of the frame.
  const [ray] = boat.sensorRays;
  near(ray.startX, before.x, 1e-9, "a ray starts at the boat on the map");
  near(ray.startY, before.y, 1e-9);
  assert.deepEqual([boat.target.x, boat.target.y].map((value) => Math.round(value * 1e6) / 1e6), [1100, 200],
    "the target is back on the map");
  near(boat.waypoints[0].x, 900, 1e-9, "a queued waypoint is back on the map");
  near(boat.waypoints[0].y, 250, 1e-9);
  near(boat.startPos.y, 790, 1e-9, "the shore start is back on the map");
  // An idle boat (no update writes its rays) keeps its rays through enter and exit.
  const idle = new BaitBoat(1000, 790, STATS);
  const rays = JSON.stringify(idle.sensorRays);
  scope.enter({ metric: perspective, boat: idle, checkPhysics: water, checkSensor: noCollision, cellSize: 40 });
  idle.update(16, water, noCollision, 40, ENV);
  scope.exit();
  // Array.from: an array of this realm (the boat's own arrays come from the source runtime's realm).
  const after = Array.from(idle.sensorRays, (entry) => Object.values(entry).map((value) => typeof value === "number"
    ? Math.round(value * 1e6) / 1e6 + 0 : value)); // + 0: no -0 from a rounded round-trip residue
  assert.deepEqual(after, JSON.parse(rays).map((entry) => Object.values(entry)), "idle rays survive the round trip");
}

function near(actual, expected, tolerance, label = "") {
  assert(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
}

const speeds = checkFlatLakeEquivalence(perspective);
for (const lateralContraction of [false, true]) for (const tiltDegrees of [1, 30, 45, 90]) {
  checkFlatLakeEquivalence(WaterMetric.illustrated({ pixelsPerMeter: 50, shoreY: 800, topY: 0, centerX: 1000,
    maxMeters: 40, tiltDegrees, farScale: .3, lateralContraction }));
}
checkUniformIdentity();
checkMapOutput();
console.log(`Bait boat water metric passed: on a 40 m perspective water the boat moves in ground metres exactly like on `
  + `a flat lake there and back (cruise ${speeds.near.toFixed(2)} m/s near, ${speeds.far.toFixed(2)} m/s far), a uniform `
  + "metric leaves it bitwise unchanged, and its velocity, headings, target, waypoints, start and sensor rays come back on "
  + "the map.");
