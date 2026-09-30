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

const RULE_MESSAGES = Object.freeze({
  rodKinds: Object.freeze({ none: "none", spinning: "spin", feeder: "feed", bolognese: "bolo", pole: "pole",
    custom: "custom", unknown: "unknown" }),
});
const LINE_MESSAGES = Object.freeze({
  lineRodRequired: "rod-required",
  lineReelRequired: "reel-required",
  lineTooShortForRod: minimum => `short:${minimum}`,
  reelTooSmallForLine: (minimum, maximum) => `small:${minimum}:${maximum}`,
  lineWillBeCut: length => `cut:${length}`,
  windingReelMissing: "reel-missing",
  lineLengthUnavailable: "line-unavailable",
  reelCapacityUnavailable: "capacity-unavailable",
  lineWillBeWound: length => `wound:${length}`,
});
const CAPACITY_MESSAGES = Object.freeze({ lineCapacityInventoryDetail: "inventory", lineCapacityEquippedDetail: "equipped",
  lineCapacityMetricLabel: "capacity", lineCapacityMetricSuffix: "m" });

const EXECUTABLE_CASES = Object.freeze({
  EquipmentRules: Object.freeze({
    "equipment-kinds-selection-and-depth": Rules => {
      const calls = [];
      const calculator = {
        getMaxCastDistancePx: (...args) => { calls.push(["max", snapshot(args)]); return args[1] === 77 ? NaN : 120; },
        getEffectiveCastDistancePx: (...args) => { calls.push(["effective", snapshot(args)]); return 75; },
        getBuildCastPowerCoefficient: (...args) => { calls.push(["power", snapshot(args)]); return 0.65; },
        describe: (...args) => { calls.push(["describe", snapshot(args)]); return { distance: 42 }; },
        getFloatLineBudget: (...args) => { calls.push(["budget", snapshot(args)]); return { applies: true, maxDepthMeters: 6.5 }; },
      };
      const config = { casting: { powerCoefficient: 0.4 }, fightPhysicsConfig: {
        getCastingPowerConfig: () => ({ fallbackCoefficient: 0.55 }),
        getLureRetrieveConfig: () => ({ defaultSurfaceDepthMeters: 0.25 }),
      } };
      const rules = new Rules(calculator, config, RULE_MESSAGES);
      const equipment = [undefined, {}, { rod: { variant: "spinning" }, line: { effectiveStats: { lengthMeters: 10 } },
        baits: [{ variant: "jig", effectiveStats: { maxDepth: 9 } }] },
      { rod: { variant: "feeder" } }, { rod: { variant: "float", effectiveStats: { hasReel: true } },
        float: {}, baits: [{}] }, { rod: { variant: "pole" }, float: {}, baits: [{}] },
      { rod: { variant: "custom" }, line: { effectiveStats: { lengthMeters: "x" } } }];
      return { facts: equipment.map(item => ({ spinning: rules.isSpinning(item), feeder: rules.isFeeder(item),
        float: rules.isFloatRod(item), kind: rules.getRodKind(item), name: rules.getRodDisplayName(item),
        reel: rules.requiresReel(item), line: rules.hasEquippedLine(item), depth: rules.canSelectDepth(item),
        maxDepth: rules.getMaxHookDepth(item, config) })),
      distances: [rules.getMaxCastDistance(equipment[2], 50, 3), rules.getMaxCastDistance(equipment[2], 77),
        rules.getEffectiveCastDistance(equipment[2], 99, null, 4), rules.getEffectiveCastDistance(equipment[2], 99, 0.8)],
      power: rules.getCastPowerCoefficient(equipment[2]), info: rules.getCastDistanceInfo(equipment[2], 0.5, 2),
      budget: rules.getFloatLineBudget(equipment[3], 1), calls, methods: methods(Rules) };
    },
  }),
  BaitRules: Object.freeze({
    "bait-types-and-physics": Rules => {
      const rules = new Rules();
      const items = [undefined, null, {}, { itemType: "lure", variant: "jig", effectiveStats: { sinkSpeed: 0.5 } },
        { itemType: "bait", effectiveStats: { sinkSpeed: 0 } }, { itemType: "spinner" }];
      return { items: items.map(item => [rules.isActiveLure(item), rules.getPhysicsType(item, "fallback"),
        rules.getSinkRate(item, 2)]), types: [[], ["bait"], ["jig"], ["x", "wobbler"], [null, "spinner"]]
        .map(value => rules.hasActiveLureType(value)), methods: methods(Rules) };
    },
  }),
  CastRules: Object.freeze({
    "bounds-distance-and-rod-position": Rules => {
      const calls = [];
      const distances = [Infinity, 100, 30, 0];
      const rules = new Rules({ getEffectiveCastDistance: (...args) => { calls.push(snapshot(args)); return distances.shift(); } });
      const bounds = { top: 10, bottom: 210 };
      return { results: [rules.canCastAt(0, 0, {}, bounds, null, 1), rules.canCastAt(0, 109, {}, bounds, null, 2),
        rules.canCastAt(30, 190, {}, bounds, { x: 0, y: 200 }, 3),
        rules.canCastAt(0, 210, {}, bounds, { x: 0, y: 210 })], calls, methods: methods(Rules) };
    },
  }),
  BiteRules: Object.freeze({
    "hook-size-and-bite-sequence": Rules => {
      const seen = [];
      const rules = new Rules({ hasActiveLureType: types => { seen.push(snapshot(types)); return types.includes("active"); } });
      const equipment = [undefined, {}, { hooks: [{ effectiveStats: { hookSizeGrade: 4 } }] },
        { hooks: [{ effectiveStats: { hookSizeGrade: 0 } }], baits: [{ effectiveStats: { hookSizeGrade: 3 } }] }];
      const fish = { biteMechanics: { active: ["a"], passive: ["p"] } };
      return { hooks: equipment.map(item => rules.getHookSize(item)), sequences: [rules.selectBiteSequence(null, []),
        rules.selectBiteSequence({}, []), rules.selectBiteSequence(fish, ["active"]),
        rules.selectBiteSequence(fish, ["passive"])].map(snapshot), seen, methods: methods(Rules) };
    },
  }),
  ChumRules: Object.freeze({
    "delivery-load-and-sections": Rules => {
      const rules = new Rules();
      const equipment = [undefined, {}, { delivery: {} }, { deliveryChums: [null, false, { id: 1 }] },
        { deliveryChums: [] }];
      return { facts: equipment.map(item => [rules.getDeliveryMethod(item), rules.hasLoadedDeliveryChum(item)]),
        sections: [undefined, {}, { effectiveStats: { sections: 0 } }, { effectiveStats: { sections: 3 } }]
          .map(item => rules.getDeliverySections(item)), methods: methods(Rules) };
    },
  }),
  BoatRules: Object.freeze({
    "manual-state-targeting-and-cast": Rules => {
      const rules = new Rules();
      const items = [undefined, {}, { effectiveStats: { manualControl: false, hasAutoReturn: true } },
        { effectiveStats: { manualControl: true, hasAutoReturn: false } }];
      const boats = [undefined, null, { state: "idle", pos: { y: 900 }, remainingSections: 0 },
        { state: "waiting", pos: { y: 950 }, remainingSections: 2 },
        { state: "drifting", pos: { y: 100 }, remainingSections: 1 },
        { state: "returning", pos: { y: 850 }, remainingSections: 0 }];
      const facts = [];
      for (const item of items) for (const boat of boats) facts.push([rules.isManual(item), rules.isBusy(boat),
        rules.canBeRemovedNearShore(boat, { bottom: 1000 }), rules.canAcceptManualTarget(boat),
        rules.canDropManualChum(boat, item), rules.canAutoReturn(item), rules.canPlayerCastWithBoat(boat, item)]);
      return { facts, methods: methods(Rules) };
    },
  }),
  PlayerCastRules: Object.freeze({
    "equipment-and-boat-gates": Rules => {
      const calls = [];
      const equipmentRules = { requiresReel: equipment => equipment.rod.needsReel,
        hasEquippedLine: equipment => equipment.line === true };
      const boatRules = { canPlayerCastWithBoat: (boat, delivery) => { calls.push([snapshot(boat), snapshot(delivery)]);
        return boat?.allowed !== false; } };
      const rules = new Rules(boatRules, equipmentRules);
      const cases = [[undefined, null], [{}, null], [{ rod: { needsReel: true }, line: true }, null],
        [{ rod: { needsReel: true }, reel: {}, line: false }, null],
        [{ rod: { needsReel: true }, reel: {}, line: true, delivery: { id: 1 } }, { allowed: true }],
        [{ rod: { needsReel: false }, line: true }, { allowed: false }]];
      return { results: cases.map(([equipment, boat]) => rules.canPlayerCast(equipment, boat)), calls, methods: methods(Rules) };
    },
  }),
  DistanceUnitConverter: Object.freeze({
    "configuration-and-conversions": Converter => {
      const configs = [undefined, null, {}, { pixelsPerMeter: 40 },
        { physics: { simulation: { pixelsPerMeter: 64 } } }, { simulation: { pixelsPerMeter: "x" } },
        { pixelsPerMeter: 0.5 }, { physics: {}, pixelsPerMeter: 70 }];
      return { facts: configs.map(config => { const value = new Converter(config); return [value.pixelsPerMeter,
        ...[0, 1, 2.5, -3, "4", NaN, Infinity].map(input =>
          [value.metersToPixels(input), value.pixelsToMeters(input)])]; }), methods: methods(Converter) };
    },
  }),
  CompositeMetricStrategy: Object.freeze({
    "components-baselines-and-failures": Strategy => {
      const strategy = new Strategy();
      const registry = { get(id) { return {
        normalized: { evaluate: () => ({ available: true, metricId: "n", rawValue: 8, normalized: 0.8,
          minimum: 0, maximum: 10 }) },
        baseline: { evaluate: () => ({ available: true, metricId: "b", rawValue: 5,
          normalized: null, minimum: null, maximum: null }) },
        missing: { evaluate: () => ({ available: false, reason: "component-missing" }) },
        invalid: { evaluate: () => ({ available: true, metricId: "i", rawValue: "x", normalized: null }) },
      }[id]; } };
      const baselines = { resolve: ({ metricKey }) => metricKey === "component:1"
        ? { available: true, minimum: 0, maximum: 10 } : { available: false, reason: "no-baseline" } };
      const evaluate = components => snapshot(strategy.evaluate({ item: { id: 1 }, groupId: "g",
        ratingConfig: { components }, strategyRegistry: registry, baselineRegistry: baselines }));
      return { id: strategy.id, empty: snapshot(strategy.evaluate()), missingStrategy: evaluate([{ strategyId: "unknown" }]),
        missingMetric: evaluate([{ strategyId: "missing" }]), invalid: evaluate([{ strategyId: "invalid" }]),
        combined: evaluate([{ strategyId: "normalized", weight: 0.75, metricLabel: "A" },
          { strategyId: "baseline", weight: 0.5, direction: "higher_is_better" }]), methods: methods(Strategy) };
    },
  }),
  ItemCapacityResolver: Object.freeze({
    "capacity-sources-and-unavailable-results": Resolver => {
      const effectiveCalls = [];
      const resolver = new Resolver({ effectiveStatsResolver: { resolve: value => { effectiveCalls.push(snapshot(value));
        return { lengthMeters: 120 }; } }, messages: CAPACITY_MESSAGES });
      const config = { strategyId: "line_capacity", statPath: "effectiveStats.lengthMeters" };
      const item = { instanceId: "line-1", effectiveStats: { lengthMeters: 80 } };
      const contexts = [{}, { catalogItem: { id: "catalog" } }, { catalogItem: { effectiveStats: { lengthMeters: 100 } } },
        { catalogItem: { effectiveStats: { lengthMeters: 100 } }, lineCapacity: {
          equippedLineInstanceId: "line-1", reelCapacityMeters: 60 } },
        { catalogItem: { effectiveStats: { lengthMeters: 100 } }, lineCapacity: {
          equippedLineInstanceId: "line-1", reelCapacityMeters: 60,
          activeState: { lineInstanceId: "line-1", hasReel: true, remainingMeters: 25 } } }];
      const results = contexts.map(context => resolver.resolve({ item, capacityConfig: config, context }));
      return { results: results.map(snapshot), frozen: results.map(Object.isFrozen), effectiveCalls,
        unavailable: [resolver.resolve(), resolver.resolve({ item, capacityConfig: {} }),
          resolver.resolve({ item: {}, capacityConfig: config }), resolver.resolve({ item: { effectiveStats: { lengthMeters: 0 } },
            capacityConfig: config })].map(snapshot), methods: methods(Resolver) };
    },
  }),
  ItemRatingResolver: Object.freeze({
    "constructor-strategy-baseline-and-range": Resolver => {
      const baselineCalls = [];
      const strategies = {
        ready: { id: "ready", evaluate: () => ({ available: true, metricId: "m", rawValue: 8,
          minimum: 0, maximum: 10, normalized: 0.8, breakdown: Object.freeze([{ x: 1 }]) }) },
        raw: { id: "raw", evaluate: () => ({ available: true, metricId: "raw", rawValue: 15,
          minimum: null, maximum: null, normalized: null }) },
        missing: { id: "missing", evaluate: () => ({ available: false, reason: "metric-absent" }) },
      };
      const strategyRegistry = { get: id => strategies[id] };
      const baselineRegistry = { resolve: value => { baselineCalls.push(snapshot(value));
        return { available: true, minimum: 0, maximum: 10, source: "catalog" }; } };
      const resolver = new Resolver({ strategyRegistry, baselineRegistry });
      const group = strategyId => ({ rating: { strategyId, metricLabel: "Metric", metricSuffix: "u" } });
      return { constructors: [attempt(() => new Resolver()), attempt(() => new Resolver({ strategyRegistry })),
        attempt(() => new Resolver({ baselineRegistry }))], missingStrategy: snapshot(resolver.resolve({ groupConfig: group("none") })),
      missingMetric: snapshot(resolver.resolve({ groupConfig: group("missing") })),
      ready: snapshot(resolver.resolve({ item: {}, groupId: "g", groupConfig: group("ready") })),
      raw: snapshot(resolver.resolve({ item: {}, groupId: "g", groupConfig: group("raw") })),
      baselineCalls, methods: methods(Resolver) };
    },
  }),
  LineAllocationPolicy: Object.freeze({
    "rod-reel-allocation-and-winding": Policy => {
      const configs = [{}, { rodLengthReserveMultiplier: 3, noReelMinRodLengthMultiplier: 1.5,
        noReelRodLengthMultiplier: 2.5, noReelExtraLengthMeters: 1.25 }];
      const rods = [undefined, { variant: "pole", effectiveStats: { lengthMeters: 4 } },
        { variant: "spinning", effectiveStats: { lengthMeters: 3, hasReel: true } }];
      const reels = [undefined, { effectiveStats: { lineCapacityMeters: 5 } },
        { effectiveStats: { lineCapacityMeters: 100 } }];
      const lines = [undefined, { effectiveStats: { lengthMeters: 0 } },
        { effectiveStats: { lengthMeters: 8 } }, { effectiveStats: { lengthMeters: 120 } }];
      const facts = [];
      for (const config of configs) {
        const policy = new Policy(config, { messages: LINE_MESSAGES });
        for (const lineItem of lines) {
          for (const rod of rods) for (const reel of reels) facts.push(snapshot(policy.resolve({ lineItem,
            equipment: rod === undefined ? undefined : { rod, reel } })));
          for (const reel of reels) facts.push(snapshot(policy.resolveForReel({ lineItem, reel })));
        }
      }
      const policy = new Policy({}, { messages: LINE_MESSAGES });
      return { facts, helpers: rods.map(rod => [policy.rodRequiresReel(rod), policy.getMinimumLineLengthMeters(rod),
        policy.getMaximumLineLengthMeters({ rod, reel: reels[2] })]), methods: methods(Policy) };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    EquipmentRules: ["equipment-kinds-selection-and-depth"],
    BaitRules: ["bait-types-and-physics"],
    CastRules: ["bounds-distance-and-rod-position"],
    BiteRules: ["hook-size-and-bite-sequence"],
    ChumRules: ["delivery-load-and-sections"],
    BoatRules: ["manual-state-targeting-and-cast"],
    PlayerCastRules: ["equipment-and-boat-gates"],
    DistanceUnitConverter: ["configuration-and-conversions"],
    CompositeMetricStrategy: ["components-baselines-and-failures"],
    ItemCapacityResolver: ["capacity-sources-and-unavailable-results"],
    ItemRatingResolver: ["constructor-strategy-baseline-and-range"],
    LineAllocationPolicy: ["rod-reel-allocation-and-winding"],
  },
  compatibilityCases: [
    "six-representation-only-named-esm-targets-and-twelve-exact-exports",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "three-exact-reviewed-imports-and-three-retired-bridges",
    "twelve-exact-classic-activations-at-their-legacy-positions",
    "ten-exact-classic-consumer-relationships",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
