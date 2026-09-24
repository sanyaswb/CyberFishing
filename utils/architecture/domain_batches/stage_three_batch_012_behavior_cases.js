"use strict";

const assert = require("node:assert/strict");

const BATCH_012_EXECUTABLE_CASES = Object.freeze({
  AssemblyAttachmentTargetResolver: Object.freeze({
    "required-injected-ports": Resolver => {
      assert.throws(() => new Resolver(), { name: "TypeError" });
      assert.throws(() => new Resolver({ repository: {} }), { name: "TypeError" });
      return "required-ports-enforced";
    },
    "empty-root-and-frozen-targets": Resolver => {
      const resolver = new Resolver({ repository: { has: () => false },
        stateRepository: { has: () => false }, profileRegistry: {}, reader: {} });
      const result = resolver.listTargets("absent");
      assert.equal(result.length, 0);
      assert(Object.isFrozen(result));
      return result.length;
    },
    "slot-order-shape-and-compatible-selection": Resolver => {
      const repository = { has: id => id === "root", require: () => ({ instanceId: "root" }) };
      const stateRepository = { has: id => id === "root", require: () => ({ profileId: "p" }) };
      const profileRegistry = { resolveForItem: () => ({ slots: [{ id: "slot" }] }),
        getSlotCapacity: () => 1, accepts: () => true };
      const reader = { getPathToSlot: () => "root/slot/0", getChild: () => null,
        getChildren: () => [] };
      const resolver = new Resolver({ repository, stateRepository, profileRegistry, reader });
      const targets = resolver.listTargets("root");
      assert.equal(targets.length, 1);
      assert(Object.isFrozen(targets) && Object.isFrozen(targets[0]));
      assert.deepEqual(Object.keys(targets[0]), ["rootInstanceId", "parentInstanceId", "slotId",
        "slotIndex", "socketId", "capacity", "depth", "parentContext", "slotDefinition", "occupied"]);
      assert.equal(targets[0].socketId, "root/slot/0");
      assert.equal(resolver.findPlacementTargets("root", { instanceId: "candidate" }).length, 1);
      assert.equal(resolver.findCompatibleTargets("root", { instanceId: "root" }).length, 0);
      return [targets.length, targets[0].socketId];
    },
  }),
  AssemblyCompletionPolicy: Object.freeze({
    "required-injected-ports": Policy => {
      assert.throws(() => new Policy(), { name: "TypeError" });
      return "required-ports-enforced";
    },
    "missing-root-default-and-frozen-result": Policy => {
      const policy = new Policy({ repository: { get: () => null },
        profileRegistry: {}, assemblyReader: {} });
      const result = policy.analyze("absent");
      assert.deepEqual(Object.keys(result), ["hasSlots", "hasAnyComponent", "isComplete",
        "filledSlotCount", "totalSlotCount"]);
      assert.equal(result.isComplete, true);
      assert(Object.isFrozen(result));
      return [result.hasSlots, result.isComplete, result.filledSlotCount];
    },
    "single-empty-slot-and-completed-slot": Policy => {
      let child = null;
      const root = { instanceId: "root" };
      const policy = new Policy({ repository: { get: () => root },
        profileRegistry: { resolveForItem: item => item === root ? { slots: [{ id: "slot" }] } : null,
          getSlotCapacity: () => 1 },
        assemblyReader: { getChild: () => child } });
      const empty = policy.analyze("root");
      assert.deepEqual([empty.hasSlots, empty.hasAnyComponent, empty.isComplete,
        empty.filledSlotCount, empty.totalSlotCount], [true, false, false, 0, 1]);
      child = { instanceId: "child" };
      const filled = policy.analyze("root");
      assert.deepEqual([filled.hasSlots, filled.hasAnyComponent, filled.isComplete,
        filled.filledSlotCount, filled.totalSlotCount], [true, true, true, 1, 1]);
      assert(Object.isFrozen(empty) && Object.isFrozen(filled));
      return [empty.isComplete, filled.isComplete];
    },
  }),
});

module.exports = { BATCH_012_EXECUTABLE_CASES };
