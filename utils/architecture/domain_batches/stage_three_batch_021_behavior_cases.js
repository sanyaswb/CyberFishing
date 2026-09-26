"use strict";

const assert = require("node:assert/strict");

const attempt = action => {
  try {
    return { value: action() };
  } catch (error) {
    return { error: { name: error.name, message: error.message } };
  }
};
const deepFrozen = value => !value || typeof value !== "object" ||
  (Object.isFrozen(value) && Object.values(value).every(deepFrozen));
const frozenTable = table => {
  assert(Object.isFrozen(table));
  return { entries: Object.entries(table), frozen: Object.isFrozen(table) };
};

const BATCH_021_EXECUTABLE_CASES = Object.freeze({
  AutoRefillTrigger: Object.freeze({ "frozen-trigger-table": frozenTable }),
  AutoRefillScope: Object.freeze({ "frozen-scope-table": frozenTable }),
  AutoRefillSettings: Object.freeze({
    "defaults-toggles-and-snapshot": Settings => {
      const settings = new Settings();
      const before = settings.snapshot();
      settings.setAutoBait(true).setAutoChum("yes");
      const mixed = settings.snapshot();
      settings.setAutoChum(true);
      assert(Object.isFrozen(before) && Object.isFrozen(mixed));
      return { before, mixed, after: settings.snapshot(), getters: [settings.autoBait, settings.autoChum],
        strict: new Settings({ autoBait: 1, autoChum: true }).snapshot() };
    },
  }),
  AutoRefillMemory: Object.freeze({
    "remember-forget-clone-and-snapshot": Memory => {
      const memory = new Memory({ "rod.bait": { key: "worm", nested: { a: 1 } }, ignored: null });
      const read = memory.get("rod.bait");
      read.key = "mutated";
      memory.remember("rod.chum", { key: "bread" }).remember("", { key: "x" }).remember("k", null);
      const beforeForget = memory.snapshot();
      memory.forget("rod.bait");
      assert(Object.isFrozen(beforeForget));
      return { reread: memory.get("rod.bait"), beforeForget, after: memory.snapshot(),
        missing: memory.get("nope"), empty: new Memory(null).snapshot() };
    },
  }),
  AutoRefillPolicy: Object.freeze({
    "trigger-scope-resolution": Policy => {
      const run = settings => {
        const policy = new Policy({ settings });
        return ["rod-retrieved", "hand-chum-used", "boat-returned", "unknown"].map(trigger =>
          policy.resolveScopes(trigger, { allBaysEmptied: true, hasReturnedToPlayer: true }));
      };
      const results = [run(null), run({ autoBait: true, autoChum: true }), run({ autoBait: false, autoChum: true })];
      const policy = new Policy({ settings: { autoBait: true, autoChum: true } });
      results.push([policy.resolveScopes("boat-returned", { allSectionsUsed: true, isAtPlayer: true }),
        policy.resolveScopes("boat-returned", { allBaysEmptied: true }), policy.resolveScopes("boat-returned")]);
      assert(results.flat().every(Object.isFrozen));
      return results;
    },
  }),
  ExactItemSignaturePolicy: Object.freeze({
    "ignored-keys-canonical-properties-and-freeze": Policy => {
      const policy = new Policy();
      const item = { itemId: "reel_x", instanceId: "1", quantity: 2, ratingPercent: 30, quality: 7,
        stats: { gear: 5.2, drag: 4, empty: undefined }, list: [{ b: 2, a: 1 }] };
      const signature = policy.create(item);
      assert(deepFrozen(signature));
      return { signature, matches: [policy.matches({ ...item, instanceId: "2" }, signature),
        policy.matches({ ...item, quality: 8 }, signature), policy.matches(null, signature)] };
    },
    "keys-errors-and-static-privacy": Policy => {
      const policy = new Policy();
      return { keys: [policy.toKey({ key: 7 }), policy.toKey({ properties: { b: 1, a: 2 } }), policy.toKey(undefined)],
        errors: [attempt(() => policy.create(null)), attempt(() => policy.create({}))],
        staticKeys: Object.getOwnPropertyNames(Policy).filter(name =>
          !["length", "name", "prototype"].includes(name)).sort() };
    },
  }),
});

module.exports = { BATCH_021_EXECUTABLE_CASES };
