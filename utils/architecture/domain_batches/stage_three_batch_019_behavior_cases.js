"use strict";

const assert = require("node:assert/strict");

const captureError = action => {
  try {
    action();
  } catch (error) {
    return { name: error.name, message: error.message };
  }
  throw new Error("Expected an error");
};
const staticKeys = Class => Object.getOwnPropertyNames(Class).filter(name =>
  !["length", "name", "prototype"].includes(name)).sort();

const BATCH_019_EXECUTABLE_CASES = Object.freeze({
  BaitEffectivenessGradePolicy: Object.freeze({
    "star-grades-and-relative-effectiveness": Policy => {
      const policy = new Policy();
      const results = [0.1, 0.5, 0.6, 0.99, 1, 2].map(multiplier =>
        policy.resolve({ multiplier, referenceMultiplier: 1 }));
      results.push(new Policy({ maximumStars: 3 }).resolve({ multiplier: 0.5, referenceMultiplier: 1 }));
      assert(results.every(Object.isFrozen));
      return results;
    },
    "incompatible-defaults-and-static-maximum": Policy => {
      const results = [new Policy().resolve(), new Policy().resolve({ multiplier: 1, referenceMultiplier: 0 }),
        new Policy({ maximumStars: "bad" }).resolve({ multiplier: 1, referenceMultiplier: 1 }),
        new Policy({ maximumStars: 2.9 }).resolve({ multiplier: 0.2, referenceMultiplier: 1 }),
        new Policy({ maximumStars: -1 }).resolve({ multiplier: -1, referenceMultiplier: 1 })];
      assert(results.every(Object.isFrozen));
      return { defaultMaximumStars: Policy.DEFAULT_MAXIMUM_STARS, staticKeys: staticKeys(Policy), results };
    },
  }),
  BaitFreshnessDecayPolicy: Object.freeze({
    "linear-decay-and-clamping": Policy => {
      const policy = new Policy();
      return [policy.resolve({ percent: 100, exposureMs: 60000, lossPerMinute: 2.5 }),
        policy.resolve({ percent: 10, exposureMs: 600000, lossPerMinute: 5 }),
        policy.resolve({ percent: 150 }), policy.resolve({ percent: "40", exposureMs: -5, lossPerMinute: -1 }),
        policy.resolve({ percent: 50, exposureMs: "x", lossPerMinute: "y" })];
    },
    "invalid-percent-errors": Policy => [
      captureError(() => new Policy().resolve()),
      captureError(() => new Policy().resolve({ percent: "bad" })),
      captureError(() => new Policy().resolve({ percent: Infinity })),
    ],
  }),
  ItemQualityGradePolicy: Object.freeze({
    "normalize-and-unit-scale": Policy => {
      const policy = new Policy();
      return { normalized: [0, 1, 5.5, 10, 11, "7", "bad", null].map(value => policy.normalize(value)),
        fallback: [policy.normalize("bad", { fallback: 4 }), policy.normalize("bad", { fallback: "x" })],
        unit: [1, 5.5, 10, 20, "bad"].map(value => policy.normalizeToUnit(value)) };
    },
    "static-limits": Policy => ({ minimum: Policy.MINIMUM, maximum: Policy.MAXIMUM,
      staticKeys: staticKeys(Policy) }),
  }),
});

module.exports = { BATCH_019_EXECUTABLE_CASES };
