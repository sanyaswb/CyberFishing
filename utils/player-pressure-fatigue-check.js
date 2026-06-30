const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/fishing/player_pressure/player_pressure_fatigue_state.js",
  "src/core/fishing/player_pressure/player_pressure_fatigue_calculator.js",
  "src/core/fishing/rod_pull_calculator.js",
  "src/core/fishing/rod_control_tension_mode_resolver.js",
  "src/systems/rod_lateral_control_system.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
  Object,
  window: {},
});

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

function approx(value, expected, tolerance, message) {
  const actual = Number(value);
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(message + " (expected " + expected + ", got " + value + ")");
  }
  checks.push(message);
}

const config = {
  enabled: true,
  pressureThresholdKg: 0.01,
  graceDurationMs: 3000,
  fatigueDurationMs: 6000,
  minEfficiency: 0.45,
  curvePower: 1.0,
  controlBreak: {
    enabled: true,
    fatigueRatioThreshold: 0.9,
    minContinuousPressureMs: 8000,
  },
  recovery: {
    delayAfterPressureMs: 400,
    recoveryPerSecond: 0.8,
  },
  channels: {
    rodHold: true,
    rodControl: true,
  },
};

const fatigueState = new PlayerPressureFatigueState();
const fatigueCalculator = new PlayerPressureFatigueCalculator();

let frame = fatigueCalculator.calculate({
  state: fatigueState,
  dtSec: 3,
  pressureKg: 1,
  config,
});
fatigueState.applyFrame(frame);
approx(frame.efficiency, 1, 0.0001, "pressure fatigue keeps full efficiency during grace");
approx(frame.pressureHoldMs, 3000, 0.0001, "pressure fatigue records grace hold time");

frame = fatigueCalculator.calculate({
  state: fatigueState,
  dtSec: 3,
  pressureKg: 1,
  config,
});
fatigueState.applyFrame(frame);
approx(frame.efficiency, 0.725, 0.0001, "pressure fatigue falls after grace");
assert(frame.recoveryState === "pressuring", "pressure fatigue reports pressuring state");

frame = fatigueCalculator.calculate({
  state: fatigueState,
  dtSec: 0.2,
  pressureKg: 0,
  config,
});
fatigueState.applyFrame(frame);
approx(frame.efficiency, 0.725, 0.0001, "pressure fatigue waits before recovery");
assert(frame.recoveryState === "waiting", "pressure fatigue reports waiting recovery state");

frame = fatigueCalculator.calculate({
  state: fatigueState,
  dtSec: 1,
  pressureKg: 0,
  config,
});
fatigueState.applyFrame(frame);
approx(frame.efficiency, 1, 0.0001, "pressure fatigue recovers to full efficiency");
assert(frame.recoveryState === "full", "pressure fatigue reports full recovery");

const controlBreakState = new PlayerPressureFatigueState();
frame = fatigueCalculator.calculate({
  state: controlBreakState,
  dtSec: 8,
  pressureKg: 1,
  config,
});
controlBreakState.applyFrame(frame);
assert(!frame.isControlExhausted, "pressure fatigue waits for fatigue threshold before control break");

frame = fatigueCalculator.calculate({
  state: controlBreakState,
  dtSec: 0.4,
  pressureKg: 1,
  config,
});
controlBreakState.applyFrame(frame);
assert(frame.controlBreakEnabled, "pressure fatigue exposes control break enabled");
assert(frame.isControlExhausted, "pressure fatigue marks control exhausted after long fatigued pressure");
approx(frame.fatigueProgress, 0.9, 0.0001, "pressure fatigue control break uses normalized fatigue progress");

const rodPullCalculator = new RodPullCalculator({
  enabled: true,
  chargeTimeSeconds: 0.1,
  minStrokeMeters: 0.001,
  distanceMultiplierByRodLength: 1,
});
const pullFrame = rodPullCalculator.calculateNextState({
  dtSec: 1,
  input: { pullHeld: true },
  previousState: {},
  rodLengthMeters: 1,
  maxTackleLoadKg: 1,
  rodLimitKg: 1,
  playerForceBudget: {
    enabled: true,
    holdBudgetKg: 0.8,
    combinedCeilingMultiplier: 1,
    combinedTensionCeilingKg: 1,
  },
  fishTensionKg: 0,
  dragLimitKg: 1,
  dragLocked: true,
  hardLineLimit: false,
  lineHasReserve: true,
  fishDistanceMeters: 5,
  playerPressureFatigue: {
    enabled: true,
    efficiency: 0.5,
    channels: { rodHold: true, rodControl: true },
  },
});
approx(pullFrame.rawForceKg, 0.8, 0.0001, "Rod Hold keeps raw force for pressure fatigue debug");
approx(pullFrame.forceKg, 0.4, 0.0001, "Rod Hold force is multiplied by pressure fatigue");

const controlFrame = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
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
  playerPressureFatigue: {
    enabled: true,
    efficiency: 0.5,
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
      maxForceKg: 0.4,
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
assert(controlFrame.canApply, "Rod Control applies in the pressure fatigue scenario");
assert(controlFrame.rawForceKg > 0, "Rod Control keeps raw force for pressure fatigue debug");
approx(
  controlFrame.forceKg,
  controlFrame.rawForceKg * 0.5,
  0.0001,
  "Rod Control force is multiplied by pressure fatigue",
);
approx(
  controlFrame.playerTensionKg,
  controlFrame.forceKg,
  0.0001,
  "Rod Control tension uses fatigued force",
);

console.log("player-pressure-fatigue-check passed:");
for (const check of checks) console.log("- " + check);
`, context, { filename: "utils/player-pressure-fatigue-check.js#scenario" });
