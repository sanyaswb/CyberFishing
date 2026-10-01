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
const frozenDeep = value => Object.isFrozen(value) &&
  Object.values(value).every(item => item === null || typeof item !== "object" || frozenDeep(item));

const RODS = [
  null, {}, { capabilities: ["reel"] }, { capabilities: ["float"] }, { capabilities: ["feeder_rig", "reel"] },
  { capabilities: { reel: true, float: true } }, { equipmentCapabilities: { supportsReel: false }, capabilities: ["reel"] },
  { capabilities: { supportsReel: true, supportsFloat: false } }, { capabilities: ["lure"] },
];
const MESSAGES = Object.freeze({
  inventoryCapacityExceeded: "capacity-text", leaderRequiresReelLine: "leader-text", rodRequired: "rod-text",
  reelRequired: "reel-text", reelLineRequired: "reel-line-text", terminalLineRequired: "terminal-text",
  feederHookMissing: "hook-text", chumBonusMissing: "chum-text",
});
const STATES = [
  undefined, null, {}, { rod: "rod_1" }, { rod: "rod_1", reel: "reel_1", terminalLine: "line_1", tackle: "hook_1", float: "float_1" },
  { rod: null, reel: "reel_1", net: "net_1" }, { rod: "rod_1", tackle: "tackle_1", float: "" },
  { rootInstanceIds: { rod: "rod_2", reel: "reel_2" } },
  { snapshot: () => Object.freeze({ rod: "rod_3", reel: "reel_3", terminalLine: null }) },
];
const capacity = (allowed, warning = null) => ({ calls: [], evaluateTransition(input) {
  this.calls.push(snapshot(input));
  return allowed === undefined ? null : { allowed, warning, cells: input.incomingRootInstanceIds.length };
} });

const EXECUTABLE_CASES = Object.freeze({
  EquipmentSlotVisibilityPolicy: Object.freeze({
    "slot-visibility-by-rod-capabilities": Policy => {
      const defaults = new Policy();
      const custom = new Policy({ slotConfig: { a: { group: "auxiliary" }, b: { visibility: "always" },
        c: { visibility: "supportsReel" }, d: { visibility: "supportsFloat" }, e: { visibility: "rodSelected" },
        f: { visibility: "other" } }, capabilityResolver: { resolve: rod => rod?.flags || null } });
      const flagRods = [null, {}, { flags: { supportsReel: true } }, { flags: { supportsFloat: true } }];
      return { methods: methods(Policy),
        defaults: RODS.map(rod => attempt(() => defaults.resolveVisibleSlotIds({ rod }))),
        explicitSlots: attempt(() => defaults.resolveVisibleSlotIds({ rod: RODS[2], slotIds: ["rod", "bogus", "net"] })),
        noArgument: attempt(() => defaults.resolveVisibleSlotIds()),
        single: ["rod", "reel", "float", "net", "bogus"].map(slot => defaults.isVisible(slot, { rod: RODS[5] })),
        custom: flagRods.map(rod => attempt(() => custom.resolveVisibleSlotIds({ rod }))),
        customSingle: attempt(() => custom.isVisible("e")), noResolver: attempt(() =>
          new Policy({ slotConfig: { c: { visibility: "supportsReel" } }, capabilityResolver: null }).isVisible("c", { rod: {} })) };
    },
  }),
  EquipmentTransitionPlan: Object.freeze({
    "frozen-plan-shape-and-noop": Plan => {
      const make = options => attempt(() => {
        const plan = new Plan(options);
        return { fields: Object.keys(plan).map(key => [key, plan[key]]), isNoop: plan.isNoop, frozen: frozenDeep(plan) };
      });
      return { methods: methods(Plan), results: [make(undefined), make({}),
        make({ kind: "k", allowed: "true", before: { rod: "r" } }),
        make({ allowed: true, before: { rod: "r" }, after: { rod: null }, movements: [{ direction: "x", slotId: "rod" }],
          capacity: { allowed: true }, warning: "w" }),
        make({ before: null, after: null, movements: null }), make({ capacity: 0, warning: "" })] };
    },
  }),
  ManualRodChangePlanner: Object.freeze({
    "manual-rod-change-plans-and-capacity": Planner => {
      const plans = planner => [...STATES.map(state => [null, "rod_1", "rod_9"].map(next =>
        attempt(() => { const plan = planner.plan({ equipmentState: state, nextRodInstanceId: next,
          capacityContext: { owner: "test" } }); return { kind: plan.kind, allowed: plan.allowed, before: plan.before,
          after: plan.after, movements: plan.movements, capacity: plan.capacity, warning: plan.warning, isNoop: plan.isNoop,
          type: plan.constructor.name }; }))), attempt(() => planner.plan())];
      const denied = capacity(false); const deniedWarning = capacity(false, "own-warning"); const nothing = capacity(undefined);
      return { methods: methods(Planner),
        defaults: plans(new Planner({ messages: MESSAGES })),
        denied: plans(new Planner({ capacityPolicy: denied, messages: MESSAGES })), deniedCalls: denied.calls.length,
        deniedWarning: plans(new Planner({ capacityPolicy: deniedWarning, messages: MESSAGES })).slice(4, 5),
        nullCapacity: plans(new Planner({ capacityPolicy: nothing, messages: MESSAGES })).slice(4, 5),
        customSlots: plans(new Planner({ mainSlotIds: ["reel", "rod"], messages: MESSAGES })).slice(3, 5),
        emptySlots: plans(new Planner({ mainSlotIds: [], messages: MESSAGES })).slice(4, 5),
        noMessages: attempt(() => new Planner({ capacityPolicy: denied }).plan({ equipmentState: STATES[4], nextRodInstanceId: "x" })) };
    },
  }),
  FishingReadinessPolicy: Object.freeze({
    "cast-bite-chum-and-leader-readiness": Policy => {
      const items = { rod_reel: { itemType: "rod", capabilities: ["reel"] }, rod_pole: { itemType: "rod" },
        rod_feeder: { itemType: "rod", capabilities: ["feeder_rig"] }, hook_1: { itemType: "hook" },
        tackle_1: { itemType: "tackle" }, line_1: { itemType: "fishing_line" }, chum_1: { itemType: "chum" } };
      const children = { reel_1: { line: ["line_1"] }, tackle_1: { hooks: ["hook_1"], feederChum: ["chum_1"] },
        tackle_2: { hook: [] } };
      const assemblyReader = { getChild: (parent, slot, index) => children[parent]?.[slot]?.[index] ?? null,
        getChildren: (parent, slot) => children[parent]?.[slot] ?? null };
      const readers = [id => items[id] || null, { getById: id => items[id] }, { getInstance: id => items[id] },
        { hydrateInstance: id => items[id] }, { get: id => items[id] }, null];
      const states = [{ rod: "rod_reel" }, { rod: "rod_reel", reel: "reel_1" }, { rod: "rod_reel", reel: "reel_2" },
        { rod: "rod_pole" }, { rod: "rod_pole", terminalLine: "line_1" }, { rod: "rod_feeder", tackle: "tackle_1" },
        { rod: "rod_feeder", tackle: "hook_1" }, { rod: "rod_feeder", tackle: "tackle_2" }, { rod: "rod_feeder" },
        { rootInstanceIds: { rod: "rod_reel", reel: "reel_1" } }, { getRootInstanceId: slot => ({ rod: "rod_pole" })[slot] },
        {}, null, { rod: items.rod_reel, reel: "reel_1" }];
      const evaluate = policy => states.map(equipmentState => ({
        cast: attempt(() => policy.evaluateCast({ equipmentState })), bite: attempt(() => policy.evaluateBite({ equipmentState })),
        chum: attempt(() => policy.evaluateChumBonus({ equipmentState })),
        leader: attempt(() => policy.validateEquip({ slotId: "terminalLine", item: { itemType: "leader_line" }, equipmentState })) }));
      return { methods: methods(Policy),
        readers: readers.map(itemReader => evaluate(new Policy({ itemReader, assemblyReader, messages: MESSAGES }))),
        equip: [["reel", null], ["terminalLine", { itemType: "fishing_line" }], ["rod", { itemType: "leader_line" }]]
          .map(([slotId, item]) => attempt(() => new Policy({ messages: MESSAGES }).validateEquip({ slotId, item, equipmentState: {} }))),
        noArgument: [attempt(() => new Policy({ messages: MESSAGES }).evaluateCast()), attempt(() => new Policy().evaluateBite()),
          attempt(() => new Policy({ messages: MESSAGES }).validateEquip())],
        injectedResolver: attempt(() => new Policy({ itemReader: id => items[id], messages: MESSAGES,
          capabilityResolver: { resolve: () => ({ supportsReel: true }) } }).evaluateCast({ equipmentState: { rod: "rod_pole" } })) };
    },
  }),
  TerminalLineSlotResolver: Object.freeze({
    "terminal-line-accept-types-by-rod": Resolver => {
      const defaults = new Resolver();
      const results = RODS.map(rod => { const result = defaults.resolve(rod); return { result, frozen: frozenDeep(result) }; });
      return { methods: methods(Resolver), results, noArgument: defaults.resolve(),
        injected: [true, false, "true"].map(supportsReel => new Resolver({ capabilityResolver:
          { resolve: () => ({ supportsReel }) } }).resolve({})),
        noResolver: new Resolver({ capabilityResolver: { resolve: () => null } }).resolve({}),
        nullArgument: attempt(() => new Resolver(null)) };
    },
  }),
  LoadoutEquipmentTransitionPlanner: Object.freeze({
    "loadout-activation-movements-owners-and-capacity": Planner => {
      const loadout = (roots, loadoutId = "l1") => ({ loadoutId, getRootInstanceIds: () => roots });
      const loadouts = [loadout({}), loadout({ rod: "rod_1", reel: "reel_1" }), loadout({ rod: "rod_9", reel: null, float: "float_2" }),
        loadout({ rod: "rod_1", reel: "reel_1", terminalLine: "line_1", tackle: "hook_1", float: "float_1", net: "net_9" }, "l2")];
      const owners = { rod_1: { kind: "loadout", loadoutId: "l0" }, reel_1: { kind: "inventory" } };
      const readers = [id => owners[id] || null, { getOwner: id => owners[id] }, null, { getOwner: () => null }];
      const plans = planner => [...STATES.map(state => loadouts.map(entry => attempt(() =>
        planner.plan({ loadout: entry, equipmentState: state, capacityContext: { owner: "test" } })))),
        attempt(() => planner.plan()), attempt(() => planner.plan({ loadout: {} }))];
      const denied = capacity(false);
      return { methods: methods(Planner),
        readers: readers.map(ownershipReader => plans(new Planner({ ownershipReader, messages: MESSAGES }))),
        denied: plans(new Planner({ capacityPolicy: denied, messages: MESSAGES })).slice(4, 5), deniedCalls: denied.calls.slice(0, 3),
        deniedWarning: plans(new Planner({ capacityPolicy: capacity(false, "own"), messages: MESSAGES })).slice(4, 5),
        nullCapacity: plans(new Planner({ capacityPolicy: capacity(undefined), messages: MESSAGES })).slice(4, 5),
        customSlots: plans(new Planner({ mainSlotIds: ["float", "rod"], messages: MESSAGES })).slice(4, 5),
        frozen: (() => { const plan = new Planner({ messages: MESSAGES }).plan({ loadout: loadouts[1], equipmentState: STATES[4] });
          return frozenDeep(plan); })() };
    },
  }),
  LineSystem: Object.freeze({
    "reel-line-release-recover-constrain-and-state": System => {
      const calculator = (base, line, max) => ({ pixelsPerMeter: 50,
        getLineReachModel: input => ({ baseReachMeters: base, lineLengthMeters: line, maxReachMeters: max,
          hasReel: input.hasReel }) });
      const reel = (speed, load) => ({ hasReel: () => true, getRetrieveSpeedMetersPerSec: () => speed,
        getEffectiveMaxLoadKg: () => load, getMaxLoadKg: () => 5 });
      const run = (options, script) => attempt(() => {
        const system = new System(options);
        const trace = [system.getState()];
        for (const step of script) trace.push(step(system));
        return { trace, state: system.getState(), limit: system.getEffectiveLineMaxLoadKg() };
      });
      const pos = (x, y) => ({ x, y });
      const fight = [
        system => system.updateDistance(pos(500, 0), pos(0, 0)),
        system => ({ ...system.releaseForDistance(0.25) }),
        system => ({ ...system.releaseForDistance({ dragRatio: 0.5, shouldSlip: true }) }),
        system => ({ ...system.releaseForDistance({ dragRatio: 0.5, creepReleaseRatio: 0.2 }) }),
        system => ({ ...system.releaseForDistance({ dragRatio: 0, shouldSlip: false }) }),
        system => system.updateDistance(pos(5000, 0), pos(0, 0)),
        system => ({ ...system.releaseForDistance(0) }),
        system => { const p = pos(9000, 30); const v = pos(4, -2); const r = system.constrainPosition(p, v, pos(0, 0));
          return { r: { ...r }, p, v }; },
        system => system.recoverLineCredit({ hasReel: true, inputRecover: true, reel: reel(2, 10), tensionKg: 3, dtSec: 0.5 }),
        system => system.recoverLineCredit({ hasReel: true, inputRecover: true, reel: reel(2, 0), tensionKg: 1, dtSec: 1,
          loadLimitKg: 4, maxRecoverMeters: 0.3 }),
        system => system.applyRetrieve({ hasReel: true, inputRetrieve: true, reel: reel(1, 6), tensionKg: 9, dtSec: 1 }),
        system => system.applyRetrieve(null),
        system => system.recoverReleasedLine({ meters: 4 }),
        system => system.recoverReleasedLine({ meters: "x", minReleasedMeters: 2 }),
        system => system.calculateBreakLossMeters({ rng: { range: (min, max) => (min + max) / 3 } }),
        system => system.calculateBreakLossMeters({ rng: { range: () => NaN, next: () => 0.25 } }),
        system => system.calculateBreakLossMeters({ rng: { next: () => 2 } }),
        system => { const p = pos(1, 1); const v = pos(1, 1); return { r: { ...system.constrainPosition(p, v, pos(0, 0)) }, p, v }; },
        system => system.getState().lastReleaseResult === system.releaseForDistance(0),
      ];
      const lineStats = { effectiveStats: { maxLoadKg: 12, durability: 40, durabilityMaxLoadLossPerPercent: 0.01 } };
      const config = { line: { defaultMaxLoadKg: 6, durabilityMaxLoadLossPerPercent: 0.002, constraintTolerancePx: 2 } };
      return { methods: methods(System), runs: [
        run({ rod: {}, reel: { hasReel: () => true }, config, lineStats, castDistanceCalculator: calculator(3, 120, 120) }, fight),
        run({ rod: {}, reel: null, config: null, castDistanceCalculator: calculator(4, 4, 4) }, fight),
        run({ rod: {}, reel: { hasReel: () => true }, config: { line: { constraintTolerancePx: -1 } },
          lineStats: { effectiveStats: { maxLoadKg: "x", durability: 200 } }, castDistanceCalculator: calculator(2, 10, 10) }, fight),
        run({ rod: {}, reel: { hasReel: () => true }, config: {}, castDistanceCalculator: calculator(0, 0, 0) }, fight),
        run({ rod: { effectiveStats: { length: 4 } }, reel: { hasReel: () => true }, config: {} }, fight.slice(0, 9)),
        attempt(() => new System()),
      ] };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    EquipmentSlotVisibilityPolicy: ["slot-visibility-by-rod-capabilities"],
    EquipmentTransitionPlan: ["frozen-plan-shape-and-noop"],
    ManualRodChangePlanner: ["manual-rod-change-plans-and-capacity"],
    FishingReadinessPolicy: ["cast-bite-chum-and-leader-readiness"],
    TerminalLineSlotResolver: ["terminal-line-accept-types-by-rod"],
    LoadoutEquipmentTransitionPlanner: ["loadout-activation-movements-owners-and-capacity"],
    LineSystem: ["reel-line-release-recover-constrain-and-state"],
  },
  compatibilityCases: [
    "six-representation-only-named-esm-targets-and-seven-exact-exports",
    "thirteen-exact-earlier-batch-and-completed-prefix-imports-bound-to-the-cumulative-instances",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "six-exact-classic-activations-at-their-legacy-positions-and-one-retired-activation",
    "eleven-exact-classic-consumer-relationships-and-twelve-retired-bridges",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
