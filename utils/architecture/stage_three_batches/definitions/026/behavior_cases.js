"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value));
const inventory = { kind: "INVENTORY" };
const item = fields => ({ itemId: "hook-basic", location: inventory, instanceId: "a", quantity: 1, ...fields });

// Batch 026: ItemAssemblyStackingPolicy decides whether two assembly records may share a stack.
// Every case runs on the classic baseline and the ESM target with the same InventoryItemLocation.
const EXECUTABLE_CASES = Object.freeze({
  ItemAssemblyStackingPolicy: Object.freeze({
    "missing-inputs-item-ids-and-locations": Policy => {
      const policy = new Policy();
      return [
        policy.canStack(null, item()), policy.canStack(item(), undefined), policy.canStack(undefined, undefined),
        policy.canStack(item(), item({ itemId: "hook-sharp" })),
        policy.canStack(item(), item()),
        policy.canStack(item({ location: { kind: "ATTACHED", parentInstanceId: "rod", slotId: "hook", slotIndex: 0 } }), item()),
        policy.canStack(item(), item({ location: { kind: "LOADOUT", loadoutId: "main", slotId: "hook" } })),
        policy.canStack(item({ location: undefined }), item()),
        policy.canStack(item({ location: null }), item({ location: null })),
      ];
    },
    "ignored-keys-nested-order-arrays-and-primitives": Policy => {
      const policy = new Policy();
      const stats = { power: 3, quality: { grade: "B", points: [1, 2] } };
      return [
        policy.canStack(item({ instanceId: "a", quantity: 1 }), item({ instanceId: "b", quantity: 40 })),
        policy.canStack(item({ stats }), item({ stats: { quality: { points: [1, 2], grade: "B" }, power: 3 } })),
        policy.canStack(item({ stats }), item({ stats: { ...stats, power: 4 } })),
        policy.canStack(item({ stats }), item({ stats: { ...stats, quality: { grade: "B", points: [2, 1] } } })),
        policy.canStack(item({ tags: ["a", "b"] }), item({ tags: ["a", "b"] })),
        policy.canStack(item({ tags: ["a", "b"] }), item({ tags: ["b", "a"] })),
        policy.canStack(item({ level: 1 }), item({ level: "1" })),
        policy.canStack(item({ level: null }), item({ level: undefined })),
        policy.canStack(item({ level: undefined }), item()),
        policy.canStack(item({ extra: 0 }), item()),
        policy.canStack(item({ note: "x" }), item({ note: "x" })),
        policy.canStack(item({ flag: true }), item({ flag: false })),
      ];
    },
    "repeated-calls-unchanged-inputs-and-location-identity": Policy => {
      const policy = new Policy();
      const left = item({ stats: { b: 1, a: [2, { d: 4, c: 3 }] } });
      const right = item({ instanceId: "z", quantity: 9, stats: { a: [2, { c: 3, d: 4 }], b: 1 } });
      const before = snapshot([left, right]);
      const first = policy.canStack(left, right);
      const second = policy.canStack(left, right);
      const reversed = policy.canStack(right, left);
      const fresh = new Policy().canStack(left, right);
      return { first, second, reversed, fresh, inputsUnchanged: JSON.stringify(before) === JSON.stringify([left, right]),
        frozenLocation: policy.canStack(item({ location: Object.freeze({ kind: "INVENTORY" }) }), item()) };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    ItemAssemblyStackingPolicy: ["missing-inputs-item-ids-and-locations",
      "ignored-keys-nested-order-arrays-and-primitives", "repeated-calls-unchanged-inputs-and-location-identity"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-one-exact-export",
    "one-exact-completed-prefix-import-bound-to-the-cumulative-instance",
    "one-reviewed-private-static-literal-set-evaluated-once",
    "one-esm-evaluation-without-other-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "three-exact-classic-consumer-relationships-and-one-retired-bridge",
    "static-ignored-keys-set-identity-preserved",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
