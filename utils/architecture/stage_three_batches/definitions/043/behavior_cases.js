"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value, (_key, item) => {
  if (item === undefined) return "#undefined";
  if (typeof item === "number" && !Number.isFinite(item)) return `#${String(item)}`;
  if (typeof item === "function") return "#function";
  return item;
}));
// Only the error type is compared: V8 formats realm objects differently in messages.
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: error.name }; }
};
const methods = Type => Object.getOwnPropertyNames(Type.prototype).sort();
// A deterministic generator for the tackle-stress failure rolls.
const sequence = values => { let index = 0; return { next: () => values[index++ % values.length] }; };

// Equipment fakes: plain stats and the getter shapes the production entities expose.
const rodOf = ({ length = 3, maxLoad = 8, hasReel = true, maxDistance, bearing } = {}) => ({
  lengthMeters: length, getLengthMeters: () => length, getEffectiveMaxLoadKg: () => maxLoad, getMaxLoadKg: () => maxLoad,
  hasReel: () => hasReel, effectiveStats: { lengthMeters: length, maxLoadKg: maxLoad, hasReel },
  ...(maxDistance === undefined ? {} : { maxDistance, getMaxDistance: () => maxDistance }),
  ...(bearing === undefined ? {} : { castPower: bearing }),
});
const reelOf = ({ maxLoad = 6, drag = true, range = { min: 0.5, max: 5 }, bearings = 4 } = {}) => ({
  hasReel: () => true, hasDrag: () => drag, getDragRangeKg: () => range, getEffectiveMaxLoadKg: () => maxLoad,
  getMaxLoadKg: () => maxLoad, bearingCount: bearings, effectiveStats: { maxLoadKg: maxLoad, bearingCount: bearings },
});
const lineOf = (length, maxLoad = 5) => ({ effectiveStats: { lengthMeters: length, maxLoadKg: maxLoad } });

const EXECUTABLE_CASES = Object.freeze({
  CastDistanceCalculator: Object.freeze({
    "reach-cast-distance-power-and-float-budget": Calculator => {
      const configs = [undefined, null, {}, { pixelsPerMeter: 40, line: { rodLengthReserveMultiplier: 1.5 } },
        { casting: { powerCoefficient: 0.7, floatDepth: { enabled: true, maxDepthMeters: 4 } } }];
      const equipments = [undefined, null, {}, { rod: rodOf() }, { rod: rodOf(), reel: reelOf(), line: lineOf(60) },
        { rod: rodOf({ hasReel: false, length: 5 }), line: lineOf(0) }, { rod: rodOf({ maxDistance: 400 }) },
        { rod: rodOf({ length: -2 }), reel: reelOf({ bearings: 9 }), line: lineOf(-5) }];
      return {
        methods: methods(Calculator),
        results: configs.map(config => {
          const calculator = new Calculator(config);
          return {
            pixelsPerMeter: calculator.pixelsPerMeter,
            conversions: [calculator.metersToPixels(2.5), calculator.pixelsToMeters(100), attempt(() => calculator.metersToPixels("x"))],
            reach: [attempt(() => calculator.getRodBaseReachMeters(rodOf())), attempt(() => calculator.getRodBaseReachMeters(rodOf(), false)),
              attempt(() => calculator.getRodBaseReachMeters(null))],
            perEquipment: equipments.map(equipment => ({
              max: attempt(() => calculator.getMaxCastDistanceMeters(equipment, 12, { selectedDepthMeters: 2 })),
              maxPx: attempt(() => calculator.getMaxCastDistancePx(equipment)),
              effective: [attempt(() => calculator.getEffectiveCastDistancePx(equipment)),
                attempt(() => calculator.getEffectiveCastDistancePx(equipment, null)),
                attempt(() => calculator.getEffectiveCastDistancePx(equipment, 1.7))],
              power: attempt(() => calculator.getBuildCastPowerCoefficient(equipment, 0.4)),
              describe: attempt(() => calculator.describe(equipment, null, { selectedDepthMeters: 1 })),
              budget: attempt(() => calculator.getFloatLineBudget(equipment, 3)),
              reachModel: attempt(() => calculator.getLineReachModel({ rod: equipment?.rod, reel: equipment?.reel,
                lineStats: equipment?.line })),
            })),
          };
        }),
      };
    },
  }),
  FishFightDirectionResolver: Object.freeze({
    "normalized-direction-reused-result-and-degenerate-inputs": Resolver => {
      const resolver = new Resolver();
      const first = resolver.resolve({ fishPosition: { x: 10, y: -20 }, rodTipPosition: { x: 0, y: 0 } });
      const inputs = [undefined, {}, { fishPosition: { x: 0, y: 0 }, rodTipPosition: { x: 0, y: 0 } },
        { fishPosition: { x: 3, y: 4 }, rodTipPosition: { x: 0, y: 0 }, radialIntent: 0, lateralIntent: 0 },
        { fishPosition: { x: 3, y: 4 }, rodTipPosition: { x: 0, y: 0 }, radialIntent: -1, lateralIntent: 1 },
        { fishPosition: { x: "5", y: null }, rodTipPosition: { x: 1, y: "x" }, radialIntent: 5, lateralIntent: -9 },
        { fishPosition: { x: 1, y: 1 }, rodTipPosition: { x: 1, y: 1.0005 }, radialIntent: NaN, lateralIntent: Infinity }];
      const results = inputs.map(input => ({ ...resolver.resolve(input) }));
      return { methods: methods(Resolver), results, stable: resolver.resolve({}) === first,
        fresh: new Resolver().resolve({}) !== first, constructorName: first.constructor.name };
    },
  }),
  RodPullCalculator: Object.freeze({
    "stroke-capacity-force-limit-and-next-state": Calculator => {
      const resolver = { calls: [], resolve(input) { this.calls.push(snapshot(input)); return 1.5; } };
      const calculators = [new Calculator(), new Calculator(null), new Calculator({ finalLandingDistanceMeters: 1,
        rodStroke: { maxDistanceMeters: 2 } }), new Calculator({ tensionCeilingMultiplier: 1.2 }, resolver)];
      const geometry = [{}, { rodLengthMeters: 3, lineLengthMeters: 20, fishDistanceMeters: 10 },
        { rodLengthMeters: 3, lineLengthMeters: 20, hasReel: false, fishDistanceMeters: 0.5 },
        { rodLengthMeters: -1, lineLengthMeters: "x", fishDistanceMeters: -4 }];
      const limits = [{}, { maxTackleLoadKg: 8, rodLimitKg: 6, playerForceBudget: 5, fishTensionKg: 4, rodHoldMaxKg: 7,
        dragLimitKg: 3, dragLocked: false, hardLineLimit: 9, lineHasReserve: true },
      { maxTackleLoadKg: 8, rodLimitKg: 6, tensionCeilingMultiplier: 0.5, tensionCeilingKg: 2, dragLocked: true,
        lineHasReserve: false }];
      let previousState = null;
      const states = [];
      for (const [index, held] of [true, true, false, true].entries()) {
        const next = attempt(() => calculators[2].calculateNextState({ dtSec: 0.016 * (index + 1),
          input: { pullHeld: held, pullReleasedThisFrame: !held }, previousState, rodLengthMeters: 3, lineLengthMeters: 25,
          maxTackleLoadKg: 8, rodLimitKg: 6, playerForceBudget: 5, fishTensionKg: 3 + index, dragLimitKg: 4,
          hardLineLimit: 9, fishDistanceMeters: 12 - index, playerPressureGain: 1.1, playerTensionBuildRate: 0.8 }));
        states.push(next);
        previousState = next.value || previousState;
      }
      return {
        methods: methods(Calculator),
        capacity: calculators.map(calculator => geometry.map(input => attempt(() => calculator.calculateStrokeCapacity(input)))),
        maxDistance: calculators.map(calculator => geometry.map(input => attempt(() => calculator.calculateMaxDistance(input)))),
        limits: calculators.map(calculator => limits.map(input => attempt(() => calculator.calculateForceLimit(input)))),
        states,
        empty: attempt(() => calculators[0].calculateNextState({})),
        injected: resolver.calls.length,
      };
    },
  }),
  InventoryItemStackingPolicy: Object.freeze({
    "stack-compatibility-ignoring-reviewed-runtime-keys": Policy => {
      const policy = new Policy();
      const base = { itemId: "hook_1", quality: 3, stats: { size: 2 } };
      const pairs = [[null, base], [base, undefined], [base, { ...base, itemId: "hook_2" }], [base, { ...base }],
        [base, { ...base, instanceId: "a", quantity: 9, freshness: 0.3, ratingColor: "#fff" }],
        [base, { ...base, stats: { size: 3 } }], [base, { ...base, extra: undefined }], [base, { ...base, extra: 1 }],
        [{ itemId: "x", progression: { level: 1 } }, { itemId: "x", progression: { level: 9 } }]];
      const left = { ...base };
      const right = { ...base, quantity: 2 };
      const result = policy.canStack(left, right);
      return { methods: methods(Policy), results: pairs.map(([a, b]) => policy.canStack(a, b)),
        unchanged: [result, snapshot(left), snapshot(right)], separate: new Policy().canStack(base, { ...base }) };
    },
  }),
  PlayerForceSystem: Object.freeze({
    "force-context-angle-penalty-drag-and-owned-vectors": System => {
      const physics = { getInputSteeringBlend: () => 0.5, getRodHoldConfig: () => ({ anglePenalty: {
        noPenaltyAngleDeg: 10, maxPenaltyAngleDeg: 60, maxPenaltyMultiplier: 0.6 } }) };
      const systems = [new System(), new System({ physicsConfig: physics })];
      const frames = [
        { fishPosition: { x: 0, y: -50 }, rodTipPosition: { x: 0, y: 0 }, input: {}, rod: rodOf(), reel: reelOf(),
          playerMaxLoadKg: 6, dragRatio: 0.5 },
        { fishPosition: { x: 40, y: -10 }, rodTipPosition: { x: 0, y: 0 }, input: { isPulling: true, pullDirection: { x: 1 } },
          rod: rodOf(), reel: reelOf({ drag: false }), buffs: { getTotalMultiplier: () => 1.25 }, dragRatio: 2 },
        { fishPosition: { x: -30, y: 30 }, rodTipPosition: { x: 0, y: 0 }, input: { isPulling: true, retrieve: true },
          rod: rodOf({ maxLoad: 0 }), reel: reelOf({ range: {} , maxLoad: 0 }), playerMaxLoadKg: 0, dragRatio: -1 },
        { fishPosition: { x: 5, y: -5 }, rodTipPosition: { x: 5, y: 5 }, input: null, rod: null, reel: null,
          physicsConfig: { getRodAnglePenaltyConfig: () => ({ enabled: false }) } },
      ];
      const results = systems.map(system => frames.map(frame => {
        const result = system.calculate(frame);
        return { ...snapshot(result), vectorIsOwned: result.vector === system.calculate(frame).vector,
          pullDirIsOwned: result.pullDir === system.calculate(frame).pullDir };
      }));
      return { methods: methods(System), results, missing: attempt(() => systems[0].calculate({})) };
    },
  }),
  TackleStressSystem: Object.freeze({
    "tension-smoothing-stress-failure-and-equipment-refresh": System => {
      const line = { getEffectiveMaxLoadKg: () => 5, getMaxLoadKg: () => 5, getState: () => ({ totalLengthMeters: 30 }) };
      const make = (overrides = {}) => new System({ rod: rodOf(), reel: reelOf(), lineSystem: line,
        hook: { getEffectiveMaxLoadKg: () => 7 }, leader: null, config: { kgSmoothPerSecond: 12 },
        rng: sequence([0.9, 0.05, 0.5]), ...overrides });
      const run = (system, frames) => frames.map(frame => attempt(() => {
        const result = system.updateTensionFrame(frame);
        return { result, tension: system.getTension(), kg: system.getTensionKg(), stress: system.getStressRatio(),
          broken: system.isBroken(), reason: system.getBreakReason(), color: system.getCurrentColor(),
          label: system.getCurrentStatusLabel() };
      }));
      const frames = [{}, { visibleTensionKg: 2, dtSec: 0.016 }, { visibleTensionKg: 6, totalTensionKg: 7, dtSec: 0.5 },
        { tensionKg: 12, rawTotalTensionKg: 15, fishTensionKg: 14, dtSec: 1, tensionStressSource: "visible" },
        { visibleTensionKg: 30, dtSec: 2, tensionConfig: { tackleStress: { enabled: true } } },
        { visibleTensionKg: 30, dtSec: 2 }];
      const plain = make();
      const disabled = make({ config: { tackleStress: { enabled: false } } });
      const injected = make({ weakestLimitResolver: { resolve: () => ({ limitKg: 1, component: "hook" }) } });
      const reequipped = make();
      reequipped.updateTensionFrame({ visibleTensionKg: 4, dtSec: 1 });
      reequipped.updateEquipment({ rod: rodOf({ maxLoad: 2 }), reel: reelOf(), lineSystem: line });
      return {
        methods: methods(System),
        plain: run(plain, frames),
        disabled: run(disabled, frames),
        injected: run(injected, frames.slice(0, 3)),
        limits: [attempt(() => plain.getEffectiveMaxTackleLoadKg()), attempt(() => plain.getEffectiveRodMaxLoadKg()),
          attempt(() => plain.getEffectiveLineSystemMaxLoadKg()), attempt(() => plain.getEffectiveHookMaxLoadKg()),
          attempt(() => plain.getEffectiveReelMaxLoadKg()), attempt(() => plain.getWeakestTackleLimitFrame())],
        target: attempt(() => make().updateTarget(3, 0.25)),
        reequipped: [reequipped.getTensionKg(), reequipped.getStressRatio(), attempt(() => reequipped.getDebugData())],
        missing: attempt(() => new System({})),
      };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    CastDistanceCalculator: ["reach-cast-distance-power-and-float-budget"],
    FishFightDirectionResolver: ["normalized-direction-reused-result-and-degenerate-inputs"],
    RodPullCalculator: ["stroke-capacity-force-limit-and-next-state"],
    InventoryItemStackingPolicy: ["stack-compatibility-ignoring-reviewed-runtime-keys"],
    PlayerForceSystem: ["force-context-angle-penalty-drag-and-owned-vectors"],
    TackleStressSystem: ["tension-smoothing-stress-failure-and-equipment-refresh"],
  },
  compatibilityCases: [
    "six-representation-only-named-esm-targets-and-six-exact-exports",
    "eight-exact-completed-prefix-imports-bound-to-the-cumulative-instances",
    "five-owner-created-composition-identities-preserved",
    "one-reviewed-private-static-literal-set",
    "six-exact-classic-activations-at-their-legacy-positions-and-five-retired",
    "nine-exact-classic-consumer-relationships-and-eight-retired-bridges",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
