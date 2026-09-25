"use strict";

const assert = require("node:assert/strict");

const BATCH_013_EXECUTABLE_CASES = Object.freeze({
  DEFAULT_FISH_RADIAL_RANGE: Object.freeze({
    "frozen-values-and-reference": range => {
      assert(Object.isFrozen(range));
      assert.deepEqual(Array.from(range), [0.35, 1]);
      return [range[0], range[1], Object.isFrozen(range)];
    },
  }),
  DEFAULT_FISH_LATERAL_RANGE: Object.freeze({
    "frozen-values-and-reference": range => {
      assert(Object.isFrozen(range));
      assert.deepEqual(Array.from(range), [-1, 1]);
      return [range[0], range[1], Object.isFrozen(range)];
    },
  }),
  FishDirectionIntentSampler: Object.freeze({
    "default-range-rng-order": Sampler => {
      const calls = [];
      const sampler = new Sampler({ range: (min, max) => {
        calls.push([min, max]); return min + (max - min) / 2;
      } });
      const result = sampler.sample();
      assert(Object.isFrozen(result));
      return { calls, result };
    },
    "reversed-and-invalid-ranges": Sampler => {
      const sampler = new Sampler({ next: () => 0.25 });
      return [sampler.sample({ radialRange: [2, 1], lateralRange: [3, -1] }),
        sampler.sample({ radialRange: ["bad", 1], lateralRange: null })];
    },
  }),
  FishingCastExposureResolver: Object.freeze({
    "elapsed-cast-time-and-inactive-edge-cases": Resolver => {
      const resolver = new Resolver();
      return [resolver.resolve({ nowMs: 1500, castStartTimeMs: 1000, timeScale: 2 }),
        resolver.resolve({ nowMs: 500, castStartTimeMs: 1000 }),
        resolver.resolve({ active: false, nowMs: 1500, castStartTimeMs: 1000 }),
        resolver.resolve({ nowMs: NaN, castStartTimeMs: 1000 })];
    },
  }),
  PlayerForceBudgetAllocator: Object.freeze({
    "hold-control-allocation-and-clamps": Allocator => {
      const allocator = new Allocator();
      const normal = allocator.resolve({ rodLimitKg: 10, fishTensionKg: 4,
        holdAction: { active: true }, controlAction: { active: true, inputRatio: 0.5 } });
      const blocked = allocator.resolve({ rodLimitKg: 10, fishTensionKg: 12,
        controlAction: { active: true, inputRatio: 2 },
        controlEligibility: { canRequestForce: false, blockedReason: "blocked" } });
      assert(Object.isFrozen(normal) && Object.isFrozen(blocked));
      return [normal, blocked];
    },
  }),
  PlayerPressureFatigueCalculator: Object.freeze({
    "pressure-fatigue-and-recovery-frames": Calculator => {
      const calculator = new Calculator();
      const pressure = calculator.calculate({ dtSec: 0.1, pressureKg: 2,
        sourceActive: true, config: { enabled: true } });
      const recovery = calculator.calculate({ state: pressure, dtSec: 0.2,
        sourceActive: false, config: { enabled: true } });
      assert(Object.isFrozen(pressure) && Object.isFrozen(recovery));
      return [pressure, recovery];
    },
  }),
  RodControlAngleResolver: Object.freeze({
    "rod-angle-clamping-and-directions": Resolver => {
      const resolver = new Resolver();
      const inputs = { absOffsetX: 10, targetRodY: 20, fishY: 0 };
      const results = [resolver.resolve(inputs), resolver.resolve({ ...inputs, aligned: true }),
        resolver.resolve({ ...inputs, centerStartActive: true }),
        resolver.resolve({ ...inputs, config: { maxEffectiveAngleDeg: 0 } })];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
  StaminaRegenCalculator: Object.freeze({
    "regen-phase-and-configuration-boundaries": Calculator => {
      const calculator = new Calculator();
      const results = [calculator.calculate({ recoveryAllowed: false, dtSec: 1 }),
        calculator.calculate({ recoveryAllowed: true, dtSec: 0.5, lineAngleDeg: 10,
          playerFatigueProgress: 0.25 }),
        calculator.calculate({ recoveryAllowed: true, dtSec: -1, config: { enabled: false } })];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
});

module.exports = { BATCH_013_EXECUTABLE_CASES };
