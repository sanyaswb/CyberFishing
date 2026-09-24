"use strict";

const assert = require("node:assert/strict");

const BATCH_011_EXECUTABLE_CASES = Object.freeze({
  ItemMetricStrategy: Object.freeze({
    "private-id-and-constructor-validation": Strategy => {
      assert.throws(() => new Strategy(""), { name: "TypeError" });
      const instance = new Strategy(17);
      assert.equal(instance.id, "17");
      assert.throws(() => instance.evaluate({}), /evaluate must be implemented/);
      return instance.id;
    },
    "path-and-finite-number-semantics": Strategy => {
      const instance = new Strategy("metric");
      assert.equal(instance.readPath({ a: { b: 7 } }, "a.b"), 7);
      assert.equal(instance.readPath({ a: null }, "a.b"), undefined);
      assert.equal(instance.finiteNumber("3.5"), 3.5);
      assert.equal(instance.finiteNumber("invalid"), null);
      return [instance.readPath({ a: { b: 7 } }, "a.b"), instance.finiteNumber("3.5")];
    },
    "frozen-result-shape-and-fresh-identity": Strategy => {
      const instance = new Strategy("metric");
      const first = instance.available({ score: 4 });
      const second = instance.available({ score: 4 });
      const unavailable = instance.unavailable("missing", { detail: 1 });
      assert.notStrictEqual(first, second);
      assert(Object.isFrozen(first) && Object.isFrozen(unavailable));
      assert.deepEqual(Object.keys(first), ["available", "reason", "strategyId", "score"]);
      assert.deepEqual(Object.keys(unavailable), ["available", "reason", "strategyId", "detail"]);
      return [first, unavailable];
    },
    "normalization-defaults-clamps-and-direction": Strategy => {
      assert.equal(Strategy.normalizeValue(5, 0, 10, "higher_is_better"), 0.5);
      assert.equal(Strategy.normalizeValue(5, 0, 10, "lower_is_better"), 0.5);
      assert.equal(Strategy.normalizeValue(20, 0, 10, "higher_is_better"), 1);
      assert.equal(Strategy.normalizeValue(-2, 0, 10, "higher_is_better"), 0);
      assert.equal(Strategy.normalizeValue(1, 2, 2, "higher_is_better"), null);
      return [0.5, 1, 0, null];
    },
  }),
  ItemProgressionDescriptor: Object.freeze({
    "defaults-and-optional-own-keys": Descriptor => {
      const item = new Descriptor({ groupId: "g" });
      assert.deepEqual(Object.keys(item), ["available", "reason", "groupId"]);
      assert.equal(item.available, true);
      assert.equal(item.reason, null);
      assert(Object.isFrozen(item));
      return Object.keys(item);
    },
    "complete-capability-shape-and-identity": Descriptor => {
      const item = new Descriptor({ available: false, reason: "x", groupId: "g",
        rating: 1, ratingTier: 2, quality: 3, capacity: 4 });
      assert.deepEqual(Object.keys(item), ["available", "reason", "groupId", "rating", "ratingTier", "quality", "capacity"]);
      assert(Object.isFrozen(item));
      assert.notStrictEqual(item, new Descriptor({ available: false, reason: "x", groupId: "g" }));
      return Object.keys(item).map(key => [key, item[key]]);
    },
  }),
  ItemRarityDescriptor: Object.freeze({
    "exact-frozen-shape-and-default": Descriptor => {
      const item = new Descriptor({ mode: "authored", tier: 2, maxTier: 5, normalized: 0.4, isUnique: false });
      assert.deepEqual(Object.keys(item), ["mode", "tier", "maxTier", "normalized", "isUnique", "uniqueId"]);
      assert.equal(item.uniqueId, null);
      assert(Object.isFrozen(item));
      return Object.keys(item).map(key => [key, item[key]]);
    },
    "unique-identity-values": Descriptor => {
      const first = new Descriptor({ mode: "unique", tier: 1, maxTier: 1,
        normalized: 1, isUnique: true, uniqueId: "u1" });
      const second = new Descriptor({ mode: "unique", tier: 1, maxTier: 1,
        normalized: 1, isUnique: true, uniqueId: "u1" });
      assert.notStrictEqual(first, second);
      assert.equal(first.uniqueId, "u1");
      return [first.uniqueId, Object.isFrozen(first), Object.isFrozen(second)];
    },
  }),
  ItemRarityStrategy: Object.freeze({
    "default-contract-behavior": Strategy => {
      const instance = new Strategy();
      assert.equal(instance.supports({ mode: "x" }), false);
      assert.throws(() => instance.resolve({ mode: "x" }), /resolve must be implemented/);
      return instance.supports({ mode: "x" });
    },
    "subclass-substitution": Strategy => {
      class Stub extends Strategy {
        supports(profile) { return profile.mode === "x"; }
        resolve(profile) { return profile.mode; }
      }
      const instance = new Stub();
      assert(instance instanceof Strategy);
      assert.equal(instance.resolve({ mode: "x" }), "x");
      return instance.supports({ mode: "x" });
    },
  }),
  ItemRarityStrategyRegistry: Object.freeze({
    "registration-order-and-first-match": Registry => {
      const calls = [];
      const first = { supports: () => { calls.push("first"); return true; }, resolve: () => "one" };
      const second = { supports: () => { calls.push("second"); return true; }, resolve: () => "two" };
      const registry = new Registry([first, second]);
      assert.equal(registry.resolve({ mode: "x" }), "one");
      assert.deepEqual(calls, ["first"]);
      return [registry.resolve({ mode: "x" }), calls.length];
    },
    "validation-and-chain-registration": Registry => {
      const registry = new Registry();
      assert.throws(() => registry.register(null), { name: "TypeError" });
      assert.throws(() => registry.register({ supports() {} }), { name: "TypeError" });
      assert.strictEqual(registry.register({ supports: () => true, resolve: () => 7 }), registry);
      assert.equal(registry.resolve({ mode: "x" }), 7);
      return 7;
    },
    "unsupported-mode-and-instance-isolation": Registry => {
      const first = new Registry([{ supports: () => true, resolve: () => "first" }]);
      const second = new Registry();
      assert.equal(first.resolve({ mode: "x" }), "first");
      assert.throws(() => second.resolve({ mode: "x" }), /Unsupported item rarity mode: x/);
      return first.resolve({ mode: "x" });
    },
  }),
});

module.exports = { BATCH_011_EXECUTABLE_CASES };
