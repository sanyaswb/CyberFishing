"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value, (_key, item) => {
  if (item === undefined) return "#undefined";
  return item;
}));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: error.name }; }
};
const methods = Type => Object.getOwnPropertyNames(Type.prototype).sort();

const stamp = "2026-10-01T00:00:00.000Z";
const LOADOUTS = [
  { loadoutId: "l1", name: "Перший", rootInstanceIds: { rod: "rod_1", reel: "reel_1" }, createdAt: stamp, updatedAt: stamp },
  { loadoutId: "l2", rootInstanceIds: { rod: "rod_2", float: "float_2" }, createdAt: stamp, updatedAt: stamp },
];

const EXECUTABLE_CASES = Object.freeze({
  EquipmentLoadoutRepository: Object.freeze({
    "loadout-store-add-remove-find-and-snapshot-restore": Repository => {
      const repository = new Repository({ loadouts: LOADOUTS });
      const reads = () => ({ list: repository.list().map(loadout => loadout.snapshot()),
        has: ["l1", "l2", "l3"].map(id => repository.has(id)), get: repository.get("l3"),
        byRoot: ["rod_1", "float_2", "none"].map(id => repository.findByRootInstanceId(id)?.loadoutId ?? null),
        snapshot: repository.toSnapshot(), created: repository.createSnapshot() });
      const before = reads();
      const writes = [attempt(() => repository.add({ loadoutId: "l3", rootInstanceIds: { rod: "rod_3" }, createdAt: stamp,
        updatedAt: stamp }).snapshot()), attempt(() => repository.add(LOADOUTS[0])), attempt(() => repository.require("none")),
      attempt(() => repository.remove("l2").snapshot()), attempt(() => repository.remove("l2"))];
      const after = reads();
      const saved = JSON.parse(JSON.stringify(repository.createSnapshot()));
      const restored = new Repository();
      const identity = restored;
      restored.restoreSnapshot(saved);
      const duplicate = attempt(() => restored.restoreSnapshot([saved[0], saved[0]]));
      const keptAfterDuplicate = restored.toSnapshot();
      restored.restoreSnapshot(null);
      return { methods: methods(Repository), before, writes, after, saved, restored: keptAfterDuplicate,
        identity: identity === restored, duplicate, empty: [restored.list().length, restored.has("l1")],
        listCopies: repository.list() !== repository.list(),
        invalid: [attempt(() => new Repository({ loadouts: [LOADOUTS[0], LOADOUTS[0]] })),
          attempt(() => new Repository({ loadouts: null }).list().length), attempt(() => new Repository(null))] };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    EquipmentLoadoutRepository: ["loadout-store-add-remove-find-and-snapshot-restore"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-one-exact-export",
    "one-exact-completed-prefix-import-bound-to-the-cumulative-instance",
    "one-reviewed-global-this-exposure-moved-to-the-activation-shim",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "two-exact-classic-consumer-relationships-and-one-retired-bridge",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
