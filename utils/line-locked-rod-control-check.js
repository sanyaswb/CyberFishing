const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/line/line_spool_state.js",
  "src/core/fishing/line_constraint_state_resolver.js",
  "src/core/fishing/rod_control_movement_projector.js",
  "src/systems/line_system.js",
];
const context = vm.createContext({ console, Math, Number, Object });

for (const file of FILES) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, file), "utf8"),
    context,
    { filename: file },
  );
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

const resolver = new LineConstraintStateResolver();
const projector = new RodControlMovementProjector();
const lockedDrag = resolver.resolve({
  lineState: {
    releasedMeters: 5,
    distanceMeters: 5,
    remainingMeters: 5,
    canReleaseLine: true,
  },
  payoutContext: {
    dragCanPayout: false,
    dragPayoutBlocked: true,
    reason: "drag_holding",
  },
});
assert(!lockedDrag.dragCanPayout, "Drag below threshold cannot pay out line");
assert(lockedDrag.lineLengthLocked, "Drag holding locks released line length");
assert(lockedDrag.radialConstraintActive, "Taut locked line activates radial constraint");
assert(lockedDrag.reason === "drag_holding", "Resolver preserves prepared drag-holding reason");

const arcPoint = projector.resolveNextPoint({
  position: { x: 0, y: 250 },
  rodTipPosition: { x: 0, y: 0 },
  directionX: 1,
  deltaMeters: 0.5,
  pixelsPerMeter: 50,
  lineConstraintState: lockedDrag,
});
assert(arcPoint.mode === "locked_arc", "Locked taut movement uses arc projection");
approx(
  Math.hypot(arcPoint.x, arcPoint.y) / 50,
  lockedDrag.lockedLengthMeters,
  0.000001,
  "Arc movement preserves locked line radius",
);

const slippingDrag = resolver.resolve({
  lineState: {
    releasedMeters: 5,
    distanceMeters: 5,
    remainingMeters: 5,
    canReleaseLine: true,
  },
  payoutContext: {
    dragCanPayout: true,
    dragPayoutBlocked: false,
    reason: "none",
  },
});
assert(slippingDrag.dragCanPayout, "Fish force above drag threshold allows payout");
assert(!slippingDrag.lineLengthLocked, "Active drag payout unlocks line length");
assert(
  projector.resolveNextPoint({
    position: { x: 0, y: 250 },
    rodTipPosition: { x: 0, y: 0 },
    directionX: 1,
    deltaMeters: 0.5,
    pixelsPerMeter: 50,
    lineConstraintState: slippingDrag,
  }).mode === "free_x",
  "Unlocked line keeps normal X movement",
);

const emptySpool = resolver.resolve({
  lineState: {
    releasedMeters: 5,
    distanceMeters: 5,
    remainingMeters: 0,
    canReleaseLine: false,
  },
  payoutContext: {
    dragCanPayout: false,
    dragPayoutBlocked: false,
    reason: "spool_empty",
  },
});
assert(emptySpool.hardLineLimit, "Empty spool at taut radius is a hard line limit");
assert(emptySpool.radialConstraintActive, "Empty spool keeps lateral movement on arc");
assert(emptySpool.reason === "spool_empty", "Resolver reports hard-limit reason without drag calculations");

const slackLocked = resolver.resolve({
  lineState: {
    releasedMeters: 5,
    distanceMeters: 3,
    remainingMeters: 5,
    canReleaseLine: true,
  },
  payoutContext: {
    dragCanPayout: false,
    dragPayoutBlocked: true,
    reason: "drag_holding",
  },
});
assert(slackLocked.lineLengthLocked, "Drag can lock released length while line is slack");
assert(!slackLocked.radialConstraintActive, "Slack line does not activate radial projection");

function createLineSystem(lengthMeters) {
  return new LineSystem({
    rod: {},
    reel: { hasReel: () => true },
    config: { line: {} },
    lineStats: { lengthMeters, maxLoadKg: 1, durability: 100 },
    castDistanceCalculator: {
      pixelsPerMeter: 50,
      getLineReachModel: () => ({
        baseReachMeters: 0,
        lineLengthMeters: lengthMeters,
        maxReachMeters: lengthMeters,
      }),
    },
  });
}

const dragHeldLine = createLineSystem(10);
dragHeldLine.updateDistance({ x: 0, y: 250 }, { x: 0, y: 0 });
dragHeldLine.updateDistance({ x: 0, y: 300 }, { x: 0, y: 0 });
const dragHeldRelease = dragHeldLine.releaseForDistance({
  dragRatio: 0.6,
  shouldSlip: false,
  slipReleaseRatio: 0,
  creepReleaseRatio: 0,
});
assert(dragHeldRelease.releasedMeters === 0, "Drag holding releases no line");
assert(dragHeldRelease.lineLengthLocked, "Blocked release reports locked line length");
assert(dragHeldRelease.blockedByDrag, "Blocked release distinguishes drag holding");
assert(dragHeldRelease.releaseBlockedReason === "drag_holding", "Drag block reason is explicit");

const slippingLine = createLineSystem(10);
slippingLine.updateDistance({ x: 0, y: 250 }, { x: 0, y: 0 });
slippingLine.updateDistance({ x: 0, y: 300 }, { x: 0, y: 0 });
const slipRelease = slippingLine.releaseForDistance({
  dragRatio: 0.6,
  shouldSlip: true,
  slipReleaseRatio: 1,
});
assert(slipRelease.releasedMeters > 0, "Slipping drag releases demanded line");
assert(!slipRelease.lineLengthLocked, "Satisfied payout leaves line length unlocked");

const hardLimitLine = createLineSystem(5);
hardLimitLine.updateDistance({ x: 0, y: 250 }, { x: 0, y: 0 });
hardLimitLine.updateDistance({ x: 0, y: 300 }, { x: 0, y: 0 });
const hardLimitRelease = hardLimitLine.releaseForDistance({
  dragRatio: 0,
  shouldSlip: true,
  slipReleaseRatio: 1,
});
assert(hardLimitRelease.releasedMeters === 0, "Empty spool cannot release line");
assert(hardLimitRelease.blockedByHardLimit, "Empty spool reports hard limit");
assert(hardLimitRelease.releaseBlockedReason === "spool_empty", "Spool-empty reason is explicit");

console.log("line-locked-rod-control-check passed:");
for (const message of checks) console.log("- " + message);
`, context);
