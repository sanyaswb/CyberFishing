"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value, (_key, item) => {
  if (item === undefined) return "#undefined";
  return item;
}));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: error.name }; }
};
const methods = Type => Object.getOwnPropertyNames(Type.prototype).sort();
const own = value => Object.keys(value).sort().map(key => [key, snapshot(value[key])]);

const EXECUTABLE_CASES = Object.freeze({
  EquipmentState: Object.freeze({
    "roots-set-clear-restore-and-snapshot": State => {
      const state = new State({ rod: "rod_1", net: "net_1" });
      const invalid = [attempt(() => new State({ net: { instanceId: "net_1" } }).snapshot()),
        attempt(() => new State({ unknown: "x" }).snapshot()), attempt(() => new State({ rod: 7 }).snapshot())];
      const reads = () => ({ snapshot: state.snapshot(), main: state.getMainRootInstanceIds(),
        auxiliary: state.getAuxiliaryRootInstanceIds(), slots: state.getSlotIds(),
        has: ["rod", "reel", "net", "gasMask"].map(slot => state.has(slot)) });
      const before = reads();
      const writes = [attempt(() => state.setRootInstanceId("reel", "reel_1")), attempt(() => state.setRootInstanceId("bogus", "x")),
        attempt(() => state.setRootInstanceId("tackle", { instanceId: "hook_2" })), attempt(() => state.setRootInstanceId("float", "")),
        attempt(() => state.clear("rod")), attempt(() => state.clear("bogus")), attempt(() => state.getRootInstanceId("bogus"))];
      const after = reads();
      const restored = new State();
      restored.restore(state.snapshot());
      const custom = new State({ a: "1" }, { mainSlotIds: ["a"], auxiliarySlotIds: ["b"] });
      return { methods: methods(State), invalid, before, writes, after, restored: restored.snapshot(),
        frozenSlots: [Object.isFrozen(state.getSlotIds()), state.getSlotIds() === state.getSlotIds()],
        snapshotFresh: state.snapshot() !== state.snapshot(),
        custom: [custom.snapshot(), custom.getSlotIds(), attempt(() => custom.setRootInstanceId("rod", "r"))],
        empty: [new State().snapshot(), attempt(() => new State(null).snapshot()), attempt(() => new State(undefined, null).snapshot())] };
    },
  }),
  EquipmentLoadout: Object.freeze({
    "persisted-roots-name-display-type-and-auxiliary-guard": Loadout => {
      const make = options => attempt(() => {
        const loadout = new Loadout(options);
        return { fields: own(loadout), roots: loadout.getRootInstanceIds(), contained: loadout.getContainedRootIds(),
          containsRod: loadout.containsRoot("rod_1"), containsNone: loadout.containsRoot("none"),
          reel: loadout.getRootInstanceId("reel"), bogus: attempt(() => loadout.getRootInstanceId("bogus")),
          snapshot: loadout.snapshot() };
      });
      const stamp = "2026-10-01T00:00:00.000Z";
      return { methods: methods(Loadout), results: [
        make(undefined), make({}), make({ loadoutId: "" }),
        make({ loadoutId: "l1", createdAt: stamp }),
        make({ loadoutId: "l2", name: "Мій", rootInstanceIds: { rod: "rod_1", reel: "reel_1", float: null },
          createdAt: stamp, updatedAt: "2026-10-02T00:00:00.000Z" }),
        make({ loadoutId: "l3", name: "", rootInstanceIds: { net: "net_1" }, createdAt: stamp }),
        make({ loadoutId: "l4", rootInstanceIds: { rod: "rod_1", tackle: "" }, createdAt: stamp, mainSlotIds: ["rod", "tackle"] }),
        make({ loadoutId: "l5", rootInstanceIds: null, createdAt: stamp }),
      ] };
    },
  }),
  LOADOUT_DISPLAY_NAME: Object.freeze({
    "persisted-default-name-value": name => ({ type: typeof name, value: name, length: name.length }),
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    EquipmentState: ["roots-set-clear-restore-and-snapshot"],
    EquipmentLoadout: ["persisted-roots-name-display-type-and-auxiliary-guard"],
    LOADOUT_DISPLAY_NAME: ["persisted-default-name-value"],
  },
  compatibilityCases: [
    "two-representation-only-named-esm-targets-and-three-exact-exports",
    "four-exact-earlier-batch-imports-bound-to-the-cumulative-instances",
    "one-reviewed-literal-constant-exported-without-activation",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "two-exact-classic-activations-at-their-legacy-positions-and-one-shared-source-retirement",
    "five-exact-classic-consumer-relationships-and-two-retired-bridges",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
