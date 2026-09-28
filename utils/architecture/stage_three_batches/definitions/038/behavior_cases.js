"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value === undefined ? null : value));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: `${error.name}: ${error.message}` }; }
};
const PROFILES = {
  reel: { id: "reel_standard", fallbackTypes: ["reel"], slots: [{ id: "line", acceptedTypes: ["fishing_line"], refillable: true }] },
  hook: { id: "hook_standard", fallbackTypes: ["hook", "lure"], slots: [
    { id: "bait", acceptedTypes: ["bait"], capacityProperty: "baitSlots", enabledProperty: "hasBaitSlot" }] },
  feeder: { id: "feeder_spring_basic", fallbackTypes: ["feeder_rig"], slots: [
    { id: "hooks", acceptedTypes: ["hook"], capacityProperty: "hooksCount" },
    { id: "chum", acceptedItemIds: ["carp-mix"], capacity: 1, enabledProperty: "hasChumSlot" }] },
};
const ITEMS = [{ itemId: "reel-1", itemType: "reel" }, { itemId: "hook-1", itemType: "hook", effectiveStats: { baitSlots: 2 } },
  { itemId: "lure-1", type: "lure" }, { itemId: "spring-1", itemType: "feeder_rig", effectiveStats: { hooksCount: 3, hasChumSlot: false } },
  { itemId: "custom", itemType: "rod", assemblyProfileId: "reel_standard" }, { itemId: "unknown" }, null];

// Batch 038: the assembly profile registry indexes the injected profile table and resolves slots.
const EXECUTABLE_CASES = Object.freeze({
  AssemblyProfileRegistry: Object.freeze({
    "profiles-resolution-and-slots": Registry => {
      const registry = new Registry(PROFILES, { itemDefinitionResolver: { get: itemId =>
        itemId === "unknown" ? { itemType: "hook", baitSlots: 1 } : null } });
      return {
        profiles: ["reel_standard", "hook_standard", "feeder_spring_basic", "missing"].map(id => snapshot(registry.get(id))),
        frozen: Object.isFrozen(registry.get("reel_standard")) && Object.isFrozen(registry.get("reel_standard").slots[0]),
        resolved: ITEMS.map(item => registry.resolveProfileIdForItem(item)),
        explicit: registry.resolveProfileIdForItem(ITEMS[0], "hook_standard"),
        forItem: ITEMS.map(item => snapshot(registry.resolveForItem(item))),
        slots: ITEMS.slice(0, 4).map(item => ["line", "bait", "hooks", "chum"].map(slotId => snapshot(registry.resolveSlot(item, slotId)))),
        capacities: ITEMS.slice(0, 4).map(item => (registry.resolveForItem(item)?.slots || [])
          .map(slot => registry.getSlotCapacity(item, slot))),
        accepts: [registry.accepts(registry.get("reel_standard").slots[0], { itemType: "fishing_line" }),
          registry.accepts(registry.get("feeder_spring_basic").slots[1], { itemId: "carp-mix" }),
          registry.accepts(registry.get("feeder_spring_basic").slots[1], { itemId: "worm" }), registry.accepts(null, {})],
        required: [attempt(() => registry.require("reel_standard").id), attempt(() => registry.require("missing"))],
      };
    },
    "registration-contract-and-empty-table": Registry => {
      const registry = new Registry([PROFILES.reel]);
      return {
        empty: [new Registry().get("reel_standard"), new Registry(null).resolveProfileIdForItem({ itemType: "reel" })],
        errors: [attempt(() => registry.register(PROFILES.reel)), attempt(() => registry.register(null)),
          attempt(() => registry.register({ id: "" })), attempt(() => registry.register({ id: "x", slots: [{}] })),
          attempt(() => registry.register({ id: "y", slots: [{ id: "s", capacity: -1 }] }))],
        added: snapshot(registry.register({ id: "z", fallbackTypes: ["reel"], slots: [] })),
        firstFallbackWins: registry.resolveProfileIdForItem({ itemType: "reel" }),
      };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    AssemblyProfileRegistry: ["profiles-resolution-and-slots", "registration-contract-and-empty-table"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-one-exact-export",
    "two-registry-map-collection-identities-preserved",
    "one-esm-evaluation-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "two-exact-classic-consumer-relationships",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
