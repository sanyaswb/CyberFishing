"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value, (_key, item) => {
  if (item === undefined) return "#undefined";
  return item;
}));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: error.name }; }
};
const methods = Type => Object.getOwnPropertyNames(Type.prototype).sort();

const MESSAGES = Object.freeze({
  itemOrSlotMissing: "missing-text", equipmentSlotLocked: slotId => `locked-${slotId}`,
  slotUnsupportedByRod: "unsupported-text", itemNotAcceptedBySlot: "not-accepted-text",
  tackleIncompatibleWithRod: "tackle-text",
});
const RODS = [null, { itemType: "rod" }, { itemType: "rod", capabilities: ["reel"] },
  { itemType: "rod", capabilities: ["float"] }, { itemType: "rod", capabilities: ["feeder_rig", "reel"] },
  { itemType: "rod", capabilities: ["lure", "reel"] }];
const ITEMS = ["rod", "reel", "fishing_line", "leader_line", "hook", "float", "feeder_rig", "spring", "lure", "jig",
  "chum_mix", "net", "boat", "gas_mask", "bogus"].map(itemType => ({ itemType }));
const SLOTS = ["rod", "reel", "terminalLine", "tackle", "float", "chum", "net", "boat", "gasMask", "bogus"];

const EXECUTABLE_CASES = Object.freeze({
  EquipmentCompatibilityPolicy: Object.freeze({
    "slot-item-rod-compatibility-and-readiness": Policy => {
      const defaults = new Policy({ messages: MESSAGES });
      const matrix = RODS.map(rod => SLOTS.map(slotId => ITEMS.map(item =>
        attempt(() => defaults.validate({ slotId, item, rod })))));
      const readiness = { calls: [], validateEquip(input) {
        this.calls.push(snapshot({ slotId: input.slotId, itemType: input.item?.itemType }));
        return input.slotId === "reel" ? { isValid: false, reason: "not-ready", warningCode: "code" } : null;
      } };
      const gated = new Policy({ messages: MESSAGES, readinessPolicy: readiness });
      const stateRod = { getRootInstanceId: slot => (slot === "rod" ? RODS[2] : null) };
      const locked = new Policy({ messages: MESSAGES, slotConfig: { a: { locked: true, acceptTypes: ["x"] } } });
      const injected = new Policy({ messages: MESSAGES, slotConfig: { a: { acceptTypes: ["x"] }, tackle: { acceptTypes: ["hook"] } },
        visibilityPolicy: { isVisible: (slotId, { rod }) => slotId !== "hidden" && rod !== "none" },
        terminalLineResolver: { resolve: () => ({ acceptTypes: ["y"] }) },
        capabilityResolver: { resolve: () => ({ supportsFloat: true }) } });
      return { methods: methods(Policy), matrix,
        readiness: [attempt(() => gated.validate({ slotId: "reel", item: ITEMS[1], rod: RODS[2] })),
          attempt(() => gated.validate({ slotId: "reel", item: ITEMS[1], rod: RODS[2], enforceReadiness: false })),
          attempt(() => gated.validate({ slotId: "rod", item: ITEMS[0] }))], readinessCalls: readiness.calls,
        fromState: [attempt(() => defaults.validate({ slotId: "reel", item: ITEMS[1], equipmentState: stateRod })),
          attempt(() => defaults.validate({ slotId: "reel", item: ITEMS[1], equipmentState: { rod: RODS[2] } })),
          attempt(() => defaults.validate({ slotId: "reel", item: ITEMS[1], equipmentState: { rod: "rod_1" } }))],
        isCompatible: [defaults.isCompatible({ slotId: "rod", item: ITEMS[0] }), defaults.isCompatible()],
        locked: attempt(() => locked.validate({ slotId: "a", item: { itemType: "x" } })),
        injected: [attempt(() => injected.validate({ slotId: "a", item: { itemType: "x" } })),
          attempt(() => injected.validate({ slotId: "tackle", item: { itemType: "hook" } })),
          attempt(() => injected.validate({ slotId: "a", item: { itemType: "x" }, rod: "none" }))],
        noMessages: attempt(() => new Policy().validate({ slotId: "bogus", item: ITEMS[0] })),
        noArgument: attempt(() => defaults.validate()) };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    EquipmentCompatibilityPolicy: ["slot-item-rod-compatibility-and-readiness"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-one-exact-export",
    "four-exact-earlier-batch-and-completed-prefix-imports-bound-to-the-cumulative-instances",
    "one-reviewed-global-this-exposure-moved-to-the-activation-shim",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "one-exact-classic-consumer-relationship-and-four-retired-bridges",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
