const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/fishing/rod_control_movement_projector.js",
  "src/core/fishing/pole_fight_sector_geometry.js",
  "src/core/fishing/pole_fight_sector_constraint.js",
  "src/core/fishing/line_constraint_state_resolver.js",
  "src/core/fishing/line_constrained_fish_motion_resolver.js",
  "src/core/fishing/line_radial_movement_splitter.js",
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

const motionResolver = new LineConstrainedFishMotionResolver();
const lineConstraintState = Object.freeze({
  radialConstraintActive: true,
  reason: "drag_holding",
});
const topPosition = { x: 0, y: -300 };

const pureOutward = motionResolver.resolve({
  position: topPosition,
  rodTipPosition: origin,
  rawVelocity: { x: 0, y: -80 },
  lineConstraintState,
  dtSec: 1 / 60,
});
assert(pureOutward.active, "pure outward velocity activates radial projection");
assert(pureOutward.reason === "radial_outward_projected", "pure outward projection reports its reason");
approx(pureOutward.velocityX, 0, 0.000001, "pure outward projection has no X movement");
approx(pureOutward.velocityY, 0, 0.000001, "pure outward projection has no Y movement");
approx(pureOutward.allowedTangentSpeedPxPerSec, 0, 0.000001, "pure outward projection does not invent tangent speed");

const outwardLeft = motionResolver.resolve({
  position: topPosition,
  rodTipPosition: origin,
  rawVelocity: { x: -30, y: -80 },
  lineConstraintState,
  dtSec: 1 / 60,
});
approx(outwardLeft.velocityX, -30, 0.000001, "outward-left preserves left tangent velocity");
approx(outwardLeft.velocityY, 0, 0.000001, "outward-left removes only outward radial velocity");
approx(outwardLeft.blockedRadialSpeedPxPerSec, 80, 0.000001, "outward-left reports blocked radial speed");
approx(outwardLeft.allowedTangentSpeedPxPerSec, 30, 0.000001, "outward-left reports preserved tangent speed");

const radialSplitter = new LineRadialMovementSplitter();
const projectedSplit = radialSplitter.resolveVelocity({
  position: topPosition,
  rodTipPosition: origin,
  freeVelocity: { x: -30, y: -80 },
  constrainedVelocity: outwardLeft,
  releasedMeters: 6,
  pixelsPerMeter: 50,
  dtSec: 1 / 60,
});
approx(projectedSplit.velocityX, -30, 0.000001, "splitter preserves projected tangent velocityX");
approx(projectedSplit.velocityY, 0, 0.000001, "splitter preserves projected tangent velocityY");

const outwardRight = motionResolver.resolve({
  position: topPosition,
  rodTipPosition: origin,
  rawVelocity: { x: 24, y: -80 },
  lineConstraintState,
  dtSec: 1 / 60,
});
approx(outwardRight.velocityX, 24, 0.000001, "outward-right preserves right tangent velocity");
approx(outwardRight.velocityY, 0, 0.000001, "outward-right removes only outward radial velocity");

const pureLateral = motionResolver.resolve({
  position: topPosition,
  rodTipPosition: origin,
  rawVelocity: { x: 42, y: 0 },
  lineConstraintState,
  dtSec: 1 / 60,
});
assert(!pureLateral.active, "pure lateral velocity needs no projection");
assert(pureLateral.reason === "allowed_inward_or_tangent", "pure lateral velocity reports allowed movement");
approx(pureLateral.velocityX, 42, 0.000001, "pure lateral X is unchanged");
approx(pureLateral.velocityY, 0, 0.000001, "pure lateral Y is unchanged");

const inward = motionResolver.resolve({
  position: topPosition,
  rodTipPosition: origin,
  rawVelocity: { x: 0, y: 55 },
  lineConstraintState,
  dtSec: 1 / 60,
});
assert(!inward.active, "inward velocity needs no projection");
assert(inward.reason === "allowed_inward_or_tangent", "inward velocity reports allowed movement");
approx(inward.velocityX, 0, 0.000001, "inward X is unchanged");
approx(inward.velocityY, 55, 0.000001, "inward Y is unchanged");

const freeLine = motionResolver.resolve({
  position: topPosition,
  rodTipPosition: origin,
  rawVelocity: { x: 12, y: -80 },
  lineConstraintState: { radialConstraintActive: false },
  dtSec: 1 / 60,
});
assert(!freeLine.active, "inactive radial constraint leaves movement free");
assert(freeLine.reason === "free", "inactive radial constraint reports free movement");
approx(freeLine.velocityX, 12, 0.000001, "free movement keeps X velocity");
approx(freeLine.velocityY, -80, 0.000001, "free movement keeps Y velocity");

const legacyReasons = [
  pureOutward.reason,
  outwardLeft.reason,
  outwardRight.reason,
  pureLateral.reason,
  inward.reason,
];
assert(!legacyReasons.includes("top_boundary_lateral_escape"), "projection resolver never reports top-boundary lateral escape");
assert(!legacyReasons.includes("outward_deadlock_tangent"), "projection resolver never reports outward deadlock tangent");

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

const dragHeldOutward = motionResolver.resolve({
  position: topPosition,
  rodTipPosition: origin,
  rawVelocity: { x: 0, y: -80 },
  lineConstraintState: dragHoldingConstraint,
  dtSec: 1 / 60,
});
approx(dragHeldOutward.velocityX, 0, 0.000001, "drag-held pure outward receives no fallback X movement");
approx(dragHeldOutward.velocityY, 0, 0.000001, "drag-held pure outward receives no fallback Y movement");

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
