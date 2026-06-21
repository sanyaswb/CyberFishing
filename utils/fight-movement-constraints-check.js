const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/fishing/rod_control_movement_projector.js",
  "src/core/fishing/pole_fight_sector_geometry.js",
  "src/core/fishing/pole_fight_sector_constraint.js",
  "src/core/fishing/line_constraint_state_resolver.js",
  "src/core/fishing/fish_boundary_steering_policy.js",
  "src/systems/player_pull_motion_smoother.js",
];
const context = vm.createContext({ console, Math, Number, Object });
for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(`
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function approx(actual, expected, epsilon, message) {
  assert(Math.abs(actual - expected) <= epsilon, message + " (" + actual + ")");
}

const projector = new RodControlMovementProjector();
const locked = {
  radialConstraintActive: true,
  lockedLengthMeters: 6,
};
const rod = { x: 0, y: 0 };
const outside = { x: -295.8, y: 68.3 };
const originalDistance = Math.hypot(outside.x, outside.y);
assert(originalDistance > 300, "test starts slightly outside the 6 m radius");

const right = projector.resolveNextPoint({
  position: outside,
  rodTipPosition: rod,
  directionX: 1,
  deltaMeters: 0.02,
  pixelsPerMeter: 50,
  lineConstraintState: locked,
});
assert(right.constraintCorrectionApplied, "outside start is normalized before Rod Control");
assert(right.constraintCorrectionPx < 10, "normalization is a local correction, not a cross-circle jump");
assert(right.appliedPathPx <= right.requestedMovePx + 0.000001, "right control never applies more path than requested");
assert(right.x < 0, "right control from the left side cannot teleport to the opposite half of the circle");
approx(Math.hypot(right.x, right.y), 300, 1.1, "right control remains inside the locked radius");

const left = projector.resolveNextPoint({
  position: outside,
  rodTipPosition: rod,
  directionX: -1,
  deltaMeters: 0.02,
  pixelsPerMeter: 50,
  lineConstraintState: locked,
});
assert(left.appliedPathPx <= left.requestedMovePx + 0.000001, "left control never applies more path than requested");
assert(left.x < 0, "left control from the left side cannot teleport through the circle");
approx(Math.hypot(left.x, left.y), 300, 0.000001, "outward left control follows the locked arc");

const sector = new PoleFightSectorConstraint();
const origin = { x: 0, y: 0 };
const pointAt = (angleDeg, radius) => {
  const angle = angleDeg * Math.PI / 180;
  return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius };
};
const from = pointAt(58, 300);
const proposed = pointAt(70, 300);
const sectorFrame = sector.resolveMovement({
  fromPosition: from,
  proposedPosition: proposed,
  origin,
  config: { enabled: true, maxAngleFromCenterDeg: 60 },
  limitRadiusPx: 300,
});
assert(sectorFrame.clamped, "sector clips movement that crosses its boundary");
assert(
  Math.hypot(sectorFrame.positionX - from.x, sectorFrame.positionY - from.y) <=
    Math.hypot(proposed.x - from.x, proposed.y - from.y) + 0.000001,
  "sector clipping never adds displacement",
);

const steering = new FishBoundarySteeringPolicy();
const steeringFrame = steering.resolveVelocity({
  position: { x: 0, y: -300 },
  rodTipPosition: origin,
  freeVelocity: { x: 0, y: -80 },
  constrainedVelocity: { velocityX: 0, velocityY: 0 },
  radialConstraintActive: true,
  sectorConfig: { enabled: true, maxAngleFromCenterDeg: 60 },
  dtSec: 1 / 60,
});
assert(steeringFrame.active, "outward center deadlock receives a tangent fallback");
assert(Math.abs(steeringFrame.velocityX) > 1, "tangent fallback produces lateral movement");
approx(steeringFrame.velocityY, 0, 0.000001, "tangent fallback removes outward radial movement");
const existingTangent = steering.resolveVelocity({
  position: { x: 0, y: -300 },
  rodTipPosition: origin,
  freeVelocity: { x: 30, y: -80 },
  constrainedVelocity: { velocityX: 30, velocityY: 0 },
  radialConstraintActive: true,
  sectorConfig: { enabled: true, maxAngleFromCenterDeg: 60 },
  dtSec: 1 / 60,
});
assert(!existingTangent.active, "boundary steering preserves an existing constrained tangent velocity");
approx(existingTangent.velocityX, 30, 0.000001, "existing tangent X is preserved");

const constraintResolver = new LineConstraintStateResolver();
const dragHoldingConstraint = constraintResolver.resolve({
  lineState: {
    releasedMeters: 6,
    distanceMeters: 6,
    remainingMeters: 8,
    canReleaseLine: true,
  },
  payoutContext: {
    dragCanPayout: false,
    dragPayoutBlocked: true,
    reason: "drag_holding",
  },
  config: { tautThresholdRatio: 0.995, epsilonMeters: 0.001 },
});
assert(dragHoldingConstraint.radialConstraintActive, "drag holding locks taut radial fish motion even with line reserve");
assert(dragHoldingConstraint.lineLengthLocked, "drag holding reports locked line length");
assert(dragHoldingConstraint.reason === "drag_holding", "drag holding is the shared constraint reason");
const dragHoldingFallback = steering.resolveVelocity({
  position: { x: 0, y: -300 },
  rodTipPosition: origin,
  freeVelocity: { x: 0, y: -80 },
  constrainedVelocity: { velocityX: 0, velocityY: 0 },
  radialConstraintActive: dragHoldingConstraint.radialConstraintActive,
  sectorConfig: { enabled: true, maxAngleFromCenterDeg: 60 },
  dtSec: 1 / 60,
});
assert(dragHoldingFallback.active, "drag-held outward deadlock receives tangent fallback from raw fish intent");
approx(dragHoldingFallback.velocityY, 0, 0.000001, "drag-held fallback removes outward radial velocity");

const smoother = new PlayerPullMotionSmoother();
const first = smoother.updateAxis({
  axis: "x",
  desiredMove: 0.1,
  deltaTime: 0.1,
  config: { inertiaSeconds: 0.2 },
});
assert(first.move > 0, "smoother accumulates control velocity");
smoother.reconcileAxis({
  axis: "x",
  appliedMove: 0,
  deltaTime: 0.1,
  blocked: true,
});
const afterBlock = smoother.updateAxis({
  axis: "x",
  desiredMove: 0,
  deltaTime: 0.1,
  config: { inertiaSeconds: 0.2 },
});
approx(afterBlock.move, 0, 0.000001, "constraint feedback removes stored blocked X motion");

console.log("fight-movement-constraints-check passed:");
for (const message of checks) console.log("- " + message);
`, context, { filename: "utils/fight-movement-constraints-check.js#scenario" });
