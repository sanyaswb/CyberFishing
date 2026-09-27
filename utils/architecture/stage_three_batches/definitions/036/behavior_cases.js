"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value === undefined ? null : value));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: `${error.name}: ${error.message}` }; }
};
const CONFIG = Object.freeze({ revision: 1, stats: Object.freeze({
  lengthMeters: Object.freeze({ valueType: "number", minimum: 0, operations: Object.freeze(["set"]),
    itemTypes: Object.freeze(["fishing_line"]) }),
  durability: Object.freeze({ valueType: "number", minimum: 0, maximum: 100, operations: Object.freeze(["set", "add"]) }),
  hooksCount: Object.freeze({ valueType: "integer", minimum: 1, maximum: 4, operations: Object.freeze(["set", "add", "multiply"]) }),
}) });
const line = { id: "line", itemType: "fishing_line", gameplayStats: { lengthMeters: 50, durability: 80, breakKg: 4 } };
const spring = { id: "spring", itemType: "feeder_rig", gameplayStats: { hooksCount: 2, durability: 90, nested: { a: [1, 2] } } };

// Batch 036: the item stat override policy validates runtime overrides; the effective stats
// resolver applies them to authored stats and deep-freezes the result.
const EXECUTABLE_CASES = Object.freeze({
  ItemStatOverridePolicy: Object.freeze({
    "normalize-values-operations-and-rejections": Policy => {
      const policy = new Policy({ config: CONFIG });
      const rejected = [];
      return {
        values: [policy.normalize({ definition: line, overrides: { lengthMeters: 25, durability: { add: -5 } } }),
          policy.normalize({ definition: spring, overrides: { hooksCount: { multiply: 2 }, durability: { set: 10 } } }),
          policy.normalize({ definition: line, overrides: {} })].map(snapshot),
        errors: [attempt(() => policy.normalize({ definition: line, overrides: { breakKg: 5 } })),
          attempt(() => policy.normalize({ definition: line, overrides: { missing: 1 } })),
          attempt(() => policy.normalize({ definition: spring, overrides: { lengthMeters: 1 } })),
          attempt(() => policy.normalize({ definition: line, overrides: { durability: 101 } })),
          attempt(() => policy.normalize({ definition: line, overrides: { durability: { multiply: 2 } } })),
          attempt(() => policy.normalize({ definition: line, overrides: [] })),
          attempt(() => policy.normalize({ definition: line, overrides: { lengthMeters: 1 }, allowedKeys: ["durability"] }))],
        tolerant: snapshot(policy.normalize({ definition: line, overrides: { lengthMeters: -1, durability: 50 },
          rejectInvalid: false, onRejected: entry => rejected.push(snapshot(entry)) })),
        rejected,
      };
    },
    "configuration-contract": Policy => [
      attempt(() => new Policy()), attempt(() => new Policy({ config: {} })),
      attempt(() => new Policy({ config: { stats: { x: { valueType: "text", operations: ["set"] } } } })),
      attempt(() => new Policy({ config: { stats: { x: { valueType: "number", operations: [] } } } })),
      attempt(() => new Policy({ config: { stats: { x: { valueType: "number", operations: ["set"], minimum: 5, maximum: 1 } } } })),
      attempt(() => new Policy({ config: { stats: { x: { valueType: "number", operations: ["set"], itemTypes: [] } } } })),
      attempt(() => new Policy({ config: CONFIG }).normalize({ definition: spring, overrides: { hooksCount: 3 } })),
    ],
  }),
  EffectiveItemStatsResolver: Object.freeze({
    "authored-stats-overrides-and-deep-freeze": Resolver => {
      const policy = { normalize: ({ overrides }) => overrides };
      const resolver = new Resolver({ overridePolicy: policy });
      const plain = resolver.resolve({ definition: spring });
      const overridden = resolver.resolve({ definition: spring,
        instanceState: { statOverrides: { hooksCount: 3, nested: { b: 1 }, durability: { set: 5 } } } });
      return { plain: snapshot(plain), overridden: snapshot(overridden), frozen: [Object.isFrozen(plain),
        Object.isFrozen(plain.nested), Object.isFrozen(plain.nested.a)], authoredUntouched: snapshot(spring),
        empty: snapshot(resolver.resolve()), missingPolicy: [attempt(() => new Resolver()),
          attempt(() => new Resolver({ overridePolicy: {} }))] };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    ItemStatOverridePolicy: ["normalize-values-operations-and-rejections", "configuration-contract"],
    EffectiveItemStatsResolver: ["authored-stats-overrides-and-deep-freeze"],
  },
  compatibilityCases: [
    "two-representation-only-named-esm-targets-and-two-exact-exports",
    "two-reviewed-global-this-exposures-moved-to-the-exact-activation-shims",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "two-exact-classic-activations-at-their-legacy-positions",
    "two-exact-classic-consumer-relationships",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
