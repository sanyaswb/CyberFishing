const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console });
// Explicit imports also load retired shims in this test realm.
const { NativeEsmTestLoader } = require("./testing/runtime/native_esm_test_loader");
new NativeEsmTestLoader({ projectRoot: root, context }).loadAll([
  "src/game/presentation/inventory/equipment_slot_presentation.js",
  "src/game/presentation/inventory/inventory_rule_messages.js",
  "src/game/domain/inventory/inventory_item_location.js",
  "src/game/domain/inventory/flat_inventory_item_repository.js",
  "src/game/domain/line/line_allocation_policy.js",
  "src/game/application/inventory/inventory_line_allocation_service.js"
]);

vm.runInContext(`(() => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  let sequence = 0;
  const repository = new FlatInventoryItemRepository({
    items: [{
      instanceId: "line-25",
      itemId: "line-basic",
      quantity: 1,
      statOverrides: {
        lengthMeters: 25,
        diameterMm: 0.22,
        maxLoadKg: 1,
        durability: 100,
        quality: 5,
      },
      rarity: { tier: 1 },
      location: InventoryItemLocation.inventory(),
    }],
  });
  const hydrate = (raw) => ({
    id: raw.itemId,
    itemType: "fishing_line",
    ...raw,
    effectiveStats: { ...raw.statOverrides },
  });
  const service = new InventoryV2LineAllocationService({
    repository,
    itemReader: hydrate,
    lineConfig: { rodLengthReserveMultiplier: 2 },
    // Composed the way InventoryV2CompositionRoot composes it, with the player-facing texts.
    linePolicy: new LineAllocationPolicy({ rodLengthReserveMultiplier: 2 }, {
      messages: INVENTORY_RULE_MESSAGES,
    }),
    instanceIdFactory: () => "line-segment-" + (++sequence),
  });
  const rod = { itemType: "rod", variant: "feeder", effectiveStats: { hasReel: true, lengthMeters: 3 } };
  const reel = { itemType: "reel", variant: "spinning_reel", effectiveStats: { lineCapacityMeters: 20 } };

  const prepared = service.prepare({
    sourceInstanceId: "line-25",
    rod,
    reel,
  });
  assert(prepared.success, "25m line should be accepted by the 20m reel");
  assert(service.getLengthMeters(prepared.instanceId) === 20,
    "equipped line segment must be exactly 20m");
  assert(service.getLengthMeters("line-25") === 5,
    "the 5m remainder must stay in inventory");

})()`, context);

// Custody, merge and break behavior are verified with a real reel parent.
vm.runInContext(`(() => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  let sequence = 0;
  const repository = new FlatInventoryItemRepository({
    items: [
      { instanceId: "reel-root", itemId: "reel", quantity: 1,
        location: InventoryItemLocation.inventory() },
      { instanceId: "line-25", itemId: "line-basic", quantity: 1,
        statOverrides: { lengthMeters: 25, diameterMm: 0.22, maxLoadKg: 1,
          durability: 100, quality: 5 }, rarity: { tier: 1 },
        location: InventoryItemLocation.inventory() },
    ],
  });
  const hydrate = (raw) => raw.itemId === "reel"
    ? { itemType: "reel", variant: "spinning_reel", effectiveStats: {}, ...raw }
    : { id: raw.itemId, itemType: "fishing_line", ...raw,
        effectiveStats: { ...raw.statOverrides } };
  const service = new InventoryV2LineAllocationService({
    repository,
    itemReader: hydrate,
    lineConfig: { rodLengthReserveMultiplier: 2 },
    // Composed the way InventoryV2CompositionRoot composes it, with the player-facing texts.
    linePolicy: new LineAllocationPolicy({ rodLengthReserveMultiplier: 2 }, {
      messages: INVENTORY_RULE_MESSAGES,
    }),
    instanceIdFactory: () => "line-segment-" + (++sequence),
  });
  const prepared = service.prepare({
    sourceInstanceId: "line-25",
    rod: { itemType: "rod", variant: "feeder", effectiveStats: { hasReel: true, lengthMeters: 3 } },
    reel: { itemType: "reel", variant: "spinning_reel", effectiveStats: { lineCapacityMeters: 20 } },
  });
  repository.setLocation(
    prepared.instanceId,
    InventoryItemLocation.attached("reel-root", "line", 0),
  );
  const released = service.release(prepared.instanceId);
  assert(released.merged, "detached segment should merge into its 5m source");
  assert(service.getLengthMeters("line-25") === 25,
    "release must restore the original 25m length");
  assert(!repository.has(prepared.instanceId),
    "merged segment must be removed");

  const preparedAgain = service.prepare({
    sourceInstanceId: "line-25",
    rod: { itemType: "rod", variant: "feeder", effectiveStats: { hasReel: true, lengthMeters: 3 } },
    reel: { itemType: "reel", variant: "spinning_reel", effectiveStats: { lineCapacityMeters: 20 } },
  });
  const damaged = service.break(preparedAgain.instanceId, 7.5);
  assert(damaged.success && !damaged.depleted,
    "partial line break should preserve the segment");
  assert(damaged.remainingLengthMeters === 12.5,
    "line break must subtract exact lost meters");
  const depleted = service.break(preparedAgain.instanceId, 99);
  assert(depleted.success && depleted.depleted,
    "full line loss must remove the segment");
  assert(!repository.has(preparedAgain.instanceId),
    "depleted segment must leave the repository");
})()`, context);

console.log("Inventory-v2 line allocation checks passed.");
