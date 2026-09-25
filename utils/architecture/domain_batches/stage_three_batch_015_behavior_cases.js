"use strict";

const assert = require("node:assert/strict");

const debuffConfig = (overrides = {}) => ({ enabled: true, curvePower: 2,
  direction: { enabled: true, exhaustedRadialRange: [0.8, 0.2] },
  behaviorWeights: { enabled: true, multipliersAtZeroEndurance: { swim: 0.25, dash: 3, rest: "bad" } },
  ...overrides });
const gainConfig = { enabled: true,
  inputThresholds: { holdForceKg: 0.5, controlInputRatio: 0.2, controlForceKg: 0.3 },
  multipliers: { holdAndControl: 2, holdOnly: 1.25, controlOnly: 1.1 } };
const tackleItem = (maxLoadKg, extra = {}) => ({ effectiveStats: { maxLoadKg, ...extra } });

const BATCH_015_EXECUTABLE_CASES = Object.freeze({
  EnduranceMovementDebuffCalculator: Object.freeze({
    "exhaustion-progress-radial-range-and-behavior-weights": Calculator => {
      const calculator = new Calculator();
      const results = [
        calculator.calculate({ phase: "exhaustion", currentExhaustion: 25, maxEndurance: 100,
          baseRadialRange: [0.4, 0.9], config: debuffConfig() }),
        calculator.calculate({ phase: "EXHAUSTION", currentExhaustion: 0, maxEndurance: 50,
          config: debuffConfig({ curvePower: -1 }) }),
        calculator.calculate({ phase: "exhaustion", currentExhaustion: 80, maxEndurance: 80,
          baseRadialRange: [0.9, 0.1], config: debuffConfig({ direction: { enabled: false } }) }),
      ];
      assert(results.every(Object.isFrozen));
      assert(results.every(result => Object.isFrozen(result.behaviorWeightMultipliers)));
      return results;
    },
    "inactive-disabled-invalid-and-static-default-range": Calculator => {
      assert(Object.isFrozen(Calculator.DEFAULT_RADIAL_RANGE));
      const calculator = new Calculator();
      const results = [
        calculator.calculate(),
        calculator.calculate({ phase: "stamina", config: debuffConfig() }),
        calculator.calculate({ phase: "exhaustion", config: { enabled: false } }),
        calculator.calculate({ phase: "exhaustion", currentExhaustion: "bad", maxEndurance: -5,
          baseRadialRange: ["x", 1], config: debuffConfig({ direction: { enabled: true,
            exhaustedRadialRange: [NaN] }, behaviorWeights: { enabled: false } }) }),
      ];
      assert(results.every(Object.isFrozen));
      return { defaultRange: Array.from(Calculator.DEFAULT_RADIAL_RANGE),
        staticKeys: Object.getOwnPropertyNames(Calculator).filter(name =>
          !["length", "name", "prototype"].includes(name)).sort(), results };
    },
  }),
  PlayerPressureGainResolver: Object.freeze({
    "mode-thresholds-and-multipliers": Resolver => {
      const resolver = new Resolver(gainConfig);
      const input = { holdForceKg: 1, controlForceKg: 1, controlInputRatio: 0.5 };
      const results = [
        resolver.resolve({ ...input, holdActive: true, controlActive: true }),
        resolver.resolve({ ...input, holdActive: true }),
        resolver.resolve({ ...input, controlActive: true }),
        resolver.resolve({ ...input, holdActive: true, controlActive: true, holdForceKg: 0.4,
          controlInputRatio: 0.1 }),
        resolver.resolve({ ...input, holdActive: true, controlActive: true,
          config: { enabled: false } }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
    "constructor-and-call-config-defaults-and-invalid-inputs": Resolver => {
      const results = [
        new Resolver().resolve({ holdActive: true, controlActive: true, holdForceKg: 1,
          controlForceKg: 1, controlInputRatio: 1, config: { enabled: true } }),
        new Resolver(null).resolve(),
        new Resolver(gainConfig).resolve({ holdActive: "yes", controlActive: true,
          holdForceKg: "bad", controlForceKg: -2, controlInputRatio: Infinity }),
        new Resolver({ enabled: true, multipliers: { holdAndControl: -1, holdOnly: "x" },
          inputThresholds: { holdForceKg: -1, controlInputRatio: 5 } })
          .resolve({ holdActive: true, holdForceKg: 0.02 }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
  ActiveEnduranceDrainCalculator: Object.freeze({
    "pressure-ratio-curve-and-drain-rate": Calculator => {
      const calculator = new Calculator();
      const results = [
        calculator.calculate({ activePressureRatio: 0.5, dtSec: 0.25, config: {} }),
        calculator.calculate({ activePressureRatio: 0.5, dtSec: 1,
          config: { curvePower: 2, drainPerSecond: 40 } }),
        calculator.calculate({ activePressureRatio: 2, dtSec: 1 / 60, config: { curvePower: 0.5 } }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
    "disabled-defaults-and-invalid-inputs": Calculator => {
      const calculator = new Calculator();
      const results = [
        calculator.calculate(),
        calculator.calculate({ activePressureRatio: 1, dtSec: 1, config: { enabled: false } }),
        calculator.calculate({ activePressureRatio: "bad", dtSec: -1,
          config: { curvePower: 0, drainPerSecond: -5 } }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
  PassiveEnduranceDrainCalculator: Object.freeze({
    "effort-resistance-taut-and-behavior-drain": Calculator => {
      const calculator = new Calculator();
      const base = { fishWonRadialForceKg: 3, dragBlockedForceKg: 1.5, weakestTackleLimitKg: 6,
        dtSec: 0.5 };
      const results = [
        calculator.calculate({ ...base, lineTaut: true, fishBehaviorName: "Dash",
          config: { behaviorMultipliers: { dash: 1.5 } } }),
        calculator.calculate({ ...base, lineTautRatio: 0.4, fishBehaviorName: "swim",
          config: { curvePower: 2, drainPerSecond: 30 } }),
        calculator.calculate({ ...base, lineTaut: true, lineTautRatio: "bad",
          fishBehaviorName: " ", config: { defaultBehaviorMultiplier: 2 } }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
    "disabled-slack-zero-limit-and-invalid-inputs": Calculator => {
      const calculator = new Calculator();
      const results = [
        calculator.calculate(),
        calculator.calculate({ fishWonRadialForceKg: 3, dragBlockedForceKg: 3, lineTaut: true,
          weakestTackleLimitKg: 6, dtSec: 1, config: { enabled: false } }),
        calculator.calculate({ fishWonRadialForceKg: 3, dragBlockedForceKg: 3, lineTaut: false,
          weakestTackleLimitKg: 0, dtSec: 1, config: {} }),
        calculator.calculate({ fishWonRadialForceKg: -1, dragBlockedForceKg: NaN,
          lineTautRatio: 3, fishBehaviorName: null, weakestTackleLimitKg: "bad", dtSec: "x",
          config: { behaviorMultipliers: { unknown: -1 }, curvePower: -2 } }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
  StaminaLateralPositionResolver: Object.freeze({
    "offset-side-edge-ratio-and-center-direction": Resolver => {
      const resolver = new Resolver();
      const results = [
        resolver.resolve({ fishLateralOffsetPx: 50, maxAllowedLateralOffsetPx: 200 }),
        resolver.resolve({ fishLateralOffsetPx: -300, maxAllowedLateralOffsetPx: 200 }),
        resolver.resolve({ fishLateralOffsetPx: 10, maxAllowedLateralOffsetPx: 200,
          config: { centerDeadZoneRatio: 0.1 } }),
        resolver.resolve({ fishLateralOffsetPx: -5, maxAllowedLateralOffsetPx: 0, angleRatio: 0.7 }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
    "center-defaults-and-invalid-inputs": Resolver => {
      const resolver = new Resolver();
      const results = [
        resolver.resolve(),
        resolver.resolve({ fishLateralOffsetPx: "bad", maxAllowedLateralOffsetPx: -10,
          angleRatio: "x", config: { centerDeadZoneRatio: 5 } }),
        resolver.resolve({ fishLateralOffsetPx: 20, maxAllowedLateralOffsetPx: NaN,
          angleRatio: 2 }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
  WeakestTackleLimitResolver: Object.freeze({
    "weakest-component-order-and-reel-inclusion": Resolver => {
      const resolver = new Resolver();
      const results = [
        resolver.resolve({ rod: tackleItem(9), lineSystem: { getEffectiveLineMaxLoadKg: () => 5 },
          leader: tackleItem(7), hook: tackleItem(12),
          reel: { hasReel: () => true, getEffectiveMaxLoadKg: () => 4 } }),
        resolver.resolve({ rod: { getMaxLoadKg: () => 6 }, lineSystem: { effectiveLineMaxLoadKg: 6 },
          reel: { hasReel: () => false, getEffectiveMaxLoadKg: () => 1 } }),
        resolver.resolve({ rod: tackleItem(10, { durability: 40,
          durabilityMaxLoadLossPerPercent: 0.01 }), lineSystem: { effectiveLineMaxLoadKg: 8 } }),
      ];
      assert(results.every(result => Object.isFrozen(result) && Object.isFrozen(result.candidates)));
      return results;
    },
    "fallback-invalid-limits-and-static-effective-load": Resolver => {
      const resolver = new Resolver();
      const results = [
        resolver.resolve(),
        resolver.resolve({ rod: tackleItem("bad"), lineSystem: { getEffectiveLineMaxLoadKg: () => -3 },
          leader: tackleItem(0), hook: { getEffectiveMaxLoadKg: () => NaN } }),
      ];
      assert(results.every(Object.isFrozen));
      return { results, effective: [
        Resolver.effectiveItemMaxLoadKg(null, 2),
        Resolver.effectiveItemMaxLoadKg(tackleItem(10, { durability: -50 })),
        Resolver.effectiveItemMaxLoadKg(tackleItem(10, { durability: 0,
          durabilityMaxLoadLossPerPercent: 0.5 })),
        Resolver.effectiveItemMaxLoadKg(tackleItem(-1), 3),
        Resolver.effectiveItemMaxLoadKg({}, Infinity),
      ], staticKeys: Object.getOwnPropertyNames(Resolver).filter(name =>
        !["length", "name", "prototype"].includes(name)).sort() };
    },
  }),
});

module.exports = { BATCH_015_EXECUTABLE_CASES };
