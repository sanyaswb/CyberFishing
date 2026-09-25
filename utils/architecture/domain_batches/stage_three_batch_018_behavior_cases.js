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
const tierConfig = { minimum: 1, segments: 5, source: "rating.normalized", distribution: "equal_segments" };
const metricResolver = (Resolver, profile) => new Resolver({ capabilityId: "condition",
  profileProvider: item => profile ?? item?.profile, descriptorFactory: values => Object.freeze({ ...values }) });

const BATCH_018_EXECUTABLE_CASES = Object.freeze({
  BaitEffectivenessKnowledgePolicy: Object.freeze({
    "abstract-contract-throws": Policy => [
      captureError(() => new Policy().isDiscovered({ baitId: "worm" })),
      captureError(() => new Policy().isDiscovered()),
    ],
    "prototype-shape-and-identity": Policy => ({ name: Policy.name,
      methods: Object.getOwnPropertyNames(Policy.prototype).sort(),
      staticKeys: Object.getOwnPropertyNames(Policy).filter(name =>
        !["length", "name", "prototype"].includes(name)).sort() }),
  }),
  AlwaysKnownBaitEffectivenessPolicy: Object.freeze({
    "always-discovered": Policy => [new Policy().isDiscovered({ baitId: "worm" }),
      new Policy().isDiscovered(), new Policy().isDiscovered(null)],
    "local-inheritance-chain": Policy => {
      const parent = Object.getPrototypeOf(Policy);
      assert.equal(typeof parent, "function");
      return { parent: parent.name, instanceOfParent: new Policy() instanceof parent,
        ownMethods: Object.getOwnPropertyNames(Policy.prototype).sort(),
        parentThrows: captureError(() => new parent().isDiscovered({})) };
    },
  }),
  BaitEffectivenessMatch: Object.freeze({
    "normalized-frozen-fields": Match => {
      const values = [new Match(), new Match({ baitId: "worm", instanceId: 42, candidate: { id: "c" },
        affinityMultiplier: "1.5", freshnessPercent: "80", freshnessMultiplier: 0.9, effectiveMultiplier: 1.35 })];
      assert(values.every(Object.isFrozen));
      return values.map(value => ({ ...value }));
    },
    "invalid-and-empty-inputs": Match => [
      new Match({ baitId: null, instanceId: 0, affinityMultiplier: "x", freshnessPercent: "bad",
        freshnessMultiplier: NaN, effectiveMultiplier: undefined }),
      new Match({ baitId: 7, instanceId: "", candidate: 0 }),
    ].map(value => ({ ...value, freshnessPercent: String(value.freshnessPercent) })),
  }),
  BaitFreshnessModifier: Object.freeze({
    "freshness-multiplier-curve": Modifier => {
      const modifier = new Modifier();
      return [0, 25, 50, 100, 150, -10].map(percent => modifier.resolve({ percent }))
        .concat([modifier.resolve({ percent: 50, minimumMultiplier: 0 }),
          modifier.resolve({ percent: 50, minimumMultiplier: 1 }), modifier.resolve()]);
    },
    "invalid-floor-errors": Modifier => [
      captureError(() => new Modifier().resolve({ percent: 50, minimumMultiplier: -0.1 })),
      captureError(() => new Modifier().resolve({ percent: 50, minimumMultiplier: 2 })),
      captureError(() => new Modifier().resolve({ percent: 50, minimumMultiplier: "x" })),
    ],
  }),
  ItemFreshnessStatePolicy: Object.freeze({
    "normalize-create-defaults-and-rounding": Policy => {
      const policy = new Policy();
      const results = [policy.resolvePercent(), policy.resolvePercent(null),
        policy.resolvePercent({ percent: 33.335 }), policy.normalize({ percent: "12.5" }),
        policy.create(100, { omitDefault: true }), policy.create(99.999, { omitDefault: true }),
        new Policy({ minimum: 10, maximum: 20, defaultPercent: 15 }).create(12.344)];
      return results.map(value => value && typeof value === "object" ? { ...value, frozen: Object.isFrozen(value) } : value);
    },
    "state-and-bounds-errors": Policy => [
      captureError(() => new Policy({ minimum: 5, maximum: 5 })),
      captureError(() => new Policy({ defaultPercent: 150 })),
      captureError(() => new Policy().normalize([])),
      captureError(() => new Policy().normalize({ percent: 50, extra: 1 })),
      captureError(() => new Policy().normalize({ percent: "x" })),
      captureError(() => new Policy().normalize({ percent: 101 })),
      captureError(() => new Policy().create(-1)),
    ],
  }),
  ItemBoundedMetricResolver: Object.freeze({
    "resolution-sources-clamping-and-reasons": Resolver => {
      const config = { minimum: 0, maximum: 200, instanceStatePath: "state.condition",
        statPath: "stats.condition", defaultCurrent: 50, metricLabel: "Condition" };
      const resolver = metricResolver(Resolver, config);
      return [resolver.resolve({ state: { condition: 250 } }), resolver.resolve({ stats: { condition: 40 } }),
        resolver.resolve({}), resolver.resolve({ state: { condition: "x" } }),
        resolver.resolve({}, { minimum: 0, maximum: 10, statPath: "a.b" }),
        resolver.resolve({}, null), resolver.resolve({}, []), resolver.resolve({}, { minimum: 5, maximum: 5 }),
        metricResolver(Resolver).resolve({ profile: undefined })];
    },
    "constructor-errors-and-subclassing": Resolver => {
      class Subclass extends Resolver {
        constructor() {
          super({ capabilityId: "freshness", profileProvider: () => ({ minimum: 0, maximum: 1,
            defaultCurrent: 0.25 }), descriptorFactory: values => ({ ...values }) });
        }
      }
      return { errors: [captureError(() => new Resolver()),
        captureError(() => new Resolver({ capabilityId: "x" })),
        captureError(() => new Resolver({ capabilityId: "x", profileProvider: () => null }))],
        subclass: new Subclass().resolve({}) };
    },
  }),
  ItemRatingTierResolver: Object.freeze({
    "equal-segment-tiers": Resolver => {
      const resolver = new Resolver();
      return [0, 0.19, 0.2, 0.5, 0.99, 1, 1.5, -1].map(normalized =>
        resolver.resolve({ available: true, normalized }, tierConfig));
    },
    "invalid-config-and-unavailable-rating": Resolver => {
      const resolver = new Resolver();
      const results = [resolver.resolve({ available: true, normalized: 0.5 }),
        resolver.resolve({ available: true, normalized: 0.5 }, { ...tierConfig, segments: 0 }),
        resolver.resolve({ available: true, normalized: 0.5 }, { ...tierConfig, distribution: "curve" }),
        resolver.resolve({ available: false, reason: "no_stats" }, tierConfig),
        resolver.resolve(null, tierConfig),
        resolver.resolve({ available: true, normalized: "x" }, tierConfig)];
      assert(results.every(Object.isFrozen));
      return results;
    },
  }),
});

module.exports = { BATCH_018_EXECUTABLE_CASES };
