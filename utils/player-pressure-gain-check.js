const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/fishing/player_force_budget_allocator.js",
  "src/core/fishing/player_pressure/player_pressure_gain_resolver.js",
  "src/core/fishing/rod_pull_calculator.js",
  "src/core/fishing/rod_control_tension_mode_resolver.js",
  "src/systems/rod_lateral_control_system.js",
];

const context = vm.createContext({
  console,
  fs,
  Math,
  Number,
  Object,
  path,
  ROOT,
  window: {},
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
  const actual = Number(value);
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(message + " (expected " + expected + ", got " + value + ")");
  }
  checks.push(message);
}

const gainConfig = Object.freeze({
  enabled: true,
  inputThresholds: {
    holdForceKg: 0.01,
    controlInputRatio: 0.05,
    controlForceKg: 0.01,
  },
  multipliers: {
    holdOnly: 1.0,
    controlOnly: 1.0,
    holdAndControl: 1.5,
  },
});

const resolver = new PlayerPressureGainResolver(gainConfig);

let frame = resolver.resolve({});
assert(frame.mode === "none", "gain resolver reports none without active pressure");
approx(frame.multiplier, 1, 0.0001, "gain resolver keeps x1 without active pressure");

frame = resolver.resolve({
  holdActive: true,
  holdForceKg: 0.5,
});
assert(frame.mode === "hold_only", "gain resolver detects hold-only pressure");
approx(frame.multiplier, 1, 0.0001, "hold-only pressure keeps x1 gain");

frame = resolver.resolve({
  controlActive: true,
  controlForceKg: 0.5,
  controlInputRatio: 1,
});
assert(frame.mode === "control_only", "gain resolver detects control-only pressure");
approx(frame.multiplier, 1, 0.0001, "control-only pressure keeps x1 gain");

frame = resolver.resolve({
  holdActive: true,
  controlActive: true,
  holdForceKg: 0.5,
  controlForceKg: 0.5,
  controlInputRatio: 1,
});
assert(frame.mode === "hold_and_control", "gain resolver detects hold + control pressure");
approx(frame.multiplier, 1.5, 0.0001, "hold + control pressure uses combo x1.5 gain");

frame = resolver.resolve({
  holdActive: true,
  controlActive: true,
  holdForceKg: 0.5,
  controlForceKg: 0.5,
  controlInputRatio: 0.01,
});
assert(frame.mode === "hold_only", "control input below threshold does not activate combo gain");

frame = resolver.resolve({
  holdActive: true,
  controlActive: true,
  holdForceKg: 0.001,
  controlForceKg: 0.5,
  controlInputRatio: 1,
});
assert(frame.mode === "control_only", "hold force below threshold does not activate combo gain");

frame = resolver.resolve({
  holdActive: true,
  controlActive: true,
  holdForceKg: 0.5,
  controlForceKg: 0.001,
  controlInputRatio: 1,
});
assert(frame.mode === "hold_only", "control force below threshold does not activate combo gain");

const allocator = new PlayerForceBudgetAllocator();
const budgetConfig = {
  enabled: true,
  allocationMode: "independent",
  control: { maxBudgetShare: 0.5, minInputRatio: 0.001 },
  tensionCeiling: {
    holdMultiplier: 1,
    controlMultiplier: 1,
    maxCombinedMultiplier: 1,
  },
};
const holdAction = Object.freeze({ active: true, ratio: 1 });
const controlAction = Object.freeze({ active: true, directionX: 1, inputRatio: 1 });

const budgetFrame = allocator.resolve({
  rodLimitKg: 1,
  fishTensionKg: 0.4,
  holdAction,
  controlAction,
  config: budgetConfig,
});
approx(budgetFrame.holdBudgetKg, 0.6, 0.0001, "independent budget keeps full Rod Hold reserve with control active");
approx(budgetFrame.controlBudgetKg, 0.6, 0.0001, "independent budget gives Rod Control its own reserve");

const comboFrame = resolver.resolve({
  holdActive: budgetFrame.holdActive,
  controlActive: budgetFrame.controlActive,
  holdForceKg: budgetFrame.holdBudgetKg,
  controlForceKg: budgetFrame.controlBudgetKg,
  controlInputRatio: budgetFrame.controlInputRatio,
});
assert(comboFrame.mode === "hold_and_control", "gain resolver consumes the independent budget frame");
approx(comboFrame.multiplier, 1.5, 0.0001, "independent hold + control budget resolves combo gain");

const rodPullCalculator = new RodPullCalculator({
  enabled: true,
  chargeTimeSeconds: 1,
  minStrokeMeters: 0.001,
  distanceMultiplierByRodLength: 1,
});

const pullBase = rodPullCalculator.calculateNextState({
  dtSec: 0.2,
  input: { pullHeld: true },
  previousState: {},
  rodLengthMeters: 1,
  maxTackleLoadKg: 1,
  rodLimitKg: 1,
  playerForceBudget: {
    enabled: true,
    holdBudgetKg: 1,
    combinedCeilingMultiplier: 1,
    combinedTensionCeilingKg: 1,
  },
  fishTensionKg: 0,
  dragLimitKg: 1,
  dragLocked: true,
  hardLineLimit: false,
  lineHasReserve: true,
  fishDistanceMeters: 5,
  playerPressureGain: {
    enabled: true,
    mode: "hold_only",
    multiplier: 1,
    holdActive: true,
  },
  playerPressureFatigue: {
    enabled: true,
    efficiency: 1,
    channels: { rodHold: true, rodControl: true },
  },
});

const pullCombo = rodPullCalculator.calculateNextState({
  dtSec: 0.2,
  input: { pullHeld: true },
  previousState: {},
  rodLengthMeters: 1,
  maxTackleLoadKg: 1,
  rodLimitKg: 1,
  playerForceBudget: {
    enabled: true,
    holdBudgetKg: 1,
    combinedCeilingMultiplier: 1,
    combinedTensionCeilingKg: 1,
  },
  fishTensionKg: 0,
  dragLimitKg: 1,
  dragLocked: true,
  hardLineLimit: false,
  lineHasReserve: true,
  fishDistanceMeters: 5,
  playerPressureGain: {
    enabled: true,
    mode: "hold_and_control",
    multiplier: 1.5,
    holdActive: true,
    controlActive: true,
  },
  playerPressureFatigue: {
    enabled: true,
    efficiency: 1,
    channels: { rodHold: true, rodControl: true },
  },
});

approx(pullBase.ratio, 0.2, 0.0001, "Rod Hold base pressure charges at x1");
approx(pullCombo.ratio, 0.3, 0.0001, "Rod Hold combo gain multiplies buildup rate");
approx(pullCombo.rawForceKg, 0.3, 0.0001, "Rod Hold combo gain affects raw force through charged ratio");
approx(pullCombo.totalTensionKg, pullCombo.forceKg, 0.0001, "Rod Hold combo gain does not post-multiply final tension");
approx(pullCombo.forceKg, pullCombo.rawForceKg, 0.0001, "Rod Hold combo gain happens before fatigue");
approx(pullCombo.chargePerSecond, pullCombo.baseChargePerSecond * 1.5, 0.0001, "Rod Hold debug exposes multiplied charge rate");

const controlFrame = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 0.4,
  },
  fishPosition: { x: -50, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  baseRodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 1,
  maxTackleLoadKg: 1,
  currentTensionKg: 0,
  fishTensionKg: 0,
  fishVelocity: { x: -20, y: 0 },
  fishWeightKg: 0,
  playerForceBudget: {
    enabled: true,
    controlBudgetKg: 1,
    controlShare: 1,
    combinedCeilingMultiplier: 1,
    combinedTensionCeilingKg: 1,
  },
  dragLimitKg: 1,
  dragLocked: true,
  lineHasReserve: true,
  hardLineLimit: false,
  playerPressureGain: {
    enabled: true,
    mode: "hold_and_control",
    multiplier: 1.5,
    holdActive: true,
    controlActive: true,
  },
  playerPressureFatigue: {
    enabled: true,
    efficiency: 1,
    channels: { rodHold: true, rodControl: true },
  },
  config: {
    enabled: true,
    alignment: {
      enabled: true,
      targetAnchorMode: "current_base",
      maxEffectiveAngleDeg: 90,
      alignedThresholdPx: 1,
      centerStartThresholdPx: 0.5,
    },
    force: {
      maxForceKg: 1,
      sidePullSpeedMultiplier: 1,
      fishWeightResistanceMultiplier: 0,
    },
    tension: {
      sameDirectionMultiplier: 0,
      sideMultiplier: 1,
      oppositeDirectionMultiplier: 1,
      mode: {
        sameDirectionThreshold: 0.35,
        oppositeDirectionThreshold: -0.35,
        minFishSpeedPxPerSec: 1,
      },
    },
    water: {
      motionResistance: 1,
      speedMultiplier: 1,
    },
    pixelsPerMeter: 50,
  },
});
assert(controlFrame.baseRequestedForceRatio > 0, "Rod Control exposes base requested force ratio");
approx(
  controlFrame.requestedForceRatio,
  Math.min(1, controlFrame.baseRequestedForceRatio * 1.5),
  0.0001,
  "Rod Control combo gain multiplies requested force before fatigue",
);
approx(controlFrame.playerPressureGainMultiplier, 1.5, 0.0001, "Rod Control debug exposes combo gain");

const fightSource = fs.readFileSync(path.join(ROOT, "src/systems/fight_physics_system.js"), "utf8");
assert(fightSource.includes("resolve_player_pressure_gain"), "Fight pipeline resolves player pressure gain before fatigue");
assert(fightSource.includes("playerPressureGainMode"), "Fight debug snapshot exposes player pressure gain mode");
assert(fightSource.includes("playerPressureControlInputRatio"), "Fight debug snapshot exposes control input ratio");

const rodPullSystemSource = fs.readFileSync(path.join(ROOT, "src/systems/rod_pull_system.js"), "utf8");
assert(rodPullSystemSource.includes("playerPressureGain,"), "RodPullSystem accepts player pressure gain");
assert(rodPullSystemSource.includes("playerPressureGain,"), "RodPullSystem forwards player pressure gain to calculator");

const overlaySource = fs.readFileSync(path.join(ROOT, "src/debug/overlay/modules/fight_summary/fight_summary_overlay_module.js"), "utf8");
assert(overlaySource.includes("fightSummary.inputCombo"), "Fight Summary overlay exposes input combo metric key");
assert(overlaySource.includes("#formatInputCombo"), "Fight Summary overlay formats input combo");

console.log("player-pressure-gain-check passed:");
for (const check of checks) console.log("- " + check);
`,
  context,
  { filename: "utils/player-pressure-gain-check.js#scenario" },
);
