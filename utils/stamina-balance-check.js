const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/casting_distance.js",
  "src/core/line/line_spool_state.js",
  "src/core/fishing/stamina/active_stamina_drain_calculator.js",
  "src/core/fishing/stamina/angle_stamina_recovery_calculator.js",
  "src/core/fishing/stamina/passive_stamina_drain_calculator.js",
  "src/core/fishing/stamina/stamina_balance_frame.js",
  "src/services/weakest_tackle_limit_resolver.js",
  "src/systems/line_system.js",
  "src/systems/stamina_system.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
  Object,
});

for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(
  `
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function approx(value, expected, tolerance, message) {
  assert(Math.abs(Number(value) - expected) <= tolerance, message + " (" + value + ")");
}

const activeDrain = new ActiveStaminaDrainCalculator();
let frame = activeDrain.calculate({
  appliedRodHoldKg: 0,
  appliedControlKg: 0,
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 100, lateralStaminaWeight: 0.5 },
});
approx(frame.activeStaminaDrain, 0, 0.0001, "applied force 0 gives zero active drain");

frame = activeDrain.calculate({
  appliedRodHoldKg: 0.5,
  appliedControlKg: 0,
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 100, lateralStaminaWeight: 0.5 },
});
approx(frame.activeDrainRatio, 0.5, 0.0001, "rodHold 0.5kg against weakest 1kg gives 0.5 drain ratio");
approx(frame.activeStaminaDrain, 50, 0.0001, "rodHold drain uses active drain ratio");

frame = activeDrain.calculate({
  appliedRodHoldKg: 0,
  appliedControlKg: 0.5,
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 100, lateralStaminaWeight: 0.5 },
});
approx(frame.usedPlayerPressureKg, 0.25, 0.0001, "control force is weighted by lateral stamina weight");
approx(frame.activeDrainRatio, 0.25, 0.0001, "weighted control pressure drives drain ratio");

frame = activeDrain.calculate({
  appliedRodHoldKg: 0.25,
  appliedControlKg: 0.25,
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 100, lateralStaminaWeight: 0.5 },
});
approx(frame.usedPlayerPressureKg, 0.375, 0.0001, "rodHold and control pressure combine");

frame = activeDrain.calculate({
  requestedRodHoldKg: 99,
  requestedControlKg: 99,
  rawInputPower: 1,
  appliedRodHoldKg: 0,
  appliedControlKg: 0,
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 100, lateralStaminaWeight: 0.5 },
});
approx(frame.activeStaminaDrain, 0, 0.0001, "raw/requested input does not affect stamina drain");

frame = activeDrain.calculate({
  appliedRodHoldKg: 0.5,
  appliedControlKg: 0.5,
  fishTensionKg: 0.8,
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 100, lateralStaminaWeight: 0.5 },
});
assert(frame.budgetOverflow, "budget overflow is flagged when applied player pressure exceeds available tackle budget");
approx(frame.availablePlayerPressureKg, 0.2, 0.0001, "available player pressure is weakest limit minus fish tension");
approx(frame.rawAppliedPlayerPressureKg, 1, 0.0001, "raw applied player pressure tracks unweighted applied force");


const passiveDrain = new PassiveStaminaDrainCalculator();
frame = passiveDrain.calculate({
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 1,
  lineTaut: true,
  fishBehaviorName: "dash",
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: false, drainPerSecond: 15 },
});
approx(frame.passiveStaminaDrain, 0, 0.0001, "passiveDrain.enabled=false gives zero passive drain");

frame = passiveDrain.calculate({
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 1,
  lineTaut: false,
  fishBehaviorName: "dash",
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 15, behaviorMultipliers: { dash: 1 } },
});
approx(frame.passiveStaminaDrain, 0, 0.0001, "slack line gives zero passive drain");

frame = passiveDrain.calculate({
  fishWonRadialForceKg: 0,
  dragBlockedForceKg: 1,
  lineTaut: true,
  fishBehaviorName: "dash",
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 15, behaviorMultipliers: { dash: 1 } },
});
approx(frame.passiveStaminaDrain, 0, 0.0001, "zero fish radial effort gives zero passive drain");

frame = passiveDrain.calculate({
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 0,
  lineTaut: true,
  fishBehaviorName: "dash",
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 15, behaviorMultipliers: { dash: 1 } },
});
approx(frame.passiveStaminaDrain, 0, 0.0001, "zero blocked force gives zero passive drain");

frame = passiveDrain.calculate({
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 1,
  lineTaut: true,
  fishBehaviorName: "dash",
  weakestTackleLimitKg: 1,
  hardLineLimit: true,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 15, behaviorMultipliers: { dash: 1 }, hardLimitMultiplier: 1 },
});
approx(frame.passiveStaminaDrain, 15, 0.0001, "hard limit dash gives max passive drain for passive model");

const swimFrame = passiveDrain.calculate({
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 1,
  lineTaut: true,
  fishBehaviorName: "swim",
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 15, behaviorMultipliers: { dash: 1, swim: 0.5, rest: 0 } },
});
assert(swimFrame.passiveStaminaDrain < frame.passiveStaminaDrain, "swim passive drain is lower than dash passive drain");

frame = passiveDrain.calculate({
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 1,
  lineTaut: true,
  fishBehaviorName: "rest",
  weakestTackleLimitKg: 1,
  dtSec: 1,
  config: { enabled: true, drainPerSecond: 15, behaviorMultipliers: { rest: 0 } },
});
approx(frame.passiveStaminaDrain, 0, 0.0001, "rest gives zero passive drain");

const angleRecovery = new AngleStaminaRecoveryCalculator();
frame = angleRecovery.calculate({
  lineAngleDeg: 10,
  dtSec: 1,
  config: { enabled: true, safeAngleDeg: 15, maxRecoveryAngleDeg: 75, middleMaxRecoveryRatio: 0.5, regenPerSecond: 40 },
});
approx(frame.angleRecoveryRatio, 0, 0.0001, "angle <= 15deg gives zero regen");
approx(frame.angleStaminaRegen, 0, 0.0001, "zero angle recovery ratio gives zero regen");

frame = angleRecovery.calculate({
  lineAngleDeg: 45,
  dtSec: 1,
  config: { enabled: true, safeAngleDeg: 15, maxRecoveryAngleDeg: 75, middleMaxRecoveryRatio: 0.5, regenPerSecond: 40 },
});
approx(frame.angleRecoveryRatio, 0.25, 0.0001, "angle 45deg gives middle-zone partial recovery");
approx(frame.angleStaminaRegen, 10, 0.0001, "angle 45deg regens 25% of max regen");

frame = angleRecovery.calculate({
  lineAngleDeg: 75,
  dtSec: 1,
  config: { enabled: true, safeAngleDeg: 15, maxRecoveryAngleDeg: 75, middleMaxRecoveryRatio: 0.5, regenPerSecond: 40 },
});
approx(frame.angleRecoveryRatio, 1, 0.0001, "angle >= 75deg gives max recovery");
approx(frame.angleStaminaRegen, 40, 0.0001, "max angle recovery uses max regen per second");

const balanceFactory = new StaminaBalanceFrame();
const baseConfig = {
  activeDrain: { enabled: true, drainPerSecond: 100, lateralStaminaWeight: 0.5, curvePower: 1 },
  angleRecovery: {
    enabled: true,
    safeAngleDeg: 15,
    maxRecoveryAngleDeg: 75,
    middleMaxRecoveryRatio: 0.5,
    regenPerSecond: 40,
    curvePower: 1,
    allowStaminaRegenWhilePulling: false,
  },
  passiveDrain: {
    enabled: false,
    drainPerSecond: 15,
    curvePower: 1,
    lineTautThresholdRatio: 0.995,
    defaultBehaviorMultiplier: 0.5,
    behaviorMultipliers: { dash: 1, swim: 0.5, idle: 0.1, rest: 0 },
    slippingDragMultiplier: 1,
    hardLimitMultiplier: 1,
  },
};
frame = balanceFactory.create({
  playerIsPulling: true,
  appliedRodHoldKg: 0.2,
  appliedControlKg: 0,
  weakestTackleLimitKg: 1,
  lineAngleDeg: 75,
  dtSec: 1,
  config: baseConfig,
});
approx(frame.rawNetStaminaChange, 20, 0.0001, "raw net stamina can be positive while pulling");
approx(frame.netStaminaChange, 0, 0.0001, "regen while pulling is blocked when config disallows it");
assert(frame.regenBlockedByPull, "regen block flag is set while pulling");
assert(!frame.passiveDrainEnabled, "passive drain remains disabled");

frame = balanceFactory.create({
  playerIsPulling: false,
  appliedRodHoldKg: 0.2,
  appliedControlKg: 0,
  weakestTackleLimitKg: 1,
  lineAngleDeg: 10,
  fishWonRadialForceKg: 1,
  dragBlockedForceKg: 1,
  lineTaut: true,
  fishBehaviorName: "dash",
  dtSec: 1,
  config: {
    ...baseConfig,
    passiveDrain: {
      ...baseConfig.passiveDrain,
      enabled: true,
      drainPerSecond: 15,
    },
  },
});
approx(frame.activeStaminaDrain, 20, 0.0001, "active drain remains unchanged when passive is enabled");
approx(frame.passiveStaminaDrain, 15, 0.0001, "passive drain is calculated independently");
approx(frame.totalStaminaDrain, 35, 0.0001, "passive and active drains are summed");
approx(frame.netStaminaChange, -35, 0.0001, "angle regen is subtracted from total stamina drain");

frame = balanceFactory.create({
  playerIsPulling: true,
  appliedRodHoldKg: 0.2,
  appliedControlKg: 0,
  weakestTackleLimitKg: 1,
  lineAngleDeg: 75,
  dtSec: 1,
  config: {
    ...baseConfig,
    angleRecovery: {
      ...baseConfig.angleRecovery,
      allowStaminaRegenWhilePulling: true,
    },
  },
});
approx(frame.netStaminaChange, 20, 0.0001, "regen while pulling is allowed when config enables it");

const condition = {
  phase: "stamina",
  currentStamina: 50,
  maxStamina: 100,
  currentExhaustion: 0,
  applyStaminaDamage(amount) { this.currentStamina = Math.max(0, this.currentStamina - amount); },
  applyStaminaRegen(amount) { this.currentStamina = Math.min(this.maxStamina, this.currentStamina + amount); },
  applyPunishment() {},
};
const fish = {
  clearDebuff() {},
  setMasteryMultiplier() {},
  getInitialPower() { return 1; },
  hasActiveDebuff: false,
  clearMasteryDebuff() {},
};
const controller = new StaminaController(condition, fish, 1, {
  baseDepletionRate: 100,
  baseRegenRate: 20,
  edgeRegenRate: 30,
});
controller.evaluate({
  staminaFrame: balanceFactory.create({
    playerIsPulling: false,
    appliedRodHoldKg: 0.3,
    appliedControlKg: 0,
    weakestTackleLimitKg: 1,
    lineAngleDeg: 10,
    dtSec: 1,
    config: baseConfig,
  }),
});
approx(condition.currentStamina, 20, 0.0001, "StaminaController applies balance frame net drain");

const weakest = new WeakestTackleLimitResolver().resolve({
  rod: { getEffectiveMaxLoadKg: () => 1.5 },
  reel: { hasReel: () => false, getEffectiveMaxLoadKg: () => 0.2 },
  lineSystem: { getEffectiveLineMaxLoadKg: () => 1.0 },
  leader: { maxLoadKg: 0.8 },
  hook: { maxLoadKg: 1.2 },
});
approx(weakest.weakestTackleLimitKg, 0.8, 0.0001, "float rod weakest limit ignores missing reel and uses active components");
assert(weakest.component === "leader", "weakest component is exposed");

const lineSystem = new LineSystem({
  rod: { lengthMeters: 3, getLengthMeters: () => 3 },
  reel: { hasReel: () => true },
  config: { simulation: { pixelsPerMeter: 1 }, line: { rodLengthReserveMultiplier: 1 } },
  lineStats: { lengthMeters: 6, maxLoadKg: 1, durability: 100 },
});
let lineState = lineSystem.updateDistance({ x: 0, y: 3 }, { x: 0, y: 0 });
assert(!lineState.isFullyExtended, "line is not fully extended at cast distance 3m with 6m available and no pull/control");
lineState = lineSystem.updateDistance({ x: 0, y: 6 }, { x: 0, y: 0 });
lineSystem.releaseForDistance({ dragRatio: 0, shouldSlip: true });
lineState = lineSystem.updateDistance({ x: 0, y: 6 }, { x: 0, y: 0 });
assert(lineState.isFullyExtended, "line becomes fully extended only at the actual released line limit");

console.log("stamina-balance-check passed:\\n- " + checks.join("\\n- "));
`,
  context,
);
