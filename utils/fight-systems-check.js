const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/core.js",
  "src/core/casting_distance.js",
  "src/config/databases/fish_db.js",
  "src/config/config.js",
  "src/entities/tackle.js",
  "src/entities/fish.js",
  "src/systems/drag_system.js",
  "src/systems/line_system.js",
  "src/systems/fish_force_system.js",
  "src/systems/tackle_stress_system.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
  setTimeout,
  clearTimeout,
  window: { innerWidth: 1280, innerHeight: 720 },
});

for (const file of FILES) {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

vm.runInContext(`
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function approx(value, expected, tolerance, message) {
  assert(Math.abs(value - expected) <= tolerance, message + " (" + value + ")");
}

const physicsConfig = CONFIG.physics;
const castDistanceCalculator = new CastDistanceCalculator(CONFIG);
const samplePoleEquipment = {
  rod: { type: "pole", lengthMeters: 2, hasReel: false },
  reel: null,
  line: { lengthMeters: 13, maxLoadKg: 2 },
};
const sampleBologneseEquipment = {
  rod: { type: "float", lengthMeters: 4, hasReel: true },
  reel: { basePower: 1, lineCapacityMeters: 20 },
  line: { lengthMeters: 13, maxLoadKg: 2 },
};
approx(
  castDistanceCalculator.getMaxCastDistancePx(samplePoleEquipment, 0),
  650,
  0.001,
  "pole cast distance uses equipped line length",
);
approx(
  castDistanceCalculator.getMaxCastDistancePx(sampleBologneseEquipment, 0),
  650,
  0.001,
  "reel cast distance uses equipped line length",
);
approx(
  castDistanceCalculator.getEffectiveCastDistancePx(sampleBologneseEquipment, 0.5),
  325,
  0.001,
  "cast power coefficient scales final distance",
);
const strongRod = new Rod(1, 5, 0, "float_pole", Infinity, false, {
  lengthMeters: 2,
  maxLoadKg: 24,
  lineMaxLoadKg: 12,
  durability: 100,
  durabilityMaxLoadLossPerPercent: 0.001,
});
const noReel = new Reel(0, 0, { maxLoadKg: 0, lineCapacityMeters: 0 });
assert(!noReel.hasReel(), "sentinel reel has no reel behavior");

const noReelLine = new LineSystem({
  rod: strongRod,
  reel: noReel,
  config: physicsConfig,
  lineStats: { lengthMeters: 13, maxLoadKg: 12, durability: 100 },
});
approx(noReelLine.getState().totalLengthMeters, 13, 0.001, "pole line length uses equipped line");

const reel = new Reel(1, 1, {
  maxLoadKg: 10,
  lineCapacityMeters: 50,
  retrieveSpeedMetersPerSec: 0.8,
  dragChangeSpeedPerSec: 1.5,
});

const reelLineStats = {
  lengthMeters: 50,
  maxLoadKg: 12,
  durability: 100,
  durabilityMaxLoadLossPerPercent: 0.001,
};
const freeLine = new LineSystem({
  rod: strongRod,
  reel,
  config: physicsConfig,
  lineStats: reelLineStats,
});
freeLine.updateDistance({ x: 50, y: 0 }, { x: 0, y: 0 });
freeLine.updateDistance({ x: 500, y: 0 }, { x: 0, y: 0 });
freeLine.releaseForDistance(0);
assert(freeLine.getState().releasedMeters >= 9.99, "drag 0 releases line for fish distance");
assert(!freeLine.getState().isFullyExtended, "drag 0 keeps line from full extension while spare line remains");

const lockedLine = new LineSystem({
  rod: strongRod,
  reel,
  config: physicsConfig,
  lineStats: reelLineStats,
});
lockedLine.updateDistance({ x: 50, y: 0 }, { x: 0, y: 0 });
lockedLine.updateDistance({ x: 500, y: 0 }, { x: 0, y: 0 });
lockedLine.releaseForDistance(1);
assert(lockedLine.getState().releasedMeters < 6, "drag 100 keeps released line close to rod base reach");

const shortReel = new Reel(1, 1, {
  maxLoadKg: 10,
  lineCapacityMeters: 5,
});
const exhaustedLine = new LineSystem({
  rod: strongRod,
  reel: shortReel,
  config: physicsConfig,
  lineStats: { lengthMeters: 4, maxLoadKg: 12, durability: 100 },
});
exhaustedLine.updateDistance({ x: 50, y: 0 }, { x: 0, y: 0 });
exhaustedLine.updateDistance({ x: 550, y: 0 }, { x: 0, y: 0 });
exhaustedLine.releaseForDistance(0);
assert(exhaustedLine.getState().isFullyExtended, "line is fully extended when spool line is exhausted");

const stress = new TackleStressSystem({
  rod: strongRod,
  reel,
  lineSystem: freeLine,
  rng: { next: () => 0.9 },
});
approx(stress.getEffectiveMaxTackleLoadKg(), 10, 0.001, "max tackle load is weakest tackle part");
stress.updateTarget(25, 1, { kgSmoothPerSecond: 999, overloadGraceMs: 0 });
assert(stress.isBroken(), "overload break is deterministic");

let rodBreaks = 0;
let lineBreaks = 0;
let seed = 12345;
function nextDeterministicRandom() {
  seed = (seed * 48271) % 2147483647;
  return seed / 2147483647;
}
for (let i = 1; i <= 6000; i++) {
  const seq = nextDeterministicRandom();
  const trialStress = new TackleStressSystem({
    rod: strongRod,
    reel: noReel,
    lineSystem: noReelLine,
    rng: { next: () => seq },
  });
  trialStress.updateTarget(30, 1, { kgSmoothPerSecond: 999, overloadGraceMs: 0 });
  if (trialStress.getBreakReason() === "rod") rodBreaks++;
  if (trialStress.getBreakReason() === "line") lineBreaks++;
}
const rodBreakRatio = rodBreaks / (rodBreaks + lineBreaks);
assert(rodBreakRatio > 0.30 && rodBreakRatio < 0.36, "rod 24kg + line 12kg break ratio is near 33%");

const fish = new Fish(1, 2, 1, CONFIG.spawns.fishes[0].physics, { next: () => 0.5, range: (a, b) => (a + b) / 2 });
const fishForce = new FishForceSystem({ fish, config: CONFIG });
const forceData = fishForce.calculate({
  dtMs: 16.666,
  fishPosition: { x: 100, y: -100 },
  fishVelocity: { x: 0, y: 0 },
  rodTipPosition: { x: 0, y: 0 },
  fishCondition: { maxPoints: 100, currentStamina: 0 },
  dragRatio: 0,
  input: { isPulling: true, retrieve: false, pointerDown: true },
  rod: strongRod,
  reel: noReel,
  buffs: null,
});
assert(forceData.debug.fishSpeedPxPerSec > 0, "stamina 0 keeps minimum fish activity speed");
assert(forceData.totalFishForceKg > 0, "stamina 0 keeps static fish force");
assert(forceData.player.anglePenalty < 1, "large rod angle applies penalty");

console.log("Fight systems check passed:");
for (const message of checks) console.log("- " + message);
`, context);
