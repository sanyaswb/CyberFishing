"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: `${error.name}: ${error.message}` }; }
};
const descriptorFactory = values => Object.freeze({ kind: "descriptor", ...values });
const PROFILE = { minimum: 0, maximum: 100, defaultCurrent: 100, statPath: "gameplayStats.condition",
  instanceStatePath: "instanceState.condition", metricLabel: "Стан" };

// Batch 035: ItemConditionResolver resolves a bounded condition metric through the injected factory.
const EXECUTABLE_CASES = Object.freeze({
  ItemConditionResolver: Object.freeze({
    "profiles-items-and-clamping": Resolver => {
      const resolver = new Resolver({ profileProvider: item => item?.profile ?? PROFILE, descriptorFactory });
      const items = [{}, { gameplayStats: { condition: 40 } }, { instanceState: { condition: 150 } },
        { instanceState: { condition: -5 } }, { instanceState: { condition: "x" } }, { profile: null },
        { profile: { minimum: 5, maximum: 5 } }, { profile: "bad" }, { profile: { ...PROFILE, metricLabel: undefined } }];
      return items.map(item => snapshot(resolver.resolve(item)));
    },
    "explicit-config-and-constructor-contract": Resolver => {
      const resolver = new Resolver({ profileProvider: () => PROFILE, descriptorFactory });
      return { explicit: snapshot(resolver.resolve({ instanceState: { condition: 60 } }, { ...PROFILE, maximum: 200 })),
        nullConfig: resolver.resolve({}, null), isBase: Object.getPrototypeOf(Resolver).name,
        missing: [attempt(() => new Resolver()), attempt(() => new Resolver({ profileProvider: () => PROFILE }))] };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    ItemConditionResolver: ["profiles-items-and-clamping", "explicit-config-and-constructor-contract"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-one-exact-export",
    "one-exact-completed-prefix-superclass-import-bound-to-the-cumulative-instance",
    "one-esm-evaluation-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "one-exact-classic-consumer-relationship-and-one-retired-bridge",
    "stage-3.36-approved-prefix-adopted-by-the-prebuild",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
