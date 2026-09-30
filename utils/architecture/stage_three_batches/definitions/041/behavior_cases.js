"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value, (_key, item) => {
  if (item === undefined) return "#undefined";
  if (typeof item === "number" && !Number.isFinite(item)) return `#${String(item)}`;
  return item;
}));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: `${error.name}: ${error.message}` }; }
};
const methods = Type => Object.getOwnPropertyNames(Type.prototype).sort();

// A config carrying its fight physics adapter, as composition passes it (read on every call).
const physicsConfig = ({ catchZone, passive, pole, pixelsPerMeter } = {}) => ({
  fightPhysicsConfig: {
    getCatchZoneConfig: () => catchZone,
    getPassiveRetrieveConfig: () => passive,
    getPoleIdleRetrieveConfig: () => pole,
    getPixelsPerMeter: () => pixelsPerMeter,
  },
});
const rodWith = ({ hasReel, lengthMeters, stats } = {}) => ({
  ...(hasReel === undefined ? {} : { hasReel: () => hasReel }),
  ...(lengthMeters === undefined ? {} : { getLengthMeters: () => lengthMeters }),
  ...(stats ? { effectiveStats: stats } : {}),
});
const reelVariants = [
  undefined, null, { hasReel: () => false }, { hasReel: () => true },
  { effectiveStats: { lineCapacityMeters: 0, basePower: 0 } }, { effectiveStats: { lineCapacityMeters: 120 } },
  { effectiveStats: { basePower: 3 } }, { effectiveStats: {} }, {},
];
const rodVariants = [
  undefined, null, rodWith({ hasReel: false }), rodWith({ hasReel: true }), rodWith({ stats: { hasReel: false } }),
  rodWith({ stats: { hasReel: true } }), rodWith({}), rodWith({ hasReel: undefined, stats: { hasReel: false } }),
];
const resolverSelection = (Resolver, [first, second]) => {
  const resolver = new Resolver();
  const kinds = [];
  for (const rod of rodVariants) {
    for (const reel of reelVariants) {
      const policy = resolver.resolve({ rod, reel });
      kinds.push(policy === resolver[first] ? first : policy === resolver[second] ? second : "other");
    }
  }
  return { kinds, missing: resolver.resolve() === resolver[first], empty: resolver.resolve({}) === resolver[first] };
};

const EXECUTABLE_CASES = Object.freeze({
  LandingPolicy: Object.freeze({
    "abstract-distance-and-zone-inputs": Policy => {
      const abstract = new Policy();
      class Fixed extends Policy {
        getLandingDistanceMeters(context) { this.seen.push(snapshot(context)); return 4; }
      }
      const fixed = new Fixed();
      fixed.seen = [];
      const contexts = [{}, { lineDistanceMeters: 3 }, { lineDistanceMeters: 4 }, { lineDistanceMeters: 4.01 },
        { shoreLandingDistanceMeters: 2, lineDistanceMeters: 9 }, { shoreLandingDistanceMeters: null, lineDistanceMeters: 1 },
        { lineDistanceMeters: -5 }, { lineDistanceMeters: "3" }, { lineDistanceMeters: "x" }, { lineDistanceMeters: NaN },
        { lineDistanceMeters: Infinity }];
      return {
        methods: methods(Policy),
        abstract: attempt(() => abstract.getLandingDistanceMeters()),
        abstractZone: attempt(() => abstract.isInLandingZone({ lineDistanceMeters: 1 })),
        zones: contexts.map(context => fixed.isInLandingZone(context)),
        noArgument: fixed.isInLandingZone(),
        seen: fixed.seen,
      };
    },
  }),
  ReelLandingPolicy: Object.freeze({
    "catch-zone-config-and-defaults": Policy => {
      const policy = new Policy();
      const configs = [undefined, null, {}, { fightPhysicsConfig: null }, physicsConfig({}),
        physicsConfig({ catchZone: {} }), physicsConfig({ catchZone: { landingDistanceMeters: 3 } }),
        physicsConfig({ catchZone: { reel: { landingDistanceMeters: 2.5 }, landingDistanceMeters: 3 } }),
        physicsConfig({ catchZone: { reel: { landingDistanceMeters: -2 } } }),
        physicsConfig({ catchZone: { reel: { landingDistanceMeters: 0 } } }),
        physicsConfig({ catchZone: { reel: {}, landingDistanceMeters: "4" } }),
        { fightPhysicsConfig: {} }];
      return {
        methods: methods(Policy),
        distances: configs.map(config => policy.getLandingDistanceMeters({ config })),
        noArgument: policy.getLandingDistanceMeters(),
        zones: [policy.isInLandingZone({ lineDistanceMeters: 1 }), policy.isInLandingZone({ lineDistanceMeters: 1.5 }),
          policy.isInLandingZone({ config: physicsConfig({ catchZone: { reel: { landingDistanceMeters: 2 } } }),
            shoreLandingDistanceMeters: 2 })],
      };
    },
  }),
  PoleLandingPolicy: Object.freeze({
    "rod-length-clamps-and-fallbacks": Policy => {
      const policy = new Policy();
      const zone = { landingDistanceMeters: 2, pole: { landingDistanceByRodLength: 0.5, minLandingDistanceMeters: 1.5,
        maxLandingDistanceMeters: 3 } };
      const rods = [undefined, null, rodWith({ lengthMeters: 4 }), rodWith({ lengthMeters: 10 }), rodWith({ lengthMeters: 1 }),
        rodWith({ lengthMeters: -3 }), rodWith({ lengthMeters: "5" }), rodWith({ stats: { lengthMeters: 6 } }),
        rodWith({ lengthMeters: undefined, stats: { lengthMeters: 5 } }), { getLengthMeters: () => null, effectiveStats: { lengthMeters: 4 } }];
      const configs = [undefined, physicsConfig({ catchZone: zone }), physicsConfig({ catchZone: {} }),
        physicsConfig({ catchZone: { pole: { minLandingDistanceMeters: 5, maxLandingDistanceMeters: 2 } } }),
        physicsConfig({ catchZone: { pole: { landingDistanceByRodLength: -1 }, landingDistanceMeters: 0 } })];
      return {
        methods: methods(Policy),
        distances: configs.map(config => rods.map(rod => policy.getLandingDistanceMeters({ rod, config }))),
        noArgument: policy.getLandingDistanceMeters(),
        zones: [policy.isInLandingZone({ rod: rodWith({ lengthMeters: 4 }), config: physicsConfig({ catchZone: zone }),
          lineDistanceMeters: 2 }), policy.isInLandingZone({ rod: rodWith({ lengthMeters: 4 }),
          config: physicsConfig({ catchZone: zone }), lineDistanceMeters: 2.1 })],
      };
    },
  }),
  LandingPolicyResolver: Object.freeze({
    "reel-and-pole-selection-and-injection": Resolver => {
      const reelPolicy = { kind: "reel" };
      const polePolicy = { kind: "pole" };
      const injected = new Resolver({ reelPolicy, polePolicy });
      const defaults = new Resolver();
      return {
        methods: methods(Resolver),
        selection: resolverSelection(Resolver, ["reelPolicy", "polePolicy"]),
        injected: [injected.reelPolicy === reelPolicy, injected.polePolicy === polePolicy,
          injected.resolve({ rod: rodWith({ hasReel: false }) }) === polePolicy, injected.resolve() === reelPolicy],
        defaults: [defaults.reelPolicy.constructor.name, defaults.polePolicy.constructor.name,
          Object.keys(defaults).sort(), defaults.reelPolicy !== new Resolver().reelPolicy],
        partial: [new Resolver({ reelPolicy }).polePolicy.constructor.name, new Resolver({ polePolicy }).reelPolicy.constructor.name],
      };
    },
  }),
  resolveFightPhysicsConfig: Object.freeze({
    "adapter-read-and-missing-inputs": resolve => {
      const adapter = { id: "adapter" };
      return {
        type: typeof resolve,
        name: resolve.name,
        length: resolve.length,
        results: [resolve(), resolve(null), resolve({}), resolve({ fightPhysicsConfig: null }),
          resolve({ fightPhysicsConfig: 0 }), resolve({ fightPhysicsConfig: "" })],
        identity: resolve({ fightPhysicsConfig: adapter }) === adapter,
        truthy: resolve({ fightPhysicsConfig: 7 }),
      };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    LandingPolicy: ["abstract-distance-and-zone-inputs"],
    ReelLandingPolicy: ["catch-zone-config-and-defaults"],
    PoleLandingPolicy: ["rod-length-clamps-and-fallbacks"],
    LandingPolicyResolver: ["reel-and-pole-selection-and-injection"],
    resolveFightPhysicsConfig: ["adapter-read-and-missing-inputs"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-five-exact-exports",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "two-exact-classic-activations-at-their-legacy-positions",
    "five-exact-classic-consumer-relationships",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
