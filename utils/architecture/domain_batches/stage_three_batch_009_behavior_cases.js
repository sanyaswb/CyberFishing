"use strict";
const assert = require("node:assert/strict");
const plain = x => JSON.parse(JSON.stringify(x));
const ranges = () => ({ maxLevel: 3, levelWeightRanges: [
  { level: 1, min: 1, max: 2 }, { level: 2, min: 4, max: 5 }, { level: 3, min: 7, max: 8 },
] });
const success = { enabled: true, chance: 0.5, anomalyId: " GOLD " };

const CASES = Object.freeze({
  FishAnomalyVariantResolver: Object.freeze({
    "disabled-and-missing-config": T => {
      const r = new T(); const none = r.resolve();
      assert.deepEqual(plain(none), { anomalyId: "none", hasAnomaly: false });
      assert.equal(r.resolve({ config: { enabled: false }, roll: 0 }), none);
      return none;
    },
    "strict-enabled-false-only": T => {
      const r = new T(); const out = [0, null, "false"].map(enabled => r.resolve({ config: { ...success, enabled }, roll: 0 }));
      assert(out.every(x => x.hasAnomaly)); return out;
    },
    "exact-roll-threshold": T => {
      const r = new T(); const out = [0.5 - Number.EPSILON, 0.5, 0.5 + Number.EPSILON]
        .map(roll => r.resolve({ config: success, roll }));
      assert.deepEqual(out.map(x => x.hasAnomaly), [true, false, false]); return out;
    },
    "chance-clamps-and-invalid-values": T => {
      const r = new T(); const out = [-1, 0, 1, 2, NaN, Infinity, -Infinity, "0.4"]
        .map(chance => r.resolve({ config: { ...success, chance }, roll: 0 }));
      assert.deepEqual(out.map(x => x.hasAnomaly), [false, false, true, true, false, false, false, true]); return out;
    },
    "roll-clamps-and-defaults": T => {
      const r = new T(); const out = [-1, 0, 1, 2, NaN, Infinity, null, "0.2", undefined]
        .map(roll => r.resolve({ config: success, roll }));
      assert.deepEqual(out.map(x => x.hasAnomaly), [true, true, false, false, false, false, true, true, false]); return out;
    },
    "chance-override-nullish-vs-zero": T => {
      const r = new T(); const out = [undefined, null, 0, 1, NaN, false, "0.7"]
        .map(chanceOverride => r.resolve({ config: success, roll: 0.1, chanceOverride }));
      assert.deepEqual(out.map(x => x.hasAnomaly), [true, true, false, true, false, false, true]); return out;
    },
    "location-trim-case-and-array-semantics": T => {
      const r = new T(); const config = { ...success, locationIds: ["lake"] };
      const out = ["lake", " lake ", "LAKE", ""].map(locationId => r.resolve({ config, roll: 0, locationId }));
      assert.deepEqual(out.map(x => x.hasAnomaly), [true, true, false, false]);
      assert(r.resolve({ config: { ...success, locationIds: "lake" }, roll: 0 }).hasAnomaly);
      return out;
    },
    "anomaly-id-normalization": T => {
      const r = new T(); const out = [" GOLD ", "none", " NONE ", "", null, 0]
        .map(anomalyId => r.resolve({ config: { ...success, anomalyId }, roll: 0 }));
      assert.deepEqual(out.map(x => x.hasAnomaly), [true, false, false, false, false, false]);
      assert.equal(out[0].anomalyId, "gold"); return out;
    },
    "custom-none-id-and-default-normalization": T => {
      const custom = new T({ noneAnomalyId: " OFF " });
      assert.equal(custom.resolve().anomalyId, "off");
      assert(!custom.resolve({ config: { ...success, anomalyId: "OFF" }, roll: 0 }).hasAnomaly);
      assert.equal(new T({ noneAnomalyId: " " }).resolve().anomalyId, "none");
      return custom.resolve();
    },
    "none-cache-same-instance-cross-instance-isolation": T => {
      const a = new T(), b = new T(); const none = a.resolve();
      assert.equal(a.resolve({ config: success, roll: 1 }), none);
      assert.notEqual(b.resolve(), none);
      const x = a.resolve({ config: success, roll: 0 }), y = a.resolve({ config: success, roll: 0 });
      assert.notEqual(x, y); assert.notEqual(x, none);
      assert(Object.isFrozen(none) && Object.isFrozen(x));
      return { none, x, cached: true, isolated: true };
    },
    "input-immutability-and-result-shape": T => {
      const config = Object.freeze({ ...success, locationIds: Object.freeze(["lake"]) });
      const out = new T().resolve(Object.freeze({ config, locationId: "lake", roll: 0 }));
      assert.deepEqual(Object.keys(out).sort(), ["anomalyId", "hasAnomaly"]);
      assert(Object.isFrozen(out)); assert.equal(config.anomalyId, " GOLD "); return out;
    },
    "null-argument-errors-remain-errors": T => {
      assert.throws(() => new T(null), { name: "TypeError" });
      assert.throws(() => new T().resolve(null), { name: "TypeError" }); return "TypeError";
    },
  }),
  FishRarityResolver: Object.freeze({
    "defaults-and-nested-frozen-result": T => {
      const out = new T().resolve();
      assert.equal(out.level, 1); assert.equal(out.maxLevel, 1);
      assert.equal(out.rarity.halfSteps, 1); assert.equal(out.rarity.stars, 0.5);
      assert(Object.isFrozen(out) && Object.isFrozen(out.rarity));
      assert.deepEqual(Object.keys(out).sort(), ["anomaly", "hasAnomaly", "isUnique", "level", "maxLevel", "rarity"]);
      assert.deepEqual(Object.keys(out.rarity).sort(), ["halfSteps", "isMaximum", "isResolved", "levelMaxWeightKg", "levelMinWeightKg", "maxHalfSteps", "maxStars", "stars", "unitsPerStar", "weightBand", "weightBandCount"]);
      return out;
    },
    "configured-range-inclusive-boundaries": T => {
      const r = new T(); const out = [0, 1, 2, 4, 5, 7, 8, 9]
        .map(weightKg => r.resolveLevel({ weightKg, weightConfig: ranges() }));
      assert.deepEqual(out, [1, 1, 1, 2, 2, 3, 3, 3]); return out;
    },
    "range-gap-tie-prefers-upper-level": T => {
      const r = new T(); const out = [2.999, 3, 3.001, 6]
        .map(weightKg => r.resolveLevel({ weightKg, weightConfig: ranges() }));
      assert.deepEqual(out, [1, 2, 2, 3]); return out;
    },
    "weight-unit-half-rounding-epsilon": T => {
      const r = new T(); const out = [2.99949, 2.9995, 2.99951]
        .map(weightKg => r.resolveLevel({ weightKg, weightConfig: ranges() }));
      assert.deepEqual(out, [1, 2, 2]); return out;
    },
    "normalize-sort-reversed-and-invalid-ranges": T => {
      const input = { levelWeightRanges: [{ level: 2, min: 5, max: 4 }, { level: NaN, min: 0, max: 1 }, { level: 1, min: 2, max: 1 }] };
      const before = JSON.stringify(input); const r = new T();
      const out = [1, 4].map(weightKg => r.resolve({ weightKg, weightConfig: input }));
      assert.deepEqual(out.map(x => x.level), [1, 2]); assert.equal(JSON.stringify(input), before); return out;
    },
    "invalid-weight-with-ranges": T => {
      const r = new T(); const out = [NaN, Infinity, -Infinity, undefined, null, "4"]
        .map(weightKg => r.resolveLevel({ weightKg, weightConfig: ranges() }));
      assert.deepEqual(out, [1, 1, 1, 1, 1, 2]); return out;
    },
    "derived-level-depth-clamps-and-rounding": T => {
      const r = new T(); const out = [-1, 0, 2.5, 5, 7.5, 10, 20].map(weightKg => r.resolveLevel({
        weightKg, weightConfig: { maxLevel: 4 }, depthConfig: { minWeightAtMinDepth: 0, maxWeightAtMaxDepth: 10 },
      }));
      assert.deepEqual(out, [1, 1, 1, 2, 3, 4, 4]); return out;
    },
    "reversed-degenerate-and-invalid-depth": T => {
      const r = new T(); const out = [
        { minWeightAtMinDepth: 10, maxWeightAtMaxDepth: 0 },
        { minWeightAtMinDepth: 5, maxWeightAtMaxDepth: 5 }, {},
      ].map(depthConfig => r.resolveLevel({ weightKg: 5, weightConfig: { maxLevel: 4 }, depthConfig }));
      assert.deepEqual(out, [2, 1, 1]); return out;
    },
    "explicit-level-and-max-level-clamps": T => {
      const r = new T(); const out = [-2, 0, 1.49, 1.5, 99, NaN, Infinity]
        .map(level => r.resolveForLevel({ level, weightConfig: { maxLevel: 3 } }).level);
      assert.deepEqual(out, [1, 1, 1, 2, 3, 1, 3]); return out;
    },
    "inclusive-weight-bands": T => {
      const r = new T({ weightBandsPerLevel: 3, weightUnitsPerKg: 10 });
      const wc = { maxLevel: 2, levelWeightRanges: [{ level: 1, min: 0, max: 0.8 }] };
      const out = [-1, 0, 0.2, 0.3, 0.5, 0.6, 0.8, 9].map(weightKg =>
        r.resolveForLevel({ level: 1, weightKg, weightConfig: wc }).rarity.weightBand);
      assert.deepEqual(out, [1, 1, 1, 2, 2, 3, 3, 3]); return out;
    },
    "scale-precedence-and-maximum-stars": T => {
      const r = new T({ scale: { fishWeightBands: 3, weightBandsPerLevel: 99, maxUnits: 4, maxHalfSteps: 99, unitsPerStar: 2 }, maxUnits: 99 });
      const out = r.resolveForLevel({ level: 99, weightConfig: { maxLevel: 99 } });
      assert.equal(out.rarity.maxHalfSteps, 4); assert.equal(out.rarity.weightBandCount, 3);
      assert.equal(out.rarity.stars, 2); assert.equal(out.rarity.isMaximum, true); return out;
    },
    "zero-fallback-negative-clamp-and-rounding-config": T => {
      const fallback = new T({ maxUnits: 0, unitsPerStar: 0, fishWeightBands: 0 }).resolve();
      const clamped = new T({ maxUnits: -1, unitsPerStar: -1, fishWeightBands: -1 }).resolve();
      const rounded = new T({ maxUnits: 3.5, unitsPerStar: 1.5, fishWeightBands: 2.5 }).resolve();
      assert.equal(fallback.rarity.maxHalfSteps, 12); assert.equal(clamped.rarity.maxHalfSteps, 1);
      assert.equal(rounded.rarity.maxHalfSteps, 4); assert.equal(rounded.rarity.weightBandCount, 3);
      return { fallback, clamped, rounded };
    },
    "none-id-config-snapshot-and-instance-isolation": T => {
      const ids = [" OFF "]; const config = { fish: { noneAnomalyIds: ids } }; const a = new T(config);
      ids.push("gold"); const b = new T(config);
      assert.equal(a.resolve({ baseAnomaly: " off " }).hasAnomaly, false);
      assert.equal(a.resolve({ baseAnomaly: " GOLD " }).hasAnomaly, true);
      assert.equal(b.resolve({ baseAnomaly: "gold" }).hasAnomaly, false);
      // Custom none set intentionally does NOT implicitly include "none".
      assert.equal(a.resolve().hasAnomaly, true);
      return { a: a.resolve({ baseAnomaly: "gold" }), b: b.resolve({ baseAnomaly: "gold" }) };
    },
    "fresh-results-no-shared-cache": T => {
      const r = new T(); const a = r.resolve(), b = r.resolve();
      assert.notEqual(a, b); assert.notEqual(a.rarity, b.rarity);
      assert.notEqual(new T().resolve(), a); assert.deepEqual(plain(a), plain(b)); return a;
    },
    "resolve-rarity-api-and-no-input-mutation": T => {
      const config = Object.freeze({ maxLevel: 3, levelWeightRanges: Object.freeze(ranges().levelWeightRanges.map(Object.freeze)) });
      const input = Object.freeze({ level: 2, weightKg: 4.5, weightConfig: config }); const r = new T();
      assert.deepEqual(plain(r.resolveRarity(input)), plain(r.resolveForLevel(input).rarity));
      assert.deepEqual(Object.keys(r), []); return r.resolveRarity(input);
    },
    "null-argument-errors-remain-errors": T => {
      assert.throws(() => new T(null), { name: "TypeError" });
      assert.throws(() => new T().resolve(null), { name: "TypeError" }); return "TypeError";
    },
  }),
});
module.exports = { BATCH_009_EXECUTABLE_CASES: CASES };
