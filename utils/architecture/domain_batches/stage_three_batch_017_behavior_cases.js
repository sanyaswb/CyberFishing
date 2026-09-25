"use strict";

const assert = require("node:assert/strict");

const captureError = action => {
  try {
    action();
  } catch (error) {
    return { name: error.name, message: error.message };
  }
  throw new Error("Expected an error");
};

const BATCH_017_EXECUTABLE_CASES = Object.freeze({
  InventoryItemLocationKind: Object.freeze({
    "frozen-kind-table-values": kind => {
      assert(Object.isFrozen(kind));
      assert.deepEqual({ ...kind }, { INVENTORY: "INVENTORY", ATTACHED: "ATTACHED", LOADOUT: "LOADOUT" });
      return { keys: Object.keys(kind), values: Object.values(kind), frozen: Object.isFrozen(kind) };
    },
  }),
  InventoryItemLocation: Object.freeze({
    "factories-normalize-and-predicates": Location => {
      const inventory = Location.inventory();
      const attached = Location.attached("rod_1", "reel", 2);
      const defaultIndex = Location.attached("rod_1", "line");
      const loadout = Location.loadout("loadout_a", "rod");
      const results = [inventory, attached, defaultIndex, loadout,
        Location.normalize(null), Location.normalize({ kind: "INVENTORY", extra: true }),
        Location.normalize({ kind: "ATTACHED", parentInstanceId: "p", slotId: "s", slotIndex: 0 }),
        Location.normalize({ kind: "LOADOUT", loadoutId: "l", slotId: "s", ignored: 1 })];
      assert(results.every(Object.isFrozen));
      const predicates = [inventory, attached, loadout, null, {}].map(value =>
        [Location.isInventory(value), Location.isAttached(value), Location.isLoadout(value)]);
      return { results, predicates,
        staticKeys: Object.getOwnPropertyNames(Location).filter(name =>
          !["length", "name", "prototype"].includes(name)).sort() };
    },
    "validation-errors-and-unknown-kind": Location => [
      captureError(() => Location.attached("", "slot")),
      captureError(() => Location.attached("parent", "  ")),
      captureError(() => Location.attached("parent", "slot", -1)),
      captureError(() => Location.attached("parent", "slot", 1.5)),
      captureError(() => Location.loadout(null, "slot")),
      captureError(() => Location.loadout("loadout", 7)),
      captureError(() => Location.normalize({ kind: "BACKPACK" })),
      captureError(() => Location.normalize({ kind: "ATTACHED", parentInstanceId: "p" })),
    ],
  }),
});

module.exports = { BATCH_017_EXECUTABLE_CASES };
