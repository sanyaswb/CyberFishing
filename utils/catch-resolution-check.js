const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/config/databases/fish/presets/fish_profile_factory.js",
  "src/config/databases/fish/presets/fish_profile_presets.js",
  "src/config/databases/fish/species/peaceful_fish.js",
  "src/config/databases/fish/species/predator_fish.js",
  "src/config/databases/fish/species/rare_fish.js",
  "src/config/databases/fish/species/event_fish.js",
  "src/config/databases/fish/fish_categories.js",
  "src/config/databases/fish_db.js",
  "src/config/physics/environment_physics_config.js",
  "src/config/physics/retrieve_physics_config.js",
  "src/config/physics/fight_physics_config.js",
  "src/config/physics/tackle_physics_config.js",
  "src/config/physics/tension_physics_config.js",
  "src/config/physics/physics_config_adapter.js",
  "src/config/physics/physics_config.js",
  "src/config/runtime/config_override_store.js",
  "src/config/runtime/resolved_config_provider.js",
  "src/config/runtime/immutable_config.js",
  "src/config/config.js",
  "src/core/casting_distance.js",
  "src/core/fishing/landing_policy.js",
  "src/core/fishing/landing_lift_readiness_policy.js",
  "src/entities/tackle.js",
  "src/app/fishing.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
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
function landingFrame(weightKg, overrides = {}) {
  const supportedTensionKg =
    overrides.supportedTensionKg === undefined
      ? weightKg
      : overrides.supportedTensionKg;
  const rawTensionKg =
    overrides.rawTensionKg === undefined
      ? supportedTensionKg
      : overrides.rawTensionKg;
  return {
    inLandingZone: overrides.inLandingZone !== false,
    lineDistanceMeters: overrides.lineDistanceMeters ?? 0.8,
    landingDistanceMeters: overrides.landingDistanceMeters ?? 1,
    lift: {
      inLandingZone: overrides.inLandingZone !== false,
      playerHoldActive: overrides.playerHoldActive !== false,
      active: overrides.active !== false,
      liftHoldKg: overrides.liftHoldKg ?? weightKg,
      liftMaxKg: overrides.liftMaxKg ?? weightKg,
    },
    tension: {
      visibleTensionKg: overrides.visibleTensionKg ?? supportedTensionKg,
      supportedTensionKg,
      totalTensionKg: supportedTensionKg,
      rawTensionKg,
      rawTotalTensionKg: rawTensionKg,
      shouldSlipDrag: overrides.shouldSlipDrag === true,
    },
    readiness: {
      ready: overrides.ready !== false,
      reason: overrides.reason || "ready",
      liftRequiredKg: overrides.liftMaxKg ?? weightKg,
      liftHoldKg: overrides.liftHoldKg ?? weightKg,
      supportedTensionKg,
      rawTensionKg,
      visibleTensionKg: overrides.visibleTensionKg ?? supportedTensionKg,
      dragSlipping: overrides.shouldSlipDrag === true,
    },
  };
}

const resolver = new CatchResolutionService();
const fish = { weight: 0.4 };
const notLifted = resolver.resolveAutoCatch({
  fishData: fish,
  lineDistanceMeters: 0.8,
  maxTackleLoadKg: 2,
  config: CONFIG,
});
assert(notLifted.inLandingZone && !notLifted.transition, "fish inside landing zone does not land before landing lift is ready");

resolver.reset();
const guaranteed = resolver.resolveAutoCatch({
  fishData: fish,
  lineDistanceMeters: 0.8,
  maxTackleLoadKg: 2,
  config: CONFIG,
  landingFrame: landingFrame(fish.weight),
});
assert(guaranteed.transition?.name === "victory", "fish lands after landing lift reaches real weight");

resolver.reset();
const frameAuthoritative = resolver.resolveAutoCatch({
  fishData: fish,
  lineDistanceMeters: 99,
  maxTackleLoadKg: 2,
  config: CONFIG,
  landingFrame: landingFrame(fish.weight),
  fightDebug: {
    landingLiftInZone: false,
    landingLiftActive: false,
    landingLiftHoldKg: 0,
    landingLiftMaxKg: fish.weight,
    totalTensionKg: 0,
  },
});
assert(
  frameAuthoritative.transition?.name === "victory",
  "landing frame is authoritative over stale debug values",
);

resolver.reset();
const dragSlippingFrame = resolver.resolveAutoCatch({
  fishData: fish,
  lineDistanceMeters: 0.8,
  maxTackleLoadKg: 2,
  config: CONFIG,
  landingFrame: landingFrame(fish.weight, {
    ready: false,
    reason: "drag_slipping",
    supportedTensionKg: fish.weight * 0.5,
    rawTensionKg: fish.weight,
    shouldSlipDrag: true,
  }),
});
assert(
  dragSlippingFrame.inLandingZone && !dragSlippingFrame.transition,
  "raw lift weight does not land fish while supported tension is drag-capped",
);

resolver.reset();
const lowTensionLift = resolver.resolveAutoCatch({
  fishData: fish,
  lineDistanceMeters: 0.8,
  maxTackleLoadKg: 2,
  config: CONFIG,
  landingFrame: landingFrame(fish.weight, {
    ready: false,
    reason: "lift_tension_below_weight",
    supportedTensionKg: fish.weight * 0.5,
  }),
});
assert(lowTensionLift.inLandingZone && !lowTensionLift.transition, "fish does not land when lift is charged but final tension cannot hold real weight");

resolver.reset();
const smoothedTensionLag = resolver.resolveAutoCatch({
  fishData: fish,
  lineDistanceMeters: 0.8,
  maxTackleLoadKg: 2,
  config: CONFIG,
  landingFrame: landingFrame(fish.weight, {
    visibleTensionKg: fish.weight * 0.5,
    supportedTensionKg: fish.weight,
  }),
});
assert(
  smoothedTensionLag.transition?.name === "victory",
  "visual tension smoothing does not delay an authoritative landing lift",
);

resolver.reset();
const maxLoadSuccess = resolver.resolveAutoCatch({
  fishData: { weight: 2 },
  lineDistanceMeters: 0.8,
  maxTackleLoadKg: 2,
  config: CONFIG,
  landingFrame: landingFrame(2),
});
assert(maxLoadSuccess.transition?.name === "victory", "fish at max load lands when maxLoadWeightRatio is 1 and lift is ready");

resolver.reset();
const overweight = resolver.resolveAutoCatch({
  fishData: { weight: 2.2 },
  lineDistanceMeters: 0.8,
  maxTackleLoadKg: 2,
  config: CONFIG,
  landingFrame: landingFrame(2.2),
});
assert(overweight.inLandingZone && !overweight.transition, "fish heavier than maxLoadWeightRatio cannot auto-land");

resolver.reset();
const outsideZone = resolver.resolveAutoCatch({
  fishData: { weight: 0.1 },
  lineDistanceMeters: 1.2,
  maxTackleLoadKg: 2,
  config: CONFIG,
});
assert(!outsideZone.inLandingZone && !outsideZone.transition, "fish outside 1m reel landing zone does not roll");

resolver.reset();
const poleZone = resolver.resolveAutoCatch({
  fishData: { weight: 0.1 },
  lineDistanceMeters: 2.0,
  maxTackleLoadKg: 2,
  config: CONFIG,
  rod: { type: "float", lengthMeters: 2.0, hasReel: false },
  reel: null,
  landingFrame: landingFrame(0.1, { lineDistanceMeters: 2.0 }),
});
assert(poleZone.inLandingZone && poleZone.transition?.name === "victory", "pole rod lands after lift inside rod-length lifting zone");
assert(poleZone.landingDistanceMeters === 2, "pole landing distance follows rod length");

resolver.reset();
const poleClassZone = resolver.resolveAutoCatch({
  fishData: { weight: 0.1 },
  lineDistanceMeters: 1.3,
  maxTackleLoadKg: 2,
  config: CONFIG,
  rod: new Rod(1, 1, 0, "float", Infinity, false, { lengthMeters: 2.0 }),
  reel: new Reel(0, 0, { lineCapacityMeters: 0 }),
  landingFrame: landingFrame(0.1, { lineDistanceMeters: 1.3 }),
});
assert(poleClassZone.inLandingZone && poleClassZone.transition?.name === "victory", "pole Rod instance lands fish after lift inside 2m lifting zone");
assert(poleClassZone.landingDistanceMeters === 2, "pole Rod instance landing distance uses getLengthMeters");

resolver.reset();
const poleTooFar = resolver.resolveAutoCatch({
  fishData: { weight: 0.1 },
  lineDistanceMeters: 2.1,
  maxTackleLoadKg: 2,
  config: CONFIG,
  rod: { type: "float", lengthMeters: 2.0, hasReel: false },
  reel: null,
});
assert(!poleTooFar.inLandingZone && !poleTooFar.transition, "pole rod still cannot land outside lifting zone");

const net = new Net({
  active: true,
  length: 3,
  maxWeight: 3,
  quality: 1,
  chances: [
    { min: 0, max: 39, chance: 80 },
    { min: 40, max: 79, chance: 70 },
    { min: 80, max: 99, chance: 60 },
    { min: 100, max: null, openEnded: true, chance: 50 },
  ],
});
assert(net.getReachMeters() === 3, "net reach is stored in meters");
assert(net.getReachPixels() === 150, "net reach uses pixelsPerMeter conversion");
assert(net.virtualReach === 150, "net virtual reach exposes converted pixels");
assert(net.getTriggerVirtualY(1000) === 850, "3m net starts 150px from bank");
assert(net.isFloatInZone(900, 1000), "fish inside converted net reach is ready");
assert(!net.isFloatInZone(849, 1000), "fish outside converted net reach is not ready");
assert(net.calculateCatchChance(2) === 100, "net catches fish under max weight at 100%");
assert(net.calculateCatchChance(6) === 50, "net overweight chance drops by configured weight difference");
assert(new Net({ active: true, maxWeight: 0 }).calculateCatchChance(1) === 0, "net with no max weight cannot catch");

const netResolver = new CatchResolutionService();
const netResult = netResolver.resolveNetAttempt(
  net,
  6,
  { range: () => 99 },
  { weight: 6 },
);
assert(netResult.transition.name === "failed", "failed net roll transitions to failed");
assert(netResult.transition.data.reason === "net_escape", "failed net roll uses net_escape reason");

console.log("Catch resolution check passed:");
for (const message of checks) console.log("- " + message);
`, context);
