"use strict";

// Equipment and loadout collaborators are plain objects; locations use the kinds the completed
// InventoryItemLocation export recognizes, which both variants read from the same instance.
const equipment = { getSlotIds: () => ["rod", "reel"],
  getRootInstanceId: slot => ({ rod: "rod-1", reel: null })[slot] };
const loadouts = { findByRootInstanceId: id => (id === "saved-9" ? { id: "loadout-a" } : null) };
const inventory = id => ({ instanceId: id, location: { kind: "INVENTORY" } });
const inLoadout = id => ({ instanceId: id, location: { kind: "LOADOUT", loadoutId: "l", slotId: "rod" } });

const BATCH_024_EXECUTABLE_CASES = Object.freeze({
  InventoryItemReservationPolicy: Object.freeze({
    "equipment-loadout-and-location-reservation": Policy => {
      const policy = new Policy({ equipmentState: equipment, loadouts });
      const probes = [inventory("rod-1"), inventory("free-2"), inLoadout("x"), inventory("saved-9"),
        "rod-1", "free-2", "saved-9", null, undefined, "", { location: { kind: "LOADOUT" } }, {}];
      return { reserved: probes.map(value => policy.isReserved(value)),
        mergeable: probes.map(value => policy.canMerge(value)) };
    },
    "missing-collaborators-and-defaults": Policy => {
      const bare = new Policy();
      const partial = new Policy({ equipmentState: { getRootInstanceId: () => "rod-1" }, loadouts: {} });
      return {
        bare: [bare.isReserved(inventory("rod-1")), bare.isReserved(inLoadout("x")), bare.canMerge("a")],
        partial: [partial.isReserved("rod-1"), partial.isReserved(inLoadout("y")), partial.canMerge("rod-1")],
        fields: Object.getOwnPropertyNames(bare).sort(),
      };
    },
  }),
});

module.exports = { BATCH_024_EXECUTABLE_CASES };
