"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value, (_key, item) => {
  if (item === undefined) return "#undefined";
  if (typeof item === "number" && !Number.isFinite(item)) return `#${item}`;
  return item;
}));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: error.name }; }
};
const methods = Type => Object.getOwnPropertyNames(Type.prototype).sort();

// Fight physics adapters as composition passes them inside the runtime config.
const physics = (passive, pole, pixelsPerMeter) => ({ fightPhysicsConfig: {
  getPassiveRetrieveConfig: () => passive,
  getPoleIdleRetrieveConfig: () => pole,
  getPixelsPerMeter: () => pixelsPerMeter,
} });
const CONFIGS = [
  undefined, null, {}, { fightPhysicsConfig: null }, { fightPhysicsConfig: {} },
  physics({ passiveRetrievePowerRatio: 0.4, power: 9, multiplier: 20, waterFriction: 0.1 },
    { speedMetersPerSecond: 2, waterFrictionMultiplier: 0.3 }, 60),
  physics({ power: 0.7 }, { speedMetersPerSecond: -3, waterFrictionMultiplier: -1 }, 0),
  physics({ passiveRetrievePowerRatio: null, power: null, multiplier: 0, waterFriction: 0 },
    { speedMetersPerSecond: "1.5", waterFrictionMultiplier: "x" }, "40"),
  physics(null, null, NaN),
  physics({ passiveRetrievePowerRatio: 0, multiplier: null }, { speedMetersPerSecond: 0, waterFrictionMultiplier: 0 }, -5),
];
const paramsFor = policy => [...CONFIGS.map(config => attempt(() => policy.getRetrieveParams({ config }))),
  attempt(() => policy.getRetrieveParams()), attempt(() => policy.getRetrieveParams({})),
  attempt(() => policy.getRetrieveParams(null))];

const RODS_AND_REELS = [
  {}, { rod: null, reel: null }, { rod: { effectiveStats: {} } },
  { rod: { hasReel: () => false }, reel: { hasReel: () => true } },
  { rod: { effectiveStats: { hasReel: false } }, reel: { effectiveStats: { basePower: 3 } } },
  { rod: { hasReel: () => true } },
  { rod: { hasReel: () => undefined, effectiveStats: { hasReel: false } }, reel: { hasReel: () => true } },
  { rod: { effectiveStats: { hasReel: true } }, reel: { hasReel: () => false } },
  { rod: { effectiveStats: { hasReel: true } }, reel: { hasReel: () => 0 } },
  { rod: { hasReel: 1 }, reel: { effectiveStats: { lineCapacityMeters: 100 } } },
  { rod: {}, reel: { effectiveStats: { lineCapacityMeters: 0, basePower: 0 } } },
  { rod: {}, reel: { effectiveStats: { lineCapacityMeters: "5", basePower: "x" } } },
  { rod: {}, reel: { effectiveStats: { basePower: -1 } } },
  { rod: {}, reel: {} },
];

const EXECUTABLE_CASES = Object.freeze({
  RetrievePolicy: Object.freeze({
    "base-policy-returns-null": Policy => {
      const policy = new Policy();
      return { methods: methods(Policy), results: [policy.getRetrieveParams(), policy.getRetrieveParams({ config: {} }),
        policy.getRetrieveParams(null)], own: Object.keys(policy) };
    },
  }),
  PassiveLureRetrievePolicy: Object.freeze({
    "passive-retrieve-parameters-and-defaults": Policy => {
      const policy = new Policy();
      const first = policy.getRetrieveParams({ config: CONFIGS[5] });
      return { methods: methods(Policy), parent: Object.getPrototypeOf(Policy.prototype).constructor.name,
        params: paramsFor(policy), fresh: first !== policy.getRetrieveParams({ config: CONFIGS[5] }) };
    },
  }),
  PoleIdleRetrievePolicy: Object.freeze({
    "pole-idle-speed-friction-and-clamps": Policy => {
      const policy = new Policy();
      const first = policy.getRetrieveParams({ config: CONFIGS[5] });
      return { methods: methods(Policy), parent: Object.getPrototypeOf(Policy.prototype).constructor.name,
        params: paramsFor(policy), fresh: first !== policy.getRetrieveParams({ config: CONFIGS[5] }) };
    },
  }),
  IdleRetrievePolicyResolver: Object.freeze({
    "usable-reel-selection-and-injected-policies": Resolver => {
      const pole = { name: "pole" };
      const reel = { name: "reel" };
      const injected = new Resolver({ polePolicy: pole, defaultPolicy: reel });
      const defaults = new Resolver();
      const name = policy => policy === pole ? "pole" : policy === reel ? "reel" : policy?.constructor?.name;
      const selections = RODS_AND_REELS.map(context => attempt(() => name(injected.resolve(context))));
      return { methods: methods(Resolver), own: Object.keys(defaults).sort(),
        defaults: [defaults.polePolicy.constructor.name, defaults.defaultPolicy.constructor.name],
        defaultParams: [defaults.polePolicy.getRetrieveParams({ config: CONFIGS[5] }),
          defaults.defaultPolicy.getRetrieveParams({ config: CONFIGS[5] })],
        selections, noArgument: name(injected.resolve()), nullArgument: attempt(() => name(injected.resolve(null))),
        stable: defaults.resolve({}) === defaults.resolve({}),
        falsyInjection: [new Resolver({ polePolicy: 0, defaultPolicy: "" }).polePolicy.constructor.name,
          attempt(() => new Resolver(null))] };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    RetrievePolicy: ["base-policy-returns-null"],
    PassiveLureRetrievePolicy: ["passive-retrieve-parameters-and-defaults"],
    PoleIdleRetrievePolicy: ["pole-idle-speed-friction-and-clamps"],
    IdleRetrievePolicyResolver: ["usable-reel-selection-and-injected-policies"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-four-exact-exports",
    "one-exact-earlier-batch-import-bound-to-the-cumulative-instance",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position-and-one-shared-source-retirement",
    "one-exact-classic-consumer-relationship-and-one-retired-bridge",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
