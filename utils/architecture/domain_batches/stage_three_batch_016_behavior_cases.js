"use strict";

const assert = require("node:assert/strict");

const flags = { reelHoldActive: true, reelHoldSessionActive: false, rodHoldActive: true,
  controlActive: false, effectivePressureKg: 2.5 };

const BATCH_016_EXECUTABLE_CASES = Object.freeze({
  PlayerPressureFatigueSourceResolver: Object.freeze({
    "source-modes-and-activity-reasons": Resolver => {
      const resolver = new Resolver({ enabled: true });
      const results = [
        resolver.resolve(flags),
        resolver.resolve({ ...flags, reelHoldSessionActive: true }),
        resolver.resolve({ ...flags, config: { enabled: true, source: { mode: "reel_hold" } } }),
        resolver.resolve({ ...flags, reelHoldActive: false,
          config: { enabled: true, source: { mode: "reel_hold" } } }),
        resolver.resolve({ ...flags, config: { enabled: true, source: { mode: "rod_hold" } } }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
    "disabled-defaults-config-precedence-and-invalid-inputs": Resolver => {
      const results = [
        new Resolver().resolve(),
        new Resolver(null).resolve(flags),
        new Resolver({ enabled: true }).resolve({ ...flags, config: { enabled: false } }),
        new Resolver({ enabled: true, source: { mode: "reel_hold" } }).resolve({
          reelHoldActive: "yes", reelHoldSessionActive: 1, rodHoldActive: null,
          controlActive: true, effectivePressureKg: "bad" }),
        new Resolver({ enabled: true }).resolve({ reelHoldSessionActive: true,
          effectivePressureKg: -3 }),
      ];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
});

module.exports = { BATCH_016_EXECUTABLE_CASES };
